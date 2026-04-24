/**
 * 딜 포인트 시스템 — 공유 헬퍼, 상수, 테이블 보장
 */

import { ensureUserPointsTable } from '../../../worker/utils/ensure-tables';
import type { D1Database } from '@cloudflare/workers-types';

export const DEFAULT_COMMISSION_RATE = 0.10; // 🛡️ 2026-04-22: 기본 10% (CLAUDE.md 정책)

export async function getDefaultCommissionRate(DB: D1Database): Promise<number> {
  try {
    const row = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'commission_rate_default'").first<{ value: string }>();
    if (row) return Number(row.value) / 100;
  } catch { /* table may not exist */ }
  return DEFAULT_COMMISSION_RATE;
}

// 충전: 1원 = 1딜 (수수료 없음)
export const CHARGE_AMOUNTS = [
  { amount: 5000,   points: 5000,   label: '5,000원 → 5,000딜' },
  { amount: 10000,  points: 10000,  label: '10,000원 → 10,000딜' },
  { amount: 30000,  points: 30000,  label: '30,000원 → 30,000딜' },
  { amount: 50000,  points: 50000,  label: '50,000원 → 50,000딜' },
  { amount: 100000, points: 100000, label: '100,000원 → 100,000딜' },
];

// 리워드 광고 상수
export const AD_REWARD_POINTS = 50;   // 광고 1회 시청 = 50딜
export const AD_DAILY_LIMIT = 10;     // 하루 최대 10회
export const AD_REWARD_DESC_PREFIX = '[광고리워드]';

// ── 테이블 자동 생성 (마이그레이션 미적용 시 fallback) ────────────────
let _pointsTablesEnsured = false;
export async function ensureTables(DB: D1Database) {
  if (_pointsTablesEnsured) return;
  _pointsTablesEnsured = true;
  await ensureUserPointsTable(DB);
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS point_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('charge', 'donate', 'refund', 'ad_reward')),
        amount INTEGER NOT NULL,
        commission_amount INTEGER NOT NULL DEFAULT 0,
        points_amount INTEGER NOT NULL DEFAULT 0,
        balance_after INTEGER NOT NULL DEFAULT 0,
        description TEXT,
        payment_key TEXT,
        order_id TEXT,
        stream_id INTEGER,
        seller_id INTEGER,
        created_at DATETIME DEFAULT (datetime('now'))
      )
    `).run();
  } catch { /* 이미 존재 */ }
}
