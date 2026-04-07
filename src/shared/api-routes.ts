/**
 * ============================================================
 * API Route Registry — Single Source of Truth
 * ============================================================
 *
 * 이 파일이 프로젝트의 API 경로 명세서입니다.
 *
 * 규칙:
 * 1. 프론트엔드 API 호출 경로를 결정할 때 반드시 이 파일을 참조할 것
 * 2. 백엔드에 새 라우트 추가 시 이 파일도 동시에 업데이트할 것
 * 3. worker/index.ts 의 app.route() 등록 경로와 반드시 일치할 것
 *
 * 사용법 (프론트엔드):
 *   import { API } from '@/shared/api-routes'
 *   api.get(API.streams.list)  // '/api/streams'
 *   api.get(API.streams.detail(id))  // '/api/streams/123'
 *
 * CI 검증: scripts/validate-routes.ts 가 이 파일을 기준으로 백엔드 등록 일치 여부를 확인함
 * ============================================================
 */

// ── Auth ────────────────────────────────────────────────────────────────────

export const AUTH = {
  /** POST /api/auth/register */
  register: '/api/auth/register',
  /** POST /api/auth/login */
  login: '/api/auth/login',
  /** POST /api/auth/logout */
  logout: '/api/auth/logout',
  /** POST /api/auth/refresh */
  refresh: '/api/auth/refresh',
  /** GET  /api/auth/me */
  me: '/api/auth/me',
  /** GET  /api/auth/validate  — 세션 유효성 검증 */
  validate: '/api/auth/validate',

  kakao: {
    /** POST /api/auth/kakao/callback */
    callback: '/api/auth/kakao/callback',
    /** POST /api/auth/kakao/firebase  — Kakao→Firebase 커스텀 토큰 교환 */
    firebase: '/api/auth/kakao/firebase',
  },

  google: {
    /** POST /api/auth/google/register */
    register: '/api/auth/google/register',
  },
} as const;

// ── Users ───────────────────────────────────────────────────────────────────

export const USERS = {
  /** GET  /api/users/role  — Firebase 토큰에서 역할 반환 */
  role: '/api/users/role',
  /** POST /api/users/init  — Firebase 회원가입 후 DB 초기화 */
  init: '/api/users/init',
} as const;

// ── Products ────────────────────────────────────────────────────────────────

export const PRODUCTS = {
  /** GET /api/products */
  list: '/api/products',
  /** GET /api/products/:id */
  detail: (id: string | number) => `/api/products/${id}` as const,
  /** GET /api/products/:id/options */
  options: (id: string | number) => `/api/products/${id}/options` as const,
} as const;

// ── Search ──────────────────────────────────────────────────────────────────

export const SEARCH = {
  /** GET /api/search/popular */
  popular: '/api/search/popular',
  /** GET /api/search/suggestions?q=... */
  suggestions: '/api/search/suggestions',
} as const;

// ── Streams (공개) ───────────────────────────────────────────────────────────

export const STREAMS = {
  /** GET  /api/streams */
  list: '/api/streams',
  /** GET  /api/streams/:id */
  detail: (id: string | number) => `/api/streams/${id}` as const,
  /** GET  /api/streams/:id/products */
  products: (id: string | number) => `/api/streams/${id}/products` as const,
  /** GET  /api/streams/:id/current-product */
  currentProduct: (id: string | number) => `/api/streams/${id}/current-product` as const,
  /** POST /api/streams/:id/current-product */
  setCurrentProduct: (id: string | number) => `/api/streams/${id}/current-product` as const,
  /** GET  /api/streams/:id/viewer-count */
  viewerCount: (id: string | number) => `/api/streams/${id}/viewer-count` as const,
  /** POST /api/streams/:id/viewer/join */
  viewerJoin: (id: string | number) => `/api/streams/${id}/viewer/join` as const,
  /** POST /api/streams/:id/fake-cart-notification  — 라이브 방송 중 장바구니 알림 시뮬레이션 */
  fakeCartNotification: (id: string | number) => `/api/streams/${id}/fake-cart-notification` as const,
} as const;

// ── Wishlists ────────────────────────────────────────────────────────────────

