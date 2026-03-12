/**
 * Order Types
 */

export interface Order {
  id: number;
  order_number: string;
  user_id: number;
  seller_id: number;
  total_amount: number;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  payment_method?: string;
  shipping_address?: string;
  shipping_name?: string;
  shipping_phone?: string;
  created_at: string;
  updated_at: string;
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
  user_id: number;
  seller_id: number;
  items: Array<{
    product_id: number;
    quantity: number;
    price: number;
  }>;
  total_amount: number;
  payment_method?: string;
  shipping_address?: string;
  shipping_name?: string;
  shipping_phone?: string;
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
