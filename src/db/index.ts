/**
 * Drizzle D1 client wrapper.
 *
 * 사용:
 *   import { getDb } from '@/db'
 *   const db = getDb(c.env.DB)
 *   const order = await db.select().from(orders).where(eq(orders.id, id)).get()
 *
 * 도입 배경: SQL 문자열 컬럼 mismatch 사고 영구 차단 (2026-05-23 Drizzle Phase 1).
 *
 * ⚠️ Worker code 는 alias '@/' import 못 함 — Worker 환경에서는 상대경로 사용:
 *   import { getDb } from '../../db'
 */

import type { D1Database } from '@cloudflare/workers-types'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

export function getDb(d1: D1Database) {
  return drizzle(d1, { schema })
}

export type Db = ReturnType<typeof getDb>

// Re-export schema 테이블 / 타입 — 호출자가 한 곳에서 import.
export * from './schema'