export const WISHLISTS = {
  /** GET    /api/wishlists?user_id=... */
  list: '/api/wishlists',
  /** POST   /api/wishlists */
  add: '/api/wishlists',
  /** POST   /api/wishlists/toggle */
  toggle: '/api/wishlists/toggle',
  /** DELETE /api/wishlists */
  clear: '/api/wishlists',
  /** DELETE /api/wishlists/:id */
  deleteById: (id: string | number) => `/api/wishlists/${id}` as const,
  /** DELETE /api/wishlists/product/:productId */
  deleteByProduct: (productId: string | number) => `/api/wishlists/product/${productId}` as const,
  /** GET    /api/wishlists/:userId */
  byUser: (userId: string | number) => `/api/wishlists/${userId}` as const,
  /** GET    /api/wishlists/check/:userId/:productId */
  check: (userId: string | number, productId: string | number) =>
    `/api/wishlists/check/${userId}/${productId}` as const,
} as const;

// ── Cart ─────────────────────────────────────────────────────────────────────

export const CART = {
  /** GET    /api/cart */
  list: '/api/cart',
  /** POST   /api/cart */
  add: '/api/cart',
  /** PUT    /api/cart/:id */
  update: (id: string | number) => `/api/cart/${id}` as const,
  /** DELETE /api/cart/:id */
  remove: (id: string | number) => `/api/cart/${id}` as const,
  /** POST   /api/cart/clear */
  clear: '/api/cart/clear',
} as const;

// ── Orders ───────────────────────────────────────────────────────────────────

export const ORDERS = {
  /** GET  /api/orders */
  list: '/api/orders',
  /** POST /api/orders */
  create: '/api/orders',
  /** GET  /api/orders/:id */
  detail: (id: string | number) => `/api/orders/${id}` as const,
  /** POST /api/orders/:id/cancel */
  cancel: (id: string | number) => `/api/orders/${id}/cancel` as const,
  /** POST /api/orders/refund */
  refund: '/api/orders/refund',
} as const;

// ── Payments ─────────────────────────────────────────────────────────────────

export const PAYMENTS = {
  /** POST /api/payments/confirm */
  confirm: '/api/payments/confirm',
  /** POST /api/payments/rollback */
  rollback: '/api/payments/rollback',
} as const;

// ── Seller ───────────────────────────────────────────────────────────────────

