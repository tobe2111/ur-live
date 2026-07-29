/**
 * 🆕 2026-07-02 유어애즈 콘텐츠 스튜디오 — 미디어 생성 provider 게이트웨이.
 *
 *   철학(toss-gateway 와 동일): **직접 fetch 금지 — 모든 미디어 생성은 이 게이트웨이를 경유**.
 *   provider-agnostic + 킬스위치 + 키 없으면 NOT_CONFIGURED + fail-soft + 자격증명 비노출.
 *
 *   - 이미지: OpenAI Images(`OPENAI_API_KEY`) — 동기(URL 반환).
 *   - 음성(TTS): ElevenLabs(`ELEVENLABS_API_KEY`) — 동기(mp3 → base64 data URL, 짧은 클립).
 *   - 영상(숏폼/아바타): Replicate(`REPLICATE_API_TOKEN`) 또는 HeyGen(`HEYGEN_API_KEY`) — **비동기 잡**
 *     (submit → provider job id 저장 → poll 로 상태 확인). ad_media_jobs 로 추적.
 *
 *   게이트: `ADS_MEDIA_ENABLED==='true'` + 해당 provider 키. 둘 중 하나라도 없으면 실행 안 함.
 *   ⚠️ 이 작업환경은 외부 egress 차단이라 **실호출 미검증** — provider 공식 docs 기준으로 배선.
 */
import type { Env } from '@/worker/types/env'

export type MediaKind = 'image' | 'voice' | 'video'
export interface MediaResult { ok: boolean; kind?: MediaKind; url?: string; jobId?: number; providerJobId?: string; status?: string; provider?: string; error?: string }

const mediaEnabled = (env: Env): boolean => env.ADS_MEDIA_ENABLED === 'true'
const imageProvider = (env: Env): string | null => (env.OPENAI_API_KEY ? (env.ADS_IMAGE_PROVIDER || 'openai') : null)
const voiceProvider = (env: Env): string | null => (env.ELEVENLABS_API_KEY ? 'elevenlabs' : null)
const videoProvider = (env: Env): string | null => {
  const pref = env.ADS_VIDEO_PROVIDER
  if (pref === 'heygen') return env.HEYGEN_API_KEY ? 'heygen' : null
  if (pref === 'replicate') return env.REPLICATE_API_TOKEN ? 'replicate' : null
  if (env.REPLICATE_API_TOKEN) return 'replicate'
  if (env.HEYGEN_API_KEY) return 'heygen'
  return null
}

/** UI/어드민용 — 어떤 미디어가 켜져 있는지(키값 비노출, boolean/provider명만). */
export function mediaStatus(env: Env): { enabled: boolean; image: string | null; voice: string | null; video: string | null } {
  const on = mediaEnabled(env)
  return { enabled: on, image: on ? imageProvider(env) : null, voice: on ? voiceProvider(env) : null, video: on ? videoProvider(env) : null }
}

// ── 스키마 (비동기 잡 추적) ──────────────────────────────────────────────────
const _schemaDone = new WeakSet<object>()
export async function ensureMediaSchema(DB: D1Database): Promise<void> {
  if (_schemaDone.has(DB)) return
  _schemaDone.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_media_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    kind TEXT NOT NULL,
    prompt TEXT,
    provider TEXT,
    provider_job_id TEXT,
    status TEXT NOT NULL DEFAULT 'queued',
    result_url TEXT,
    error TEXT,
    created_at DATETIME DEFAULT (datetime('now')),
    updated_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(() => null)
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_ad_media_acct ON ad_media_jobs(account_id, id)').run().catch(() => null)
}

