/**
 * 🆕 2026-07-15 소셜 자동화 — 숏폼 영상 렌더 게이트웨이(스토리보드 → mp4 URL).
 *
 * Worker 는 픽셀 렌더 불가(ffmpeg 없음) → 외부 템플릿 렌더 API 에 위임.
 * provider-agnostic + 킬스위치(SOCIAL_VIDEO_ENABLED) + 키 없으면 NOT_CONFIGURED + fail-soft.
 * 기본 provider = Creatomate(JSON source/template → mp4, 비동기: submit → poll).
 *   운영 팁: SOCIAL_VIDEO_TEMPLATE_ID 로 디자인된 템플릿에 자막만 주입하면 품질↑.
 * ⚠️ 이 작업환경 egress 차단으로 실호출 미검증(media-gateway 와 동일 — provider docs 기준 배선).
 */
import type { Env } from '../../../worker/types/env'
import type { Storyboard } from './social-video'

type E = Record<string, string | undefined>

export function videoRenderEnabled(env: Env): boolean {
  return (env as unknown as E).SOCIAL_VIDEO_ENABLED === 'true'
}
export function videoRenderProvider(env: Env): string | null {
  const e = env as unknown as E
  const pref = e.SOCIAL_VIDEO_PROVIDER || 'creatomate'
  if (pref === 'creatomate') return e.SOCIAL_VIDEO_RENDER_KEY ? 'creatomate' : null
  return null
}
export function videoRenderStatus(env: Env): { enabled: boolean; provider: string | null } {
  const on = videoRenderEnabled(env)
  return { enabled: on, provider: on ? videoRenderProvider(env) : null }
}

export interface RenderSubmit { ok: boolean; providerJobId?: string; status?: string; url?: string; error?: string }
export interface RenderPoll { ok: boolean; status?: string; url?: string; error?: string }

/** Creatomate source 를 스토리보드에서 구성(자막 슬라이드쇼, 9:16). 템플릿 지정 시 그쪽 우선. */
function buildCreatomateBody(env: Env, sb: Storyboard): Record<string, unknown> {
  const templateId = (env as unknown as E).SOCIAL_VIDEO_TEMPLATE_ID
  if (templateId) {
    // 디자인된 템플릿 + 자막 주입(요소 이름 규칙: Scene-1-Text …). 운영자가 템플릿에 맞춰 조정.
    const modifications: Record<string, string> = { 'Title': sb.title }
    sb.scenes.forEach((s, i) => { modifications[`Scene-${i + 1}-Text`] = s.onScreenText || s.narration })
    return { template_id: templateId, modifications }
  }
  // 템플릿 없으면 기본 자막 슬라이드쇼 source 구성.
  const palette = ['#111827', '#0f766e', '#7c3aed', '#b45309', '#be123c', '#1d4ed8']
  const elements = sb.scenes.map((s, i) => ({
    type: 'composition',
    duration: s.durationSec,
    elements: [
      { type: 'shape', width: '100%', height: '100%', fill_color: palette[i % palette.length] },
      { type: 'text', text: s.onScreenText || s.narration, x: '50%', y: '50%', width: '86%',
        font_family: 'Noto Sans KR', font_weight: '700', font_size: '9 vmin', fill_color: '#ffffff', text_alignment: 'center' },
    ],
  }))
  return { output_format: 'mp4', width: 1080, height: 1920, source: { elements } }
}

/** 스토리보드 렌더 제출. 비동기(processing) 또는 즉시 URL. */
export async function submitVideoRender(env: Env, sb: Storyboard): Promise<RenderSubmit> {
  if (!videoRenderEnabled(env)) return { ok: false, error: 'DISABLED' }
  const provider = videoRenderProvider(env)
  if (!provider) return { ok: false, error: 'NOT_CONFIGURED' }
  const key = (env as unknown as E).SOCIAL_VIDEO_RENDER_KEY
  try {
    // Creatomate POST /v1/renders — docs 기준. ⚠️ 실호출 미검증.
    const res = await fetch('https://api.creatomate.com/v1/renders', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify(buildCreatomateBody(env, sb)),
    }).catch(() => null)
    if (!res) return { ok: false, error: '영상 렌더 호출 실패(네트워크)' }
    const data = (await res.json().catch(() => null)) as Array<{ id?: string; status?: string; url?: string }> | { id?: string; status?: string; url?: string } | null
    if (!res.ok) return { ok: false, error: `영상 렌더 제출 실패(HTTP ${res.status})` }
    const first = Array.isArray(data) ? data[0] : data
    if (!first?.id) return { ok: false, error: '렌더 응답에 작업 ID 없음' }
    return { ok: true, providerJobId: first.id, status: first.status || 'processing', url: first.url }
  } catch { return { ok: false, error: '영상 렌더 제출 중 오류' } }
}

/** 렌더 상태 폴링 → done 시 url. */
export async function pollVideoRender(env: Env, providerJobId: string): Promise<RenderPoll> {
  const provider = videoRenderProvider(env)
  if (!provider) return { ok: false, error: 'NOT_CONFIGURED' }
  const key = (env as unknown as E).SOCIAL_VIDEO_RENDER_KEY
  try {
    const res = await fetch(`https://api.creatomate.com/v1/renders/${encodeURIComponent(providerJobId)}`, {
      headers: { authorization: `Bearer ${key}` },
    }).catch(() => null)
    if (!res || !res.ok) return { ok: false, error: `렌더 상태 조회 실패(HTTP ${res?.status || 'network'})` }
    const data = (await res.json().catch(() => null)) as { status?: string; url?: string } | null
    const st = data?.status
    if (st === 'succeeded') return { ok: true, status: 'done', url: data?.url }
    if (st === 'failed') return { ok: true, status: 'failed' }
    return { ok: true, status: 'processing' }
  } catch { return { ok: false, error: '렌더 상태 조회 중 오류' } }
}
