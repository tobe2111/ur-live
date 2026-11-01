/**
 * 🖼️ 2026-11-01 크기별로 미리 저장한 사진 — 주소 규칙 SSOT (대표 *"가장 이상적인 방법은 뭐야?"* →
 *   *"응 잠금 해제해줄게 진행해줘"*).
 *
 * 왜: Cloudflare Images 무료 한도는 **그달에 쓰인 고유 변환**(사진 × 크기)으로 센다. 그때그때 줄이면
 *   사진이 늘수록 매달 사용량이 같이 커진다(2026-10-31 실제로 한도를 다 써 사이트 전체 리사이즈가 429 로 멈췄다).
 *   사진을 올릴 때 **브라우저가 한 번** 세 크기로 줄여 R2 에 넣어 두면, 화면은 그 파일을 그대로 쓰고
 *   변환은 영원히 0 이다.
 *
 * 주소 모양(이 모양 자체가 "크기별 파일이 있다" 는 표시다 — DB 조회 없이 판정한다):
 *   /api/media/uploads/sized/<경로…>/<id>/w1280.webp     (상대 — PUBLIC_R2_URL 미설정 때 업로드가 돌려주는 모양)
 *   https://media.ur-team.com/uploads/sized/…/w1280.webp (절대)
 *   저장되는 주소는 언제나 **가장 큰 크기**다 — cfImage 를 안 거치는 자리도 멀쩡한 사진을 받는다.
 *
 * ⚠️ 워커·화면이 같이 쓴다(워커 preload · 서버 첫 화면 · 카드가 같은 주소를 내야 이중 다운로드가 없다) —
 *    DOM 을 쓰지 말 것.
 */

/** 저장하는 폭. 카드(200·2배 400) · 상세(900) 가 이 셋 안에서 해결된다. 바꾸면 이미 저장한 사진과 어긋난다. */
export const SIZED_WIDTHS = [320, 640, 1280] as const
export type SizedWidth = (typeof SIZED_WIDTHS)[number]
export const SIZED_MAX_WIDTH: SizedWidth = 1280
export const SIZED_EXTS = ['webp', 'jpg'] as const
export type SizedExt = (typeof SIZED_EXTS)[number]

export const SIZED_KEY_PREFIX = 'uploads/sized/'
export const SIZED_PUBLIC_ORIGIN = 'https://media.ur-team.com'

export interface SizedRef {
  /** R2 키의 머리 — `uploads/sized/…/<id>/` (끝에 `/`). */
  base: string
  ext: SizedExt
}

const SIZED_RE = /^(?:\/api\/media\/|https:\/\/media\.ur-team\.com\/)(uploads\/sized\/(?:[A-Za-z0-9_-]+\/)+)w(320|640|1280)\.(webp|jpg)$/

/** 크기별로 저장된 사진 주소면 그 머리와 확장자를, 아니면 null. */
export function parseSizedUrl(src: string | null | undefined): SizedRef | null {
  if (!src || typeof src !== 'string') return null
  const m = SIZED_RE.exec(src)
  if (!m) return null
  return { base: m[1], ext: m[3] as SizedExt }
}

/** 요청한 폭 이상인 가장 작은 저장 폭(없으면 가장 큰 것). 데이터 절약이면 한 칸 내린다. */
export function pickSizedWidth(width: number | undefined, saveData = false): SizedWidth {
  const w = width && width > 0 ? width : 400
  let i = SIZED_WIDTHS.findIndex((s) => s >= w)
  if (i === -1) i = SIZED_WIDTHS.length - 1
  if (saveData && i > 0) i -= 1
  return SIZED_WIDTHS[i]
}

export function sizedKey(ref: SizedRef, width: SizedWidth): string {
  return `${ref.base}w${width}.${ref.ext}`
}

/** 화면에 내보낼 주소 — R2 공개 도메인 그대로(변환 0). */
export function sizedVariantUrl(ref: SizedRef, width: SizedWidth): string {
  return `${SIZED_PUBLIC_ORIGIN}/${sizedKey(ref, width)}`
}

/** 업로드가 저장 주소로 돌려주는 모양 — 가장 큰 크기. */
export function sizedStoredUrl(ref: SizedRef, publicBase = ''): string {
  const key = sizedKey(ref, SIZED_MAX_WIDTH)
  return publicBase ? `${publicBase.replace(/\/$/, '')}/${key}` : `/api/media/${key}`
}

/** 업로드 묶음 이름(`2026-11/abcdEFGH12345678`) — 클라가 두 번째 크기부터 같은 자리에 넣으려고 되돌려 보낸다. */
export const SIZED_BATCH_RE = /^\d{4}-\d{2}\/[A-Za-z0-9]{16}$/

export function isSizedWidth(n: number): n is SizedWidth {
  return (SIZED_WIDTHS as readonly number[]).includes(n)
}
