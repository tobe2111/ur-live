// ============================================================
// Shared Types - Used by both Worker and Client
// ============================================================

// ---- Enums ----
export type OrderStatus =
  | 'PENDING'
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'DONE'
  | 'PREPARING'
  | 'SHIPPING'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'FAILED'
  | 'REFUNDED';

export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'DELETED';
export type SellerStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
export type UserRole = 'BUYER' | 'SELLER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';
export type WebhookStatus = 'RECEIVED' | 'PROCESSED' | 'FAILED' | 'SKIPPED';

// ---- Toss Payments ----
// V2 공식 이벤트 (docs.tosspayments.com/guides/webhook).
// legacy V1 이벤트도 fallback 으로 받음 (옛 등록 webhook 호환).
export type TossEventType =
  // V2 표준 (UPPER_SNAKE_CASE)
  | 'PAYMENT_STATUS_CHANGED'        // 결제 상태 변경 (DONE/CANCELED/PARTIAL_CANCELED/ABORTED/EXPIRED/WAITING_FOR_DEPOSIT 등)
  | 'DEPOSIT_CALLBACK'              // 가상계좌 입금/환불
  | 'CANCEL_STATUS_CHANGED'         // 결제 취소 상태 변경
  | 'METHOD_UPDATED'                // 브랜드페이 결제수단 변경
  | 'CUSTOMER_STATUS_CHANGED'       // 브랜드페이 고객 상태 변경
  | 'BILLING_DELETED'               // 빌링키 삭제 (자동결제)
  | 'ORDER_PAYMENT_STATUS_CHANGED'  // 링크페이 주문 상태 변경
  // 지급대행 (lowercase.dotted)
  | 'payout.changed'
  | 'seller.changed'
  // Legacy V1 (이전 등록 webhook 호환)
  | 'payment.confirmed'
  | 'payment.cancelled'
  | 'payment.partial_canceled'
  | 'payment.failed'
  | 'payment.virtual_account_issued'
  | 'payment.virtual_account_deposited'
  | 'refund_completed'
  | 'dispute_raised';

export type TossPaymentMethod =
  | 'CARD'
  | 'VIRTUAL_ACCOUNT'
  | 'EASY_PAY'
  | 'MOBILE_PHONE'
  | 'TRANSFER'
  | 'CULTURE_GIFT_CERTIFICATE'
  | 'FOREIGN_EASY_PAY';

/**
 * V2 webhook 페이로드.
 * data 필드는 docs 의 Payment object (28+ 필드) 와 동일 — 이벤트 종류에 따라 일부 필드만 채워진다.
 * 신규 필드는 worker 코드에서 안전하게 optional 로 접근. (index signature 로 forward-compat)
 */
export interface TossWebhookPayload {
  eventType: TossEventType;
  createdAt?: string;
  data: {
    // ── 식별/공통 ─────────────────────────────────
    paymentKey: string;
    orderId: string;          // 우리 order_number
    orderName?: string;
    mId?: string;
    version?: string;
    type?: 'NORMAL' | 'BILLING' | 'BRANDPAY' | string;
    lastTransactionKey?: string;
    // ── 상태 ─────────────────────────────────────
    status: string;           // READY/IN_PROGRESS/WAITING_FOR_DEPOSIT/DONE/CANCELED/PARTIAL_CANCELED/ABORTED/EXPIRED
    isPartialCancelable?: boolean;
    // ── 금액 ─────────────────────────────────────
    totalAmount: number;
    balanceAmount?: number;
    suppliedAmount?: number;
    vat?: number;
    taxFreeAmount?: number;
    taxExemptionAmount?: number;
    currency?: string;
    // ── 결제수단 ─────────────────────────────────
    method?: TossPaymentMethod | string;
    card?: Record<string, unknown> | null;
    virtualAccount?: Record<string, unknown> | null;
    transfer?: Record<string, unknown> | null;
    mobilePhone?: Record<string, unknown> | null;
    giftCertificate?: Record<string, unknown> | null;
    easyPay?: Record<string, unknown> | null;
    discount?: { amount: number } | null;
    // ── 영수증/체크아웃 ───────────────────────────
    receipt?: { url?: string } | null;
    checkout?: { url?: string } | null;
    cashReceipt?: Record<string, unknown> | null;
    cashReceipts?: Array<Record<string, unknown>> | null;
    // ── 시간 ─────────────────────────────────────
    requestedAt?: string;
    approvedAt?: string;
    cancelledAt?: string;
    // ── 실패 ─────────────────────────────────────
    failure?: { code: string; message: string } | null;
    /** @deprecated V1 호환 — V2 는 failure.code / failure.message */
    failureCode?: string;
    /** @deprecated V1 호환 — V2 는 failure.code / failure.message */
    failureMessage?: string;
    // ── 취소 ─────────────────────────────────────
    cancels?: Array<Record<string, unknown>> | null;
    // ── 부가 ─────────────────────────────────────
    useEscrow?: boolean;
    cultureExpense?: boolean;
    country?: string;
    secret?: string | null;   // 가상계좌 secret (매핑 검증용)
    metadata?: Record<string, string> | null;
    // forward-compat (신규 필드 자동 수용)
    [k: string]: unknown;
  };
}