export const SELLER = {
  /** POST /api/seller/register */
  register: '/api/seller/register',
  /** POST /api/seller/login */
  login: '/api/seller/login',
  /** GET  /api/seller/profile */
  profile: '/api/seller/profile',
  /** PUT  /api/seller/profile */
  updateProfile: '/api/seller/profile',
  /** GET  /api/seller/personal-info */
  personalInfo: '/api/seller/personal-info',
  /** PUT  /api/seller/personal-info */
  updatePersonalInfo: '/api/seller/personal-info',
  /** GET  /api/seller/business-info */
  businessInfo: '/api/seller/business-info',
  /** PUT  /api/seller/business-info */
  updateBusinessInfo: '/api/seller/business-info',
  /** GET  /api/seller/stats */
  stats: '/api/seller/stats',
  /** GET  /api/seller/dashboard/stats */
  dashboardStats: '/api/seller/dashboard/stats',
  /** POST /api/seller/upload-image */
  uploadImage: '/api/seller/upload-image',
  /** POST /api/seller/change-password */
  changePassword: '/api/seller/change-password',

  /** GET  /api/seller/public/:sellerId  — 비인증 판매자 공개 프로필 */
  publicProfile: (sellerId: string | number) => `/api/seller/public/${sellerId}` as const,

  orders: {
    /** GET /api/seller/orders */
    list: '/api/seller/orders',
    /** PUT /api/seller/orders/:id/status */
    updateStatus: (id: string | number) => `/api/seller/orders/${id}/status` as const,
    /** GET /api/seller/products */
    products: '/api/seller/products',
  },

  products: {
    /** GET /api/seller/products */
    list: '/api/seller/products',
    /** GET /api/seller/products/:id */
    detail: (id: string | number) => `/api/seller/products/${id}` as const,
    /** GET /api/seller/products/:id/options */
    options: (id: string | number) => `/api/seller/products/${id}/options` as const,
  },

  streams: {
    /** GET  /api/seller/streams */
    list: '/api/seller/streams',
    /** GET  /api/seller/streams/:id */
    detail: (id: string | number) => `/api/seller/streams/${id}` as const,
    /** POST /api/seller/streams */
    create: '/api/seller/streams',
    /** PUT  /api/seller/streams/:id */
    update: (id: string | number) => `/api/seller/streams/${id}` as const,
    /** DELETE /api/seller/streams/:id */
    delete: (id: string | number) => `/api/seller/streams/${id}` as const,
    /** POST /api/seller/streams/:streamId/change-product */
    changeProduct: (streamId: string | number) => `/api/seller/streams/${streamId}/change-product` as const,
  },

  settlements: {
    /** GET  /api/seller/settlements */
    list: '/api/seller/settlements',
    /** POST /api/seller/settlements/request */
    request: '/api/seller/settlements/request',
    /** GET  /api/seller/settlements/stats */
    stats: '/api/seller/settlements/stats',
    /** GET  /api/seller/settlements/summary */
    summary: '/api/seller/settlements/summary',
    /** GET  /api/seller/settlements/:id/download */
    download: (id: string | number) => `/api/seller/settlements/${id}/download` as const,
  },

  youtube: {
    /** GET  /api/seller/youtube/auth-url */
    authUrl: '/api/seller/youtube/auth-url',
    /** GET  /api/seller/youtube/channels */
    channels: '/api/seller/youtube/channels',
    /** POST /api/seller/youtube/live/create */
    createLive: '/api/seller/youtube/live/create',
    /** POST /api/seller/youtube/live/:id/start */
    startLive: (id: string | number) => `/api/seller/youtube/live/${id}/start` as const,
    /** POST /api/seller/youtube/live/:id/end */
    endLive: (id: string | number) => `/api/seller/youtube/live/${id}/end` as const,
    /** DELETE /api/seller/youtube/oauth/:channelId */
    disconnectOauth: (channelId: string | number) => `/api/seller/youtube/oauth/${channelId}` as const,
  },
} as const;

// ── Sellers (공개 목록) ───────────────────────────────────────────────────────

export const SELLERS = {
  /** GET /api/sellers */
  list: '/api/sellers',
  /** GET /api/sellers/:sellerId/products-public  — 비인증 판매자 상품 목록 */
  products: (sellerId: string | number) => `/api/sellers/${sellerId}/products-public` as const,
  /** GET /api/sellers/:sellerId/streams  — 비인증 판매자 스트림 목록 */
  streams: (sellerId: string | number) => `/api/sellers/${sellerId}/streams` as const,
} as const;

// ── Notifications ─────────────────────────────────────────────────────────────

export const NOTIFICATIONS = {
  /** GET    /api/notifications */
  list: '/api/notifications',
  /** PUT    /api/notifications/:id/read */
  markRead: (id: string | number) => `/api/notifications/${id}/read` as const,
  /** PUT    /api/notifications/read-all */
  markAllRead: '/api/notifications/read-all',
  /** DELETE /api/notifications/:id */
  delete: (id: string | number) => `/api/notifications/${id}` as const,
} as const;

// ── Shipping Addresses ────────────────────────────────────────────────────────

export const SHIPPING = {
  /** GET    /api/shipping-addresses */
  list: '/api/shipping-addresses',
  /** POST   /api/shipping-addresses */
  add: '/api/shipping-addresses',
  /** PUT    /api/shipping-addresses/:id */
  update: (id: string | number) => `/api/shipping-addresses/${id}` as const,
  /** DELETE /api/shipping-addresses/:id */
  delete: (id: string | number) => `/api/shipping-addresses/${id}` as const,
} as const;

// ── Banners ───────────────────────────────────────────────────────────────────

export const BANNERS = {
  /** GET /api/banners */
  list: '/api/banners',
} as const;

// ── Admin ─────────────────────────────────────────────────────────────────────

