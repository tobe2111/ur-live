// ============================================================
// Constants
// ============================================================

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: '결제 대기',
  AWAITING_PAYMENT: '결제 진행중',
  PAID: '결제 완료',
  DONE: '결제 완료',
  PREPARING: '상품 준비중',
  SHIPPING: '배송중',
  DELIVERED: '배송 완료',
  CANCELLED: '취소됨',
  FAILED: '결제 실패',
  REFUNDED: '환불 완료',
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-yellow-600 bg-yellow-50',
  AWAITING_PAYMENT: 'text-blue-600 bg-blue-50',
  PAID: 'text-green-600 bg-green-50',
  DONE: 'text-green-600 bg-green-50',
  PREPARING: 'text-indigo-600 bg-indigo-50',
  SHIPPING: 'text-purple-600 bg-purple-50',
  DELIVERED: 'text-teal-600 bg-teal-50',
  CANCELLED: 'text-red-600 bg-red-50',
  FAILED: 'text-red-600 bg-red-50',
  REFUNDED: 'text-gray-600 bg-gray-50',
};

export const TOSS_PAYMENT_URL = 'https://api.tosspayments.com/v1';

export const API_ROUTES = {
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    LOGOUT: '/api/auth/logout',
    REFRESH: '/api/auth/refresh',
    ME: '/api/auth/me',
  },
  PRODUCTS: {
    LIST: '/api/products',
    DETAIL: (id: string) => `/api/products/${id}`,
  },
  SELLERS: {
    LIST: '/api/sellers',
    DETAIL: (id: string) => `/api/sellers/${id}`,
  },
  ORDERS: {
    CREATE: '/api/orders',
    LIST: '/api/orders',
    DETAIL: (id: string) => `/api/orders/${id}`,
    CANCEL: (id: string) => `/api/orders/${id}/cancel`,
  },
  PAYMENTS: {
    CONFIRM: '/api/payments/confirm',
    WEBHOOK: '/api/payments/webhook',
    CHECKOUT_SESSION: '/api/payments/checkout-session',
  },
} as const;

export const SUPPORTED_CURRENCIES = ['KRW', 'USD', 'JPY', 'EUR', 'CNY'] as const;
export const SUPPORTED_LOCALES = ['ko', 'en', 'ja', 'zh'] as const;
export const SUPPORTED_COUNTRIES = ['KR', 'US', 'JP', 'CN', 'EU'] as const;

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_CART_ITEMS = 50;
export const MAX_QUANTITY_PER_ITEM = 99;

export const JWT_ACCESS_TOKEN_EXPIRY = 15 * 60;       // 15 minutes
export const JWT_REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60; // 30 days

// ============================================================
// CORS — 허용 도메인 목록 (모든 라우트에서 공유)
// ============================================================
export const ALLOWED_ORIGINS = [
  'https://ur-live.pages.dev',
  'https://www.ur-live.com',
  'https://live.ur-team.com',
  'https://ur-team.com',
  'https://www.ur-team.com',
  ...(typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production' ? ['http://localhost:5173', 'http://localhost:3000'] : []),
] as string[];

// ============================================================
// 비즈니스 상수
// ============================================================
export const DEFAULT_COMMISSION_RATE = 10.00;           // 셀러 기본 수수료율 (%)
export const DONATION_COMMISSION_RATE = 0.10;           // 후원 플랫폼 수수료율 (10%)
export const CREDIT_UNIT_PRICE = 8;                     // 알림톡 크레딧 1건 = 8원
export const MIN_PASSWORD_LENGTH = 8;                   // 비밀번호 최소 길이

// ============================================================
// Firebase
// ============================================================
export const FIREBASE_RTDB_URL = 'https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app';
export const FIREBASE_APP_URL = 'https://urteam-live-commerce-5b284.firebaseapp.com';

// ============================================================
// 외부 API Base URLs
// ============================================================
export const TOSS_PAYMENT_CONFIRM_URL = `${TOSS_PAYMENT_URL}/payments/confirm`;
export const ALIGO_API_BASE = 'https://kakaoapi.aligo.in/akv10';
export const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
export const YOUTUBE_OAUTH_BASE = 'https://oauth2.googleapis.com';
export const TRACKER_GRAPHQL_URL = 'https://apis.tracker.delivery/graphql';

// ============================================================
// 🛡️ 2026-05-17: 공구권 카테고리 6종 → 4종 통합.
//   대분류: 오프라인(voucher 4종, 매장 방문) vs 온라인(일반 상품, 배송).
//   기존 health → beauty 통합, pet/activity → etc 통합.
//   레거시 카테고리 호환: voucher-categories.ts 의 normalizeCategory() 사용.
// ============================================================
export const VOUCHER_CATEGORIES = [
  'meal_voucher',    // 식사권 (음식점/카페)
  'beauty_voucher',  // 미용 (헬스/뷰티)
  'stay_voucher',    // 숙소 (펜션/호텔/모텔)
  'etc_voucher',     // 기타 (펫/액티비티/그 외)
] as const;
export type VoucherCategory = typeof VOUCHER_CATEGORIES[number];

export const VOUCHER_CATEGORY_LABELS: Record<VoucherCategory, string> = {
  meal_voucher:   '식사권',
  beauty_voucher: '미용',
  stay_voucher:   '숙소',
  etc_voucher:    '기타',
};

export const VOUCHER_CATEGORY_ICONS: Record<VoucherCategory, string> = {
  meal_voucher:   '🍽️',
  beauty_voucher: '💇',
  stay_voucher:   '🏨',
  etc_voucher:    '🎯',
};

// SQL IN 절용 SQL placeholder (legacy + new 모두 — 마이그레이션 사이 graceful).
const _ALL_LEGACY_AND_NEW = [...VOUCHER_CATEGORIES, 'health_voucher', 'pet_voucher', 'activity_voucher'] as const;
export const VOUCHER_CATEGORY_SQL_PLACEHOLDERS = _ALL_LEGACY_AND_NEW.map(() => '?').join(',');
export const VOUCHER_CATEGORY_SQL_VALUES = _ALL_LEGACY_AND_NEW;
