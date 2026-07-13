/**
 * 🆕 2026-07-13 유어애즈 — 인플루언서 발굴/연락처 수집 (대표 "지금 무조건 수집").
 *
 *   ⚖️ 합법·즉시 동작 경로: **YouTube Data API v3**(공식, `YOUTUBE_API_KEY` 보유, OAuth·승인 불필요).
 *   키워드로 채널을 검색해 공개 지표(구독자/조회수)를 얻고, **API가 공식 반환하는 채널 설명(description)
 *   텍스트에서** 크리에이터가 스스로 공개한 비즈니스 이메일 + 인스타/틱톡 링크를 추출한다
 *   (숨겨진 필드 스크래핑이 아니라 공개 텍스트 파싱 — 유튜버는 설명란에 타 SNS·문의처를 교차게시하므로
 *   유튜브 1개 API 로 3플랫폼 핸들+연락처를 동시에 수집 가능).
 *
 *   ⚠️ 수집은 합법이나 **활용은 별개**: 수집한 이메일/연락처로 광고성 정보를 보내려면 정보통신망법상
 *   사전 수신동의가 필요(콜드 발송 위법). 이 모듈은 수집·정리까지만 담당 — 발송 자동화는 하지 않는다.
 *   개인정보 최소화: 원시 IP/UA 등은 저장 안 하고, 크리에이터가 공개한 비즈니스 컨택만 기록.
 */

const YT_BASE = 'https://www.googleapis.com/youtube/v3'

export interface ExtractedContacts { emails: string[]; instagram: string[]; tiktok: string[]; links: string[] }

const EMAIL_RE = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g
const IG_RE = /(?:instagram\.com|instagr\.am)\/([A-Za-z0-9_.]{2,40})/gi
const TT_RE = /tiktok\.com\/@?([A-Za-z0-9_.]{2,40})/gi
const LINKINBIO_RE = /(?:linktr\.ee|litt\.ly|inpock\.co\.kr|litelink\.at|link\.bio|taplink\.cc)\/[A-Za-z0-9_.\-/]{1,60}/gi
// 이메일 오탐 필터 — 이미지/파일 확장자로 끝나는 건 컨택 아님.
const NOT_EMAIL_SUFFIX = /\.(png|jpg|jpeg|gif|webp|svg|mp4|webm)$/i

const uniqLower = (arr: string[]): string[] => Array.from(new Set(arr.map(s => s.trim().toLowerCase()))).filter(Boolean)

/** 공개 텍스트(채널/영상 설명)에서 컨택 추출 — 순수함수(단위테스트 잠금). */
export function extractContacts(text: string): ExtractedContacts {
  const t = String(text || '')
  const emails = uniqLower((t.match(EMAIL_RE) || []).filter(e => !NOT_EMAIL_SUFFIX.test(e))).slice(0, 5)
  const instagram = uniqLower(Array.from(t.matchAll(IG_RE), m => m[1]).filter(h => !['p', 'reel', 'reels', 'explore', 'stories', 'tv'].includes(h.toLowerCase()))).slice(0, 5)
  const tiktok = uniqLower(Array.from(t.matchAll(TT_RE), m => m[1]).filter(h => !['video', 'tag', 'discover'].includes(h.toLowerCase()))).slice(0, 5)
  const links = uniqLower(t.match(LINKINBIO_RE) || []).slice(0, 5)
  return { emails, instagram, tiktok, links }
}

export interface InfluencerLead {
  platform: string; channel_id: string; handle: string | null; name: string; url: string
  subscriber_count: number; view_count: number; video_count: number
  country: string | null; thumbnail: string | null
  email: string | null; instagram: string | null; tiktok: string | null; links: string | null
  description: string
}

interface YTSearchResp { items?: Array<{ id?: { channelId?: string } }>; error?: { message?: string; errors?: Array<{ reason?: string }> } }
interface YTChannelsResp {
  items?: Array<{
    id: string
    snippet?: { title?: string; description?: string; customUrl?: string; country?: string; thumbnails?: { default?: { url?: string }; medium?: { url?: string } } }
    statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string; hiddenSubscriberCount?: boolean }
    brandingSettings?: { channel?: { description?: string } }
  }>
  error?: { message?: string; errors?: Array<{ reason?: string }> }
}

export type DiscoverResult =
  | { ok: true; leads: InfluencerLead[] }
  | { ok: false; error: 'NOT_CONFIGURED' | 'QUOTA' | 'FAILED'; message?: string }

