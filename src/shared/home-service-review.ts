/**
 * 🏠 생활 업체 소개 · 다른 곳 후기 링크 · 유어딜 후기 — 화면·서버가 함께 쓰는 규칙 (2026-10-26 대표)
 *
 * 대표: *"생활 관련 사장님들한테는 미소, 숨고 등 링크를 넣을 수 있는거지 소개에. 후기 기능 만들어주고"*.
 *
 * 🔑 왜 링크를 받나: 업체 수가 적은 지금 유어딜 후기는 0개부터 시작한다. 사장님이 이미 숨고·미소·
 *   네이버 플레이스에 쌓아 둔 후기를 손님이 바로 볼 수 있으면, 처음 온 업체도 믿을 근거가 생긴다.
 * 🔒 아무 주소나 받지 않는다 — 후기·업체 페이지가 있는 곳만(허용 목록). 피싱·도박 링크가
 *   손님 견적 화면에 뜨는 것을 막는다. 허용 목록에 없는 주소는 저장 때 거절한다(조용히 버리지 않는다).
 */

import { isRequestPhotoUrl } from './home-service'

export const PRO_INTRO_MAX = 300
/** 후기 사진(전후 사진) — 요청서 사진과 같은 업로드 규칙·같은 장수. */
export const REVIEW_PHOTOS_MAX = 5
export const PRO_LINKS_MAX = 5
export const REVIEW_BODY_MAX = 500
export const REVIEW_BODY_MIN = 5
/** 손님 견적 카드에 보여 줄 최근 후기 수. */
export const REVIEW_PREVIEW_COUNT = 3

/** 허용 호스트 → 화면 이름. 하위 도메인도 받는다(`m.place.naver.com` → 네이버). */
export const PRO_LINK_SITES: { host: string; label: string }[] = [
  { host: 'soomgo.com', label: '숨고' },
  { host: 'miso.kr', label: '미소' },
  { host: 'place.naver.com', label: '네이버 플레이스' },
  { host: 'map.naver.com', label: '네이버 지도' },
  { host: 'naver.me', label: '네이버' },
  { host: 'blog.naver.com', label: '네이버 블로그' },
  { host: 'map.kakao.com', label: '카카오맵' },
  { host: 'kko.to', label: '카카오맵' },
  { host: 'daangn.com', label: '당근' },
  { host: 'instagram.com', label: '인스타그램' },
  { host: 'youtube.com', label: '유튜브' },
]

/** 주소 하나를 판정 — 허용 목록 안의 https 주소면 이름을 준다. */
export function proLinkLabel(raw: unknown): string | null {
  let u: URL
  try { u = new URL(String(raw ?? '').trim()) } catch { return null }
  if (u.protocol !== 'https:' || u.username || u.password) return null
  const host = u.hostname.toLowerCase().replace(/^www\./, '')
  const site = PRO_LINK_SITES.find((s) => host === s.host || host.endsWith(`.${s.host}`))
  return site ? site.label : null
}

/**
 * 입력 칸 도우미(2026-10-26 대표 "어느 플랫폼인지 입력하면 보이게") — 사장님이 `soomgo.com/…` 처럼
 * 앞부분 없이 붙여 넣는 경우가 많아 `https://` 를 채워 준다. 판정 자체는 `proLinkLabel` 하나다.
 */
export function normalizeProLink(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return s
  return `https://${s.replace(/^\/+/, '')}`
}

/** 칸 하나의 상태 — 비었으면 'empty', 허용 목록이면 그 이름, 아니면 'bad'. */
export function proLinkStatus(raw: unknown): { kind: 'empty' } | { kind: 'ok'; label: string } | { kind: 'bad' } {
  const s = normalizeProLink(raw)
  if (!s) return { kind: 'empty' }
  const label = proLinkLabel(s)
  return label ? { kind: 'ok', label } : { kind: 'bad' }
}

export type ProLink = { url: string; label: string }

/**
 * 저장할 때 — 하나라도 허용 목록 밖이면 그 주소를 알려 주며 거절한다.
 * 빈 칸은 건너뛴다. 같은 주소는 한 번만.
 */
