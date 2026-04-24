/**
 * 유저 공동구매 (Community Group Buy) — 공유 헬퍼 & DDL
 */

import type { Env } from '@/worker/types/env';

// ── 테이블 자동 생성 + 마이그레이션 ───────────────────────────────────
export async function ensureRefundTable(DB: D1Database) {
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS community_group_buy_refunds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        refunded_at DATETIME DEFAULT (datetime('now')),
        UNIQUE(group_id, user_id)
      )
    `).run();
  } catch { /* exists */ }
}

export async function ensureTables(DB: D1Database) {
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS community_group_buys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        creator_user_id TEXT NOT NULL,
        creator_name TEXT NOT NULL,
        restaurant_name TEXT NOT NULL,
        restaurant_address TEXT,
        restaurant_phone TEXT,
        restaurant_lat TEXT,
        restaurant_lng TEXT,
        proposed_price INTEGER NOT NULL,
        deposit_per_person INTEGER NOT NULL DEFAULT 5000,
        target_count INTEGER NOT NULL DEFAULT 10,
        current_count INTEGER DEFAULT 0,
        total_deposited INTEGER DEFAULT 0,
        status TEXT DEFAULT 'proposed' CHECK(status IN ('proposed','negotiating','confirmed','achieved','failed','refunded')),
        invite_code TEXT UNIQUE,
        confirmed_price INTEGER,
        confirmed_discount_percent INTEGER,
        restaurant_seller_id INTEGER,
        expires_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `).run();
  } catch { /* already exists */ }

  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS community_group_buy_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_buy_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        deposit_amount INTEGER NOT NULL,
        status TEXT DEFAULT 'deposited' CHECK(status IN ('deposited','refunded','paid')),
        joined_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (group_buy_id) REFERENCES community_group_buys(id)
      )
    `).run();
  } catch { /* already exists */ }

  // 마이그레이션: 나중에 추가될 수 있는 컬럼
  try { await DB.prepare("ALTER TABLE community_group_buys ADD COLUMN confirmed_price INTEGER").run(); } catch {}
  try { await DB.prepare("ALTER TABLE community_group_buys ADD COLUMN confirmed_discount_percent INTEGER").run(); } catch {}
  try { await DB.prepare("ALTER TABLE community_group_buys ADD COLUMN restaurant_seller_id INTEGER").run(); } catch {}
}

// ── 초대 코드 생성 ────────────────────────────────────────────────────
// 🛡️ 2026-04-22: Math.random → crypto.getRandomValues (guessable code 방어)
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[bytes[i] % chars.length];
  return code;
}

// Env re-export so sub-route files can use it via this module if desired
export type { Env };