/** YouTube Data API 로 키워드 채널 발굴 + 컨택 추출. maxResults 1~25(quota: search=100 units/call). */
export async function discoverYouTubeInfluencers(
  env: { YOUTUBE_API_KEY?: string }, keyword: string, opts: { maxResults?: number } = {},
): Promise<DiscoverResult> {
  const key = env.YOUTUBE_API_KEY
  if (!key) return { ok: false, error: 'NOT_CONFIGURED' }
  const q = (keyword || '').trim()
  if (q.length < 2) return { ok: false, error: 'FAILED', message: '키워드를 2자 이상 입력해주세요' }
  const n = Math.min(25, Math.max(1, Math.round(opts.maxResults || 15)))

  // 1) 채널 검색(한국 우선).
  const searchUrl = `${YT_BASE}/search?part=snippet&type=channel&maxResults=${n}&order=relevance&regionCode=KR&relevanceLanguage=ko&q=${encodeURIComponent(q)}&key=${key}`
  let searchData: YTSearchResp
  try {
    const res = await fetch(searchUrl, { signal: AbortSignal.timeout(15000) })
    searchData = await res.json() as YTSearchResp
    if (!res.ok) {
      const reason = searchData.error?.errors?.[0]?.reason || ''
      if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') return { ok: false, error: 'QUOTA', message: '오늘 YouTube 조회 한도에 도달했습니다. 내일 다시 시도해주세요.' }
      // Google 사유를 그대로 노출(키/시크릿 아님 — accessNotConfigured/keyInvalid/ipRefererBlocked 등 진단용).
      const detail = reason || searchData.error?.message || `HTTP ${res.status}`
      return { ok: false, error: 'FAILED', message: `YouTube 검색 실패: ${detail}` }
    }
  } catch (e) { return { ok: false, error: 'FAILED', message: `검색 요청 오류: ${(e as Error)?.message || 'network'}` } }

  const channelIds = (searchData.items || []).map(i => i.id?.channelId).filter((x): x is string => !!x)
  if (!channelIds.length) return { ok: true, leads: [] }

  // 2) 채널 상세(지표 + 설명 + 브랜딩).
  const chUrl = `${YT_BASE}/channels?part=snippet,statistics,brandingSettings&id=${channelIds.join(',')}&maxResults=50&key=${key}`
  let chData: YTChannelsResp
  try {
    const res = await fetch(chUrl, { signal: AbortSignal.timeout(15000) })
    chData = await res.json() as YTChannelsResp
    if (!res.ok) {
      const reason = chData.error?.errors?.[0]?.reason || ''
      if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') return { ok: false, error: 'QUOTA', message: '오늘 YouTube 조회 한도에 도달했습니다.' }
      return { ok: false, error: 'FAILED', message: '채널 정보를 불러오지 못했습니다' }
    }
  } catch { return { ok: false, error: 'FAILED', message: '채널 요청 중 오류가 발생했습니다' } }

  const leads: InfluencerLead[] = (chData.items || []).map(ch => {
    const desc = `${ch.snippet?.description || ''}\n${ch.brandingSettings?.channel?.description || ''}`.trim()
    const c = extractContacts(desc)
    const custom = ch.snippet?.customUrl || null
    return {
      platform: 'youtube',
      channel_id: ch.id,
      handle: custom,
      name: ch.snippet?.title || '(이름 없음)',
      url: custom ? `https://www.youtube.com/${custom.startsWith('@') ? custom : '@' + custom}` : `https://www.youtube.com/channel/${ch.id}`,
      subscriber_count: ch.statistics?.hiddenSubscriberCount ? 0 : parseInt(ch.statistics?.subscriberCount || '0', 10) || 0,
      view_count: parseInt(ch.statistics?.viewCount || '0', 10) || 0,
      video_count: parseInt(ch.statistics?.videoCount || '0', 10) || 0,
      country: ch.snippet?.country || null,
      thumbnail: ch.snippet?.thumbnails?.medium?.url || ch.snippet?.thumbnails?.default?.url || null,
      email: c.emails[0] || null,
      instagram: c.instagram[0] || null,
      tiktok: c.tiktok[0] || null,
      links: c.links.length ? c.links.join(' ') : null,
      description: desc.slice(0, 500),
    }
  })
  // 구독자 많은 순.
  leads.sort((a, b) => b.subscriber_count - a.subscriber_count)
  return { ok: true, leads }
}

// ── 저장/관리 (계정별 리드 DB) ────────────────────────────────────────────────
export interface LeadRow extends InfluencerLead { id: number; status: string; memo: string | null; collected_at: string }

