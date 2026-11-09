/**
 * 🖥️ 교환권 목록(`/vouchers`) **PC(lg+) 서버 첫 화면** 의 클래스·문구 (2026-11-09 대표 승인 — "가장 이상적으로 진행").
 *
 * 라이브 실측(1440px · 4G · CPU 4배): PC 교환권 첫 글자 **2.27s**(로더-먼저만 걸려 있었다 — 폰 첫 화면은 넓은 화면이면 스스로 걷어낸다).
 * PC 레이아웃은 폰과 다르다: [상단 네비] + 2열(좌 248px 레일 · 우 상품 격자 3/5열). 그래서 폰 첫 화면을 넓혀 쓰지 않고 따로 그린다.
 *
 * 값은 React 원본의 className **그대로** — `VouchersPage.tsx`(격자·레일·머리 줄) · `vouchers/shared.tsx`(`VoucherCard`) ·
 * `vouchers/TopChromeReserve.tsx`(`PC_BRAND`·`PcBrandStripReserve`) · `vouchers/DealBalanceCard.tsx`(비로그인 compact) ·
 * `vouchers/GifticonBoxEntry.tsx`(레일 줄) · `ui/sort-menu.tsx`. 시험이 원본 소스에서 문자열을 뽑아 한 글자씩 대조한다.
 *
 * 그리지 않는 것: 레일의 **카테고리 세로 목록**(`/api/vouchers/sections` 가 와야 안다 — 레일은 자기 폭 안에서만 자라므로 우측 격자는 안 움직인다) ·
 *   아이콘(lucide·유어딜 세트 — 같은 치수 빈 칸) · 로그인 잔액(비로그인 화면이다 — 로그인 흔적이면 가드가 걷어낸다).
 */
export const VOUCHERS_PC_FS = {
  page: 'bg-warm dark:bg-[#11141C] min-h-[100dvh]',
  h1Text: '교환권 — 인기 브랜드 기프티콘을 딜로 즉시 구매',
  grid: 'ur-content-wide px-8 py-6 grid grid-cols-[248px_minmax(0,1fr)] gap-8 items-start',
  rail: 'sticky top-[120px] self-start space-y-5',
  /** `DealBalanceCard` 비로그인 compact 버튼 */
  balanceBtn: 'w-full flex items-center justify-between gap-2 rounded-xl active:scale-[0.99] transition-transform px-3 py-2',
  balanceText: 'text-[12px] text-gray-600 dark:text-gray-300 truncate text-left',
  balanceCta: 'shrink-0 inline-flex items-center gap-1 text-[12px] font-medium text-brand-text',
  /** `GifticonBoxRailRow` */
  giftRow: 'w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-line text-left hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors',
  giftIcon: 'w-[18px] h-[18px] shrink-0 text-gray-500 dark:text-gray-400',
  giftLabel: 'flex-1 text-[13px] font-medium text-gray-900 dark:text-white',
  giftChev: 'w-4 h-4 shrink-0 text-gray-300 dark:text-gray-600',
  /** `PC_BRAND` + `PcBrandStripReserve` */
  brandWrap: 'mb-5 pb-4 border-b border-gray-100 dark:border-[#2C2F35]',
  brandTitle: 'text-[12px] font-medium text-gray-400 dark:text-gray-500 mb-2',
  brandRow: 'flex gap-3 overflow-x-auto scrollbar-hide py-1',
  brandChip: 'flex flex-col items-center gap-1 shrink-0',
  brandTile: 'w-12 h-12 rounded-2xl block',
  brandLabel: 'text-[12px] max-w-[56px]',
  /** 머리 줄 */
  head: 'flex items-center justify-between gap-2 mb-5',
  h2: 'text-[16px] font-semibold text-gray-900 dark:text-white flex items-center gap-2 min-w-0',
  h2Count: 'text-[15px] font-medium text-gray-400 dark:text-gray-500 shrink-0',
  /** `SortMenu` 버튼 */
  sortWrap: 'relative shrink-0',
  sortBtn: 'inline-flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-2 text-[12px] font-medium text-gray-900 dark:text-white active:scale-[0.98] transition-transform',
  /** 격자 + `VoucherCard` */
  cards: 'grid grid-cols-3 xl:grid-cols-5 gap-x-3 gap-y-3',
  card: 'ur-cv-card text-left active:scale-[0.98] transition-transform w-full flex flex-col rounded-2xl overflow-hidden',
  cardImgBox: 'relative aspect-square w-full overflow-hidden bg-gradient-to-b from-[#F7F8FA] to-[#EFF1F4] dark:from-[#15171C] dark:to-[#0F1115]',
  cardImg: 'w-full h-full object-cover',
  cardBody: 'px-2 pt-2 pb-2 flex flex-col flex-1',
  cardBrand: 'text-[12px] font-medium leading-none mb-1 text-gray-400 dark:text-gray-500',
  cardName: 'text-[13px] leading-tight line-clamp-2 font-medium text-gray-800 dark:text-gray-100',
  cardPriceRow: 'flex items-baseline gap-1 mt-1',
  cardDiscount: 'text-[15px] font-bold text-sale dark:text-[#4D8DF5] tracking-tight',
  cardPrice: 'text-[16px] font-bold text-[#171B24] dark:text-white tracking-tight',
  cardUnit: 'text-[12px] font-medium text-[#171B24] dark:text-white',
  cardStrike: 'text-[12px] ml-1 leading-none line-through text-gray-300 dark:text-gray-600',
  cardSold: 'mt-1 text-[12px] text-gray-400 dark:text-gray-500',
} as const
export const VOUCHERS_PC_COPY = { balance: '딜을 모으면 더 싸게 살 수 있어요', balanceCta: '모으는 방법 ', gift: '내 교환권', sort: '낮은 가격순' } as const
/** `VoucherCard` 사진 폭·sizes · 첫 화면 카드 수(3열 2줄 = 6 ~ 5열 2줄 = 10 → 10) · 앞 8장 eager(`aboveFold={idx < 8}`) */
export const VOUCHERS_PC_IMG_W = 300
export const VOUCHERS_PC_IMG_SIZES = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px'
export const VOUCHERS_PC_CARDS = 10
export const VOUCHERS_PC_ABOVE_FOLD = 8
