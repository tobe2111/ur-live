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

// 비즈니스 문의 맥락 키워드 — 이 근처의 이메일이 채널 주인의 컨택일 확률이 높다.
// ⚠️ bare "mail" 은 gmail 등 주소 자체에 오매칭되므로 제외 — 한국어 "메일"/"이메일" 과 명시 문맥어만.
const BIZ_CONTEXT_RE = /(비즈니스|문의|제휴|협찬|광고|연락|섭외|business|inquir|contact|sponsor|collab|partnership|advert|이메일|메일)/i
// 협찬사/서비스/자동응답 등 채널 주인이 아닐 확률이 높은 이메일(감점).
const NON_OWNER_EMAIL_RE = /^(no-?reply|noreply|support|help|admin|contact|info|cs|care|hello|team)@/i

/**
 * 여러 후보 이메일 중 **채널 주인의 비즈니스 이메일**을 고른다(영상 설명은 협찬사 메일 등 노이즈가 많음).
 *   점수: 비즈니스 문맥어(문의/business…) 근처(±40자) +3 · 개인메일 도메인(gmail/naver/daum/kakao/hanmail) +1
 *        · 서비스/자동응답 계정(support@ 등) −2. 동점이면 먼저 등장한 것. 후보 0개면 null.
 */
export function pickBusinessEmail(text: string): string | null {
  const t = String(text || '')
  const raw = uniqLower((t.match(EMAIL_RE) || []).filter(e => !NOT_EMAIL_SUFFIX.test(e))).slice(0, 12)
  if (!raw.length) return null
  const lower = t.toLowerCase()
  let best: string | null = null; let bestScore = -Infinity; let bestIdx = Infinity
  for (const email of raw) {
    const idx = lower.indexOf(email)
    const around = idx >= 0 ? t.slice(Math.max(0, idx - 40), idx + email.length + 10) : ''
    let score = 0
    if (BIZ_CONTEXT_RE.test(around)) score += 3
    if (/@(gmail|naver|daum|kakao|hanmail|nate)\./i.test(email)) score += 1
    if (NON_OWNER_EMAIL_RE.test(email)) score -= 2
    if (score > bestScore || (score === bestScore && idx < bestIdx)) { best = email; bestScore = score; bestIdx = idx }
  }
  return best
}

export interface InfluencerLead {
  platform: string; channel_id: string; handle: string | null; name: string; url: string
  subscriber_count: number; view_count: number; video_count: number
  country: string | null; thumbnail: string | null
  email: string | null; instagram: string | null; tiktok: string | null; links: string | null
  description: string
}

interface YTSearchResp { items?: Array<{ id?: { channelId?: string } }>; nextPageToken?: string; error?: { message?: string; errors?: Array<{ reason?: string }> } }
interface YTChannelsResp {
  items?: Array<{
    id: string
    snippet?: { title?: string; description?: string; customUrl?: string; country?: string; thumbnails?: { default?: { url?: string }; medium?: { url?: string } } }
    statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string; hiddenSubscriberCount?: boolean }
    brandingSettings?: { channel?: { description?: string } }
    contentDetails?: { relatedPlaylists?: { uploads?: string } }
  }>
  error?: { message?: string; errors?: Array<{ reason?: string }> }
}
interface YTPlaylistItemsResp { items?: Array<{ snippet?: { description?: string } }>; error?: { errors?: Array<{ reason?: string }> } }

/** 채널 최근 영상 설명 텍스트 합본을 가져온다(비즈니스 이메일이 About 버튼 뒤가 아니라 영상 더보기에 있는 경우 커버).
 *  playlistItems.list = 1 unit(최대 50개). 실패/쿼터 시 빈 문자열(fail-soft) — 상위에서 다음 search 가 QUOTA 감지. */
async function fetchRecentVideoText(key: string, uploadsPlaylistId: string): Promise<string> {
  try {
    const url = `${YT_BASE}/playlistItems?part=snippet&maxResults=8&playlistId=${uploadsPlaylistId}&key=${key}`
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) })
    const data = await res.json() as YTPlaylistItemsResp
    if (!res.ok) return ''
    return (data.items || []).map(it => it.snippet?.description || '').join('\n')
  } catch { return '' }
}

export type DiscoverResult =
  | { ok: true; leads: InfluencerLead[] }
  | { ok: false; error: 'NOT_CONFIGURED' | 'QUOTA' | 'FAILED'; message?: string }

/** YouTube Data API 로 키워드 채널 발굴 + 컨택 추출.
 *  quota: search=100 units/page · channels.list=1/50ch · playlistItems(enrich)=1/ch.
 *  opts.pages: 검색 페이지 수(1~5, 기본 1) — 키워드당 깊이 확장(page 2=51~100위…). */
