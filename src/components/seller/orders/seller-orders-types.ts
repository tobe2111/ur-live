export interface OrderItem {
  id: number
  product_id: number
  product_name: string
  image_url: string | null
  quantity: number
  price: number
}

export interface Order {
  id: string
  order_number: string
  user_name: string
  total_amount: number
  status: string
  payment_status: string
  shipping_name: string
  shipping_phone: string
  shipping_address: string
  courier: string | null
  tracking_number: string | null
  created_at: string
  updated_at: string
  items?: OrderItem[]
}
