/**
 * Cafe24 Integration Types
 */

// ── OAuth ──────────────────────────────────────────────────────────

export interface Cafe24OAuthTokens {
  access_token: string;
  expires_at: string;
  refresh_token: string;
  refresh_token_expires_at?: string;
  client_id: string;
  mall_id: string;
  user_id?: string;
  scopes: string[];
  issued_at?: string;
}

export interface Cafe24TokenRow {
  id: number;
  mall_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scopes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Cafe24 Product (API response shape) ────────────────────────────

export interface Cafe24ProductVariant {
  variant_code: string;
  options?: { name: string; value: string }[];
  quantity: number;
  price: string;
  display: string;
}

export interface Cafe24Product {
  product_no: number;
  product_code: string;
  product_name: string;
  internal_product_name?: string;
  description?: string;
  mobile_description?: string;
  summary_description?: string;
  price: string;
  retail_price?: string;
  supply_price?: string;
  display: string;
  selling: string;
  product_condition?: string;
  product_used_month?: number;
  custom_product_code?: string;
  category?: number;
  brand_code?: string;
  product_weight?: string;
  detail_image?: string;
  list_image?: string;
  tiny_image?: string;
  small_image?: string;
  additional_image?: string[];
  variants?: Cafe24ProductVariant[];
  created_date?: string;
  updated_date?: string;
  stock_quantity?: number;
}

export interface Cafe24ProductListResponse {
  products: Cafe24Product[];
}

export interface Cafe24ProductDetailResponse {
  product: Cafe24Product;
}

// ── Product Mapping (DB row) ───────────────────────────────────────

export interface Cafe24ProductMapRow {
  id: number;
  cafe24_product_no: number;
  product_id: number;
  cafe24_mall_id: string;
  last_synced_at: string;
}

// ── Sync Result ────────────────────────────────────────────────────

export interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}
