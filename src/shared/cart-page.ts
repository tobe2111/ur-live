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
  empty: '장바구니가 비어있습니다',
  emptySubtitle: '마음에 드는 상품을 담아보세요',
  continueShop: '쇼핑 계속하기',
} as const

/**
 * 🧺 빈 장바구니(`components/cart/EmptyCart.tsx`) — 비로그인은 `/api/cart` 가 401 이라 **언제나** 이 화면이다.
 *   그래서 세션 쿠키가 없으면 서버가 머리줄 아래에 이것까지 그린다(로더 없이 — 화면이 완성이다). 로그인은 API 가 와야 안다 → 로더.
 */
export const CART_EMPTY_CLS = {
  wrap: 'flex flex-col items-center justify-center py-20 px-4',
  iconBox: 'w-20 h-20 bg-gray-50 dark:bg-[#1D1F29] rounded-full flex items-center justify-center mb-5',
  icon: 'text-gray-300 dark:text-gray-600',
  title: 'text-[16px] font-semibold text-gray-900 dark:text-white mb-2',
  desc: 'text-[13px] text-gray-500 dark:text-gray-400 text-center mb-8',
  btn: 'px-8 py-3 bg-brand text-white text-[15px] font-bold rounded-xl hover:bg-brand-dark transition-colors active:scale-[0.98]',
} as const
/** 빈 장바구니 가방 아이콘 크기 — `BagIcon size` 와 서버 빈 칸이 같은 px. */
export const CART_EMPTY_ICON = 36
