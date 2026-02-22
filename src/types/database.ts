/**
 * Database Table Types
 * 
 * Strongly typed interfaces for all database tables
 * Prevents runtime errors by catching type issues at compile time
 */

/**
 * Users Table
 */
export interface User {
  id: number;
  email: string;
  name: string;
  kakao_id?: string;
  role: 'user' | 'seller' | 'admin';
  profile_image?: string;
  created_at: string;
  updated_at?: string;
}

/**
 * Orders Table
 */
export interface Order {
  id: number;
  user_id: number;
  order_number: string;
  status: 'pending' | 'paid' | 'preparing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  total_amount: number;
  shipping_fee: number;
  payment_method: string;
  payment_key?: string;
  payment_status?: string;
  shipping_address: string;
  shipping_name: string;
  shipping_phone: string;
  delivery_request?: string;
  created_at: string;
  updated_at?: string;
}

/**
 * Order Items Table
 */
export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  option_id?: number;
  quantity: number;
  price: number;
  product_name?: string;
  option_value?: string;
  image_url?: string;
}

/**
 * Products Table
 */
export interface Product {
  id: number;
  name: string;
  description?: string;
  price: number;
  original_price?: number;
  discount_rate?: number;
  image_url?: string;
  stock: number;
  category: string;
  seller_id: number;
  is_active: number; // SQLite uses 0/1 for boolean
  created_at: string;
  updated_at?: string;
}

/**
 * Product Options Table
 */
export interface ProductOption {
  id: number;
  product_id: number;
  name: string;
  value: string;
  price_adjustment: number;
  stock: number;
  created_at: string;
}

/**
 * Cart Items Table
 */
export interface CartItem {
  id: number;
  user_id: number;
  product_id: number;
  option_id?: number;
  quantity: number;
  price_snapshot: number;
  live_stream_id?: number;
  added_at: string;
}

/**
 * Live Streams Table
 */
export interface LiveStream {
  id: number;
  title: string;
  description?: string;
  youtube_video_id: string;
  status: 'scheduled' | 'live' | 'ended';
  current_product_id?: number;
  seller_id: number;
  thumbnail_url?: string;
  platform: 'youtube' | 'tiktok';
  current_viewers: number;
  peak_viewers: number;
  created_at: string;
  updated_at?: string;
}

/**
 * Chat Messages Table
 */
export interface ChatMessage {
  id: number;
  live_stream_id: number;
  user_id?: number;
  user_name: string;
  user_avatar?: string;
  message: string;
  is_seller: number;
  is_admin: number;
  is_deleted: number;
  created_at: string;
}

/**
 * Sellers Table
 */
export interface Seller {
  id: number;
  username: string;
  password_hash: string;
  name: string;
  business_name: string;
  business_number?: string;
  phone?: string;
  email?: string;
  bank_account?: string;
  commission_rate: number;
  is_active: number;
  is_featured_seller: number;
  created_at: string;
  updated_at?: string;
}

/**
 * Admin Sessions Table
 */
export interface AdminSession {
  id: number;
  session_token: string;
  admin_id?: number;
  seller_id?: number;
  user_type: 'admin' | 'seller' | 'user';
  expires_at: string;
  created_at: string;
}

/**
 * Notifications Table
 */
export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: string;
  is_read: number;
  created_at: string;
}

/**
 * Wishlists Table
 */
export interface Wishlist {
  id: number;
  user_id: number;
  product_id: number;
  created_at: string;
}

/**
 * Settlements Table
 */
export interface Settlement {
  id: number;
  seller_id: number;
  period_start: string;
  period_end: string;
  total_sales: number;
  commission_rate: number;
  commission_amount: number;
  settlement_amount: number;
  status: 'pending' | 'processing' | 'completed';
  created_at: string;
  completed_at?: string;
}

/**
 * Query Result Helpers
 */
export type QueryResult<T> = {
  results: T[];
  success: boolean;
  meta?: any;
};

export type SingleResult<T> = T | null;
