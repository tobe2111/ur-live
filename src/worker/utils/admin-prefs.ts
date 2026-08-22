/**
 * ⭐ 어드민 개인 설정 K-V (2026-08-22 대표 신고 — "즐겨찾기가 계속 초기화 돼")
 *
 * ## 왜 서버로 옮겼나
 * 즐겨찾기는 `localStorage.admin_nav_pinned_v1` 하나에만 있었다. localStorage 는
 * **오리진·브라우저·프로필마다 따로**이고 다음 경우에 조용히 사라진다:
 *   · 다른 기기/브라우저로 접속  · 시크릿 창  · "사이트 데이터 지우기"
 *   · 도메인 전환기(구 `live.ur-team.com` ↔ `urdeal.kr` 는 **다른 오리진** = 다른 저장소)
 * 게다가 최초 진입의 기본값 시드가 **저장되지 않아서**, 저장소가 비면 항상 기본 4개로
 * 돌아간다 — 대표가 본 "초기화"의 모습이 정확히 이것이다.
 *
 * 어느 트리거였는지 특정하기보다 **저장 위치를 바꿔 그 증상 자체가 불가능하게** 만든다.
 * 계정에 붙으면 기기를 바꿔도 따라온다.
 *
 * ## 설계
 * `admins` 에 컬럼을 붙이지 않고 사이드 K-V 를 쓴다(`product_supply_meta`·`seller_meta` 와 동일 철학).
 * 값은 JSON 문자열, 키는 화이트리스트(임의 키로 테이블이 쓰레기통이 되는 것 방지).
 */

import type { D1Database } from '@cloudflare/workers-types';

/** 저장 가능한 키. 늘릴 땐 여기 + 라우트 화이트리스트 둘 다. */
export const ADMIN_PREF_KEYS = ['nav_pins'] as const;
export type AdminPrefKey = (typeof ADMIN_PREF_KEYS)[number];

/** 값 상한 — 즐겨찾기 경로 수십 개면 충분하다. 넘으면 저장 거부(무한 성장 차단). */
export const ADMIN_PREF_MAX_BYTES = 4000;

const ensured = new WeakSet<D1Database>();

/** per-request DDL 금지(머니 룰 부수 규칙) — 인스턴스당 1회만. */
export async function ensureAdminPrefs(DB: D1Database): Promise<void> {
  if (ensured.has(DB)) return;
  await DB.prepare(
    `CREATE TABLE IF NOT EXISTS admin_prefs (
      admin_id INTEGER NOT NULL,
      pref_key TEXT NOT NULL,
      pref_value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (admin_id, pref_key)
    )`,
  ).run();
  ensured.add(DB);
}

export async function getAdminPref(
  DB: D1Database,
  adminId: number,
  key: AdminPrefKey,
): Promise<string | null> {
  await ensureAdminPrefs(DB);
  const row = await DB.prepare('SELECT pref_value FROM admin_prefs WHERE admin_id = ? AND pref_key = ?')
    .bind(adminId, key)
    .first<{ pref_value: string }>();
  return row?.pref_value ?? null;
}

export async function setAdminPref(
  DB: D1Database,
  adminId: number,
  key: AdminPrefKey,
  value: string,
): Promise<void> {
  await ensureAdminPrefs(DB);
  await DB.prepare(
    `INSERT INTO admin_prefs (admin_id, pref_key, pref_value, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(admin_id, pref_key) DO UPDATE SET pref_value = excluded.pref_value, updated_at = CURRENT_TIMESTAMP`,
  )
    .bind(adminId, key, value)
    .run();
}