export function parseProLinks(raw: unknown): { ok: true; links: string[] } | { ok: false; error: string } {
  const arr = Array.isArray(raw) ? raw : []
  const out: string[] = []
  for (const v of arr) {
    const s = normalizeProLink(v)
    if (!s) continue
    if (s.length > 300) return { ok: false, error: '주소가 너무 길어요' }
    if (!proLinkLabel(s)) return { ok: false, error: `숨고·미소·네이버·카카오맵·당근·인스타그램 주소만 넣을 수 있어요 (${s.slice(0, 40)})` }
    const norm = new URL(s).toString()
    if (!out.includes(norm)) out.push(norm)
  }
  if (out.length > PRO_LINKS_MAX) return { ok: false, error: `링크는 ${PRO_LINKS_MAX}개까지 넣을 수 있어요` }
  return { ok: true, links: out }
}

/** 읽을 때 — 저장된 JSON 을 다시 거른다(허용 목록이 줄어도 옛 주소가 화면에 안 나간다). */
export function readProLinks(stored: unknown): ProLink[] {
  let arr: unknown = []
  try { arr = JSON.parse(String(stored || '[]')) } catch { arr = [] }
  if (!Array.isArray(arr)) return []
  const out: ProLink[] = []
  for (const v of arr.slice(0, PRO_LINKS_MAX)) {
    const label = proLinkLabel(v)
    if (label) out.push({ url: String(v), label })
  }
  return out
}

export function parseProIntro(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null   // 안 보냄 = 그대로 둔다
  return String(raw).replace(/\r\n/g, '\n').trim().slice(0, PRO_INTRO_MAX)
}

/**
 * 후기 입력 — 별점 1~5 정수, 본문 5~500자, 사진 5장까지.
 * 사진은 **우리 업로드 주소 + 이 손님이 올린 것**만(`uploads/user/<id>/`) — 남의 사진·외부 주소를 업체 페이지에 못 띄운다.
 */
export function parseReview(body: { rating?: unknown; body?: unknown; photos?: unknown }, userId = 0):
  { ok: true; rating: number; text: string; photos: string[] } | { ok: false; error: string } {
  const rating = Number(body.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, error: '별점을 골라 주세요' }
  const text = String(body.body ?? '').replace(/\r\n/g, '\n').trim()
  if (text.length < REVIEW_BODY_MIN) return { ok: false, error: `후기를 ${REVIEW_BODY_MIN}자 이상 적어 주세요` }
  const photos = Array.isArray(body.photos) ? [...new Set(body.photos.map((u) => String(u ?? '').trim()).filter(Boolean))] : []
  if (photos.length > REVIEW_PHOTOS_MAX) return { ok: false, error: `사진은 ${REVIEW_PHOTOS_MAX}장까지 올릴 수 있어요` }
  if (photos.some((u) => !isRequestPhotoUrl(u) || !u.includes(`/uploads/user/${userId}/`))) return { ok: false, error: '사진을 다시 올려 주세요' }
  return { ok: true, rating, text: text.slice(0, REVIEW_BODY_MAX), photos }
}

/** 저장된 후기 사진 — 읽을 때도 다시 거른다. */
export function readReviewPhotos(stored: unknown): string[] {
  return String(stored || '').split(',').map((u) => u.trim()).filter((u) => u && isRequestPhotoUrl(u)).slice(0, REVIEW_PHOTOS_MAX)
}

/** 평균 별점 표시 — 소수 첫째 자리. 후기가 없으면 null(0점으로 보이지 않게). */
export function ratingText(avg: unknown, count: unknown): string | null {
  const n = Number(count), a = Number(avg)
  if (!(n > 0) || !Number.isFinite(a)) return null
  return `★ ${a.toFixed(1)} (${n})`
}

/** 이름 가리기 — 후기 작성자는 첫 글자만(공유 페이지와 같은 규칙). */
export function maskReviewer(name: unknown): string {
  const s = String(name ?? '').trim()
  return s ? `${[...s][0]}○○` : '손님'
}
