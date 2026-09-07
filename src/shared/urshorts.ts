/**
 * 🎬 유어쇼츠 — 홈 레일과 `/videos` 뷰어가 공유하는 SSOT (2026-09-07 대표 확정).
 *
 * ## 무엇인가
 * 유튜브 쇼츠를 홈에 얹되, **영상마다 파는 이용권이 붙어 있는** 형태다.
 * 대표가 확정한 것: 이름 "유어쇼츠" · 뷰어 `/videos` · 카드 125×222 고정(영상 수와 무관) ·
 * 자리는 인기 이용권 다음 · 홈 레일은 최신 12편 + 끝에 전체 보기 타일.
 *
 * ## 🔴 이 파일이 지키는 규칙 하나
 * **이용권이 안 붙은 영상은 홈에 못 나간다.** 안 묶으면 홈에 유튜브를 켜 주는 셈이고
 * 사용자는 관련 영상을 타고 나간다 — 그 순간 이 기능은 매출 장치가 아니라 이탈 장치가 된다.
 * 서버 쿼리(`urshorts.routes`)가 INNER JOIN 으로 그걸 강제하고, 테스트가 그 조인을 고정한다.
 *
 * ## 크기를 왜 고정하나 (실측)
 * 처음 시안은 한 줄 6개(217×386)였는데 제목 줄까지 430px 이라 **바로 위 딜 카드(299px)보다
 * 1.4배 컸다** — 딜을 팔려고 놓은 것이 딜보다 커진 것이다. 125×222 로 고정하면 딜 카드보다
 * 77px 낮고, 몇 개가 보이는지는 화면이 정한다(1440에서 10개 · 390에서 2개 + 잘린 조각).
 */

/** 홈 레일에 싣는 최대 편수. 뷰어(`/videos`)에는 전부 들어간다 — 자르는 게 아니라 입구를 짧게 두는 것. */
export const URSHORTS_RAIL_LIMIT = 12

/** 카드 폭(px). 영상이 몇 편이든 고정 — 몇 개가 보이는지는 화면 폭이 정한다. */
export const URSHORTS_CARD_W = 125
/** 9:16 에서 나오는 높이. 딜 카드(299px)보다 낮아야 한다는 것이 이 값의 근거다. */
export const URSHORTS_CARD_H = Math.round((URSHORTS_CARD_W * 16) / 9) // 222

/** 뷰어 주소. 옛 `/shorts` 는 라이브커머스와 함께 내려간 자리라 재사용하지 않는다. */
export const URSHORTS_VIEWER_PATH = '/videos'

/** 유튜브 영상 id 모양 — 11자 고정. 이보다 느슨하면 쿼리스트링 조각을 id 로 오인한다. */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

/** 주소가 어떤 모양이었는지. `shorts` 만이 "쇼츠임"을 스스로 증명한다. */
export type YouTubeUrlForm = 'shorts' | 'watch' | 'bare'

/**
 * 붙여 넣은 주소에서 영상 id 와 **주소 모양**을 뽑는다. 못 뽑으면 `null`.
 *
 * 🔴 **모양이 중요한 이유**: 유어쇼츠 카드는 9:16 이라 가로 영상을 넣으면 위아래 검은 띠가 생기고,
 * 10분짜리 영상에 구매 바를 붙이는 건 쇼츠가 아니라 그냥 유튜브다. `/shorts/` 주소는 그 자체로
 * 쇼츠임을 증명하지만 `watch?v=` 는 **쇼츠도 일반 영상도 될 수 있다** — 그건 길이를 따로 확인해야 한다.
 */
export function parseYouTubeUrl(input: string | null | undefined): { id: string; form: YouTubeUrlForm } | null {
  const raw = (input ?? '').trim()
  if (!raw) return null
  if (VIDEO_ID.test(raw)) return { id: raw, form: 'bare' }
  let u: URL
  try {
    u = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
  } catch {
    return null
  }
  const host = u.hostname.replace(/^www\./, '').toLowerCase()
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0]
    return VIDEO_ID.test(id) ? { id, form: 'watch' } : null
  }
  if (host !== 'youtube.com' && host !== 'm.youtube.com' && host !== 'music.youtube.com') return null
  const shorts = u.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{11})/)
  if (shorts) return { id: shorts[1], form: 'shorts' }
  const v = u.searchParams.get('v')
  if (v && VIDEO_ID.test(v)) return { id: v, form: 'watch' }
  const m = u.pathname.match(/^\/(?:embed|live|v)\/([A-Za-z0-9_-]{11})/)
  return m ? { id: m[1], form: 'watch' } : null
}

/** id 만 필요할 때. 모양 판단이 필요하면 `parseYouTubeUrl` 을 쓸 것. */
export function parseYouTubeVideoId(input: string | null | undefined): string | null {
  return parseYouTubeUrl(input)?.id ?? null
}

/**
 * 쇼츠로 인정하는 최대 길이(초). 유튜브가 2024-10 에 60초에서 3분으로 늘렸다.
 * 이 값을 넘으면 세로 카드에 넣어도 쇼츠처럼 안 보이고, 구매 바를 띄울 화면도 아니다.
 */
export const URSHORTS_MAX_DURATION_SEC = 180

/** ISO-8601 재생시간(`PT1M12S`)을 초로. 못 읽으면 `null`(모르면 통과시키지 않는다). */
export function parseIsoDurationSec(iso: string | null | undefined): number | null {
  const m = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec((iso ?? '').trim())
  if (!m) return null
  const [, d, h, mi, se] = m
  return (Number(d) || 0) * 86400 + (Number(h) || 0) * 3600 + (Number(mi) || 0) * 60 + Math.round(Number(se) || 0)
}

/**
 * 썸네일 주소. `img.youtube.com` 은 이미 `cf-image.ts` 의 외부 프록시 목록에 있어
 * 우리 리사이저를 거친다 — 원본 대신 작은 사진이 간다.
 *
 * `hq720` 은 쇼츠에서 없을 수 있어 `hqdefault`(항상 있음)를 기본으로 둔다.
 * 빠진 파일을 부르면 유튜브가 회색 자리표시자 이미지를 200 으로 돌려줘 **에러 없이 회색 카드**가 된다.
 */
export function youTubeThumbUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
}

/**
 * 재생용 embed 주소. **누른 뒤에만** 만든다 — 미리 만들면 홈 첫 화면이 재생기 무게를 받는다.
 * `playsinline=1` 이 없으면 iOS 가 전체화면을 강제로 띄워 우리 구매 바를 덮는다.
 */
export function youTubeEmbedUrl(videoId: string, opts?: { autoplay?: boolean }): string {
  const p = new URLSearchParams({
    playsinline: '1',
    rel: '0',            // 끝나고 남의 채널 영상을 추천하지 않는다
    modestbranding: '1',
  })
  if (opts?.autoplay) p.set('autoplay', '1')
  return `https://www.youtube-nocookie.com/embed/${videoId}?${p.toString()}`
}

/** 홈 레일·뷰어가 함께 쓰는 한 편의 모양. 상품 필드는 서버가 조인해 붙인다. */
export interface UrShortItem {
  id: number
  video_id: string
  title: string | null
  channel: string | null
  thumb_url: string | null
  /** 🔴 항상 존재한다 — 서버가 INNER JOIN 으로 강제한다. */
  product_id: number
  /** 초. 쇼츠 판정에 쓴 값이라 남겨 둔다(모르면 null). */
  duration_sec?: number | null
  product_name: string | null
  store_name: string | null
  product_image: string | null
  price: number | null
  original_price: number | null
  discount_rate: number | null
}
