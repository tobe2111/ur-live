/**
 * Seller Management — shared helpers
 * Used by seller-registration, seller-profile, seller-business, seller-stats, seller-public-api routes.
 */

import { verify } from 'hono/jwt';
import type { JWTPayload } from 'hono/utils/jwt/types';
import { logError } from '@/worker/utils/logger';

export type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  ALIGO_API_KEY?: string;
  ALIGO_USER_ID?: string;
  SESSION_KV?: KVNamespace;
};

// ── DB row types ──────────────────────────────────────────────────────────────

export interface SellerProfileRow {
  id: number;
  username: string;
  email: string;
  name: string;
  business_name: string;
  phone: string;
  address: string | null;
  description: string | null;
  bank_account: string | null;
  bank_name: string | null;
  account_holder: string | null;
  status: string;
  commission_rate: number;
  created_at: string;
  updated_at: string;
}

export interface BusinessInfoRow {
  business_number: string | null;
  business_registration_file: string | null;
  tax_email: string | null;
  representative_name: string | null;
  business_address: string | null;
}

export interface PublicSellerRow {
  id: number;
  name: string;
  slug: string | null;
  description: string | null;
  logo_url: string | null;
  email: string;
  base_shipping_fee: number | null;
  free_shipping_threshold: number | null;
  country: string | null;
  currency: string | null;
  status: string;
  is_verified: number;
  created_at: string;
}

export interface ProductIdRow {
  id: number;
}

export interface ImgbbResponse {
  success: boolean;
  data?: { url: string; delete_url: string };
  error?: { message: string };
}

export interface SellerJWTPayload extends Record<string, unknown> {
  seller_id?: number;
}

export type SellerRegisterRequest = {
  username: string;
  email: string;
  password: string;
  name: string;
  business_name: string;
  business_number: string;
  phone: string;
  address?: string;
  description?: string;
  youtube_email: string;
  seller_type?: 'influencer' | 'store_owner' | 'both';
};

export type SellerProfileUpdate = {
  name?: string;
  business_name?: string;
  phone?: string;
  address?: string;
  description?: string;
  bank_account?: string;
  bank_name?: string;
  account_holder?: string;
};

export type BusinessInfoUpdate = {
  business_number?: string;
  business_registration_file?: string;
  tax_email?: string;
  representative_name?: string;
  business_address?: string;
};

// ── ensureSellerColumns ────────────────────────────────────────────────────────

let _sellerColumnsEnsured = false;
export async function ensureSellerColumns(db: D1Database) {
  if (_sellerColumnsEnsured) return;
  try { await db.prepare("ALTER TABLE sellers ADD COLUMN linked_user_id INTEGER").run(); } catch { /* exists */ }
  try { await db.prepare("ALTER TABLE sellers ADD COLUMN seller_type TEXT DEFAULT 'influencer'").run(); } catch { /* exists */ }
  _sellerColumnsEnsured = true;
}

// ── getSellerIdFromToken ──────────────────────────────────────────────────────

export async function getSellerIdFromToken(authorization: string | undefined, jwtSecret: string): Promise<number | null> {
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null;
  }
  try {
    const token = authorization.substring(7);
    const payload = await verify(token, jwtSecret, 'HS256') as JWTPayload & { seller_id?: number };
    return payload.seller_id || null;
  } catch (error) {
    logError('seller.management.tokenVerificationError', { error: (error as Error)?.message });
    return null;
  }
}
