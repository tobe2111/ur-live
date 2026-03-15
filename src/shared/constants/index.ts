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
