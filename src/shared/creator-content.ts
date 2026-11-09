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

/**
 * 🎯 **확실한 매칭** — 자동으로 바로 보여도 되는가 (2026-11-04 대표 *"자동으로 이용권들에 업로드가 기본적으로 되게끔"*).
 * 가게 이름(지점 꼬리 뗀 핵심)과 **동네 한 단어(동·읍·면, 없으면 구·군)** 가 제목·요약에 **둘 다** 있어야 한다.
 * 이름만 맞는 글은 후보로 남긴다 — 흔한 이름은 다른 지역 같은 이름 가게 글이 섞인다.
 */
export function confidentMatch(text: string, storeName: string, address: string | null | undefined): boolean {
  if (!mentionsStore(text, storeName)) return false
  // 체인점은 블로그도 지점명까지(2026-11-09 — 영상과 같은 규칙. 같은 동네의 다른 지점 글이 섞이지 않게).
  const branch = branchOf(storeName)
  // "명륜" 만 보면 동네 이름(명륜동)에도 걸린다 — 지점 표기 "명륜점" 으로 본다.
  if (branch && !normStoreName(text).includes(`${branch}점`)) return false
  const words = String(address ?? '').split(/\s+/).filter(Boolean)
  const areas = words.filter((w) => /(동|읍|면|구|군)$/.test(w) && w.length >= 2).map((w) => normStoreName(w))
  // 🏝️ 도로명 주소라 구·동이 없는 곳("제주시 연북로", "강릉시 하슬라로")은 시로 본다(2026-11-09 실측: 이런 가게 후기가
  //    전부 후보에 머물러 손님 칸이 비었다). "제주시" 는 글에서 "제주" 로 쓰이니 아래 끝 글자 떼기가 받는다.
  if (!areas.length) for (const w of words) if (/시$/.test(w) && w.length >= 3) areas.push(normStoreName(w))
  if (!areas.length) return false
  const t = normStoreName(text)
  // "연산동" 은 글에서 "연산" 으로도 쓰인다 — 끝 글자를 뗀 형태(2자 이상)도 동네로 본다.
  return areas.some((a) => t.includes(a) || (a.length >= 3 && t.includes(a.slice(0, -1))))
}

/**
 * 🏷️ **제목이 이 가게를 가리키는가** (2026-11-09 대표 *"연관 없는 블로그도 있네. 정확성이 많이 떨어져?"*).
 * 실측: 자동 공개 블로그 2,009개 중 24% 가 제목에 가게 이름이 없었고, 그 대부분이 남의 이야기였다
 * (동네 맛집 총정리 · 아파트 순위 · 가구 납품 후기 — 요약 한 줄에 가게 이름이 스쳐 지나갔을 뿐).
 * 그래서 자동 공개는 **제목**이 이름을 불러야 한다. 셋 중 하나면 된다:
 *   ① 핵심 이름이 제목에 그대로 ② 이름이 띄어 쓴 낱말이면 낱말마다 제목에 있다("스시사카바 합정")
 *   ③ 네이버가 제목을 "…." 로 잘랐고 그 끝이 이름의 앞 3자 이상이다("디저트가 예술인 '타르틴베....")
 */
export function titleNamesStore(title: string | null | undefined, storeName: string): boolean {
  const core = coreStoreName(storeName)
  if (core.length <= 2) return false // 짧은 이름은 아무 제목에나 걸린다(mentionsStore 와 같은 기준)
  const raw = String(title ?? '')
  const t = normStoreName(raw)
  if (t.includes(core)) return true
  const words = String(storeName).replace(/\s*\(?[가-힣A-Za-z0-9]{1,8}(점|지점)\)?\s*$/, '').split(/[\s()]+/).map(normStoreName).filter(Boolean)
  if (words.length > 1 && words.every((w) => w.length >= 2) && words.every((w) => t.includes(w))) return true
  if (/(\.{2,}|…)\s*$/.test(raw)) {
    for (let n = core.length - 1; n >= 3; n--) if (t.endsWith(core.slice(0, n))) return true
  }
  return false
}