export async function discoverYouTubeInfluencers(
  env: { YOUTUBE_API_KEY?: string }, keyword: string, opts: { maxResults?: number; enrichMax?: number; pages?: number } = {},
): Promise<DiscoverResult> {
  const key = env.YOUTUBE_API_KEY
  if (!key) return { ok: false, error: 'NOT_CONFIGURED' }
  const q = (keyword || '').trim()
  if (q.length < 2) return { ok: false, error: 'FAILED', message: '키워드를 2자 이상 입력해주세요' }
  const n = Math.min(50, Math.max(1, Math.round(opts.maxResults || 15)))
  const pages = Math.max(1, Math.min(5, Math.round(opts.pages || 1)))

  // 1) 채널 검색 — pageToken 으로 pages 만큼 깊이 순회(각 page=100 units). 첫 page 실패는 에러, 이후는 있는 만큼 진행.
  const channelIds: string[] = []
  let pageToken = ''
  for (let p = 0; p < pages; p++) {
    const searchUrl = `${YT_BASE}/search?part=snippet&type=channel&maxResults=${n}&order=relevance&regionCode=KR&relevanceLanguage=ko&q=${encodeURIComponent(q)}${pageToken ? `&pageToken=${pageToken}` : ''}&key=${key}`
    let searchData: YTSearchResp
    try {
      const res = await fetch(searchUrl, { signal: AbortSignal.timeout(15000) })
      searchData = await res.json() as YTSearchResp
      if (!res.ok) {
        const reason = searchData.error?.errors?.[0]?.reason || ''
        if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
          if (p === 0) return { ok: false, error: 'QUOTA', message: '오늘 YouTube 조회 한도에 도달했습니다. 내일 다시 시도해주세요.' }
          break // 이후 page 만 실패 — 지금까지 모은 것 계속 처리
        }
        if (p === 0) { const detail = reason || searchData.error?.message || `HTTP ${res.status}`; return { ok: false, error: 'FAILED', message: `YouTube 검색 실패: ${detail}` } }
        break
      }
    } catch (e) { if (p === 0) return { ok: false, error: 'FAILED', message: `검색 요청 오류: ${(e as Error)?.message || 'network'}` }; break }
    for (const it of searchData.items || []) { const id = it.id?.channelId; if (id) channelIds.push(id) }
    pageToken = searchData.nextPageToken || ''
    if (!pageToken) break // 더 깊은 페이지 없음
  }
  const uniqIds = Array.from(new Set(channelIds))
  if (!uniqIds.length) return { ok: true, leads: [] }

  // 2) 채널 상세 — id 50개씩 배치(channels.list 는 1콜당 최대 50 id/1 unit). contentDetails 로 업로드 재생목록.
  const chItems: NonNullable<YTChannelsResp['items']> = []
  for (let i = 0; i < uniqIds.length; i += 50) {
    const batch = uniqIds.slice(i, i + 50)
    const chUrl = `${YT_BASE}/channels?part=snippet,statistics,brandingSettings,contentDetails&id=${batch.join(',')}&maxResults=50&key=${key}`
    try {
      const res = await fetch(chUrl, { signal: AbortSignal.timeout(15000) })
      const chData = await res.json() as YTChannelsResp
      if (!res.ok) {
        const reason = chData.error?.errors?.[0]?.reason || ''
        if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') { if (i === 0) return { ok: false, error: 'QUOTA', message: '오늘 YouTube 조회 한도에 도달했습니다.' }; break }
        if (i === 0) return { ok: false, error: 'FAILED', message: '채널 정보를 불러오지 못했습니다' }; break
      }
      for (const it of chData.items || []) chItems.push(it)
    } catch { if (i === 0) return { ok: false, error: 'FAILED', message: '채널 요청 중 오류가 발생했습니다' }; break }
  }

  const leads: InfluencerLead[] = chItems.map(ch => {
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
      email: pickBusinessEmail(desc), // About 이메일도 비즈니스 문맥 우선 선별
      instagram: c.instagram[0] || null,
      tiktok: c.tiktok[0] || null,
      links: c.links.length ? c.links.join(' ') : null,
      description: desc.slice(0, 500),
      // 업로드 재생목록(영상 설명 보충용 — lead 엔 저장 안 함, 아래 enrich 후 제거).
      _uploads: ch.contentDetails?.relatedPlaylists?.uploads,
    } as InfluencerLead & { _uploads?: string }
  })

  // 3) 📧 이메일 보충 — About 에 이메일 없는 채널만 최근 영상 설명 스캔(playlistItems 1unit/채널, 상한 enrichMax).
  //    유튜브 "이메일 주소 보기" 버튼 값은 CAPTCHA 게이트라 API 불가 → 대신 영상 더보기에 적힌 비즈니스 메일 커버.
  //    노이즈(협찬사 메일 등) 방지: pickBusinessEmail 로 문맥 우선 선별.
  const enrichMax = Math.max(0, Math.min(30, opts.enrichMax ?? 15))
  const targets = (leads as Array<InfluencerLead & { _uploads?: string }>)
    .filter(l => !l.email && l._uploads)
    .sort((a, b) => b.subscriber_count - a.subscriber_count)
    .slice(0, enrichMax)
  for (const l of targets) {
    const vidText = await fetchRecentVideoText(key, l._uploads!)
    if (!vidText) continue
    const c = extractContacts(vidText)
    const bizEmail = pickBusinessEmail(vidText)
    if (bizEmail) l.email = bizEmail
    if (!l.instagram && c.instagram[0]) l.instagram = c.instagram[0]
    if (!l.tiktok && c.tiktok[0]) l.tiktok = c.tiktok[0]
    if (!l.links && c.links.length) l.links = c.links.join(' ')
  }
  // 내부 필드 제거(저장 스키마엔 없음).
  for (const l of leads as Array<InfluencerLead & { _uploads?: string }>) delete l._uploads

  // 구독자 많은 순.
  leads.sort((a, b) => b.subscriber_count - a.subscriber_count)
  return { ok: true, leads }
}