async function insertJob(DB: D1Database, accountId: number, kind: MediaKind, prompt: string, provider: string): Promise<number> {
  await ensureMediaSchema(DB)
  const r = await DB.prepare("INSERT INTO ad_media_jobs (account_id, kind, prompt, provider, status) VALUES (?, ?, ?, ?, 'processing')")
    .bind(accountId, kind, prompt.slice(0, 500), provider).run().catch(() => null)
  return Number(r?.meta?.last_row_id) || 0
}
async function finishJob(DB: D1Database, id: number, patch: { status: string; result_url?: string; provider_job_id?: string; error?: string }): Promise<void> {
  await DB.prepare("UPDATE ad_media_jobs SET status = ?, result_url = COALESCE(?, result_url), provider_job_id = COALESCE(?, provider_job_id), error = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(patch.status, patch.result_url ?? null, patch.provider_job_id ?? null, patch.error ?? null, id).run().catch(() => null)
}

export async function listMediaJobs(DB: D1Database, accountId: number, limit = 50): Promise<Array<{ id: number; kind: string; prompt: string | null; provider: string | null; status: string; result_url: string | null; error: string | null; created_at: string }>> {
  await ensureMediaSchema(DB)
  const r = await DB.prepare('SELECT id, kind, prompt, provider, status, result_url, error, created_at FROM ad_media_jobs WHERE account_id = ? ORDER BY id DESC LIMIT ?')
    .bind(accountId, Math.min(100, limit)).all().catch(() => null)
  return (r?.results || []) as Array<{ id: number; kind: string; prompt: string | null; provider: string | null; status: string; result_url: string | null; error: string | null; created_at: string }>
}

// ── 이미지 (OpenAI Images) — 동기 ────────────────────────────────────────────
export async function generateImage(env: Env, accountId: number, prompt: string, opts?: { size?: string }): Promise<MediaResult> {
  const p = String(prompt || '').trim()
  if (!p) return { ok: false, error: '이미지 설명(프롬프트)을 입력해주세요' }
  if (!mediaEnabled(env)) return { ok: false, error: 'DISABLED', kind: 'image' }
  const provider = imageProvider(env)
  if (!provider) return { ok: false, error: 'NOT_CONFIGURED', kind: 'image' }
  const jobId = await insertJob(env.DB, accountId, 'image', p, provider)
  try {
    // OpenAI Images (docs 기준). ⚠️ 실호출 미검증(egress 차단).
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: 'gpt-image-1', prompt: p.slice(0, 1000), n: 1, size: opts?.size || '1024x1024' }),
    })
    const data = (await res.json().catch(() => null)) as { data?: Array<{ url?: string; b64_json?: string }> } | null
    if (!res.ok) { await finishJob(env.DB, jobId, { status: 'failed', error: `HTTP ${res.status}` }); return { ok: false, error: `이미지 생성 실패 (HTTP ${res.status})`, kind: 'image', jobId } }
    const d = data?.data?.[0]
    const url = d?.url || (d?.b64_json ? `data:image/png;base64,${d.b64_json}` : null)
    if (!url) { await finishJob(env.DB, jobId, { status: 'failed', error: 'empty' }); return { ok: false, error: '이미지 응답이 비어 있습니다', kind: 'image', jobId } }
    await finishJob(env.DB, jobId, { status: 'done', result_url: url })
    return { ok: true, kind: 'image', url, jobId, status: 'done', provider }
  } catch { await finishJob(env.DB, jobId, { status: 'failed', error: 'network' }); return { ok: false, error: '이미지 생성 중 오류가 발생했습니다', kind: 'image', jobId } }
}

// ── 음성 TTS (ElevenLabs) — 동기(짧은 클립 → data URL) ───────────────────────
export async function generateVoice(env: Env, accountId: number, text: string, opts?: { voiceId?: string }): Promise<MediaResult> {
  const t = String(text || '').trim()
  if (!t) return { ok: false, error: '읽어줄 텍스트를 입력해주세요' }
  if (t.length > 800) return { ok: false, error: '음성 변환은 800자 이내로 입력해주세요' }
  if (!mediaEnabled(env)) return { ok: false, error: 'DISABLED', kind: 'voice' }
  const provider = voiceProvider(env)
  if (!provider) return { ok: false, error: 'NOT_CONFIGURED', kind: 'voice' }
  const jobId = await insertJob(env.DB, accountId, 'voice', t, provider)
  try {
    const voiceId = (opts?.voiceId || '21m00Tcm4TlvDq8ikWAM').replace(/[^a-zA-Z0-9]/g, '')
    // ElevenLabs TTS (docs 기준). ⚠️ 실호출 미검증.
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'xi-api-key': String(env.ELEVENLABS_API_KEY), accept: 'audio/mpeg' },
      body: JSON.stringify({ text: t, model_id: 'eleven_multilingual_v2' }),
    })
    if (!res.ok) { await finishJob(env.DB, jobId, { status: 'failed', error: `HTTP ${res.status}` }); return { ok: false, error: `음성 생성 실패 (HTTP ${res.status})`, kind: 'voice', jobId } }
    const buf = await res.arrayBuffer()
    // 짧은 클립만 data URL 로(대용량 방지 — 약 1MB 상한).
    if (buf.byteLength > 1_500_000) { await finishJob(env.DB, jobId, { status: 'failed', error: 'too_large' }); return { ok: false, error: '음성 파일이 너무 큽니다. 더 짧은 텍스트로 시도해주세요.', kind: 'voice', jobId } }
    let bin = ''
    const bytes = new Uint8Array(buf)
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    const url = `data:audio/mpeg;base64,${btoa(bin)}`
    await finishJob(env.DB, jobId, { status: 'done', result_url: url })
    return { ok: true, kind: 'voice', url, jobId, status: 'done', provider }
  } catch { await finishJob(env.DB, jobId, { status: 'failed', error: 'network' }); return { ok: false, error: '음성 생성 중 오류가 발생했습니다', kind: 'voice', jobId } }
}

