/**
 * 🎨 2026-07-19 대표 확정 로고(Final 핸드오프) — 세컨더리(비즈니스) 파비콘 스왑.
 *
 * 사양: 기본 아이콘 = 로즈 #1C69EF + 흰 ur / 세컨더리(셀러·문서·비즈니스) = 네이비 #16181C + 로즈 r.
 * 셀러 대시보드(/seller/*) 탭에서 세컨더리 파비콘으로 교체, 이탈 시 원복.
 * (도매몰은 worker HTMLRewriter 가 favicon-utong.svg 로 전면 교체 — 서비스 분리, 이 모듈 무관.)
 */
const BIZ_32 = '/favicon-biz-32.png'

let saved: { el: HTMLLinkElement; href: string; type: string | null }[] | null = null

export function applyBizFavicon(): void {
  if (typeof document === 'undefined' || saved) return
  const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]'))
  if (!links.length) return
  saved = links.map((el) => ({ el, href: el.getAttribute('href') || '', type: el.getAttribute('type') }))
  for (const el of links) {
    el.setAttribute('href', BIZ_32)
    el.setAttribute('type', 'image/png')
  }
}

export function restoreDefaultFavicon(): void {
  if (!saved) return
  for (const { el, href, type } of saved) {
    el.setAttribute('href', href)
    if (type) el.setAttribute('type', type)
  }
  saved = null
}
