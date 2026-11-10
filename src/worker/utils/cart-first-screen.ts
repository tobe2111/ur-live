/**
 * 🧺 장바구니(`/cart`) 서버 첫 화면 (2026-11-10).
 *
 * 라이브 실측(폰 4G · CPU 4배): HTML 0.3~0.5s · **첫 그림 2.1s**(로더-먼저만). 머리줄(닫기 · 장바구니)은 고정 모양이고 담긴 것은
 * API 가 와야 안다 — [머리줄(개수 없음) + 로더]까지만 그린다. 비로그인도 들어오는 화면이라(결제 때만 로그인) 세션 조건이 없다.
 * 같은 모양의 근거: `shared/cart-page.ts`(`CartHeader` 와 `CartPage` 로딩 분기가 같은 상수). 닫기 아이콘은 같은 크기 빈 칸.
 * 그리지 않는 것: 개수(`장바구니 3`) · 전체선택 줄(담긴 게 있을 때만 앱이 머리줄 아래에 세운다 — 아래로만 자란다) · 목록.
 * 🖥️ PC: 430 액자 → 게스트 탭과 같은 [네비 높이 예약 + 액자].
 */
import { CART_CLS, CART_COPY, CART_BACK_ICON } from '../../shared/cart-page'
import { PC_HOME_FS } from '../../shared/pc-home-first-screen'
import { GUEST_PC_FRAME } from './guest-first-screen'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function buildCartFirstScreen(loaderHtml: string, isMobile = true): string {
  const header = `<div class="${CART_CLS.header}"><div class="${CART_CLS.headerRow}">` +
    `<span class="${CART_CLS.back}" aria-hidden="true"><span class="${CART_CLS.backIcon} block" style="width:${CART_BACK_ICON}px;height:${CART_BACK_ICON}px"></span></span>` +
    `<h1 class="${CART_CLS.title}">${esc(CART_COPY.title)} </h1><div class="${CART_CLS.spacer}"></div></div></div>`
  const page = `<div class="${CART_CLS.root}">${header}</div>`
  const topnav = isMobile ? '' : `<div class="${PC_HOME_FS.topnav}"><div class="${PC_HOME_FS.topnavRow1}"></div><div class="${PC_HOME_FS.topnavRow2}"></div></div>`
  const framed = isMobile ? page : `<div class="${GUEST_PC_FRAME.cls}" data-mobile-only="false" style="--app-frame:${GUEST_PC_FRAME.width}">${page}</div>`
  // 🧷 노드 id 는 다른 첫 화면과 같다 — `lib/boot-first-screen.ts` 가 이 노드를 Suspense 폴백에 도로 붙인다. 목록 자리는 그 아래 로더.
  return `<div id="ur-first-screen">${topnav}${framed}</div>${loaderHtml.replace('min-height:100dvh', 'min-height:34dvh')}`
}
