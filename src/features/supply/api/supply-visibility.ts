/**
 * 🏭 2026-06-03 유통스타트 도매몰 — 공급 범위(유통채널 선별) + 공급가 이력 + 바코드 스키마/헬퍼.
 * (스펙: "전체공급 / 승인한 유통채널 공급 / 유통스타트 유통채널 공급" + 선정된 유통회원에게만 공개)
 *
 * products.supply_visibility:
 *   - 'ALL'              : 전체공급 — 모든 유통사에 노출 (기본)
 *   - 'APPROVED_CHANNEL' : 승인한 유통채널 공급 — 허용목록(product_distributor_access) 유통사만
 *   - 'UTONGSTART_ONLY'  : 유통스타트 유통채널 공급 — 관리자가 선정한 유통사만 (허용목록 동일 사용)
 *
 * 카탈로그/주문에서 유통사 가시성 = ALL 이거나, 허용목록에 해당 유통사 row 존재.
 *
 * ⚠️ 멱등 ensure. ALTER ADD COLUMN 은 pragma 로 존재 확인 후 1회만.
 */
import { swallow } from '@/worker/utils/swallow'

export const SUPPLY_VISIBILITY_VALUES = ['ALL', 'APPROVED_CHANNEL', 'UTONGSTART_ONLY'] as const
export type SupplyVisibility = (typeof SUPPLY_VISIBILITY_VALUES)[number]

// 🛡️ 완료된 ensure 만 캐시(promise 기반) — add 를 await 전에 하면 동시 cold 요청이
//   컬럼 생성 전에 쿼리해 500. in-flight promise 를 공유해 동시 호출이 같은 완료를 기다림.
const _ensuring = new WeakMap<object, Promise<void>>()

export async function ensureSupplyVisibilitySchema(DB: D1Database): Promise<void> {
  const existing = _ensuring.get(DB)
  if (existing) return existing
  const p = _ensureSupplyVisibilitySchema(DB)
  _ensuring.set(DB, p)
  try {
    await p
  } catch {
    _ensuring.delete(DB) // 실패 시 다음 호출이 재시도하도록 캐시 제거
  }
}

