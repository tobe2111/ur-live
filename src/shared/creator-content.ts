/**
 * 🎬 이용권 상세 "다녀온 사람들" — 콘텐츠 SSOT (2026-11-04 대표 확정 *"손님 2 + 사장님 2 + 블로그 창"*)
 *
 * 시안: https://claude.ai/artifact/8jrxtpbGUfwxLwrJTHKaMe (손님 2 · 사장님 2) ·
 *       https://claude.ai/artifact/8j6giZULgH5cpjWtQv34BC (블로그 보기 창) · 기록 `docs/design/voucher-creator-content-2026-11-04.md`
 *
 * 무엇이 한 줄에 서나 (위에서부터):
 *   ① 사장님이 맨 앞에 고정한 것
 *   ② 유어딜 사람 — 체험단 게시물 · 유어쇼츠(이 이용권에 붙은 쇼츠)
 *   ③ 외부 영상 — 유튜브(자동 + 주소) · 인스타 · 틱톡 · 네이버 클립(주소로만)
 *   ④ 블로그 — 네이버 블로그(자동 + 주소)
 * 그리고 이 이용권을 유어샵에 **담아 파는 사람**은 영상이 없어도 위 띠("유어딜 N명이 추천해요")로 선다.
 *
 * 🔴 **자동으로 찾은 것은 사장님이 켜기 전엔 안 나간다**(`candidate`). 엉뚱한 가게 글이 섞이기 때문이다
 *    (가게 이름이 흔하면 다른 지역 같은 이름 가게가 걸린다). 주소로 넣은 것은 사장님이 고른 것이라 바로 보인다.
 * 🔴 **본문을 복사하지 않는다** — 블로그는 제목·대표 사진·요약 두세 줄(검색 API 가 주는 것)만, 영상은 각 SNS 공식 재생기.
 */

export type ContentPlatform = 'youtube' | 'instagram' | 'tiktok' | 'naver_clip' | 'naver_blog'
export type ContentKind = 'video' | 'blog'
export type ContentStatus = 'candidate' | 'visible' | 'hidden' | 'deleted'
export type ContentSource = 'auto' | 'owner' | 'admin' | 'seeding' | 'urshorts'

export const CONTENT_PLATFORM_LABEL: Record<ContentPlatform, string> = {
  youtube: '유튜브',
  instagram: '인스타그램',
  tiktok: '틱톡',
  naver_clip: '네이버 클립',
  naver_blog: '네이버 블로그',
}

export function kindOf(p: ContentPlatform): ContentKind {
  return p === 'naver_blog' ? 'blog' : 'video'
}

/** 붙여 넣은 주소 → 어느 플랫폼의 무엇인가. 모르는 주소는 null(아무 사이트나 손님 화면에 걸지 않는다). */
export interface ParsedContentUrl { platform: ContentPlatform; extId: string; url: string }

const YT_ID = /^[A-Za-z0-9_-]{11}$/

