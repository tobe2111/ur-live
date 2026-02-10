/**
 * 디자인 토큰 (Design Tokens)
 * UI 변경을 쉽게 하기 위한 중앙 집중식 설정
 */

// ============================================
// 색상 (Colors)
// ============================================
export const colors = {
  // 브랜드 색상
  brand: {
    primary: '#FFD700',      // 골드
    primaryDark: '#FFC700',
    secondary: '#FFA500',    // 오렌지
    secondaryDark: '#FF9500',
    purple: '#6A5ACD',       // 퍼플
    purpleDark: '#5A4ABD',
  },

  // 상태 색상
  status: {
    success: '#22C55E',
    warning: '#F97316',
    error: '#EF4444',
    info: '#3B82F6',
  },

  // 그레이스케일
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },

  // 특수 색상
  special: {
    live: '#EF4444',         // 라이브 뱃지
    soldOut: '#EF4444',      // 품절
    stockWarning: '#F97316', // 재고 경고
  },
}

// ============================================
// 타이포그래피 (Typography)
// ============================================
export const typography = {
  // 폰트 크기 (Tailwind 클래스명)
  fontSize: {
    xs: 'text-xs',       // 12px
    sm: 'text-sm',       // 14px
    base: 'text-base',   // 16px
    lg: 'text-lg',       // 18px
    xl: 'text-xl',       // 20px
    '2xl': 'text-2xl',   // 24px
    '3xl': 'text-3xl',   // 30px
    '4xl': 'text-4xl',   // 36px
    '5xl': 'text-5xl',   // 48px
  },

  // 반응형 폰트 크기
  fontSizeResponsive: {
    // 작은 텍스트 (보조 정보)
    small: 'text-xs sm:text-sm',
    // 본문 텍스트
    body: 'text-sm sm:text-base',
    // 강조 텍스트
    emphasis: 'text-base sm:text-lg',
    // 제목
    heading: 'text-lg sm:text-xl md:text-2xl',
    // 대형 제목
    display: 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl',
  },

  // 폰트 굵기
  fontWeight: {
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
    extrabold: 'font-extrabold',
  },
}

// ============================================
// 간격 (Spacing)
// ============================================
export const spacing = {
  // 패딩 (반응형)
  padding: {
    xs: 'px-2 py-1',
    sm: 'px-3 py-2',
    md: 'px-4 py-2',
    lg: 'px-6 py-3',
    xl: 'px-8 py-4',
  },

  // 반응형 패딩
  paddingResponsive: {
    page: 'px-4 sm:px-6 lg:px-8',
    section: 'py-8 sm:py-12 lg:py-16',
    card: 'p-4 sm:p-6 lg:p-8',
  },

  // 여백
  gap: {
    xs: 'gap-2',
    sm: 'gap-3',
    md: 'gap-4',
    lg: 'gap-6',
    xl: 'gap-8',
  },
}

// ============================================
// 버튼 (Buttons)
// ============================================
export const buttons = {
  // 크기
  size: {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4 text-base',
    lg: 'h-12 px-6 text-lg',
    xl: 'h-14 px-8 text-xl',
  },

  // 반응형 크기
  sizeResponsive: {
    default: 'h-10 px-4 sm:h-12 sm:px-6 text-sm sm:text-base',
    large: 'h-12 px-6 sm:h-14 sm:px-8 text-base sm:text-lg',
  },

  // 스타일 변형
  variant: {
    primary: 'bg-gradient-to-r from-[#FFD700] to-[#FFA500] hover:from-[#FFC700] hover:to-[#FF9500] text-gray-900 font-bold shadow-lg hover:shadow-xl transition-all',
    secondary: 'bg-gradient-to-r from-[#6A5ACD] to-[#9370DB] hover:from-[#5A4ABD] hover:to-[#8360CB] text-white font-bold shadow-lg hover:shadow-xl transition-all',
    outline: 'bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-200 font-medium transition-all',
    ghost: 'bg-transparent hover:bg-gray-100 text-gray-700 font-medium transition-all',
    danger: 'bg-red-500 hover:bg-red-600 text-white font-bold shadow-lg hover:shadow-xl transition-all',
  },

  // 모양
  shape: {
    rounded: 'rounded-lg',
    pill: 'rounded-full',
    square: 'rounded-none',
  },
}

// ============================================
// 카드 (Cards)
// ============================================
export const cards = {
  // 기본 카드
  base: 'bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300',
  
  // 카드 변형
  variant: {
    default: 'bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all',
    elevated: 'bg-white rounded-3xl shadow-2xl hover:shadow-3xl transition-all transform hover:scale-105',
    flat: 'bg-white rounded-2xl border border-gray-200 hover:border-gray-300 transition-all',
    glass: 'bg-white/80 backdrop-blur-lg rounded-3xl shadow-xl border border-white/20',
  },

  // 패딩
  padding: {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
    responsive: 'p-4 sm:p-6 lg:p-8',
  },
}

// ============================================
// 그리드 (Grid)
// ============================================
export const grid = {
  // 반응형 그리드
  responsive: {
    // 2-5 컬럼 (모바일 → 데스크톱)
    auto: 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5',
    // 1-3 컬럼
    simple: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    // 1-2 컬럼
    basic: 'grid grid-cols-1 sm:grid-cols-2',
  },

  // 간격
  gap: {
    sm: 'gap-3 sm:gap-4',
    md: 'gap-4 sm:gap-6',
    lg: 'gap-6 sm:gap-8',
  },
}

// ============================================
// 반응형 브레이크포인트
// ============================================
export const breakpoints = {
  sm: '640px',   // 모바일
  md: '768px',   // 태블릿
  lg: '1024px',  // 데스크톱
  xl: '1280px',  // 대형 데스크톱
}

// ============================================
// 애니메이션
// ============================================
export const animations = {
  transition: {
    fast: 'transition-all duration-150',
    normal: 'transition-all duration-300',
    slow: 'transition-all duration-500',
  },

  hover: {
    scale: 'hover:scale-105 transition-transform duration-300',
    lift: 'hover:-translate-y-2 transition-transform duration-300',
  },
}

// ============================================
// 뱃지 (Badges)
// ============================================
export const badges = {
  size: {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  },

  variant: {
    live: 'bg-red-500 text-white font-bold',
    soldOut: 'bg-red-500 text-white font-bold',
    discount: 'bg-red-500 text-white font-bold',
    stock: 'bg-orange-500 text-white font-bold',
    new: 'bg-blue-500 text-white font-bold',
  },

  shape: {
    rounded: 'rounded-lg',
    pill: 'rounded-full',
  },
}

// ============================================
// 헬퍼 유틸리티
// ============================================

/**
 * 클래스명 결합 헬퍼
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

/**
 * 반응형 클래스 생성
 */
export function responsive(mobile: string, desktop?: string): string {
  if (!desktop) return mobile
  return `${mobile} sm:${desktop}`
}

// ============================================
// 사전 정의된 컴포넌트 스타일
// ============================================

export const presets = {
  // 페이지 컨테이너
  pageContainer: 'min-h-screen bg-white',
  
  // 섹션
  section: 'py-8 sm:py-12 lg:py-16',
  
  // 컨텐츠 래퍼
  contentWrapper: 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8',
  
  // 헤더
  header: 'sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100',
  
  // 입력 필드
  input: 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent',
  
  // 텍스트 영역
  textarea: 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none',
}

// ============================================
// Export Default
// ============================================
const tokens = {
  colors,
  typography,
  spacing,
  buttons,
  cards,
  grid,
  breakpoints,
  animations,
  badges,
  cn,
  responsive,
  presets,
}

export default tokens
