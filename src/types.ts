// Import Cloudflare runtime bindings
/// <reference types="../worker-configuration.d.ts" />

// Type definitions for Cloudflare bindings
export type Bindings = CloudflareBindings;

// Live Stream Types
export type LiveStreamStatus = 'scheduled' | 'live' | 'ended';
export type LiveStreamPlatform = 'youtube' | 'tiktok';

export interface LiveStream {
  id: number;
  title: string;
  description: string | null;
  youtube_video_id: string;
  platform: LiveStreamPlatform;
  tiktok_username: string | null;
  status: LiveStreamStatus;
  current_product_id: number | null;
  created_at: string;
  updated_at: string;
}

// Product Types
export interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  original_price: number | null;
  discount_rate: number;
  image_url: string | null;
  stock: number;
  category: string | null;
  live_stream_id: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductOption {
  id: number;
  product_id: number;
  option_type: string;
  option_value: string;
  price_adjustment: number;
  stock: number;
  created_at: string;
}

// User Types
export interface User {
  id: number;
  kakao_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  profile_image: string | null;
  created_at: string;
  updated_at: string;
}

// Cart Types
export interface CartItem {
  id: number;
  user_id: number;
  product_id: number;
  option_id: number | null;
  quantity: number;
  price_snapshot: number;
  live_stream_id: number | null;
  added_at: string;
}

export interface CartItemWithDetails extends CartItem {
  product_name: string;
  product_image: string | null;
  option_info: string | null;
}

// Order Types
export type PaymentStatus = 'pending' | 'approved' | 'failed' | 'cancelled' | 'refunded';

export interface Order {
  id: number;
  order_number: string;
  user_id: number;
  total_amount: number;
  payment_key: string | null;
  payment_status: PaymentStatus;
  shipping_address: string | null;
  shipping_name: string | null;
  shipping_phone: string | null;
  live_stream_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  option_id: number | null;
  quantity: number;
  price: number;
  product_name: string;
  option_info: string | null;
}

// WebSocket Message Types
export type WSMessageType =
  | 'product_change'
  | 'cart_update'
  | 'viewer_count'
  | 'chat_message'
  | 'stream_status'
  | 'donation';

export interface WSMessage {
  type: WSMessageType;
  data: unknown;
  timestamp: number;
}

export interface ProductChangeMessage extends WSMessage {
  type: 'product_change';
  data: {
    product: Product;
    options: ProductOption[];
  };
}

export interface ViewerCountMessage extends WSMessage {
  type: 'viewer_count';
  data: {
    count: number;
  };
}

export interface StreamStatusMessage extends WSMessage {
  type: 'stream_status';
  data: {
    status: LiveStreamStatus;
    live_stream_id: number;
  };
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