const _schemaDone = new WeakSet<object>()
export async function ensureInfluencerSchema(DB: D1Database): Promise<void> {
  if (_schemaDone.has(DB)) return
  _schemaDone.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_influencer_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    platform TEXT NOT NULL DEFAULT 'youtube',
    channel_id TEXT NOT NULL,
    handle TEXT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    subscriber_count INTEGER NOT NULL DEFAULT 0,
    view_count INTEGER NOT NULL DEFAULT 0,
    video_count INTEGER NOT NULL DEFAULT 0,
    country TEXT,
    thumbnail TEXT,
    email TEXT,
    instagram TEXT,
    tiktok TEXT,
    links TEXT,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    memo TEXT,
    collected_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(account_id, platform, channel_id)
  )`).run().catch(() => null)
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_ad_inf_leads_acct ON ad_influencer_leads(account_id, id)').run().catch(() => null)
}

/** 발굴 결과를 계정 DB 에 저장(멱등 — 이미 있는 채널은 skip, 수동편집 보존). 반환: 신규 저장 수. */
export async function saveInfluencerLeads(DB: D1Database, accountId: number, leads: InfluencerLead[]): Promise<number> {
  await ensureInfluencerSchema(DB)
  let saved = 0
  for (const l of leads) {
    const r = await DB.prepare(`INSERT OR IGNORE INTO ad_influencer_leads
      (account_id, platform, channel_id, handle, name, url, subscriber_count, view_count, video_count, country, thumbnail, email, instagram, tiktok, links, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(accountId, l.platform, l.channel_id, l.handle, l.name.slice(0, 120), l.url, l.subscriber_count, l.view_count, l.video_count,
        l.country, l.thumbnail, l.email, l.instagram, l.tiktok, l.links, l.description.slice(0, 500))
      .run().catch(() => null)
    if (r?.meta?.changes === 1) saved++
  }
  return saved
}

export async function listInfluencerLeads(DB: D1Database, accountId: number, filter: { status?: string; hasContact?: boolean } = {}): Promise<LeadRow[]> {
  await ensureInfluencerSchema(DB)
  const where = ['account_id = ?']
  const binds: (string | number)[] = [accountId]
  if (filter.status && ['new', 'contacted', 'rejected'].includes(filter.status)) { where.push('status = ?'); binds.push(filter.status) }
  if (filter.hasContact) where.push('(email IS NOT NULL OR instagram IS NOT NULL OR tiktok IS NOT NULL OR links IS NOT NULL)')
  const r = await DB.prepare(`SELECT id, platform, channel_id, handle, name, url, subscriber_count, view_count, video_count, country, thumbnail, email, instagram, tiktok, links, description, status, memo, collected_at
    FROM ad_influencer_leads WHERE ${where.join(' AND ')} ORDER BY subscriber_count DESC, id DESC LIMIT 500`)
    .bind(...binds).all<LeadRow>().catch(() => null)
  return r?.results || []
}

export async function updateInfluencerLead(DB: D1Database, accountId: number, id: number, patch: { status?: string; memo?: string }): Promise<{ ok: boolean; error?: string }> {
  await ensureInfluencerSchema(DB)
  const sets: string[] = []
  const binds: (string | number | null)[] = []
  if (patch.status !== undefined) {
    if (!['new', 'contacted', 'rejected'].includes(patch.status)) return { ok: false, error: '상태 값이 올바르지 않습니다' }
    sets.push('status = ?'); binds.push(patch.status)
  }
  if (patch.memo !== undefined) { sets.push('memo = ?'); binds.push(patch.memo.slice(0, 500) || null) }
  if (!sets.length) return { ok: false, error: '변경할 항목이 없습니다' }
  const r = await DB.prepare(`UPDATE ad_influencer_leads SET ${sets.join(', ')} WHERE id = ? AND account_id = ?`).bind(...binds, id, accountId).run().catch(() => null)
  if (!r || r.meta?.changes === 0) return { ok: false, error: '리드를 찾을 수 없습니다' }
  return { ok: true }
}

export async function deleteInfluencerLead(DB: D1Database, accountId: number, id: number): Promise<{ ok: boolean; error?: string }> {
  await ensureInfluencerSchema(DB)
  const r = await DB.prepare('DELETE FROM ad_influencer_leads WHERE id = ? AND account_id = ?').bind(id, accountId).run().catch(() => null)
  if (!r || r.meta?.changes === 0) return { ok: false, error: '리드를 찾을 수 없습니다' }
  return { ok: true }
}
