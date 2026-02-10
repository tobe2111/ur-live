/**
 * UI 테마 설정
 * 프로젝트 전체의 UI 스타일을 쉽게 변경할 수 있는 설정 파일
 */

import tokens from './tokens'

// ============================================
// 라이브 페이지 테마
// ============================================
export const livePageTheme = {
  // 비디오 플레이어
  videoPlayer: {
    container: 'absolute inset-0 w-full h-full bg-black',
    loading: 'absolute inset-0 bg-black flex items-center justify-center',
    loadingText: 'text-white text-base sm:text-lg font-semibold',
  },

  // 상품 카드
  productCard: {
    container: 'bg-white rounded-2xl sm:rounded-3xl shadow-lg p-4 sm:p-6',
    image: 'w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover',
    title: tokens.typography.fontSizeResponsive.emphasis + ' font-bold text-gray-900',
    price: 'text-xl sm:text-2xl font-bold text-gray-900',
    originalPrice: 'text-sm sm:text-base text-gray-400 line-through',
  },

  // 버튼
  addToCartButton: {
    default: tokens.cn(
      tokens.buttons.sizeResponsive.large,
      tokens.buttons.variant.primary,
      tokens.buttons.shape.pill,
      'w-full'
    ),
    disabled: 'bg-gray-300 text-gray-500 cursor-not-allowed',
    soldOut: 'bg-red-500 text-white',
  },

  // 채팅
  chat: {
    container: 'bg-black/50 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-3 sm:p-4',
    message: 'text-sm sm:text-base text-white',
    username: 'font-bold text-yellow-400',
  },

  // 뱃지
  badges: {
    live: tokens.cn(tokens.badges.variant.live, tokens.badges.shape.pill, tokens.badges.size.md),
    soldOut: tokens.cn(tokens.badges.variant.soldOut, tokens.badges.shape.pill, tokens.badges.size.md),
    stock: tokens.cn(tokens.badges.variant.stock, tokens.badges.shape.pill, tokens.badges.size.sm),
    discount: tokens.cn(tokens.badges.variant.discount, tokens.badges.shape.rounded, tokens.badges.size.sm),
  },
}

// ============================================
// 장바구니 페이지 테마
// ============================================
export const cartPageTheme = {
  // 페이지 컨테이너
  container: tokens.presets.pageContainer,
  wrapper: tokens.presets.contentWrapper,

  // 장바구니 아이템
  item: {
    container: tokens.cn(
      tokens.cards.variant.default,
      tokens.cards.padding.responsive,
      'mb-4'
    ),
    grid: 'grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr_auto] gap-4',
    image: 'w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover',
    title: tokens.typography.fontSizeResponsive.body + ' font-bold text-gray-900',
    price: tokens.typography.fontSizeResponsive.emphasis + ' font-bold text-gray-900',
    quantity: 'flex items-center gap-2 sm:gap-3',
  },

  // 수량 조절 버튼
  quantityButton: {
    default: tokens.cn(
      'w-8 h-8 sm:w-10 sm:h-10',
      'flex items-center justify-center',
      'rounded-full',
      'bg-gray-100 hover:bg-gray-200',
      'transition-all'
    ),
  },

  // 요약
  summary: {
    container: tokens.cn(
      tokens.cards.variant.flat,
      tokens.cards.padding.responsive,
      'sticky bottom-0 sm:relative'
    ),
    row: 'flex justify-between items-center py-2',
    label: tokens.typography.fontSizeResponsive.body + ' text-gray-600',
    value: tokens.typography.fontSizeResponsive.emphasis + ' font-bold text-gray-900',
    total: 'text-lg sm:text-xl md:text-2xl font-extrabold text-gray-900',
  },

  // 체크아웃 버튼
  checkoutButton: tokens.cn(
    tokens.buttons.sizeResponsive.large,
    tokens.buttons.variant.primary,
    tokens.buttons.shape.pill,
    'w-full'
  ),
}

// ============================================
// 홈 페이지 테마
// ============================================
export const homePageTheme = {
  // 히어로 섹션
  hero: {
    container: 'relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-yellow-50',
    title: tokens.typography.fontSizeResponsive.display + ' font-extrabold text-gray-900',
    subtitle: tokens.typography.fontSizeResponsive.heading + ' text-gray-600',
    cta: tokens.cn(
      tokens.buttons.sizeResponsive.large,
      tokens.buttons.variant.primary,
      tokens.buttons.shape.pill
    ),
  },

  // 라이브 카드
  liveCard: {
    container: tokens.cn(
      tokens.cards.variant.elevated,
      'overflow-hidden'
    ),
    thumbnail: 'aspect-video object-cover transition-transform duration-500 group-hover:scale-110',
    title: tokens.typography.fontSizeResponsive.heading + ' font-bold text-gray-900 line-clamp-2',
    seller: tokens.typography.fontSizeResponsive.body + ' text-gray-700',
  },

  // 인기 상품 카드
  productCard: {
    container: tokens.cn(
      tokens.cards.variant.default,
      'overflow-hidden group'
    ),
    image: 'aspect-square object-cover transition-transform duration-500 group-hover:scale-110',
    title: 'text-sm sm:text-base font-bold text-gray-900 line-clamp-2',
    price: 'text-lg sm:text-xl font-bold text-gray-900',
  },
}

// ============================================
// 공통 컴포넌트 테마
// ============================================
export const commonTheme = {
  // 헤더
  header: {
    container: tokens.presets.header,
    logo: 'flex items-center space-x-3',
    logoIcon: 'flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FFD700] to-[#FFA500] shadow-lg',
    navigation: 'hidden md:flex items-center space-x-8',
    navLink: tokens.typography.fontSize.base + ' font-medium text-gray-600 hover:text-gray-900 transition-colors',
  },

  // 푸터
  footer: {
    container: 'border-t border-gray-200 bg-gray-50',
    wrapper: tokens.presets.contentWrapper + ' py-12',
    link: 'text-sm text-gray-600 hover:text-gray-900 transition-colors',
    text: 'text-sm text-gray-600',
  },

  // 모달
  modal: {
    overlay: 'fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center',
    container: tokens.cn(
      tokens.cards.variant.glass,
      'max-w-md w-full mx-4',
      tokens.cards.padding.lg
    ),
    title: tokens.typography.fontSize['2xl'] + ' font-bold text-gray-900 mb-4',
    message: tokens.typography.fontSize.base + ' text-gray-600 mb-6',
  },

  // 로딩
  loading: {
    container: 'flex items-center justify-center py-8',
    spinner: 'animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-[#FFD700]',
    text: tokens.typography.fontSize.base + ' text-gray-600 mt-4',
  },

  // 빈 상태
  empty: {
    container: 'flex flex-col items-center justify-center py-16',
    icon: 'h-16 w-16 text-gray-400 mb-4',
    title: tokens.typography.fontSize.xl + ' font-bold text-gray-900 mb-2',
    message: tokens.typography.fontSize.base + ' text-gray-600',
  },
}

// ============================================
// Export All Themes
// ============================================
const themes = {
  live: livePageTheme,
  cart: cartPageTheme,
  home: homePageTheme,
  common: commonTheme,
}

export default themes