/** 여러 가게를 한데 모은 글("BEST 5" · "TOP10" · "총정리" · "6곳 비교") — 한 가게 후기가 아니다. */
export function isListPost(title: string | null | undefined): boolean {
  return /(best|top)\s*\d+|\d+\s*(곳|군데)|베스트\s*\d+|총정리|모음|순위|리스트/i.test(String(title ?? ''))
}

/**
 * 🏭 **업체가 쓴 글** — 블로그 이름이 납품·시공·중개 업체다(실측: "업소용가구전문,대건산업" 의 세라믹 테이블 납품기가 한우집에 떴다).
 * 손님 후기가 아니라 그 업체 홍보라 자동 공개에서 뺀다(후보로는 남아 사장님이 고를 수 있다).
 */
export function isVendorAuthor(authorName: string | null | undefined): boolean {
  return /(업소용|가구|인테리어|산업|부동산|공인중개|시공|분양|간판|컨설팅|설비|보일러|홈케어|납품|도매|주식회사|㈜|\(주\)|상사|문화누리카드)/.test(String(authorName ?? ''))
}

/**
 * 🫥 **이름이 업종 그 자체인 가게** — "입주청소" · "서초에어컨청소" · "홍대돈까스" · "송파한우정육식당".
 * 데모 이용권에 이런 이름이 많다(2026-11-09 실측 188곳 중 20곳 남짓). 이름으로 찾으면 **그 업종의 아무 글**이 걸려서
 * (다른 청소업체 홍보 · 다른 돈까스집 후기) 이름 매칭으로는 판정이 안 된다 → 자동 공개하지 않는다(후보로만).
 * 판정: 앞의 동네 이름 한 단어를 떼면 업종 낱말만 남는다.
 */
const GENERIC_PLACE = /^(서울|부산|대구|인천|광주|대전|울산|세종|제주|강남|서초|송파|잠실|삼성|홍대|신촌|합정|건대|성수|이태원|종로|광화문|여의도|마포|용산|노원|강서|분당|판교|수원|동탄|용인|일산|청주|천안|창원|김해)/
const GENERIC_BODY = /^(입주청소|이사청소|에어컨청소|청소|셀프사진관|사진관|쌀국수집|쌀국수|한우곱창|곱창|막창|돈까스|돈가스|한우정육식당|정육식당|한우|헬스장|헬스|필라테스|요가|네일|미용실|왁싱|카페|펜션|게스트하우스|모텔|호텔|국밥|해장국|치킨|피자)+$/
export function isGenericStoreName(storeName: string | null | undefined): boolean {
  const n = coreStoreName(storeName)
  if (!n) return true
  return GENERIC_BODY.test(n) || GENERIC_BODY.test(n.replace(GENERIC_PLACE, ''))
}

/**
 * ✅ **블로그 자동 공개 판정 하나** — 수집할 때도, 쌓인 글을 다시 볼 때도 이것만 쓴다(두 곳이 갈리면 둘 다 못 믿는다).
 * 가게 자기 글 · 업체 글 · 모음 글이 아니고, 제목이 가게를 부르고, 제목+요약에 이름·동네(체인은 지점)가 다 있어야 한다.
 */
export function blogAutoShow(p: { title: string | null; summary: string | null; author: string | null }, storeName: string, address: string | null | undefined): boolean {
  if (isGenericStoreName(storeName)) return false
  if (isStoreOwnPost(p.author, storeName) || isVendorAuthor(p.author) || isListPost(p.title)) return false
  if (!titleNamesStore(p.title, storeName)) return false
  return confidentMatch(`${p.title ?? ''} ${p.summary ?? ''}`, storeName, address)
}

