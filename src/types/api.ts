/**
 * API Response Types
 * 
 * Standardized response interfaces for all API endpoints
 * Ensures consistent response structure across the application
 */

/**
 * Generic Success Response
 */
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  cached?: boolean;
  message?: string;
}

/**
 * Generic Error Response
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * API Response Union Type
 */
export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;

/**
 * Paginated Response
 */
export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Authentication Response
 */
export interface AuthResponse {
  success: boolean;
  user?: {
    id: number;
    email: string;
    name: string;
    role: 'user' | 'seller' | 'admin';
    profile_image?: string;
  };
  session?: {
    token: string;
    expires_at: string;
  };
  error?: string;
}

/**
 * Product List Response
 */
export interface ProductsResponse {
  success: true;
  data: Array<{
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
    seller_name?: string;
    sold_count?: number;
  }>;
  cached?: boolean;
}

/**
 * Product Detail Response
 */
export interface ProductDetailResponse {
  success: true;
  data: {
    product: {
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
      seller_name?: string;
      is_active: number;
      created_at: string;
    };
    options: Array<{
      id: number;
      product_id: number;
      name: string;
      value: string;
      price_adjustment: number;
      stock: number;
    }>;
  };
  cached?: boolean;
}

/**
 * Cart Response
 */
export interface CartResponse {
  success: true;
  data: Array<{
    id: number;
    product_id: number;
    product_name: string;
    price: number;
    image_url?: string;
    quantity: number;
    option_id?: number;
    option_value?: string;
    stock: number;
    seller_id: number;
    seller_name?: string;
  }>;
}

/**
 * Orders Response
 */
export interface OrdersResponse {
  success: true;
  data: Array<{
    id: number;
    order_number: string;
    status: string;
    total_amount: number;
    shipping_fee: number;
    payment_method: string;
    created_at: string;
    items: Array<{
      id: number;
      product_id: number;
      product_name: string;
      option_value?: string;
      quantity: number;
      price: number;
      image_url?: string;
    }>;
  }>;
}

/**
 * Live Stream Response
 */
export interface LiveStreamResponse {
  success: true;
  data: {
    id: number;
    title: string;
    description?: string;
    youtube_video_id: string;
    status: 'scheduled' | 'live' | 'ended';
    current_product_id?: number;
    seller_id: number;
    thumbnail_url?: string;
    current_viewers: number;
    peak_viewers: number;
    created_at: string;
    current_product?: {
      id: number;
      name: string;
      price: number;
      image_url?: string;
      stock: number;
    };
  };
  cached?: boolean;
}

/**
 * Chat Message Response
 */
export interface ChatMessagesResponse {
  success: true;
  data: Array<{
    id: number;
    live_stream_id: number;
    user_id?: number;
    user_name: string;
    user_avatar?: string;
    message: string;
    is_seller: boolean;
    is_admin: boolean;
    created_at: string;
  }>;
}

/**
 * Statistics Response
 */
export interface StatsResponse {
  success: true;
  data: {
    total_sales: number;
    total_orders: number;
    total_products: number;
    total_users: number;
    [key: string]: number | string;
  };
}

/**
 * Cache Stats Response
 */
export interface CacheStatsResponse {
  success: true;
  data: {
    hitRate: number;
    hits: number;
    misses: number;
    writes: number;
    evictions: number;
    cacheSize: number;
    memoryUsage?: number;
    kvReadsPerDay?: number;
    kvWritesPerDay?: number;
  };
}