// ── 네이버 블로거 발굴 (네이버 검색 오픈API — 무료, 보유 키) ────────────────────
//   블로그 검색으로 키워드 상위 노출 블로거를 수집(고유 블로거로 집계). 지표는 없고
//   블로그 링크 + 이름 + 매칭 글 수(활동/관련도 프록시) 제공. 연락처는 글 설명에서 best-effort.
const NAVER_OPENAPI = 'https://openapi.naver.com'
const stripTag = (s: string | undefined) => String(s || '').replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').trim()

/** 네이버 블로그 RSS(공개 피드)로 최근 글 본문 텍스트 취득 — 검색 스니펫보다 풍부해 컨택(이메일/카톡/인스타) 커버.
 *  네이버 오픈API 쿼터와 무관(단순 HTTP GET). 실패/차단 시 빈 문자열(fail-soft). */
async function fetchNaverBlogRss(handle: string): Promise<string> {
  if (!/^[A-Za-z0-9_-]{2,40}$/.test(handle)) return ''
  try {
    const res = await fetch(`https://rss.blog.naver.com/${handle}.xml`, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return ''
    return (await res.text()).slice(0, 20000) // 최근 글 몇 개면 충분
  } catch { return '' }
}

export async function discoverNaverBloggers(
  clientId: string | undefined, clientSecret: string | undefined, keyword: string, opts: { display?: number; enrichMax?: number } = {},
): Promise<DiscoverResult> {
  if (!clientId || !clientSecret) return { ok: false, error: 'NOT_CONFIGURED' }
  const q = (keyword || '').trim()
  if (q.length < 2) return { ok: false, error: 'FAILED', message: '키워드를 2자 이상 입력해주세요' }
  const display = Math.min(100, Math.max(10, Math.round(opts.display || 50)))
  const url = `${NAVER_OPENAPI}/v1/search/blog.json?query=${encodeURIComponent(q)}&display=${display}&sort=sim`
  const res = await fetch(url, { headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret }, signal: AbortSignal.timeout(12000) }).catch(() => null)
  if (!res) return { ok: false, error: 'FAILED', message: '블로그 검색 호출 실패 (네트워크)' }
  const data = (await res.json().catch(() => null)) as { items?: Array<{ title?: string; link?: string; description?: string; bloggername?: string; bloggerlink?: string }>; errorMessage?: string } | null
  if (!res.ok) return { ok: false, error: 'FAILED', message: data?.errorMessage || `블로그 검색 오류 (HTTP ${res.status})` }
  // 고유 블로거로 집계(블로그홈 링크 기준).
  const byBlog = new Map<string, InfluencerLead & { _matches: number }>()
  for (const it of (data?.items || [])) {
    const home = String(it.bloggerlink || '').trim()
    if (!home) continue
    const key = home.replace(/\/$/, '')
    const handle = key.replace(/^https?:\/\/(blog\.naver\.com\/)?/, '').replace(/\/.*$/, '') || null
    const text = `${stripTag(it.title)} ${stripTag(it.description)}`
    const ex = existingOrNew(byBlog, key, String(it.bloggername || handle || '블로거'), key, handle)
    ex._matches += 1
    // 첫 매칭의 설명에서 컨택 시도(누적).
    const c = extractContacts(text)
    if (!ex.email && c.emails[0]) ex.email = c.emails[0]
    if (!ex.instagram && c.instagram[0]) ex.instagram = c.instagram[0]
    if (!ex.tiktok && c.tiktok[0]) ex.tiktok = c.tiktok[0]
    if (!ex.links && c.links.length) ex.links = c.links.join(' ')
    if (!ex.description) ex.description = text.slice(0, 300)
  }
  const leads = Array.from(byBlog.values())
    .map(({ _matches, ...l }) => ({ ...l, video_count: _matches })) // video_count = 매칭 글 수(활동 프록시)
    .sort((a, b) => b.video_count - a.video_count)

  // 📧 컨택 보충 — 이메일 없는 블로거는 RSS(공개 피드)로 최근 글 본문 스캔(활동 많은 순 상한 enrichMax).
  //    유튜브 영상설명 스캔과 동형. pickBusinessEmail 로 협찬문의 맥락 이메일 우선.
  const enrichMax = Math.max(0, Math.min(20, opts.enrichMax ?? 8))
  const targets = leads.filter(l => !l.email && l.handle).slice(0, enrichMax)
  for (const l of targets) {
    const rss = await fetchNaverBlogRss(l.handle!)
    if (!rss) continue
    const c = extractContacts(rss)
    const biz = pickBusinessEmail(rss)
    if (biz) l.email = biz
    if (!l.instagram && c.instagram[0]) l.instagram = c.instagram[0]
    if (!l.tiktok && c.tiktok[0]) l.tiktok = c.tiktok[0]
    if (!l.links && c.links.length) l.links = c.links.join(' ')
  }
  return { ok: true, leads }
}