/** products.supply_visibility / barcode 컬럼 + 허용목록·공급가이력 테이블 보장 (멱등). */
async function _ensureSupplyVisibilitySchema(DB: D1Database): Promise<void> {
  // products 컬럼 추가 (존재 확인 후) — D1 은 ADD COLUMN IF NOT EXISTS 미지원.
  const cols = await DB.prepare("SELECT name FROM pragma_table_info('products')")
    .all<{ name: string }>().catch(() => ({ results: [] as { name: string }[] }))
  const have = new Set((cols.results || []).map(r => r.name))
  // 🛡️ 2026-06-04 핵심 공급(B2B) 컬럼 self-heal — 기존엔 /api/_internal/repair-schema 수동 실행에만
  //   의존했음. 미실행 환경에서 /catalog·/home 이 supply_price/supply_source_id 참조 시 500.
  //   카탈로그·주문 등 모든 supply route 가 이 ensure 를 호출하므로 여기서 보장하면 영구 self-heal.
  if (!have.has('is_supply_product')) {
    await DB.prepare('ALTER TABLE products ADD COLUMN is_supply_product INTEGER DEFAULT 0').run().catch(swallow('supply-vis:add-is-supply'))
  }
  if (!have.has('supply_price')) {
    await DB.prepare('ALTER TABLE products ADD COLUMN supply_price INTEGER DEFAULT 0').run().catch(swallow('supply-vis:add-supply-price'))
  }
  if (!have.has('supply_source_id')) {
    await DB.prepare('ALTER TABLE products ADD COLUMN supply_source_id INTEGER').run().catch(swallow('supply-vis:add-supply-source'))
  }
  if (!have.has('supplier_id')) {
    await DB.prepare('ALTER TABLE products ADD COLUMN supplier_id INTEGER').run().catch(swallow('supply-vis:add-supplier-id'))
  }
  if (!have.has('supply_approval_status')) {
    await DB.prepare('ALTER TABLE products ADD COLUMN supply_approval_status TEXT').run().catch(swallow('supply-vis:add-approval'))
  }
  if (!have.has('supply_visibility')) {
    await DB.prepare("ALTER TABLE products ADD COLUMN supply_visibility TEXT DEFAULT 'ALL'").run().catch(swallow('supply-vis:add-col'))
  }
  if (!have.has('barcode')) {
    await DB.prepare('ALTER TABLE products ADD COLUMN barcode TEXT').run().catch(swallow('supply-vis:add-barcode'))
  }
  if (!have.has('is_brand_product')) {
    // 스펙 정산 분기: 브랜드제품(1) = 판매 후 당일 정산 / 일반제품(0) = 7일 환불창 성숙 후.
    await DB.prepare('ALTER TABLE products ADD COLUMN is_brand_product INTEGER DEFAULT 0').run().catch(swallow('supply-vis:add-brand'))
  }
  if (!have.has('supply_margin_override_pct')) {
    // 🏭 2026-06-04 상품별 등급마진 override (사용자 확정) — 설정 시 등급 무관 이 마진을
    //   전 유통사에 동일 적용(전략/특가 상품). NULL = 기존 등급별 마진. 관리자만 설정.
    await DB.prepare('ALTER TABLE products ADD COLUMN supply_margin_override_pct REAL').run().catch(swallow('supply-vis:add-margin-override'))
  }
  if (!have.has('min_order_qty')) {
    // 🏭 2026-06-04 최소 주문 수량(MOQ) — 도매 박스 단위. 공급자 설정, 기본 1(낱개).
    //   카드/상세/카트 박스·개당 단가 병기 + 주문 서버 검증(qty >= moq).
    await DB.prepare('ALTER TABLE products ADD COLUMN min_order_qty INTEGER DEFAULT 1').run().catch(swallow('supply-vis:add-moq'))
  }
  // 🏭 2026-06-07 온라인 최저가 검수 + 가격변경 승인 워크플로 (사용자 요청).
  //   제조사(브랜드사) 업로드 시 '온라인 최저가' 참고 링크 제출 → 어드민이 최저가 검수(lowest_price_checked).
  //   승인되어 판매 중인 상품의 가격 수정은 즉시 반영 X → pending_* 에 적재 후 어드민 승인 시에만 라이브 반영.
  if (!have.has('lowest_price_url')) {
    await DB.prepare('ALTER TABLE products ADD COLUMN lowest_price_url TEXT').run().catch(swallow('supply-vis:add-lp-url'))
  }
  if (!have.has('lowest_price_checked')) {
    await DB.prepare('ALTER TABLE products ADD COLUMN lowest_price_checked INTEGER DEFAULT 0').run().catch(swallow('supply-vis:add-lp-checked'))
  }
  if (!have.has('pending_supply_price')) {
    await DB.prepare('ALTER TABLE products ADD COLUMN pending_supply_price INTEGER').run().catch(swallow('supply-vis:add-pending-supply'))
  }
  if (!have.has('pending_retail_price')) {
    await DB.prepare('ALTER TABLE products ADD COLUMN pending_retail_price INTEGER').run().catch(swallow('supply-vis:add-pending-retail'))
  }
  if (!have.has('pending_price_url')) {
    await DB.prepare('ALTER TABLE products ADD COLUMN pending_price_url TEXT').run().catch(swallow('supply-vis:add-pending-url'))
  }
  if (!have.has('pending_price_reason')) {
    await DB.prepare('ALTER TABLE products ADD COLUMN pending_price_reason TEXT').run().catch(swallow('supply-vis:add-pending-reason'))
  }
  if (!have.has('pending_price_requested_at')) {
    await DB.prepare('ALTER TABLE products ADD COLUMN pending_price_requested_at TEXT').run().catch(swallow('supply-vis:add-pending-at'))
  }

  await DB.prepare(`CREATE TABLE IF NOT EXISTS product_distributor_access (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    distributor_seller_id INTEGER NOT NULL,
    granted_by INTEGER,
    created_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(product_id, distributor_seller_id)
  )`).run().catch(swallow('supply-vis:create-access'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_pda_seller ON product_distributor_access(distributor_seller_id)')
    .run().catch(swallow('supply-vis:idx-seller'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_pda_product ON product_distributor_access(product_id)')
    .run().catch(swallow('supply-vis:idx-product'))

  // 🏭 2026-06-04 수량 구간 할인(volume tier) — 상품별 "많이 살수록 ↓" (% 할인). 관리자 설정.
  await DB.prepare(`CREATE TABLE IF NOT EXISTS product_qty_tiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    min_qty INTEGER NOT NULL,
    discount_pct REAL NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(product_id, min_qty)
  )`).run().catch(swallow('supply-vis:create-qty-tiers'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_pqt_product ON product_qty_tiers(product_id, min_qty)')
    .run().catch(swallow('supply-vis:idx-pqt'))

  // 공급가 수정 이력 (스펙: 수정 전 금액 기록 — 관리자만 확인).
  await DB.prepare(`CREATE TABLE IF NOT EXISTS supply_price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    supplier_id INTEGER,
    old_supply_price INTEGER,
    new_supply_price INTEGER,
    changed_by TEXT,
    created_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(swallow('supply-vis:create-price-history'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_sph_product ON supply_price_history(product_id, created_at DESC)')
    .run().catch(swallow('supply-vis:idx-sph'))
}

/**
 * 유통사 가시성 SQL 조건 (products alias `p`). bind 에 sellerId 1개 push 필요.
 * supply_visibility 가 ALL/NULL 이거나, 허용목록에 (product, seller) row 가 있으면 노출.
 */
export const visibilityWhere = (alias = 'p') =>
  `(${alias}.supply_visibility = 'ALL' OR ${alias}.supply_visibility IS NULL
    OR EXISTS (SELECT 1 FROM product_distributor_access pda
               WHERE pda.product_id = ${alias}.id AND pda.distributor_seller_id = ?))`

/** 공급가 변경 이력 기록 (변경 시에만). */
export async function recordSupplyPriceChange(
  DB: D1Database,
  productId: number,
  supplierId: number | null,
  oldPrice: number,
  newPrice: number,
  changedBy: string,
): Promise<void> {
  if (oldPrice === newPrice) return
  await DB.prepare(
    `INSERT INTO supply_price_history (product_id, supplier_id, old_supply_price, new_supply_price, changed_by)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(productId, supplierId, oldPrice, newPrice, changedBy.slice(0, 40)).run().catch(swallow('supply-vis:price-history'))
}

/**
 * 공급 범위 값 정규화 (잘못된 값 → ALL).
 * @param selfServe 제조사 self-serve 입력이면 true — `UTONGSTART_ONLY`(유통스타트 유통채널 =
 *   관리자 선정 전용)는 제조사가 직접 설정 못 하도록 `APPROVED_CHANNEL`(본인 승인 채널)로 강등.
 *   관리자(distributor-admin) 경로는 selfServe 생략 → 3종 모두 허용.
 */
export function normalizeVisibility(v: unknown, selfServe = false): SupplyVisibility {
  const s = String(v || '').toUpperCase()
  const valid = (SUPPLY_VISIBILITY_VALUES as readonly string[]).includes(s) ? (s as SupplyVisibility) : 'ALL'
  if (selfServe && valid === 'UTONGSTART_ONLY') return 'APPROVED_CHANNEL'
  return valid
}
