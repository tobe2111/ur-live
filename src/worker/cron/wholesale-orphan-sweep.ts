/**
 * 🏭 DATA-1 (2026-06-08) — 도매몰 FK/고아행 일일 스윕 (flag-only).
 *
 * 도매(공급) 모델은 D1(SQLite)에서 외래키 제약을 쓰지 않는다 — 운영 중 ALTER/repair-schema 로
 * 컬럼을 점진 추가했고, FK ON DELETE 가 없어 참조 대상이 지워져도 dangling 행이 남는다.
 * 이 cron 은 매일 LEFT JOIN / NOT EXISTS 로 그런 고아행을 **집계만** 하고
 * `wholesale_integrity_reports` 테이블에 리포트 한 행을 남긴다.
 *
 * ⚠️ 절대 삭제하지 않는다 (flag-only). 어떤 고아행이 실제로 정리되어야 하는지는
 *    어드민 수동 판단 영역 — 자동 삭제는 정산/주문 데이터 유실 위험이 커서 금지.
 *    이 스윕은 **읽기 전용 + 리포트 INSERT** 만 수행한다.
 *
 * 설계 결정:
 *   - **per-check fail-soft**: 한 체크 쿼리 실패(테이블 없음 등)가 전체 스윕을 중단시키지 않는다.
 *     누락 테이블은 `error` 필드로 리포트에 기록.
 *   - **capped sample ids**: 각 체크당 고아 id 를 최대 SAMPLE_CAP 개만 저장 (리포트 비대화 방지).
 *   - **멱등**: run 당 리포트 1행 INSERT. 최근 KEEP_REPORTS 개만 유지(오래된 행 정리).
 *   - **self-ensure**: 리포트 테이블을 best-effort 로 생성 (repair-schema 미실행 환경 대비).
 *
 * 호출:
 *   - cron (worker/scheduled.ts, 매일 1회)
 *   - 어드민 수동 트리거 (wholesale-integrity.routes GET /api/admin/wholesale/integrity?run=1)
 */

import type { Env } from '../types/env';
import { swallow } from '../utils/swallow';

/** 체크당 저장하는 고아 id 샘플 최대 개수. */
const SAMPLE_CAP = 50;
/** 보관하는 최근 리포트 행 수. 초과분은 매 run 후 삭제. */
const KEEP_REPORTS = 30;

export interface OrphanCheck {
  /** 머신 키 (안정적, UI/정렬용). */
  key: string;
  /** 사람이 읽는 설명 (어떤 참조가 깨졌는지). */
  label: string;
  /** 발견된 고아행 수. */
  count: number;
  /** 고아행 id 샘플 (최대 SAMPLE_CAP). */
  sample_ids: Array<number | string>;
  /** 체크 실패 시 사유 (테이블 없음 등). null 이면 정상. */
  error: string | null;
}

export interface OrphanSweepResult {
  run_at: string;
  total_orphans: number;
  checks: OrphanCheck[];
}

/**
 * 단일 고아 체크 실행. id 컬럼을 SELECT 하는 쿼리를 받아 count + 샘플 id 를 채운다.
 * 쿼리는 `SELECT <idCol> AS oid FROM ... WHERE <고아 조건>` 형태여야 한다.
 * 실패(테이블 없음 등)는 fail-soft — error 필드에 사유 기록.
 */