// ── 영상 (Replicate / HeyGen) — 비동기 잡(submit → poll) ──────────────────────
export async function submitVideo(env: Env, accountId: number, prompt: string): Promise<MediaResult> {
  const p = String(prompt || '').trim()
  if (!p) return { ok: false, error: '영상 설명(프롬프트)을 입력해주세요' }
  if (!mediaEnabled(env)) return { ok: false, error: 'DISABLED', kind: 'video' }
  const provider = videoProvider(env)
  if (!provider) return { ok: false, error: 'NOT_CONFIGURED', kind: 'video' }
  const jobId = await insertJob(env.DB, accountId, 'video', p, provider)
  try {
    if (provider === 'replicate') {
      // Replicate predictions (docs 기준). 모델 버전은 운영자가 설정하는 것이 이상적 — 여기선 예시.
      const res = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${env.REPLICATE_API_TOKEN}` },
        body: JSON.stringify({ input: { prompt: p.slice(0, 1000) } }),
      })
      const data = (await res.json().catch(() => null)) as { id?: string; status?: string } | null
      if (!res.ok || !data?.id) { await finishJob(env.DB, jobId, { status: 'failed', error: `HTTP ${res.status}` }); return { ok: false, error: `영상 작업 제출 실패 (HTTP ${res.status})`, kind: 'video', jobId } }
      await finishJob(env.DB, jobId, { status: 'processing', provider_job_id: data.id })
      return { ok: true, kind: 'video', jobId, providerJobId: data.id, status: 'processing', provider }
    }
    // heygen — video/generate (docs 기준).
    const res = await fetch('https://api.heygen.com/v2/video/generate', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': String(env.HEYGEN_API_KEY) },
      body: JSON.stringify({ caption: false, dimension: { width: 720, height: 1280 }, title: p.slice(0, 100) }),
    })
    const data = (await res.json().catch(() => null)) as { data?: { video_id?: string } } | null
    const vid = data?.data?.video_id
    if (!res.ok || !vid) { await finishJob(env.DB, jobId, { status: 'failed', error: `HTTP ${res.status}` }); return { ok: false, error: `영상 작업 제출 실패 (HTTP ${res.status})`, kind: 'video', jobId } }
    await finishJob(env.DB, jobId, { status: 'processing', provider_job_id: vid })
    return { ok: true, kind: 'video', jobId, providerJobId: vid, status: 'processing', provider }
  } catch { await finishJob(env.DB, jobId, { status: 'failed', error: 'network' }); return { ok: false, error: '영상 작업 제출 중 오류가 발생했습니다', kind: 'video', jobId } }
}

/** 영상 잡 상태 폴링 — provider 에 물어 done/failed 갱신. 소유 검증(account_id)은 라우트가 선행. */
export async function pollVideo(env: Env, accountId: number, jobId: number): Promise<MediaResult> {
  await ensureMediaSchema(env.DB)
  const row = await env.DB.prepare('SELECT provider, provider_job_id, status, result_url FROM ad_media_jobs WHERE id = ? AND account_id = ? AND kind = ?')
    .bind(jobId, accountId, 'video').first<{ provider: string; provider_job_id: string | null; status: string; result_url: string | null }>().catch(() => null)
  if (!row) return { ok: false, error: '작업을 찾을 수 없습니다' }
  if (row.status === 'done' || row.status === 'failed') return { ok: true, kind: 'video', jobId, status: row.status, url: row.result_url || undefined }
  if (!row.provider_job_id) return { ok: true, kind: 'video', jobId, status: row.status }
  try {
    if (row.provider === 'replicate') {
      const res = await fetch(`https://api.replicate.com/v1/predictions/${encodeURIComponent(row.provider_job_id)}`, { headers: { authorization: `Bearer ${env.REPLICATE_API_TOKEN}` } })
      const data = (await res.json().catch(() => null)) as { status?: string; output?: string | string[] } | null
      const st = data?.status
      if (st === 'succeeded') { const url = Array.isArray(data?.output) ? data?.output[0] : (data?.output || undefined); await finishJob(env.DB, jobId, { status: 'done', result_url: url }); return { ok: true, kind: 'video', jobId, status: 'done', url } }
      if (st === 'failed' || st === 'canceled') { await finishJob(env.DB, jobId, { status: 'failed', error: st }); return { ok: true, kind: 'video', jobId, status: 'failed' } }
      return { ok: true, kind: 'video', jobId, status: 'processing' }
    }
    const res = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${encodeURIComponent(row.provider_job_id)}`, { headers: { 'x-api-key': String(env.HEYGEN_API_KEY) } })
    const data = (await res.json().catch(() => null)) as { data?: { status?: string; video_url?: string } } | null
    const st = data?.data?.status
    if (st === 'completed') { await finishJob(env.DB, jobId, { status: 'done', result_url: data?.data?.video_url }); return { ok: true, kind: 'video', jobId, status: 'done', url: data?.data?.video_url } }
    if (st === 'failed') { await finishJob(env.DB, jobId, { status: 'failed', error: 'provider' }); return { ok: true, kind: 'video', jobId, status: 'failed' } }
    return { ok: true, kind: 'video', jobId, status: 'processing' }
  } catch { return { ok: true, kind: 'video', jobId, status: row.status } }
}