export const ADMIN = {
  /** POST /api/admin/login */
  login: '/api/admin/login',
  /** POST /api/admin/refresh */
  refresh: '/api/admin/refresh',

  sellers: {
    list: '/api/admin/sellers',
    pending: '/api/admin/sellers/pending',
    approve: (id: string | number) => `/api/admin/sellers/${id}/approve` as const,
    reject: (id: string | number) => `/api/admin/sellers/${id}/reject` as const,
    commission: (id: string | number) => `/api/admin/sellers/${id}/commission` as const,
    permissions: (id: string | number) => `/api/admin/sellers/${id}/permissions` as const,
  },

  orders: {
    /** GET  /api/admin/orders */
    list: '/api/admin/orders',
    /** GET  /api/admin/orders/:orderNumber */
    detail: (orderNumber: string) => `/api/admin/orders/${orderNumber}` as const,
    /** GET  /api/admin/orders/export */
    export: '/api/admin/orders/export',
  },

  products: {
    /** GET    /api/admin/products */
    list: '/api/admin/products',
    /** PUT    /api/admin/products/:id */
    update: (id: string | number) => `/api/admin/products/${id}` as const,
    /** DELETE /api/admin/products/:id */
    delete: (id: string | number) => `/api/admin/products/${id}` as const,
  },

  banners: {
    /** GET    /api/admin/banners */
    list: '/api/admin/banners',
    /** POST   /api/admin/banners */
    create: '/api/admin/banners',
    /** PUT    /api/admin/banners/:id */
    update: (id: string | number) => `/api/admin/banners/${id}` as const,
    /** DELETE /api/admin/banners/:id */
    delete: (id: string | number) => `/api/admin/banners/${id}` as const,
  },

  dashboard: {
    /** GET /api/admin/dashboard/stats */
    stats: '/api/admin/dashboard/stats',
  },

  settlement: {
    /** GET /api/admin/settlement/stats */
    stats: '/api/admin/settlement/stats',
    /** GET /api/admin/settlement/records */
    records: '/api/admin/settlement/records',
    /** POST /api/admin/settlement/execute */
    execute: '/api/admin/settlement/execute',
  },

  streams: {
    /** DELETE /api/admin/streams/:id */
    delete: (id: string | number) => `/api/admin/streams/${id}` as const,
  },

  alimtalk: {
    /** GET  /api/admin/alimtalk/pricing */
    pricing: '/api/admin/alimtalk/pricing',
    /** PUT  /api/admin/alimtalk/pricing/:id */
    updatePricing: (id: string | number) => `/api/admin/alimtalk/pricing/${id}` as const,
    /** GET  /api/admin/alimtalk/accounts */
    accounts: '/api/admin/alimtalk/accounts',
    /** PATCH /api/admin/alimtalk/accounts/:id/status */
    updateAccountStatus: (id: string | number) => `/api/admin/alimtalk/accounts/${id}/status` as const,
    /** GET  /api/admin/alimtalk/statistics */
    statistics: '/api/admin/alimtalk/statistics',
  },
} as const;

// ── Account ───────────────────────────────────────────────────────────────────

export const ACCOUNT = {
  /** DELETE /api/account/delete */
  delete: '/api/account/delete',
} as const;

// ── YouTube (legacy alias) ────────────────────────────────────────────────────

export const YOUTUBE = {
  /** GET /api/youtube/chat/:streamId */
  chat: (streamId: string | number) => `/api/youtube/chat/${streamId}` as const,
  /** GET /api/youtube/oauth/callback */
  oauthCallback: '/api/youtube/oauth/callback',
} as const;

// ── Unified export ────────────────────────────────────────────────────────────

export const API = {
  auth: AUTH,
  users: USERS,
  products: PRODUCTS,
  search: SEARCH,
  streams: STREAMS,
  wishlists: WISHLISTS,
  cart: CART,
  orders: ORDERS,
  payments: PAYMENTS,
  seller: SELLER,
  sellers: SELLERS,
  notifications: NOTIFICATIONS,
  shipping: SHIPPING,
  banners: BANNERS,
  admin: ADMIN,
  account: ACCOUNT,
  youtube: YOUTUBE,
} as const;

export default API;