/** 지점명 — "샤브올데이 부산명륜점" → "명륜", "보광정 이태원점" → "이태원". 지점이 없으면 null. 앞의 시·도 이름은 뗀다. */
export function branchOf(storeName: string | null | undefined): string | null {
  const m = String(storeName ?? '').trim().match(/\s+\(?([가-힣A-Za-z0-9]{1,10}?)(?:지점|점)\)?$/)
  if (!m) return null
  const b = m[1].replace(/^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/, '')
  return b.length >= 2 ? normStoreName(b) : (m[1].length >= 2 ? normStoreName(m[1]) : null)
}

/**
 * 🎬 **유튜브 영상은 이것으로 바로 공개** (2026-11-09 대표 *"체인점은 지점명까지. 다른건 이름만 맞으면 보이게"*).
 * 유튜브 제목·설명은 블로그와 달리 동네를 잘 안 써서 `confidentMatch` 로는 거의 다 후보에 남았다(실측 144개 중 26개만 공개).
 * 검색 자체를 "가게 이름 + 동네" 로 했으므로 — 이름이 맞으면 보이고, **지점이 있는 가게는 지점명까지** 맞아야 한다
 * (같은 체인 다른 지점 영상: 실측 "샤브올데이 수영점" 영상이 명륜점에 걸렸다).
 */
export function videoMatch(text: string, storeName: string): boolean {
  if (!mentionsStore(text, storeName)) return false
  const branch = branchOf(storeName)
  return branch ? normStoreName(text).includes(`${branch}점`) : true
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

/**
 * 🏪 **가게가 직접 쓴 글인가** (2026-11-04 대표 *"매장이 직접 입력한거네 인플루언서가 아니라"*).
 * 블로그·채널 이름에 가게 핵심 이름이 들어 있으면 가게 계정이다(실측: APM휘트니스 수원점 블로그의 운영 안내·운동 팁 15건).
 * "다녀온 사람들" 은 **남이 써 준 이야기**만 — 가게 글이 섞이면 칸 전체를 안 믿게 된다.
 */
export function isStoreOwnPost(authorName: string | null | undefined, storeName: string): boolean {
  const core = coreStoreName(storeName)
  const a = normStoreName(authorName)
  if (core.length < 3 || a.length < 2) return false
  return a.includes(core) || (a.length >= 3 && core.includes(a))
}

/** 한 사람 글은 가게당 이만큼만 손님에게 — 한 블로거가 칸을 채우지 않게. */
export const MAX_POSTS_PER_AUTHOR = 2

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
/**
 * 손님에게 보이는 순서 — 고정 → 유어딜 사람 → 영상 → 블로그. 같은 무리 안에서는 (2026-11-09 대표 *"전부 해줘"* — 보여 주는 순서)
 *   사장님이 정한 순서(position > 0) → 사진 있는 글 → 협찬 아닌 글 → 최근 1년 안 → 최근 것.
 * 손님이 처음 보는 3개의 질이 이 함수로 정해진다.
 */
export function sortForCustomer(items: ContentItem[], nowMs: number = Date.now()): ContentItem[] {
  const rank = (x: ContentItem) => (x.pinned ? 0 : x.urdeal ? 1 : x.kind === 'video' ? 2 : 3)
  const yearAgo = new Date(nowMs - 365 * 86400000).toISOString().slice(0, 10)
  const ordered = (x: ContentItem) => (x.position > 0 ? x.position : 1e9)
  const fresh = (x: ContentItem) => (x.published_at && x.published_at.slice(0, 10) >= yearAgo ? 0 : 1)
  return [...items].sort((a, b) =>
    rank(a) - rank(b)
    || ordered(a) - ordered(b)
    || Number(!a.thumb_url) - Number(!b.thumb_url)
    || Number(a.sponsored) - Number(b.sponsored)
    || fresh(a) - fresh(b)
    || String(b.published_at ?? '').localeCompare(String(a.published_at ?? '')))
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

