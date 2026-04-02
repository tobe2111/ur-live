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
export type TossEventType =
  | 'payment.confirmed'
  | 'payment.cancelled'
  | 'payment.failed'
  | 'payment.virtual_account_issued'
  | 'payment.virtual_account_deposited';

export type TossPaymentMethod =
  | 'CARD'
  | 'VIRTUAL_ACCOUNT'
  | 'EASY_PAY'
  | 'MOBILE_PHONE'
  | 'TRANSFER'
  | 'CULTURE_GIFT_CERTIFICATE'
  | 'FOREIGN_EASY_PAY';

export interface TossWebhookPayload {
  eventType: TossEventType;
  createdAt: string;
  data: {
    paymentKey: string;
    orderId: string;          // our order_number
    orderName: string;
    status: string;
    totalAmount: number;
    currency: string;
    method?: TossPaymentMethod;
    requestedAt?: string;
    approvedAt?: string;
    cancelledAt?: string;
    failureCode?: string;
    failureMessage?: string;
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
  stock_quantity: number;
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
