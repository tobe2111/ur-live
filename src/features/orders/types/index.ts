/**
 * Order Types
 */

export interface Order {
  id: number;
  order_number: string;
  user_id: number;
  seller_id: number;
  // ✅ SCHEMA: Production DB column is `total_amount` (see production-schema.ts).
  total_amount: number;
  status: 'pending' | 'paid' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  payment_method?: string;
  shipping_address?: string;
  shipping_name?: string;
  shipping_phone?: string;
  created_at: string;
  updated_at: string;
  courier?: string;
  tracking_number?: string;
  tracking_company?: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
  created_at: string;
}

export interface OrderCreateInput {
  user_id: number | string;  // Firebase UID (string) or DB integer id
  seller_id: number;
  // ✅ BUG #26 FIX: Accept an optional order_number for idempotent retries.
  // If the caller provides the same order_number on retry, the repository
  // returns the existing order instead of creating a duplicate.
  order_number?: string;
  items: Array<{
    product_id: number;
    quantity: number;
    price: number;
  }>;
  total_amount: number;
  payment_method?: string;
  shipping_address?: string;
  shipping_address_detail?: string;
  shipping_name?: string;
  shipping_phone?: string;
  status?: string;
}

export interface OrderFilter {
  userId?: number;
  sellerId?: number;
  status?: Order['status'];
}

// Compatibility type aliases
export type CreateOrderRequest = OrderCreateInput;
export interface UpdateOrderStatusRequest {
  status: Order['status'];
  reason?: string;
}
export type OrderFilters = OrderFilter;
