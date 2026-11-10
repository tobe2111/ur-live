/**
 * 🧺 장바구니(`/cart`)의 **머리줄 클래스·문구 SSOT** (2026-11-10 — 라이브 폰 첫 그림 2.1s · HTML 0.3~0.5s).
 *
 * 화면(`components/cart/CartHeader.tsx` · `pages/CartPage.tsx` 로딩 분기)과 서버 첫 화면(`worker/utils/cart-first-screen.ts`)이
 * 이 파일 하나를 읽는다. 서버는 [머리줄(개수 없음) + 로더]만 그린다 — 담긴 것은 API(`/api/cart`)가 와야 안다.
 * 로딩 분기도 같은 머리줄을 그려야 서버 그림 → 로딩 → 완성이 한 모양으로 이어진다(종전엔 로딩이 흰 바탕 + 큰 로더였다).
 */
export const CART_CLS = {
  root: 'flex flex-col min-h-[100dvh] bg-warm',
  header: 'sticky top-0 z-10 bg-white dark:bg-[#11141C] border-b border-gray-100 dark:border-[#2C2F35]',
  headerRow: 'mx-auto max-w-md lg:max-w-[1020px] flex items-center justify-between px-5 py-3',
  back: 'w-9 h-9 flex items-center justify-center',
  backIcon: 'text-gray-900 dark:text-white',
  title: 'text-[16px] font-bold text-gray-900 dark:text-white',
  count: 'text-brand-text tabular-nums',
  spacer: 'w-9',
} as const

/** 닫기(X) 아이콘 크기 — lucide `size` 와 서버 빈 칸이 같은 px. */
export const CART_BACK_ICON = 22

export const CART_COPY = {
  title: '장바구니',
  back: '뒤로 가기',
  loading: '로딩 중...',
} as const
