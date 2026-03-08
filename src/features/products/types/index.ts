/**
 * Product Types
 */

export interface Product {
  id: number;
  seller_id: number;
  name: string;
  description?: string;
  price: number;
  stock_quantity: number;
  category?: string;
  images?: string; // JSON string
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
