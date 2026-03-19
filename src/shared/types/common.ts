/**
 * Common Type Definitions for API Responses
 * 
 * Purpose: Replace 'any' types with proper TypeScript types
 * to improve type safety and catch errors at compile time.
 */

// ============================================
// Generic API Response Types
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface ErrorResponse {
  success: false
  error: string
  code?: string
  details?: Record<string, unknown>
  timestamp?: string
}

// ============================================
// Database Query Result Types
// ============================================

export interface D1Result<T = unknown> {
  success: boolean
  results: T[]
  meta?: {
    duration: number
    last_row_id?: number
    changes?: number
    served_by?: string
    internal_stats?: unknown
  }
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = unknown>(colName?: string): Promise<T | null>
  run<T = unknown>(): Promise<D1Result<T>>
  all<T = unknown>(): Promise<D1Result<T>>
}

// ============================================
// User & Authentication Types
// ============================================

export interface User {
  id: number
  email: string
  name?: string
  profile_image?: string
  user_type: 'user' | 'seller' | 'admin'
  created_at: string
  updated_at?: string
}

export interface Seller extends User {
  user_type: 'seller'
  store_name?: string
  business_number?: string
  business_address?: string
  bank_account?: string
  settlement_status?: 'pending' | 'approved' | 'rejected'
}

export interface Admin extends User {
  user_type: 'admin'
  role: 'super_admin' | 'moderator' | 'support'
  permissions?: string[]
}

// ============================================
// Product Types
// ============================================

export interface Product {
  id: number
  seller_id: number
  name: string
  description?: string
  price: number
  original_price?: number
  stock: number
  thumbnail_url?: string
  images?: string[]
  category?: string
  status: 'active' | 'inactive' | 'out_of_stock'
  created_at: string
  updated_at?: string
}

export interface ProductWithSeller extends Product {
  seller_name?: string
  seller_store_name?: string
  seller_avatar?: string
}

// ============================================
// Order Types
// ============================================

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'

export interface OrderItem {
  id: number
  order_id: number
  product_id: number
  quantity: number
  price_snapshot: number
  product_name?: string
  product_thumbnail?: string
  options?: Record<string, unknown>
}

export interface Order {
  id: number
  order_number: string
  user_id: number
  seller_id: number
  status: OrderStatus
  total_amount: number
  shipping_address: string
  shipping_name: string
  shipping_phone: string
  shipping_memo?: string
  items?: OrderItem[]
  payment_method?: string
  payment_status?: 'pending' | 'completed' | 'failed'
  created_at: string
  updated_at?: string
}

// ============================================
// Cart Types
// ============================================

export interface CartItem {
  id: number
  user_id: number
  product_id: number
  seller_id: number
  quantity: number
  price_snapshot: number
  product?: Product
  seller?: Partial<Seller>
  created_at: string
}

// ============================================
// Live Stream Types
// ============================================

export type StreamStatus = 'scheduled' | 'live' | 'ended'

export interface LiveStream {
  id: number
  seller_id: number
  title: string
  description?: string
  status: StreamStatus
  thumbnail_url?: string
  video_url?: string
  youtube_video_id?: string
  viewer_count: number
  current_product_id?: number
  scheduled_start?: string
  started_at?: string
  ended_at?: string
  created_at: string
}

export interface ChatMessage {
  id: string
  live_stream_id: number
  user_id: number
  user_name: string
  message: string
  user_type: 'viewer' | 'seller' | 'system'
  timestamp: number
}

// ============================================
// Settlement Types
// ============================================

export type SettlementStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Settlement {
  id: number
  seller_id: number
  order_id: number
  amount: number
  fee: number
  net_amount: number
  status: SettlementStatus
  settlement_date?: string
  bank_account?: string
  created_at: string
  processed_at?: string
}

// ============================================
// Payment Types (Toss Payments)
// ============================================

export interface TossPaymentConfirmRequest {
  paymentKey: string
  orderId: string
  amount: number
}

export interface TossPaymentResponse {
  paymentKey: string
  orderId: string
  orderName: string
  method: string
  totalAmount: number
  status: 'READY' | 'IN_PROGRESS' | 'DONE' | 'CANCELED' | 'PARTIAL_CANCELED' | 'ABORTED' | 'EXPIRED'
  requestedAt: string
  approvedAt?: string
  receipt?: {
    url: string
  }
  card?: {
    company: string
    number: string
    installmentPlanMonths: number
    isInterestFree: boolean
    approveNo: string
  }
}

// ============================================
// Error Types
// ============================================

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, 'VALIDATION_ERROR', details)
    this.name = 'ValidationError'
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR')
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends ApiError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR')
    this.name = 'AuthorizationError'
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND')
    this.name = 'NotFoundError'
  }
}

// ============================================
// Utility Types
// ============================================

export type Nullable<T> = T | null
export type Optional<T> = T | undefined
export type Maybe<T> = T | null | undefined

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = 
  Pick<T, Exclude<keyof T, Keys>> & 
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>
  }[Keys]

// ============================================
// Database Helper Types
// ============================================

export interface DatabaseRow {
  [key: string]: string | number | boolean | null
}

export type QueryValues = (string | number | boolean | null)[]

export interface SQLQuery {
  sql: string
  values?: QueryValues
}

// ============================================
// Export all types
// ============================================

export type {
  // API
  ApiResponse,
  PaginatedResponse,
  ErrorResponse,
  
  // Database
  D1Result,
  D1PreparedStatement,
  DatabaseRow,
  QueryValues,
  SQLQuery,
  
  // Users
  User,
  Seller,
  Admin,
  
  // Products
  Product,
  ProductWithSeller,
  
  // Orders
  Order,
  OrderItem,
  OrderStatus,
  
  // Cart
  CartItem,
  
  // Live Streaming
  LiveStream,
  StreamStatus,
  ChatMessage,
  
  // Settlement
  Settlement,
  SettlementStatus,
  
  // Payments
  TossPaymentConfirmRequest,
  TossPaymentResponse,
  
  // Utilities
  Nullable,
  Optional,
  Maybe,
  DeepPartial,
  RequireAtLeastOne,
}

export {
  // Error classes
  ApiError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
}
