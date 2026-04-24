import { z } from 'zod';
import type { Env } from '../types/env';
import type { AuthUser } from '../middleware/auth';
import type { Hono } from 'hono';

export type AuthVariables = { user: AuthUser };
export type OrderApp = Hono<{ Bindings: Env; Variables: AuthVariables }>;

// Firebase UID → DB user_id 변환 헬퍼
export async function getUserDbId(db: D1Database, firebaseUid: string): Promise<string> {
  try {
    const row = await (db
      .prepare('SELECT id FROM users WHERE firebase_uid = ? LIMIT 1')
      .bind(firebaseUid)
      .first() as Promise<{ id: string | number } | null>);
    if (row?.id != null) return String(row.id);
  } catch {
    // users 테이블에 firebase_uid 컬럼이 없는 경우 → Firebase UID 직접 사용
  }
  return firebaseUid;
}

export const createOrderSchema = z.object({
  seller_id: z.string().optional().default(''),
  order_number: z.string().min(1),
  items: z.array(z.object({
    product_id: z.string().min(1),
    quantity: z.number().int().positive().max(99),
    options: z.record(z.string()).optional(),
  })).min(1),
  shipping_address: z.object({
    postal_code: z.string(),
    address1: z.string(),
    address2: z.string().optional(),
    city: z.string().optional(),
    country: z.string().default('KR'),
    recipient_name: z.string().optional(),
  }),
  shipping_name: z.string(),
  shipping_phone: z.string(),
  shipping_memo: z.string().optional(),
  idempotency_key: z.string().min(1),
});