export function parseContentUrl(input: string | null | undefined): ParsedContentUrl | null {
  const raw = (input ?? '').trim()
  if (!raw || raw.length > 600) return null
  let u: URL
  try { u = new URL(raw.startsWith('http') ? raw : `https://${raw}`) } catch { return null }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  const host = u.hostname.replace(/^(www|m)\./, '').toLowerCase()
  const path = u.pathname

  if (host === 'youtu.be') {
    const id = path.slice(1).split('/')[0]
    return YT_ID.test(id) ? { platform: 'youtube', extId: id, url: `https://www.youtube.com/shorts/${id}` } : null
  }
  if (host === 'youtube.com') {
    const m = path.match(/^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/)
    const id = m?.[1] ?? u.searchParams.get('v') ?? ''
    return YT_ID.test(id) ? { platform: 'youtube', extId: id, url: `https://www.youtube.com/watch?v=${id}` } : null
  }
  if (host === 'instagram.com') {
    const m = path.match(/^\/(?:[A-Za-z0-9._]+\/)?(reel|reels|p|tv)\/([A-Za-z0-9_-]{5,40})/)
    if (!m) return null
    const kind = m[1] === 'p' ? 'p' : 'reel'
    return { platform: 'instagram', extId: m[2], url: `https://www.instagram.com/${kind}/${m[2]}/` }
  }
  if (host === 'tiktok.com') {
    const m = path.match(/^\/@([A-Za-z0-9._-]+)\/video\/(\d{8,25})/)
    return m ? { platform: 'tiktok', extId: m[2], url: `https://www.tiktok.com/@${m[1]}/video/${m[2]}` } : null
  }
  if (host === 'vt.tiktok.com' || host === 'vm.tiktok.com') return null // 짧은 주소는 원래 주소를 붙여 달라고 한다(따라가 보지 않는다)
  if (host === 'clip.naver.com' || (host === 'naver.com' && /\/clip/.test(path)) || host === 'tv.naver.com') {
    const m = path.match(/(\d{5,25})/) ?? u.search.match(/(\d{5,25})/)
    return m ? { platform: 'naver_clip', extId: m[1], url: u.toString() } : null
  }
  if (host === 'blog.naver.com') {
    // blog.naver.com/{id}/{logNo} 또는 PostView.naver?blogId=&logNo=
    const m = path.match(/^\/([A-Za-z0-9_-]{2,40})\/(\d{6,20})/)
    const blogId = m?.[1] ?? u.searchParams.get('blogId') ?? ''
    const logNo = m?.[2] ?? u.searchParams.get('logNo') ?? ''
    if (!/^[A-Za-z0-9_-]{2,40}$/.test(blogId) || !/^\d{6,20}$/.test(logNo)) return null
    return { platform: 'naver_blog', extId: `${blogId}/${logNo}`, url: `https://blog.naver.com/${blogId}/${logNo}` }
  }
  return null
}

/** 네이버 블로그 글을 창 안에 띄울 때 쓰는 모바일 주소. */
export function naverBlogMobileUrl(extId: string): string {
  const [blogId, logNo] = extId.split('/')
  return `https://m.blog.naver.com/${blogId}/${logNo}`
}

/** 공식 재생기 주소. null 이면 그 플랫폼은 창 안에서 못 틀고 원본으로 보낸다(네이버 클립). */
export function embedUrl(p: ContentPlatform, extId: string): string | null {
  if (p === 'youtube') return `https://www.youtube.com/embed/${extId}?autoplay=1&playsinline=1&rel=0`
  if (p === 'instagram') return `https://www.instagram.com/reel/${extId}/embed`
  if (p === 'tiktok') return `https://www.tiktok.com/embed/v2/${extId}`
  return null
}

/** 유튜브 썸네일(검색 응답이 없을 때 — 주소로 넣은 경우). */
export function youtubeThumb(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
}

/* ─────────────────────────── 가게 이름 매칭 ─────────────────────────── */

