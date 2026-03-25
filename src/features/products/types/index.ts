/**
 * Product Types
 */

export interface Product {
  id: number;
  seller_id: number;
  seller_name?: string;
  seller_slug?: string;
  name: string;
  description?: string;
  long_description?: string; // Detailed product description
  price: number;
  compare_at_price?: number; // Original price before discount
  stock_quantity: number;
  category?: string;
  thumbnail_url?: string; // Main product image
  images?: string; // JSON string
  detail_images?: string | string[]; // JSON array or parsed array of detail image URLs
  status: 'active' | 'inactive' | 'deleted';
  created_at: string;
  updated_at: string;
}

export interface ProductFilter {
  sellerId?: number;
  category?: string;
  status?: 'active' | 'inactive';
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  productType?: 'featured' | 'live'; // 'featured': 어드민 등록 ur특가 상품, 'live': 셀러 라이브 전용 상품
}

export interface ProductCreateInput {
  seller_id: number;
  name: string;
  description?: string;
  price: number;
  stock_quantity: number;
  category?: string;
  images?: string[];
}

export interface ProductUpdateInput {
  name?: string;
  description?: string;
  price?: number;
  stock_quantity?: number;
  category?: string;
  images?: string[];
  status?: 'active' | 'inactive';
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