async function runCheck(
  DB: D1Database,
  key: string,
  label: string,
  sql: string,
): Promise<OrphanCheck> {
  try {
    const res = await DB.prepare(sql).all<{ oid: number | string }>();
    const rows = res.results ?? [];
    const sample_ids = rows.slice(0, SAMPLE_CAP).map((r) => r.oid);
    return { key, label, count: rows.length, sample_ids, error: null };
  } catch (err) {
    return {
      key,
      label,
      count: 0,
      sample_ids: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** 리포트 테이블 self-ensure (best-effort). */
async function ensureReportTable(DB: D1Database): Promise<void> {
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS wholesale_integrity_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_at DATETIME DEFAULT (datetime('now')),
      total_orphans INTEGER NOT NULL DEFAULT 0,
      checks_json TEXT NOT NULL
    )
  `).run().catch(swallow('wholesale-orphan-sweep:ensure-table'));
  await DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_wholesale_integrity_run ON wholesale_integrity_reports(run_at DESC)`,
  ).run().catch(swallow('wholesale-orphan-sweep:ensure-index'));
}

/**
 * 메인 스윕. cron + 어드민 수동 트리거가 공유.
 * 절대 삭제하지 않음 — flag-only 집계 + 리포트 INSERT.
 */
export async function runWholesaleOrphanSweep(env: Env): Promise<OrphanSweepResult> {
  const DB = env.DB;
  const out: OrphanSweepResult = { run_at: new Date().toISOString(), total_orphans: 0, checks: [] };
  if (!DB) return out;

  await ensureReportTable(DB);

  // 각 체크: LEFT JOIN ... WHERE 우측 NULL / NOT EXISTS 로 참조 대상이 사라진 행을 찾는다.
  //   product_id / supply_source_id 가 0 또는 NULL 인 행은 "참조 없음"이 정상이므로 제외(> 0 가드).
  const checks: OrphanCheck[] = [];

  // 1) supplier_settlements 의 product_id 가 products 에 없음 (상품 삭제됨).
  checks.push(await runCheck(
    DB,
    'settlement_dangling_product',
    'supplier_settlements: 참조 상품(products) 없음',
    `SELECT ss.id AS oid
       FROM supplier_settlements ss
       LEFT JOIN products p ON p.id = ss.product_id
      WHERE ss.product_id IS NOT NULL AND ss.product_id > 0 AND p.id IS NULL`,
  ));

  // 2) supplier_settlements 의 order_id 가 orders 에 없음 (주문 삭제됨).
  checks.push(await runCheck(
    DB,
    'settlement_dangling_order',
    'supplier_settlements: 참조 주문(orders) 없음',
    `SELECT ss.id AS oid
       FROM supplier_settlements ss
       LEFT JOIN orders o ON o.id = ss.order_id
      WHERE ss.order_id IS NOT NULL AND ss.order_id > 0 AND o.id IS NULL`,
  ));

  // 3) supplier_settlements 의 supplier_id 가 suppliers 에 없음 (공급자 삭제됨).
  checks.push(await runCheck(
    DB,
    'settlement_dangling_supplier',
    'supplier_settlements: 참조 공급자(suppliers) 없음',
    `SELECT ss.id AS oid
       FROM supplier_settlements ss
       LEFT JOIN suppliers s ON s.id = ss.supplier_id
      WHERE ss.supplier_id IS NOT NULL AND ss.supplier_id > 0 AND s.id IS NULL`,
  ));

  // 4) products.supply_source_id 가 존재하지 않는 공급 상품(원본 product)을 가리킴.
  //    (셀러가 등록한 상품이 가리키는 공급 원본이 삭제됨)
  checks.push(await runCheck(
    DB,
    'product_dangling_supply_source',
    'products: supply_source_id 가 가리키는 공급 원본 상품 없음',
    `SELECT p.id AS oid
       FROM products p
       LEFT JOIN products src ON src.id = p.supply_source_id
      WHERE p.supply_source_id IS NOT NULL AND p.supply_source_id > 0 AND src.id IS NULL`,
  ));

  // 5) products.supplier_id 가 존재하지 않는 공급자를 가리킴 (공급 상품인데 공급자 삭제됨).
  checks.push(await runCheck(
    DB,
    'product_dangling_supplier',
    'products: supplier_id 가 가리키는 공급자(suppliers) 없음',
    `SELECT p.id AS oid
       FROM products p
       LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.supplier_id IS NOT NULL AND p.supplier_id > 0 AND s.id IS NULL`,
  ));

  // 6) supplier_balances 의 supplier_id 가 suppliers 에 없음 (공급자 삭제됐는데 잔액행 잔존).
  checks.push(await runCheck(
    DB,
    'balance_dangling_supplier',
    'supplier_balances: 참조 공급자(suppliers) 없음',
    `SELECT sb.supplier_id AS oid
       FROM supplier_balances sb
       LEFT JOIN suppliers s ON s.id = sb.supplier_id
      WHERE sb.supplier_id IS NOT NULL AND s.id IS NULL`,
  ));

  // 7) wholesale_order_items 의 wholesale_order_id 가 wholesale_orders 에 없음 (도매주문 삭제됨).
  checks.push(await runCheck(
    DB,
    'wholesale_item_dangling_order',
    'wholesale_order_items: 참조 도매주문(wholesale_orders) 없음',
    `SELECT wi.id AS oid
       FROM wholesale_order_items wi
       LEFT JOIN wholesale_orders wo ON wo.id = wi.wholesale_order_id
      WHERE wi.wholesale_order_id IS NOT NULL AND wi.wholesale_order_id > 0 AND wo.id IS NULL`,
  ));

  // 8) wholesale_order_items 의 product_id 가 products 에 없음 (상품 삭제됨).
  checks.push(await runCheck(
    DB,
    'wholesale_item_dangling_product',
    'wholesale_order_items: 참조 상품(products) 없음',
    `SELECT wi.id AS oid
       FROM wholesale_order_items wi
       LEFT JOIN products p ON p.id = wi.product_id
      WHERE wi.product_id IS NOT NULL AND wi.product_id > 0 AND p.id IS NULL`,
  ));

  // 9) wholesale_order_items 의 supplier_id 가 suppliers 에 없음 (공급자 삭제됨).
  checks.push(await runCheck(
    DB,
    'wholesale_item_dangling_supplier',
    'wholesale_order_items: 참조 공급자(suppliers) 없음',
    `SELECT wi.id AS oid
       FROM wholesale_order_items wi
       LEFT JOIN suppliers s ON s.id = wi.supplier_id
      WHERE wi.supplier_id IS NOT NULL AND wi.supplier_id > 0 AND s.id IS NULL`,
  ));

  // 10) wholesale_orders 의 distributor_seller_id 가 sellers 에 없음 (유통사 셀러 삭제됨).
  checks.push(await runCheck(
    DB,
    'wholesale_order_dangling_seller',
    'wholesale_orders: 참조 유통사(sellers) 없음',
    `SELECT wo.id AS oid
       FROM wholesale_orders wo
       LEFT JOIN sellers se ON se.id = wo.distributor_seller_id
      WHERE wo.distributor_seller_id IS NOT NULL AND wo.distributor_seller_id > 0 AND se.id IS NULL`,
  ));

  out.checks = checks;
  out.total_orphans = checks.reduce((sum, c) => sum + (c.error ? 0 : c.count), 0);

  // 리포트 한 행 INSERT (run 당 1행, 멱등).
  await DB.prepare(
    `INSERT INTO wholesale_integrity_reports (run_at, total_orphans, checks_json) VALUES (?, ?, ?)`,
  ).bind(out.run_at, out.total_orphans, JSON.stringify(checks))
    .run().catch(swallow('wholesale-orphan-sweep:insert-report'));

  // 최근 KEEP_REPORTS 개만 유지 — 오래된 리포트 정리(best-effort).
  await DB.prepare(
    `DELETE FROM wholesale_integrity_reports
      WHERE id NOT IN (
        SELECT id FROM wholesale_integrity_reports ORDER BY run_at DESC, id DESC LIMIT ?
      )`,
  ).bind(KEEP_REPORTS).run().catch(swallow('wholesale-orphan-sweep:prune'));

  const failed = checks.filter((c) => c.error).length;
  console.info(
    `[cron:wholesale-orphan-sweep] orphans=${out.total_orphans} checks=${checks.length} failed=${failed}`,
  );
  return out;
}

/** cron 진입점 (scheduled.ts 에서 호출). */
export async function handleWholesaleOrphanSweep(env: Env): Promise<void> {
  await runWholesaleOrphanSweep(env).catch((e) => {
    console.error('[cron:wholesale-orphan-sweep] FAILED', e);
  });
}