/** 비교용 가게 이름 — 공백·괄호·특수문자를 걷는다. "꾸꾸데쎄르 (연산점)" → "꾸꾸데쎄르연산점". */
export function normStoreName(name: string | null | undefined): string {
  return String(name ?? '').toLowerCase().replace(/<[^>]*>/g, '').replace(/[\s()[\]{}·.,!?'"~\-_/|&]+/g, '')
}

/** 지점 꼬리("연산점"·"본점")를 뗀 핵심 이름. 블로그는 지점명을 자주 빼고 쓴다. */
export function coreStoreName(name: string | null | undefined): string {
  return normStoreName(String(name ?? '').replace(/\s*\(?[가-힣A-Za-z0-9]{1,8}(점|지점)\)?\s*$/, ''))
}

/**
 * 이 글/영상이 이 가게 이야기인가. 제목+요약에 핵심 이름이 **그대로** 들어 있어야 한다.
 * 🔴 핵심 이름이 2자 이하면 매칭하지 않는다 — "카페"·"밥집" 같은 이름은 아무 글에나 걸린다.
 */
export function mentionsStore(text: string, storeName: string): boolean {
  const core = coreStoreName(storeName)
  if (core.length < 3) return false
  return normStoreName(text).includes(core)
}

/** 검색어 — 가게 이름 + 동네(주소의 구/동 한 단어). 동네가 없으면 이름만. */
export function searchQueryFor(storeName: string, address: string | null | undefined): string {
  const name = String(storeName).replace(/\s*\([^)]*\)\s*$/, '').trim()
  const words = String(address ?? '').split(/\s+/).filter(Boolean)
  const area = words.find((w) => /(동|읍|면)$/.test(w)) ?? words.find((w) => /(구|군)$/.test(w)) ?? ''
  return area ? `${name} ${area}` : name
}

/** 검색 API 가 주는 `<b>` 강조·HTML 엔티티를 걷어 글자만 남긴다. */
export function stripHtml(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim()
}

/** 협찬·체험단 표시가 있는 글인가(공정위 표시 문구). */
export function looksSponsored(text: string): boolean {
  return /(협찬|원고료|체험단|제공받아|제공 받아|소정의|광고)/.test(text)
}

/* ─────────────────────────── 손님 화면 정렬 ─────────────────────────── */

export interface ContentItem {
  id: string                // 'c:12'(표) · 's:5'(체험단) · 'u:9'(유어쇼츠)
  platform: ContentPlatform
  kind: ContentKind
  ext_id: string
  url: string
  title: string | null
  thumb_url: string | null
  author_name: string | null
  author_meta: string | null   // "구독자 3.2만" 같은 한 줄
  summary: string | null       // 블로그 요약(검색 API 가 준 두세 줄)
  published_at: string | null
  sponsored: boolean
  embeddable: boolean          // 블로그: 창 안에 띄울 수 있나(수집 때 응답 헤더로 판정)
  urdeal: 'seeding' | 'urshorts' | null   // 유어딜 사람 배지
  pinned: boolean
  position: number
}

export interface PinPerson { user_id: number; handle: string; name: string | null; avatar: string | null }

export interface CreatorContentPayload { items: ContentItem[]; pinners: PinPerson[] }

/** 손님에게 보이는 순서 — 고정 → 유어딜 사람 → 영상 → 블로그, 그 안에서는 사장님 순서(position) → 최근 것. */
export function sortForCustomer(items: ContentItem[]): ContentItem[] {
  const rank = (x: ContentItem) => (x.pinned ? 0 : x.urdeal ? 1 : x.kind === 'video' ? 2 : 3)
  return [...items].sort((a, b) =>
    rank(a) - rank(b) || a.position - b.position || String(b.published_at ?? '').localeCompare(String(a.published_at ?? '')))
}

/** 유튜브 공유 한도 — 유어애즈와 같은 하루 10,000점 풀에서 이 몫만 쓴다(2026-11-04 대표 *"자동으로 분담"*). */
export const CONTENT_YT_DAILY_SEARCHES = 15
export const CONTENT_YT_USED_KEY = 'urdeal_content_yt_used'
/**
 * 유어애즈 성과 측정이 **비워 둘** 몫(units). 오늘 아직 안 쓴 우리 몫만큼 남겨 두고,
 * 태평양시 18시(한국 오전 10~11시)가 지나면 0 — 그때까지 못 쓴 몫은 유어애즈에 돌려준다.
 */
export function contentYtReservedUnits(usedToday: number, nowMs: number): number {
  const ptHour = Number(new Date(nowMs).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false }))
  if (!Number.isFinite(ptHour) || ptHour >= 18) return 0
  return Math.max(0, CONTENT_YT_DAILY_SEARCHES - Math.max(0, usedToday)) * 100
}

/** "YYYY-MM-DD:n" 에서 오늘 분만. 날짜가 다르면 0. */
export function readDayCount(raw: string | null | undefined, day: string): number {
  if (!raw) return 0
  const i = raw.indexOf(':')
  if (i <= 0 || raw.slice(0, i) !== day) return 0
  return Math.max(0, parseInt(raw.slice(i + 1), 10) || 0)
}
