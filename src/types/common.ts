/**
 * 공통 타입 정의
 * API 응답 및 데이터 모델의 타입을 정의합니다.
 */

// =================================
// API Response Types
// =================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
  cached?: boolean;
}

// =================================
// Product Types
// =================================

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  original_price: number;
  discount_rate: number;
  image_url: string;
  detail_images?: string[];
  stock: number;
  category: string;
  seller_id: number;
  seller_name?: string;
  live_stream_id?: number;
  is_active: boolean;
  sold_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ProductOption {
  id: number;
  product_id: number;
  name: string;
  values: string[];
  price_adjustment: number;
}

// =================================
// Cart Types
// =================================

export interface CartItem {
  id: number;
  user_id: number;
  product_id: number;
  product_name: string;
  image_url?: string;
  quantity: number;
  price_snapshot: number;
  option_id?: number;
  option_value?: string;
  created_at: string;
  product_stock?: number;
}

// =================================
// Order Types
// =================================

export interface Order {
  id: number;
  user_id: number;
  order_number: string;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  shipping_status: string;
  shipping_address_id?: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  price_snapshot: number;
  option_value?: string;
}

// =================================
// User Types
// =================================

export interface User {
  id: number;
  email: string;
  name: string;
  phone?: string;
  profile_image?: string;
  kakao_id?: string;
  created_at: string;
  last_login_at?: string;
}

// =================================
// Seller Types
// =================================

export interface Seller {
  id: number;
  username: string;
  email: string;
  name: string;
  business_name?: string;
  company_name?: string;
  business_number?: string;
  phone?: string;
  status: 'pending' | 'approved' | 'rejected';
  is_active: boolean;
  is_featured_seller: boolean;
  commission_rate: number;
  display_name?: string;
  created_at: string;
}

// =================================
// Live Stream Types
// =================================

export interface LiveStream {
  id: number;
  title: string;
  description?: string;
  seller_id: number;
  seller_name?: string;
  youtube_video_id: string;
  tiktok_video_id?: string;
  status: 'scheduled' | 'active' | 'ended';
  scheduled_at?: string;
  started_at?: string;
  ended_at?: string;
  current_viewers?: number;
  total_views?: number;
  current_product_id?: number;
  thumbnail_url?: string;
  created_at: string;
  updated_at: string;
}

// =================================
// Shipping Address Types
// =================================

export interface ShippingAddress {
  id: number;
  user_id: number;
  recipient_name: string;
  phone: string;
  postal_code: string;
  address: string;
  address_detail?: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// =================================
// Chat Message Types
// =================================

export interface ChatMessage {
  id: string;
  user_id: string;
  user_name: string;
  message: string;
  timestamp: number;
  type: 'user' | 'system' | 'seller';
}

// =================================
// Auth Types
// =================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  data?: {
    access_token: string;
    user: User;
  };
  error?: string;
}

export interface SessionData {
  userId: number;
  userType: 'user' | 'seller' | 'admin';
  expiresAt: number;
}

// =================================
// Payment Types
// =================================

export interface PaymentConfirmRequest {
  paymentKey: string;
  orderId: string;
  amount: number;
}

export interface PaymentConfirmResponse {
  success: boolean;
  orderId: string;
  paymentKey: string;
  method: string;
  totalAmount: number;
  status: string;
  approvedAt: string;
  error?: string;
}
