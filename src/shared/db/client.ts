import type { D1Database } from '@cloudflare/workers-types';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

/**
 * ✅ Drizzle DB Client
 * 
 * Week 5 Day 3 - DB 타입 안전성 & N+1 쿼리 해결
 * 
 * 사용:
 * - Worker: createDB(env.DB)
 * - 로컬: createDB(localD1)
 */

export function createDB(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type DB = ReturnType<typeof createDB>;

// ============================================
// 타입 재export (편의성)
// ============================================
export * from './schema';