function existingOrNew(m: Map<string, InfluencerLead & { _matches: number }>, key: string, name: string, url: string, handle: string | null): InfluencerLead & { _matches: number } {
  let ex = m.get(key)
  if (!ex) {
    ex = { platform: 'naver_blog', channel_id: key, handle, name, url, subscriber_count: 0, view_count: 0, video_count: 0, country: 'KR', thumbnail: null, email: null, instagram: null, tiktok: null, links: null, description: '', _matches: 0 }
    m.set(key, ex)
  }
  return ex
}

// ── 네이버 카페 발굴 (네이버 검색 오픈API cafearticle — 무료, 동일 키) ──────────
//   카페는 개인이 아니라 커뮤니티 단위 → 게시글 상위 노출 카페를 집계(카페홈 링크 기준).
//   지표 없음, 매칭 글 수(활동 프록시) + best-effort 컨택. platform='naver_cafe'.
export async function discoverNaverCafes(
  clientId: string | undefined, clientSecret: string | undefined, keyword: string, opts: { display?: number } = {},
): Promise<DiscoverResult> {
  if (!clientId || !clientSecret) return { ok: false, error: 'NOT_CONFIGURED' }
  const q = (keyword || '').trim()
  if (q.length < 2) return { ok: false, error: 'FAILED', message: '키워드를 2자 이상 입력해주세요' }
  const display = Math.min(100, Math.max(10, Math.round(opts.display || 50)))
  const url = `${NAVER_OPENAPI}/v1/search/cafearticle.json?query=${encodeURIComponent(q)}&display=${display}&sort=sim`
  const res = await fetch(url, { headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret }, signal: AbortSignal.timeout(12000) }).catch(() => null)
  if (!res) return { ok: false, error: 'FAILED', message: '카페 검색 호출 실패 (네트워크)' }
  const data = (await res.json().catch(() => null)) as { items?: Array<{ title?: string; link?: string; description?: string; cafename?: string; cafeurl?: string }>; errorMessage?: string } | null
  if (!res.ok) return { ok: false, error: 'FAILED', message: data?.errorMessage || `카페 검색 오류 (HTTP ${res.status})` }
  const byCafe = new Map<string, InfluencerLead & { _matches: number }>()
  for (const it of (data?.items || [])) {
    const home = String(it.cafeurl || '').trim()
    if (!home) continue
    const key = home.replace(/\/$/, '')
    const handle = key.replace(/^https?:\/\/(cafe\.naver\.com\/)?/, '').replace(/\/.*$/, '') || null
    const text = `${stripTag(it.title)} ${stripTag(it.description)}`
    let ex = byCafe.get(key)
    if (!ex) { ex = { platform: 'naver_cafe', channel_id: key, handle, name: String(it.cafename || handle || '카페'), url: key, subscriber_count: 0, view_count: 0, video_count: 0, country: 'KR', thumbnail: null, email: null, instagram: null, tiktok: null, links: null, description: '', _matches: 0 }; byCafe.set(key, ex) }
    ex._matches += 1
    const c = extractContacts(text)
    if (!ex.email && c.emails[0]) ex.email = c.emails[0]
    if (!ex.instagram && c.instagram[0]) ex.instagram = c.instagram[0]
    if (!ex.links && c.links.length) ex.links = c.links.join(' ')
    if (!ex.description) ex.description = text.slice(0, 300)
  }
  const leads = Array.from(byCafe.values())
    .map(({ _matches, ...l }) => ({ ...l, video_count: _matches }))
    .sort((a, b) => b.video_count - a.video_count)
  return { ok: true, leads }
}