// ---- Seller ----
export interface Seller {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  email: string;
  phone?: string;
  base_shipping_fee: number;
  free_shipping_threshold?: number;
  status: SellerStatus;
  is_verified: boolean;
  country: string;
  currency: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

// ---- Product ----
export interface Product {
  id: string;
  seller_id: string;
  category_id?: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  compare_at_price?: number;
  currency: string;
  /**
   * @deprecated Use `stock` (canonical per migration 0114 / production-schema.ts).
   * Legacy DBs may have this column; code has fallback via COALESCE(stock, stock_quantity, 0).
   */
  stock_quantity?: number;
  stock: number;
  sku?: string;
  thumbnail_url?: string;
  images: string[];
  tags: string[];
  status: ProductStatus;
  is_digital: boolean;
  view_count: number;
  sold_count: number;
  published_at?: string;
  created_at: string;
  updated_at: string;
  // Joined
  seller_name?: string;
  seller_slug?: string;
  // Extended product detail fields
  detail_images?: string | string[];
  long_description?: string;
  original_price?: number;
}

// ---- Cart ----
export interface CartItem {
  product_id: string;
  seller_id: string;
  seller_name: string;
  product_name: string;
  product_thumbnail?: string;
  price: number;
  quantity: number;
  stock_quantity: number;
  options?: Record<string, string>;
  // Computed
  subtotal: number;
}

export interface SellerCartGroup {
  seller_id: string;
  seller_name: string;
  seller_slug: string;
  base_shipping_fee: number;
  free_shipping_threshold?: number;
  items: CartItem[];
  // Computed
  subtotal: number;
  shipping_fee: number;
  total: number;
}

// ---- Order ----
export interface ShippingAddress {
  postal_code: string;
  address1: string;
  address2?: string;
  city?: string;
  country: string;
  recipient_name?: string;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  seller_id: string;
  toss_order_id?: string;
  toss_payment_key?: string;
  payment_method?: string;
  subtotal: number;
  shipping_fee: number;
  discount_amount: number;
  total_amount: number;
  currency: string;
  status: OrderStatus;
  shipping_name?: string;
  shipping_phone?: string;
  shipping_address?: ShippingAddress;
  shipping_memo?: string;
  tracking_number?: string;
  tracking_company?: string;
  cancelled_at?: string;
  cancel_reason?: string;
  refunded_amount?: number;
  paid_at?: string;
  shipped_at?: string;
  delivered_at?: string;
  created_at: string;
  updated_at: string;
  // Joined
  items?: OrderItem[];
  seller?: Seller;
  seller_name?: string;
  seller_phone?: string;
  seller_kakao_chat_url?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  seller_id: string;
  product_name: string;
  product_thumbnail?: string;
  product_sku?: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
  currency: string;
  options?: Record<string, string>;
  status: string;
  created_at: string;
  // 🛡️ 2026-06-18: 주문내역 종류 분류(상품/교환권/공구) 신호 — products JOIN 으로 채움.
  //   order-type.ts getOrderKind() 가 소비. 누락(상품 삭제 등) 시 '상품' 폴백.
  category?: string | null;
  deal_only?: number | null;
  group_buy_status?: string | null;
}

// ---- User ----
export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatar_url?: string;
  role: UserRole;
  status: UserStatus;
  preferred_language: string;
  preferred_currency: string;
  country: string;
  is_email_verified: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

// ---- Auth ----
export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface JWTPayload {
  sub: string;       // user id
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

// ---- API Responses ----
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  has_next: boolean;
}

// ---- Checkout ----
export interface CreateOrderRequest {
  seller_id: string;
  order_number: string;          // shared across multi-seller checkout
  items: {
    product_id: string;
    quantity: number;
    options?: Record<string, string>;
  }[];
  shipping_address: ShippingAddress;
  shipping_name: string;
  shipping_phone: string;
  shipping_memo?: string;
  idempotency_key: string;
  // 🛡️ 2026-04-22: 할인 로직 — 클라이언트가 적용한 쿠폰+포인트 합계
  // 서버에서 max(0, min(discount, subtotal+shipping)) 검증 후 저장
  discount_amount?: number;
  coupon_id?: number | null;  // 적용된 쿠폰 (있으면 use 처리)
  deal_used?: number;          // 사용한 딜 포인트
}

export interface CheckoutSession {
  order_number: string;
  orders: Order[];
  total_amount: number;
  toss_client_key: string;
}

// ---- Webhook ----
export interface WebhookEvent {
  id: string;
  source: string;
  event_type: string;
  event_id?: string;
  payload: string;
  status: WebhookStatus;
  error_message?: string;
  retry_count: number;
  order_number?: string;
  toss_order_id?: string;
  processed_at?: string;
  created_at: string;
}
