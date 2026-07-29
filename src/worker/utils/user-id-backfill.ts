/**
 * 🔧 2026-07-13 (데이터 감사 3단계): off-live user_id 이력 backfill — firebase_uid → 숫자 users.id.
 *
 * 배경(1단계 후속): live(카카오 세션)는 이미 숫자 users.id 라 backfill 대상 0. off-live(Firebase)
 *   에서 과거 orders/vouchers/point_transactions/user_points 가 firebase_uid 문자열로 키됐을 수 있어,
 *   완결고리 조인이 갈라짐. 이 backfill 로 그 이력을 숫자 users.id 로 수렴.
 *
 * 안전:
 *  - 기본 **dry-run**(카운트만). apply=true 일 때만 UPDATE.
 *  - **멱등**: 수렴 후 user_id 는 숫자 → 다시 firebase_uid 집합에 안 잡힘(재실행 no-op).
 *  - orders/vouchers/point_transactions: user_id 유니크 제약 없음 → 안전 relabel.
 *  - user_points: user_id PK. 대상 유저의 숫자 잔액행이 **이미 있으면 PK 충돌** → 그 행은
 *    건드리지 않고 conflict 로 보고(잔액 병합은 수동 검토 필요 — 자동 합산 안 함).
 */

const FIREBASE_SET = "SELECT firebase_uid FROM users WHERE firebase_uid IS NOT NULL AND firebase_uid <> ''"
// 대상 테이블의 user_id(=firebase_uid)에 매칭되는 숫자 users.id (문자열).
function numericIdSub(table: string): string {
  return `(SELECT CAST(u.id AS TEXT) FROM users u WHERE u.firebase_uid = ${table}.user_id)`
}

export interface BackfillTableResult {
  table: string
  candidates: number
  updated: number
  conflicts: number
  applied: boolean
}

async function countCandidates(DB: D1Database, table: string): Promise<number> {
  const r = await DB.prepare(
    `SELECT COUNT(*) AS n FROM ${table} t WHERE t.user_id IN (${FIREBASE_SET})`,
  ).first<{ n: number }>().catch(() => null)
  return r?.n ?? 0
}

/** 안전 relabel 테이블(유니크 없음): orders / vouchers / point_transactions. */
async function backfillPlain(DB: D1Database, table: string, apply: boolean): Promise<BackfillTableResult> {
  const candidates = await countCandidates(DB, table)
  let updated = 0
  if (apply && candidates > 0) {
    const r = await DB.prepare(
      `UPDATE ${table} SET user_id = ${numericIdSub(table)} WHERE user_id IN (${FIREBASE_SET})`,
    ).run().catch(() => null)
    updated = r?.meta?.changes ?? 0
  }
  return { table, candidates, updated, conflicts: 0, applied: apply }
}

/** user_points(PK=user_id): 숫자 잔액행 없는 것만 relabel, 있으면 conflict 보고(병합 안 함). */
async function backfillUserPoints(DB: D1Database, apply: boolean): Promise<BackfillTableResult> {
  const table = 'user_points'
  const candidates = await countCandidates(DB, table)
  // 충돌 = firebase 행의 목표 숫자 id 로 이미 잔액행이 존재.
  const conflictRow = await DB.prepare(
    `SELECT COUNT(*) AS n FROM user_points up
      WHERE up.user_id IN (${FIREBASE_SET})
        AND EXISTS (SELECT 1 FROM user_points up2 WHERE up2.user_id = ${numericIdSub('up')})`,
  ).first<{ n: number }>().catch(() => null)
  const conflicts = conflictRow?.n ?? 0
  let updated = 0
  if (apply && candidates - conflicts > 0) {
    const r = await DB.prepare(
      `UPDATE user_points SET user_id = ${numericIdSub('user_points')}
        WHERE user_id IN (${FIREBASE_SET})
          AND NOT EXISTS (SELECT 1 FROM user_points up2 WHERE up2.user_id = ${numericIdSub('user_points')})`,
    ).run().catch(() => null)
    updated = r?.meta?.changes ?? 0
  }
  return { table, candidates, updated, conflicts, applied: apply }
}

/**
 * 전체 backfill 실행. apply=false(기본)=dry-run 카운트만.
 * 반환: 테이블별 candidates/updated/conflicts + 요약.
 */
export async function backfillUserIdMapping(
  DB: D1Database,
  apply: boolean,
): Promise<{ apply: boolean; tables: BackfillTableResult[]; total_candidates: number; total_updated: number; total_conflicts: number }> {
  const tables: BackfillTableResult[] = []
  for (const t of ['orders', 'vouchers', 'point_transactions']) {
    tables.push(await backfillPlain(DB, t, apply).catch(() => ({ table: t, candidates: 0, updated: 0, conflicts: 0, applied: apply })))
  }
  tables.push(await backfillUserPoints(DB, apply).catch(() => ({ table: 'user_points', candidates: 0, updated: 0, conflicts: 0, applied: apply })))
  return {
    apply,
    tables,
    total_candidates: tables.reduce((a, b) => a + b.candidates, 0),
    total_updated: tables.reduce((a, b) => a + b.updated, 0),
    total_conflicts: tables.reduce((a, b) => a + b.conflicts, 0),
  }
}
