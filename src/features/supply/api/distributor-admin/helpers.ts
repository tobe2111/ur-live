/**
 * 🏭 distributor-admin 공유 헬퍼/상수 (byte-identical 분해, 동작 변화 0).
 *   원본 distributor-admin.routes.ts 의 모듈-level 헬퍼/WeakSet/상수를 그대로 이동.
 */
import type { Env } from '@/worker/types/env'
import { swallow } from '@/worker/utils/swallow'

export type { Env }

export const ASSIGNABLE = ['A', 'B', 'C', 'D', 'OEM'] // SPECIAL 은 직접 배정 X — 특별할인 기간으로만 적용

const _ensured = new WeakSet<object>()
export async function ensureGrades(db: D1Database) {
  if (_ensured.has(db)) return
  _ensured.add(db)
  await db.prepare(`CREATE TABLE IF NOT EXISTS distributor_grades (
    grade TEXT PRIMARY KEY,
    label TEXT,
    margin_pct REAL NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_special INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    updated_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(swallow('distributor-admin:create-table'))
  // 🆕 2026-06-16 신모델 = 판매가 대비 보장마진(%). 프리미엄 38 / 프로 30 / 일반 15.
  await db.prepare(`INSERT OR IGNORE INTO distributor_grades (grade, label, margin_pct, sort_order, is_special) VALUES
    ('A','프리미엄',38,1,0),('B','프로',30,2,0),('C','일반',15,3,0),
    ('D','D등급',8,4,0),('OEM','OEM',40,5,0),('SPECIAL','특별할인(기간한정)',45,9,1)`)
    .run().catch(swallow('distributor-admin:seed'))
  // 🆕 2026-06-16 공식 전환(원가×마크업 → 판매가×(1−보장마진)) 1회 마이그레이션. 기존 행은 구 마크업 값
  //   (A10/B15/C20)이라 그대로 두면 신엔진이 보장마진으로 오해석 → 가격 역전. flag 로 1회만 값/라벨 갱신.
  const MIGRATE_FLAG = 'wholesale_grade_model_v2_20260616'
  const flag = await db.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(MIGRATE_FLAG).first<{ value: string }>().catch(() => null)
  if (!flag) {
    await db.batch([
      db.prepare("UPDATE distributor_grades SET margin_pct = 38, label = '프리미엄' WHERE grade = 'A'"),
      db.prepare("UPDATE distributor_grades SET margin_pct = 30, label = '프로' WHERE grade = 'B'"),
      db.prepare("UPDATE distributor_grades SET margin_pct = 15, label = '일반' WHERE grade = 'C'"),
      db.prepare("UPDATE distributor_grades SET margin_pct = 8 WHERE grade = 'D'"),
      db.prepare("UPDATE distributor_grades SET margin_pct = 40 WHERE grade = 'OEM'"),
      db.prepare("UPDATE distributor_grades SET margin_pct = 45 WHERE grade = 'SPECIAL'"),
      db.prepare("INSERT INTO platform_settings (key, value, updated_at) VALUES (?, '1', datetime('now')) ON CONFLICT(key) DO UPDATE SET value = '1', updated_at = datetime('now')").bind(MIGRATE_FLAG),
    ]).catch(swallow('distributor-admin:grade-model-v2-migrate'))
  }
}

// ── BIZ-2 v1 (2026-06-08) 여신/외상(credit terms) 관리 ─────────────────────────
//   sellers 의 distributor_credit_limit / outstanding_balance / credit_frozen + 미수금 원장.
//   ⚠️ wholesale.routes ensureCreditSchema 와 동일 스키마 — cold isolate 대비 여기서도 멱등 보장.
const _creditEnsuredAdmin = new WeakSet<object>()
export async function ensureCreditSchemaAdmin(DB: D1Database) {
  if (_creditEnsuredAdmin.has(DB)) return
  _creditEnsuredAdmin.add(DB)
  for (const sql of [
    'ALTER TABLE sellers ADD COLUMN distributor_credit_limit INTEGER DEFAULT 0',
    'ALTER TABLE sellers ADD COLUMN outstanding_balance INTEGER DEFAULT 0',
    'ALTER TABLE sellers ADD COLUMN credit_frozen INTEGER DEFAULT 0',
    'ALTER TABLE sellers ADD COLUMN mall_id INTEGER DEFAULT 1', // 🏬 멀티-몰: 목록 JOIN/필터 안전 보장
  ]) { await DB.prepare(sql).run().catch(swallow('distributor-admin:credit:alter')) }
  // 🏬 멀티-몰: wholesale_malls 테이블/기본 몰 보장(목록 LEFT JOIN m.name 안전). 없으면 cold-isolate self-heal.
  await DB.prepare(`CREATE TABLE IF NOT EXISTS wholesale_malls (
    id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT UNIQUE, name TEXT, host TEXT, brand_name TEXT,
    brand_color TEXT, logo_url TEXT, deposit_account TEXT, commission_rate REAL, categories_json TEXT,
    active INTEGER DEFAULT 1, created_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(swallow('distributor-admin:malls:ensure'))
  await DB.prepare(`CREATE TABLE IF NOT EXISTS wholesale_credit_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    distributor_seller_id INTEGER NOT NULL,
    order_id INTEGER,
    type TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,
    balance_after INTEGER NOT NULL DEFAULT 0,
    memo TEXT,
    created_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(swallow('distributor-admin:credit:ledger'))
  await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_wholesale_credit_ledger_seller ON wholesale_credit_ledger(distributor_seller_id, created_at DESC)`).run().catch(swallow('distributor-admin:credit:idx'))
}

// ── 상품제안 (어드민 → 판매사) ────────────────────────────────────────────────
export async function ensureProposals(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS wholesale_proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT, distributor_seller_id INTEGER NOT NULL, product_id INTEGER NOT NULL,
    note TEXT, status TEXT NOT NULL DEFAULT 'active', created_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(swallow('distributor-admin:ensure-proposals'))
}

// 플랫폼(유통스타트) 사업자정보 — 전자세금계산서(바로빌) 발행에 필요. platform_settings 저장.
export const COMPANY_KEYS = ['company_business_number', 'company_name', 'company_ceo', 'company_address', 'company_biz_type', 'company_biz_class', 'company_email', 'company_tel'] as const

// 🩹 2026-06-17 (사용자 신고 — 데모 '정리' 500 근본수정): products 의 FTS 삭제 트리거를 외부콘텐츠
//   (content=products) FTS5 정식 'delete' 커맨드 패턴으로 교정. 기존 트리거(`DELETE FROM products_fts
//   WHERE rowid=OLD.id`)는 AFTER DELETE 시점에 원본 행이 이미 사라져 인덱스에서 제거할 콘텐츠를 못 읽어
//   throw → 상품 하드삭제(데모 정리)가 500. 정식 'delete' 커맨드는 OLD 값을 명시 전달하므로 행 소실과
//   무관하게 인덱스 동기화 성공. CREATE TRIGGER IF NOT EXISTS 는 기존을 안 바꾸므로 DROP 후 재생성(멱등).
//   하드삭제는 이 앱에서 드물어(보통 is_active 소프트삭제) 현재 100% 깨진 경로라 — 회귀 위험 없음(개선만).
//   update/insert 트리거는 하드에러 없이 상시 동작(상품 수정/생성 정상) → 범위 밖, 건드리지 않음(블래스트 최소).
const _ftsDeleteTriggerFixed = new WeakSet<object>()
export async function ensureProductsFtsDeleteTrigger(DB: D1Database): Promise<void> {
  if (_ftsDeleteTriggerFixed.has(DB)) return
  _ftsDeleteTriggerFixed.add(DB)
  try {
    await DB.prepare('DROP TRIGGER IF EXISTS products_fts_delete').run()
    await DB.prepare(
      `CREATE TRIGGER products_fts_delete AFTER DELETE ON products BEGIN
        INSERT INTO products_fts(products_fts, rowid, name, description, category)
        VALUES('delete', OLD.id, COALESCE(OLD.name,''), COALESCE(OLD.description,''), COALESCE(OLD.category,''));
      END`,
    ).run()
  } catch (e) {
    // products_fts 미설치(FTS 미사용 DB)·드문 오류 — 폴백(소프트 아카이브)이 처리. DROP 만 성공해도 하드삭제는 가능.
    swallow('distributor-admin:fts-delete-trigger')(e)
  }
}