// ── 저장/관리 (계정별 리드 DB) ────────────────────────────────────────────────
export interface LeadRow extends InfluencerLead { id: number; status: string; memo: string | null; collected_at: string; category: string | null; source_keyword: string | null }

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
    category TEXT,
    source_keyword TEXT,
    collected_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(account_id, platform, channel_id)
  )`).run().catch(() => null)
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_ad_inf_leads_acct ON ad_influencer_leads(account_id, id)').run().catch(() => null)
  // 기존 테이블(구버전) 대비 컬럼 보강 — 이미 있으면 catch 로 무시(자동 수집 출처 분류용).
  await DB.prepare('ALTER TABLE ad_influencer_leads ADD COLUMN category TEXT').run().catch(() => null)
  await DB.prepare('ALTER TABLE ad_influencer_leads ADD COLUMN source_keyword TEXT').run().catch(() => null)
}

/** 발굴 결과를 계정 DB 에 저장(멱등 — 이미 있는 채널은 skip, 수동편집 보존). 반환: 신규 저장 수. */
export async function saveInfluencerLeads(
  DB: D1Database, accountId: number, leads: InfluencerLead[],
  meta?: { category?: string | null; sourceKeyword?: string | null },
): Promise<number> {
  await ensureInfluencerSchema(DB)
  const category = meta?.category ?? null
  const sourceKeyword = meta?.sourceKeyword ?? null
  let saved = 0
  for (const l of leads) {
    const r = await DB.prepare(`INSERT OR IGNORE INTO ad_influencer_leads
      (account_id, platform, channel_id, handle, name, url, subscriber_count, view_count, video_count, country, thumbnail, email, instagram, tiktok, links, description, category, source_keyword)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(accountId, l.platform, l.channel_id, l.handle, l.name.slice(0, 120), l.url, l.subscriber_count, l.view_count, l.video_count,
        l.country, l.thumbnail, l.email, l.instagram, l.tiktok, l.links, l.description.slice(0, 500), category, sourceKeyword)
      .run().catch(() => null)
    if (r?.meta?.changes === 1) saved++
  }
  return saved
}

export async function listInfluencerLeads(DB: D1Database, accountId: number, filter: { status?: string; hasContact?: boolean } = {}): Promise<LeadRow[]> {
  await ensureInfluencerSchema(DB)
  const where = ['account_id = ?']
  const binds: (string | number)[] = [accountId]
  if (filter.status && ['new', 'contacted', 'interested', 'contracted', 'rejected', 'hold'].includes(filter.status)) { where.push('status = ?'); binds.push(filter.status) }
  if (filter.hasContact) where.push('(email IS NOT NULL OR instagram IS NOT NULL OR tiktok IS NOT NULL OR links IS NOT NULL)')
  const r = await DB.prepare(`SELECT id, platform, channel_id, handle, name, url, subscriber_count, view_count, video_count, country, thumbnail, email, instagram, tiktok, links, description, status, memo, category, source_keyword, collected_at
    FROM ad_influencer_leads WHERE ${where.join(' AND ')} ORDER BY subscriber_count DESC, id DESC LIMIT 500`)
    .bind(...binds).all<LeadRow>().catch(() => null)
  return r?.results || []
}

export async function updateInfluencerLead(DB: D1Database, accountId: number, id: number, patch: { status?: string; memo?: string }): Promise<{ ok: boolean; error?: string }> {
  await ensureInfluencerSchema(DB)
  const sets: string[] = []
  const binds: (string | number | null)[] = []
  if (patch.status !== undefined) {
    // 아웃리치 파이프라인: 신규→컨택함→관심→계약 / 거절·보류.
    if (!['new', 'contacted', 'interested', 'contracted', 'rejected', 'hold'].includes(patch.status)) return { ok: false, error: '상태 값이 올바르지 않습니다' }
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
