/**
 * 🏭 유통스타트 도매몰 — 순수 헬퍼 / 스키마 ensure / 상수 / 타입.
 *   wholesale.routes.ts 에서 분해(byte-identical 이동). route 핸들러 본문/SQL/money 로직은 미포함.
 *   ⚠️ 이 파일의 함수 본문은 wholesale.routes.ts 의 원본과 한 글자도 다르지 않음(이동만).
 */
import { swallow } from '@/worker/utils/swallow'
import { type GradeMargin, type QtyTier } from '@/lib/distributor-pricing'
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes'
// 🔐 2026-06-28 (대표 "큰 리팩터"): 셀러 토큰 파싱은 서비스 중립 공용 유틸로 이동(`@/worker/utils/seller-auth`).
//   기존 import 경로(`from './wholesale-helpers'`) 보존을 위해 re-export — wholesale.routes/wholesale-deposit 등 무수정.
export { sellerIdFrom, sellerIdFromCookieGet } from '@/worker/utils/seller-auth'

// ── B2B 주문 테이블 (선결제). 멱등 ensure. ───────────────────────────────────
const _whEnsured = new WeakSet<object>()
export async function ensureOrderTables(DB: D1Database) {
  if (_whEnsured.has(DB)) return
  _whEnsured.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS wholesale_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    distributor_seller_id INTEGER NOT NULL,
    toss_order_id TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'PENDING',
    grade TEXT,
    subtotal INTEGER NOT NULL DEFAULT 0,
    supply_total INTEGER NOT NULL DEFAULT 0,
    margin_total INTEGER NOT NULL DEFAULT 0,
    payment_key TEXT,
    refunded_amount INTEGER NOT NULL DEFAULT 0,
    courier TEXT,
    tracking_number TEXT,
    shipped_at DATETIME,
    ship_to_name TEXT,
    ship_to_phone TEXT,
    ship_to_address TEXT,
    ship_to_postal TEXT,
    created_at DATETIME DEFAULT (datetime('now')),
    updated_at DATETIME,
    paid_at DATETIME
  )`).run().catch(swallow('wholesale:create-orders'))
  // 🛡️ 2026-06-11 (CI strict 검출 — 잠복 머니버그): compensateDepositOrderOnce 가 updated_at 을
  //   갱신하는데 기존 테이블에 컬럼이 없으면 환불 보상 CAS 가 무음 실패(.catch→changes 0).
  //   기존 환경 self-heal (신규는 위 CREATE 에 포함).
  await DB.prepare('ALTER TABLE wholesale_orders ADD COLUMN updated_at DATETIME').run().catch(swallow('wholesale:orders-updated-at'))
  await DB.prepare(`CREATE TABLE IF NOT EXISTS wholesale_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wholesale_order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    supplier_id INTEGER,
    name TEXT,
    qty INTEGER NOT NULL DEFAULT 1,
    base_supply_price INTEGER NOT NULL DEFAULT 0,
    distributor_unit_price INTEGER NOT NULL DEFAULT 0,
    line_total INTEGER NOT NULL DEFAULT 0,
    courier TEXT,
    tracking_number TEXT,
    shipped_at DATETIME,
    line_status TEXT NOT NULL DEFAULT 'PENDING',
    accepted_at DATETIME,
    option_label TEXT,
    ext_order_no TEXT,
    ship_to_name TEXT,
    ship_to_phone TEXT,
    ship_to_postal TEXT,
    ship_to_address TEXT,
    ship_to_message TEXT
  )`).run().catch(swallow('wholesale:create-items'))
  // 🏭 2026-07-01 (라이브 감사 — 라인단위 수락): 제조사별 수락 시각. line_status(발송/환불 게이트)는
  //   건드리지 않고(수락해도 PENDING 유지 → 발송 가능) accepted_at 로만 수락 표시(다제조사 독립 수락).
  await DB.prepare('ALTER TABLE wholesale_order_items ADD COLUMN accepted_at DATETIME').run().catch(swallow('wholesale:items-accepted-at'))
  await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_wholesale_orders_seller ON wholesale_orders(distributor_seller_id, created_at DESC)`).run().catch(swallow('wholesale:idx1'))
  await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_wholesale_items_order ON wholesale_order_items(wholesale_order_id)`).run().catch(swallow('wholesale:idx2'))
  await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_wholesale_items_supplier ON wholesale_order_items(supplier_id)`).run().catch(swallow('wholesale:idx3'))
  // 🛡️ 2026-06-09 perf: 결제확인(confirm)의 toss_order_id 조회 + 정산 멱등확인(order_id,source) — 주문 누적 시 풀스캔 방지.
  await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_wholesale_orders_toss ON wholesale_orders(toss_order_id)`).run().catch(swallow('wholesale:idx4'))
  await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_supplier_settlements_order_source ON supplier_settlements(order_id, source)`).run().catch(swallow('wholesale:idx5'))
  // 🛡️ 2026-06-19 (머니 감사): 정산 멱등의 근간 — UNIQUE(order_id, product_id, source). 도매 적립/클로백의
  //   ON CONFLICT 타겟. repair-schema(idx_supplier_settle_unique)에도 있지만 self-heal 로 ensure 에도 보장
  //   (미실행 env 에서 ON CONFLICT 타겟 부재로 throw 되는 것 방지). 기존 중복행 있으면 생성 실패→swallow(정리 후 재생성).
  await DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_settle_unique ON supplier_settlements(order_id, product_id, source)`).run().catch(swallow('wholesale:idx-settle-unique'))
  // 🚚 2026-06-09 배송정책: wholesale_orders.shipping_total — 주문에 합산된 (제조사별) 배송비 총액.
  //   grand total = subtotal + shipping_total. 보상환불은 (subtotal+shipping_total) 전액 환불.
  await DB.prepare('ALTER TABLE wholesale_orders ADD COLUMN shipping_total INTEGER NOT NULL DEFAULT 0').run().catch(swallow('wholesale:alter-shipping-total'))
  // 🏭 2026-06-27 (대표 — B2B 플로우 완성): 수락/거절/취소/구매확정 단계 타임스탬프 + 사유 (best-effort self-heal).
  //   PENDING→PAID→ACCEPTED→SHIPPED→DONE + REJECTED/CANCELLED. 상태머신(wholesale-order-status.ts) 이 전이 관리.
  await DB.prepare('ALTER TABLE wholesale_orders ADD COLUMN accepted_at DATETIME').run().catch(swallow('wholesale:alter-accepted-at'))
  await DB.prepare('ALTER TABLE wholesale_orders ADD COLUMN rejected_at DATETIME').run().catch(swallow('wholesale:alter-rejected-at'))
  await DB.prepare('ALTER TABLE wholesale_orders ADD COLUMN reject_reason TEXT').run().catch(swallow('wholesale:alter-reject-reason'))
  await DB.prepare('ALTER TABLE wholesale_orders ADD COLUMN cancelled_at DATETIME').run().catch(swallow('wholesale:alter-cancelled-at'))
  await DB.prepare('ALTER TABLE wholesale_orders ADD COLUMN cancel_reason TEXT').run().catch(swallow('wholesale:alter-cancel-reason'))
  await DB.prepare('ALTER TABLE wholesale_orders ADD COLUMN confirmed_at DATETIME').run().catch(swallow('wholesale:alter-confirmed-at'))
  // 🚚 2026-06-29 (대표 — 배송 메시지 주문 전달): 단일주문은 ship_to_* 가 주문 헤더에 있으므로 메시지도 헤더에.
  await DB.prepare('ALTER TABLE wholesale_orders ADD COLUMN ship_to_message TEXT').run().catch(swallow('wholesale:alter-ship-message'))
  // 🛡️ 2026-06-28 (머니 P0 — 배송비 이중환불 차단): 라인 스코프 환불의 배송비 단발 환불 멱등 마커.
  //   전량환불 도달 시 단 하나의 호출만 배송비를 환불(CAS WHERE shipping_refunded=0). 동시 다라인/다제조사
  //   환불에서 stale snapshot 기반 배송비 gap 이 이중 환불되던 것 차단.
  await DB.prepare('ALTER TABLE wholesale_orders ADD COLUMN shipping_refunded INTEGER NOT NULL DEFAULT 0').run().catch(swallow('wholesale:alter-shipping-refunded'))
  // 📦 2026-06-29 (대표 — 대량발주 드랍십): 라인별 옵션(상품상세) + 받는사람별 배송지. 같은 상품이라도
  //   행마다 다른 고객에게 직배(드랍십)되므로 라인 단위로 보관 — 제조사가 라인별 송장 발행. 금액 경로 불변
  //   (옵션/배송지는 비가격 패스스루). best-effort self-heal — 기존 env 에 컬럼 추가(신규는 위 CREATE 포함).
  for (const sql of [
    'ALTER TABLE wholesale_order_items ADD COLUMN option_label TEXT',
    'ALTER TABLE wholesale_order_items ADD COLUMN ext_order_no TEXT',
    'ALTER TABLE wholesale_order_items ADD COLUMN ship_to_name TEXT',
    'ALTER TABLE wholesale_order_items ADD COLUMN ship_to_phone TEXT',
    'ALTER TABLE wholesale_order_items ADD COLUMN ship_to_postal TEXT',
    'ALTER TABLE wholesale_order_items ADD COLUMN ship_to_address TEXT',
    'ALTER TABLE wholesale_order_items ADD COLUMN ship_to_message TEXT',
  ]) { await DB.prepare(sql).run().catch(swallow('wholesale:alter-item-dropship')) }
}

// ── 🚚 2026-06-09 제조사(공급자)별 배송/주문 정책 — suppliers 3컬럼 멱등 ensure. ──────
//   min_order_amount     = 이 제조사 라인 합이 이 금액 미만이면 주문 거부(0=제한 없음).
//   shipping_fee         = 이 제조사 배송비(0=무료/미설정).
//   free_ship_threshold  = 이 제조사 라인 합이 이 금액 이상이면 배송비 무료(0=무료배송 없음).
//   self-contained(repair-schema 와 멱등 동일). best-effort ADD COLUMN — 이미 있으면 swallow.
const _supPolicyEnsured = new WeakSet<object>()
export async function ensureSupplierPolicySchema(DB: D1Database) {
  if (_supPolicyEnsured.has(DB)) return
  _supPolicyEnsured.add(DB)
  for (const sql of [
    'ALTER TABLE suppliers ADD COLUMN min_order_amount INTEGER DEFAULT 0',
    'ALTER TABLE suppliers ADD COLUMN shipping_fee INTEGER DEFAULT 0',
    'ALTER TABLE suppliers ADD COLUMN free_ship_threshold INTEGER DEFAULT 0',
  ]) { await DB.prepare(sql).run().catch(swallow('wholesale:supplier-policy:alter')) }
}

// 제조사별 배송/주문 정책 일괄 로드 — supplier_id → { min_order_amount, shipping_fee, free_ship_threshold }.
//   ⚠️ supplier_id(제조사 신원)는 판매사 응답에 절대 노출 X — 정책 숫자만 그룹 계산에 사용.
export type SupplierPolicy = { min_order_amount: number; shipping_fee: number; free_ship_threshold: number }
export async function loadSupplierPolicies(DB: D1Database, supplierIds: number[]): Promise<Map<number, SupplierPolicy>> {
  const out = new Map<number, SupplierPolicy>()
  const ids = [...new Set(supplierIds.filter((x) => Number.isFinite(x) && x > 0))]
  if (!ids.length) return out
  await ensureSupplierPolicySchema(DB)
  const ph = ids.map(() => '?').join(',')
  const rows = await DB.prepare(
    `SELECT id, COALESCE(min_order_amount,0) AS min_order_amount, COALESCE(shipping_fee,0) AS shipping_fee, COALESCE(free_ship_threshold,0) AS free_ship_threshold
       FROM suppliers WHERE id IN (${ph})`
  ).bind(...ids).all<{ id: number; min_order_amount: number; shipping_fee: number; free_ship_threshold: number }>().catch(() => ({ results: [] as Array<{ id: number; min_order_amount: number; shipping_fee: number; free_ship_threshold: number }> }))
  for (const r of rows.results || []) {
    out.set(r.id, {
      min_order_amount: Math.max(0, Math.floor(r.min_order_amount || 0)),
      shipping_fee: Math.max(0, Math.floor(r.shipping_fee || 0)),
      free_ship_threshold: Math.max(0, Math.floor(r.free_ship_threshold || 0)),
    })
  }
  return out
}

// 🚚 제조사별 그룹 정산 — 라인 배열 → { perSupplier[], shippingTotal, shortfalls[] }.
//   min-order: supplier.min_order_amount>0 && 그 제조사 라인합 < min_order_amount → shortfall(부족액).
//   shipping : (free_ship_threshold>0 && 라인합>=threshold) ? 0 : shipping_fee. 제조사별 합산.
//   ⚠️ 청구 전 검증/계산용 — 절대 클라 금액 신뢰 X. supplier_group 은 비식별 그룹키(s{id}).
interface SupplierShipResult {
  perSupplier: Array<{ supplier_id: number | null; supplier_group: string; subtotal: number; min_order_amount: number; shipping_fee: number; free_ship_threshold: number; shipping: number; meets_min: boolean; shortfall: number; free_ship_remaining: number }>
  shippingTotal: number
  shortfalls: Array<{ supplier_group: string; min_order_amount: number; subtotal: number; shortfall: number }>
}
export function computeSupplierShipping(
  lines: Array<{ supplier_id: number | null; line_total: number; product_shipping_fee?: number | null }>,
  policies: Map<number, SupplierPolicy>,
): SupplierShipResult {
  // 🚚 2026-06-15 (대표 요청): 상품별 배송비 우선 — 라인에 product_shipping_fee(>=0, 0=무료)가 있으면 그 값,
  //   없으면 제조사 정책 배송비. 제조사 그룹(묶음배송)의 배송비 = 그룹 내 라인별 유효 배송비의 최댓값(1회 청구).
  //   ⚠️ 하위호환: 라인에 product_shipping_fee 가 하나도 없으면 모든 유효값 = 정책 배송비 → max = 정책 배송비(현행 불변).
  const bySupplier = new Map<string, { supplier_id: number | null; subtotal: number; policy: SupplierPolicy; effFee: number }>()
  for (const l of lines) {
    const sid = (Number.isFinite(l.supplier_id as number) && (l.supplier_id as number) > 0) ? (l.supplier_id as number) : null
    const key = sid != null ? `s${sid}` : 'none'
    const pol = sid != null ? (policies.get(sid) || { min_order_amount: 0, shipping_fee: 0, free_ship_threshold: 0 }) : { min_order_amount: 0, shipping_fee: 0, free_ship_threshold: 0 }
    const cur = bySupplier.get(key) || { supplier_id: sid, subtotal: 0, policy: pol, effFee: 0 }
    cur.subtotal += Math.max(0, Math.floor(l.line_total || 0))
    // 상품별 배송비(0 포함)가 지정됐으면 그 값, 아니면 제조사 정책 배송비. 그룹 배송비 = 라인 유효배송비의 최댓값.
    const lineFee = (l.product_shipping_fee != null && Number.isFinite(l.product_shipping_fee))
      ? Math.max(0, Math.floor(l.product_shipping_fee))
      : Math.max(0, Math.floor(pol.shipping_fee || 0))
    cur.effFee = Math.max(cur.effFee, lineFee)
    bySupplier.set(key, cur)
  }
  const perSupplier: SupplierShipResult['perSupplier'] = []
  const shortfalls: SupplierShipResult['shortfalls'] = []
  let shippingTotal = 0
  for (const [key, g] of bySupplier) {
    const { min_order_amount, free_ship_threshold } = g.policy
    const shipping_fee = g.effFee // 유효 배송비(상품별 우선·정책 폴백의 그룹 최댓값)
    const meetsMin = !(min_order_amount > 0 && g.subtotal < min_order_amount)
    const shortfall = meetsMin ? 0 : Math.max(0, min_order_amount - g.subtotal)
    const shipping = (free_ship_threshold > 0 && g.subtotal >= free_ship_threshold) ? 0 : shipping_fee
    const freeShipRemaining = (free_ship_threshold > 0 && g.subtotal < free_ship_threshold) ? Math.max(0, free_ship_threshold - g.subtotal) : 0
    shippingTotal += shipping
    perSupplier.push({ supplier_id: g.supplier_id, supplier_group: key, subtotal: g.subtotal, min_order_amount, shipping_fee, free_ship_threshold, shipping, meets_min: meetsMin, shortfall, free_ship_remaining: freeShipRemaining })
    if (!meetsMin) shortfalls.push({ supplier_group: key, min_order_amount, subtotal: g.subtotal, shortfall })
  }
  return { perSupplier, shippingTotal, shortfalls }
}

// 🚚 product_supply_meta 의 상품별 배송비(wholesale_shipping_fee) 파싱 — 미설정/빈값이면 undefined(정책 폴백).
export function parseProductShipFee(meta: Record<string, string> | undefined): number | undefined {
  const raw = meta?.['wholesale_shipping_fee']
  if (raw == null || raw === '') return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : undefined
}

// ── BIZ-8 (2026-06-08) MOQ/단가 고도화 — pack_size / order_multiple 컬럼 멱등 ensure. ───
//   pack_size      = 1 박스에 든 낱개 수(표시용 — "1박스 = N개").
//   order_multiple = 주문 수량이 반드시 이 배수여야 함(박스 배수 강제). 1 = 제약 없음(낱개).
//   min_order_qty 는 기존 컬럼(최소 주문 수량) 재사용. ⚠️ 가격 산식 불변 — 수량 제약만 추가.
//   self-contained(repair-schema 미의존). best-effort ADD COLUMN — 이미 있으면 swallow.
const _biz8Ensured = new WeakSet<object>()
// 🏭 2026-06-10 (카탈로그 전수조사): is_supply_product pragma 존재 체크 — isolate 당 1회(양성만 캐시).
export const _supplyCatalogReady = new WeakSet<object>()

// 🏭 2026-06-10 (카탈로그 최속화): 허용목록(per-seller 가시성) 제한 상품 존재 여부 — 60s TTL.
//   제한 상품 0건이면 응답은 (등급, 몰, 쿼리) 에만 의존 → 등급 단위 엣지 캐시 공유 가능.
//   제한 상품이 생기면 60s 내 자동으로 per-seller 라이브 쿼리 복귀(유출 0). 캐시 TTL(60s)도 동일 상한.
let _visRestricted: { val: boolean; ts: number } | null = null
export async function hasRestrictedVisibility(DB: D1Database): Promise<boolean> {
  const now = Date.now()
  if (_visRestricted && now - _visRestricted.ts < 60_000) return _visRestricted.val
  const row = await DB.prepare(
    "SELECT 1 AS x FROM products WHERE is_supply_product = 1 AND supply_visibility IS NOT NULL AND supply_visibility <> 'ALL' LIMIT 1"
  ).first<{ x: number }>().catch(() => null)
  _visRestricted = { val: !!row, ts: now }
  return _visRestricted.val
}

export async function ensureQtyConstraintSchema(DB: D1Database) {
  if (_biz8Ensured.has(DB)) return
  _biz8Ensured.add(DB)
  for (const sql of [
    'ALTER TABLE products ADD COLUMN pack_size INTEGER DEFAULT 1',
    'ALTER TABLE products ADD COLUMN order_multiple INTEGER DEFAULT 1',
    // 🏭 2026-06-09 Wave 2 프리미엄 전용관 플래그(ensure-on-use — repair-schema 와 멱등 동일).
    'ALTER TABLE products ADD COLUMN is_premium INTEGER DEFAULT 0',
    // 🏬 2026-06-09 멀티-몰 테넌시 — products.mall_id(DEFAULT 1). 기본 몰만 있으면 전 행 1 → 카탈로그 동작 불변.
    'ALTER TABLE products ADD COLUMN mall_id INTEGER DEFAULT 1',
    // 🏷️ 2026-06-09 브랜드 전시관 — products.brand_name(브랜드제품 라벨, is_brand_product=1 일 때만 의미).
    //   repair-schema 에도 동일 ADD COLUMN 존재(멱등). 없는 환경(미마이그레이션) self-heal — 카탈로그 SELECT/필터 전 보장.
    'ALTER TABLE products ADD COLUMN brand_name TEXT',
    // 🏷️ 2026-06-09 브랜드 전시관 로고 — 브랜드 로고 이미지 URL(선택). 없으면 기존 텍스트 칩 불변.
    'ALTER TABLE products ADD COLUMN brand_logo_url TEXT',
  ]) { await DB.prepare(sql).run().catch(swallow('wholesale:biz8:alter')) }
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_products_mall_supply ON products(mall_id) WHERE is_supply_product = 1').run().catch(swallow('wholesale:biz8:idx-mall'))
}

// ── BIZ-2 v1 (2026-06-08) 여신/외상(credit terms) — 멱등 ensure. ─────────────────
//   "사입 0원" 핵심 모순(현재 100% Toss 선결제) 해소를 위한 ADDITIVE 외상 경로.
//   sellers 에 여신 한도/미수금/동결 3컬럼 + 감사가능 미수금 원장(wholesale_credit_ledger).
//   ⚠️ 선결제(prepay) 경로는 byte-identical 보존 — credit 은 별도 status 'ON_CREDIT' 분기.
const _creditEnsured = new WeakSet<object>()
export async function ensureCreditSchema(DB: D1Database) {
  if (_creditEnsured.has(DB)) return
  _creditEnsured.add(DB)
  for (const sql of [
    'ALTER TABLE sellers ADD COLUMN distributor_credit_limit INTEGER DEFAULT 0',   // 0 = 여신 없음(선결제 전용)
    'ALTER TABLE sellers ADD COLUMN outstanding_balance INTEGER DEFAULT 0',        // 현재 미상환 외상 잔액(플랫폼이 보유한 채권)
    'ALTER TABLE sellers ADD COLUMN credit_frozen INTEGER DEFAULT 0',              // 1 = 여신 동결(연체 등)
  ]) { await DB.prepare(sql).run().catch(swallow('wholesale:credit:alter')) }
  // 미수금 원장 — 청구(charge)/상환(repayment)/조정(adjust) 감사 이력.
  await DB.prepare(`CREATE TABLE IF NOT EXISTS wholesale_credit_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    distributor_seller_id INTEGER NOT NULL,
    order_id INTEGER,
    type TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,
    balance_after INTEGER NOT NULL DEFAULT 0,
    memo TEXT,
    created_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(swallow('wholesale:credit:ledger'))
  await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_wholesale_credit_ledger_seller ON wholesale_credit_ledger(distributor_seller_id, created_at DESC)`).run().catch(swallow('wholesale:credit:idx'))
}

/** 판매사 여신 상태 로드(미배정/컬럼 없는 환경은 0). */
interface SellerCreditRow { distributor_credit_limit: number | null; outstanding_balance: number | null; credit_frozen: number | null; status: string | null }
export async function loadSellerCredit(DB: D1Database, sellerId: number): Promise<{ limit: number; outstanding: number; frozen: boolean; available: number; status: string | null }> {
  const row = await DB.prepare(
    'SELECT distributor_credit_limit, outstanding_balance, credit_frozen, status FROM sellers WHERE id = ?'
  ).bind(sellerId).first<SellerCreditRow>().catch(() => null)
  const limit = Math.max(0, Math.floor(Number(row?.distributor_credit_limit) || 0))
  const outstanding = Math.max(0, Math.floor(Number(row?.outstanding_balance) || 0))
  const frozen = Number(row?.credit_frozen) === 1
  return { limit, outstanding, frozen, available: Math.max(0, limit - outstanding), status: row?.status ?? null }
}

// 🔐 2026-06-24 (전수조사): 판매사 토큰은 30일 유효 + status 를 발급시점에 박제 → sellerIdFrom(seller-auth) 은 서명만 검증.
//   승인 후 정지/거부된 판매사가 만료 전까지 발주·충전(예치금 차감/충전요청)을 계속할 수 있던 갭을 닫기 위한
//   **요청시점 status 재검사**. reject-list(정지/거부/대기/차단)만 차단 → approved/active(정상 happy-path)는 불변.
//   fail-open: status 조회 실패 시 차단 안 함(정상 발주를 transient DB 오류로 막지 않음).
const BLOCKED_SELLER_STATUSES = new Set(['suspended', 'rejected', 'banned', 'deleted', 'pending'])
export async function isSellerBlocked(DB: D1Database, sellerId: number): Promise<boolean> {
  const row = await DB.prepare('SELECT status FROM sellers WHERE id = ?').bind(sellerId)
    .first<{ status: string | null }>().catch(() => null)
  return BLOCKED_SELLER_STATUSES.has(String(row?.status || '').toLowerCase())
}

// ── 👥 2026-06-09 판매사 직원 서브계정 ────────────────────────────────────────
//   회사(판매사 owner) 1계정에 여러 직원 로그인. 서브계정 토큰의 seller_id = PARENT(회사) seller_id →
//   기존 예치금/주문/카탈로그/정산 코드는 회사 계정 위에서 byte-identical 동작(전혀 인지 못함).
//   토큰에 sub_account_id / sub_role 추가 클레임만 얹어 (a) 직원 식별 (b) 권한 게이트에 사용.
//   ⚠️ 서브계정 없는 기존 판매사는 토큰/로그인/동작 전부 불변 — 이 코드 경로를 절대 타지 않음.
export type SubRole = 'admin' | 'staff' | 'viewer'
export const SUB_ROLES: readonly SubRole[] = ['admin', 'staff', 'viewer'] as const

/** 서브계정 클레임 추출 — owner 토큰(서브계정 X)이면 sub_account_id/sub_role = null. seller_id 는 항상 PARENT. */
export async function subClaimsFrom(authorization: string | undefined, jwtSecret: string): Promise<{ sellerId: number | null; subAccountId: number | null; subRole: SubRole | null }> {
  if (!authorization?.startsWith('Bearer ')) return { sellerId: null, subAccountId: null, subRole: null }
  try {
    const { verify } = await import('hono/jwt')
    const payload = await verify(authorization.substring(7), jwtSecret, 'HS256') as { seller_id?: number; sub_account_id?: number; sub_role?: string }
    const subRole = SUB_ROLES.includes(payload.sub_role as SubRole) ? (payload.sub_role as SubRole) : null
    const subAccountId = Number.isFinite(payload.sub_account_id as number) && (payload.sub_account_id as number) > 0 ? (payload.sub_account_id as number) : null
    return { sellerId: payload.seller_id ?? null, subAccountId: subRole ? subAccountId : null, subRole }
  } catch {
    return { sellerId: null, subAccountId: null, subRole: null }
  }
}

export const SUB_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * 직원 계정 관리 권한 게이트 — owner(서브계정 클레임 X) OR sub_role='admin' 만 허용.
 * 반환: 통과 시 { sellerId }, 차단 시 { error, status }.
 * IDOR: sellerId 는 항상 토큰의 PARENT seller_id → 호출자는 본인 회사 서브계정만 관리.
 */
export async function requireSubAdmin(c: { req: { header: (k: string) => string | undefined }; env: { JWT_SECRET: string } }): Promise<{ sellerId: number } | { error: string; status: 401 | 403 }> {
  const { sellerId, subRole } = await subClaimsFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return { error: '로그인이 필요합니다', status: 401 }
  // owner(subRole=null) 또는 admin 서브계정만 직원 관리 가능. staff/viewer 는 차단.
  if (subRole && subRole !== 'admin') return { error: '직원 계정을 관리할 권한이 없습니다', status: 403 }
  return { sellerId }
}

interface SellerGradeRow {
  distributor_grade: string | null
  special_discount_until: string | null
}

export async function loadGradeTable(DB: D1Database): Promise<GradeMargin[]> {
  const { results } = await DB.prepare(
    'SELECT grade, margin_pct, is_special FROM distributor_grades WHERE active = 1'
  ).all<{ grade: string; margin_pct: number; is_special: number }>().catch(() => ({ results: [] as { grade: string; margin_pct: number; is_special: number }[] }))
  return (results || []).map(r => ({ grade: r.grade, margin_pct: r.margin_pct, is_special: !!r.is_special }))
}

/**
 * 🛡️ PRC-1 (2026-06-08) — 수량구간 할인의 최소 플랫폼 마진율(%) 읽기.
 *   platform_settings.wholesale_min_platform_margin_pct (어드민 설정). 미설정/잘못된 값이면 0.
 *   기본 0 = 현행 동작 보존(어드민이 명시 설정하기 전엔 실가격 불변). 3 정도면 Toss PG 수수료(~2-3%) 커버.
 *   ⚠️ DISPLAY(카탈로그)·CHARGE(주문) 가 동일 floor 를 쓰도록 요청당 1회만 읽어 양쪽에 전달할 것.
 *   설정 UI 는 유통 어드민 설정 페이지(distributor-admin)에 두는 것이 적절 — 여기선 값 읽기만.
 */
export async function loadMinPlatformMarginPct(DB: D1Database): Promise<number> {
  const row = await DB.prepare(
    "SELECT value FROM platform_settings WHERE key = 'wholesale_min_platform_margin_pct'"
  ).first<{ value: string }>().catch(() => null)
  const n = Number(row?.value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export async function loadSellerGrade(DB: D1Database, sellerId: number): Promise<SellerGradeRow> {
  const row = await DB.prepare(
    'SELECT distributor_grade, special_discount_until FROM sellers WHERE id = ?'
  ).bind(sellerId).first<SellerGradeRow>().catch(() => null)
  return row ?? { distributor_grade: null, special_discount_until: null }
}

/** 상품들의 수량 구간 할인 tier 로드 → Map<product_id, QtyTier[]> (min_qty 오름차순). */
export async function loadQtyTiers(DB: D1Database, productIds: number[]): Promise<Map<number, QtyTier[]>> {
  const map = new Map<number, QtyTier[]>()
  if (!productIds.length) return map
  const ph = productIds.map(() => '?').join(',')
  const { results } = await DB.prepare(
    `SELECT product_id, min_qty, discount_pct FROM product_qty_tiers WHERE product_id IN (${ph}) ORDER BY min_qty ASC`
  ).bind(...productIds).all<{ product_id: number; min_qty: number; discount_pct: number }>().catch(() => ({ results: [] as { product_id: number; min_qty: number; discount_pct: number }[] }))
  for (const r of results || []) {
    const arr = map.get(r.product_id) || []
    arr.push({ min_qty: r.min_qty, discount_pct: r.discount_pct })
    map.set(r.product_id, arr)
  }
  return map
}

// ── BIZ-4 (2026-06-08) 카탈로그 검색/정렬/필터 헬퍼 ──────────────────────────────
//   모두 query-param 게이트 — 파라미터 없는 기본 요청은 기존 SQL/ORDER BY 와 byte-identical.

/**
 * FTS5(products_fts) 가용 여부 module-memo. 소비자몰과 동일 virtual table(migration 0080:
 * name/description/category, content=products, content_rowid=id) 재사용. 없는 환경(미마이그레이션)
 * 이면 1회 probe 후 false 기억 → LIKE fallback. ProductRepository 의 graceful-degradation 패턴 답습.
 */
let _ftsAvail: boolean | null = null
export async function ftsAvailable(DB: D1Database): Promise<boolean> {
  if (_ftsAvail !== null) return _ftsAvail
  try {
    await DB.prepare("SELECT 1 FROM products_fts WHERE products_fts MATCH 'a' LIMIT 1").all()
    _ftsAvail = true
  } catch {
    _ftsAvail = false
  }
  return _ftsAvail
}

/**
 * FTS5 MATCH 질의 문자열 sanitize — 특수문자 제거 + prefix wildcard(`"스타"*` → "스타벅스" 매칭).
 * ProductRepository.searchProductsFts 의 토큰화와 동일 컨벤션(동의어 확장은 생략 — B2B 카탈로그).
 * 토큰 0개면 null → 호출측이 검색 skip.
 */
export function buildFtsMatch(raw: string): string | null {
  const tokens = raw.trim().replace(/["*^():~+\-]/g, ' ').replace(/\s+/g, ' ').split(' ').filter(t => t.length >= 1)
  if (!tokens.length) return null
  return tokens.map(t => `"${t}"*`).join(' ')
}

/** sort 파라미터 → 안전한 ORDER BY (화이트리스트만; injection 불가). 미지정/미허용 = popular(현행 정렬). */
export const CATALOG_SORT_ORDER: Record<string, string> = {
  popular:    'COALESCE(p.sold_count,0) DESC, p.created_at DESC', // = 기본(현행) 정렬 — 변경 금지
  price_low:  'COALESCE(p.supply_price,0) ASC, p.created_at DESC',
  price_high: 'COALESCE(p.supply_price,0) DESC, p.created_at DESC',
  discount:   'COALESCE(p.discount_rate,0) DESC, p.created_at DESC',
  newest:     'p.created_at DESC, p.id DESC',
}

// 🛡️ 2026-06-18 (인증 audit): 유통회원 셀러 컬럼 self-heal — 기존엔 핸들러 안 매 호출 16 ALTER 루프였음
//   (그들 룰 "핸들러 inline ALTER 금지 → ensureXxx + WeakSet" 위반). isolate 당 1회로 메모이즈.
//   ⚠️ 신규 컬럼 추가가 아니라 미마이그레이션 환경 self-heal(멱등) — sellers 컬럼 예산 무영향.
const _distSellerEnsured = new WeakSet<object>()
export async function ensureDistributorSellerSchema(DB: D1Database) {
  if (_distSellerEnsured.has(DB)) return
  _distSellerEnsured.add(DB)
  for (const sql of [
    "ALTER TABLE sellers ADD COLUMN seller_type TEXT DEFAULT 'influencer'",
    'ALTER TABLE sellers ADD COLUMN commission_rate REAL DEFAULT 5.00',
    'ALTER TABLE sellers ADD COLUMN business_name TEXT',
    'ALTER TABLE sellers ADD COLUMN business_number TEXT',
    'ALTER TABLE sellers ADD COLUMN representative_name TEXT',
    'ALTER TABLE sellers ADD COLUMN business_registration_image_url TEXT',
    "ALTER TABLE sellers ADD COLUMN business_registration_status TEXT DEFAULT 'pending'",
    'ALTER TABLE sellers ADD COLUMN phone TEXT',
    'ALTER TABLE sellers ADD COLUMN distributor_grade TEXT',
    'ALTER TABLE sellers ADD COLUMN is_distributor INTEGER DEFAULT 0',
    'ALTER TABLE sellers ADD COLUMN representative_phone TEXT',
    'ALTER TABLE sellers ADD COLUMN manager_name TEXT',
    'ALTER TABLE sellers ADD COLUMN manager_phone TEXT',
    'ALTER TABLE sellers ADD COLUMN manager_email TEXT',
    'ALTER TABLE sellers ADD COLUMN linked_user_id INTEGER',
    'ALTER TABLE sellers ADD COLUMN mall_id INTEGER DEFAULT 1', // 🏬 멀티-몰: 가입 시 어느 몰에 가입했는지
    'ALTER TABLE sellers ADD COLUMN nts_status TEXT', // 국세청 상태(참고 표시용)
    'ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0', // verified-게이트 자동연결용
  ]) { await DB.prepare(sql).run().catch(swallow('wholesale:become:ensure-schema')) }
}

/**
 * 🏭 2026-06-30 [서비스 분리 SSOT] "도매 전용(순수 판매사)" 판별 — 셀러 대시보드 ↔ 도매몰 라우팅 단일 진실원천.
 *
 * 배경(대표 신고 — `/seller` 들어가면 `/wholesale` 로 튕김): `SellerLayout` 이 `is_distributor === 1`
 *   하나로 셀러 대시보드 접근을 막아, **소비자 셀러 + 판매사 겸업** 계정이 대시보드에서 영구 차단됐다.
 *   문제는 `is_distributor` 가 "도매 접근 권한 있음"(capability)일 뿐 "도매 전용"(exclusivity)이 아니라는 것.
 *   기존 셀러가 `/become-distributor` 한 번만 해도 같은 셀러 행에 `is_distributor=1` 이 덧붙어 겸업이 된다.
 *
 * 규칙(애매하면 false=대시보드 노출 — **절대 lock-out 금지**, 편향은 안전한 쪽으로):
 *   아래를 **모두** 만족할 때만 '도매 전용'(true):
 *     · is_distributor = 1
 *     · seller_type ∉ { store_owner, both }   (소비자 매장 운영자는 언제나 셀러)
 *     · 소비자(비-도매) 상품이 하나도 없음      (있으면 겸업 — 셀러 대시보드 필요)
 *
 *   클라이언트 localStorage(`is_distributor`)는 coarse hint 로만 쓰고, 실제 라우팅 판정은
 *   반드시 이 서버 권위 함수로 한다. → 표면(SellerLayout/SellerLoginPage)에서 `is_distributor`
 *   직접 비교로 도매몰 redirect 하는 패턴은 `check-seller-wholesale-redirect.mjs` 가 차단.
 */
export async function computeWholesaleOnly(DB: D1Database, sellerId: number): Promise<boolean> {
  if (!Number.isFinite(sellerId) || sellerId <= 0) return false
  const s = await DB.prepare('SELECT is_distributor, seller_type FROM sellers WHERE id = ? LIMIT 1')
    .bind(sellerId).first<{ is_distributor: number | null; seller_type: string | null }>().catch(() => null)
  if (!s || !s.is_distributor) return false
  const st = String(s.seller_type || '')
  if (st === 'store_owner' || st === 'both') return false // 소비자 매장 운영자 → 항상 셀러
  // 소비자(비-도매) 상품을 하나라도 보유 → 겸업 → 셀러 대시보드 유지(도매 전용 아님).
  const consumerProduct = await DB.prepare(
    "SELECT 1 AS x FROM products WHERE seller_id = ? AND COALESCE(is_supply_product, 0) = 0 LIMIT 1"
  ).bind(sellerId).first<{ x: number }>().catch(() => null)
  if (consumerProduct) return false
  return true
}

// 🔔 2026-06-12 (도매몰 감사 fix): 주문 PAID 확정 시 라인의 제조사들에게 "새 도매 주문" 알림.
//   기존엔 대시보드 방문 시 발송대기 배지 집계뿐 — 제조사가 접속 전엔 신규 주문을 몰라 발송 지연.
//   fail-soft(알림 실패가 결제를 절대 막지 않음) + PAID CAS 승자 경로에서만 호출(중복 알림 방지).
export async function notifySuppliersOfPaidOrder(DB: D1Database, orderId: number): Promise<void> {
  const rows = await DB.prepare(
    `SELECT supplier_id, COUNT(*) AS line_cnt, COALESCE(SUM(qty), 0) AS unit_cnt
       FROM wholesale_order_items
      WHERE wholesale_order_id = ? AND supplier_id IS NOT NULL
      GROUP BY supplier_id`
  ).bind(orderId).all<{ supplier_id: number; line_cnt: number; unit_cnt: number }>()
  for (const r of rows.results || []) {
    if (!Number.isFinite(r.supplier_id) || r.supplier_id <= 0) continue
    await createDashboardNotification(
      DB, 'supplier', String(r.supplier_id), 'wholesale_new_order',
      '새 도매 주문이 들어왔어요',
      `주문 #${orderId} — 품목 ${r.line_cnt}건 / 수량 ${r.unit_cnt}개 발송을 준비해주세요.`,
      '/supplier/wholesale-orders',
    ).catch(swallow('wholesale:notify-supplier-order'))
  }
}

/**
 * 🔔 2026-06-27 (라이프사이클 알림 완성): 주문에 라인이 있는 모든 제조사(공급자)에게 단일 이벤트 알림.
 *   구매확정(DONE)/취소(CANCELLED) 등 — 기존엔 신규주문/발송 알림만 있고 확정·취소 통지가 없어 제조사가
 *   정산 성숙/주문 취소를 대시보드에서 몰랐음. fail-soft(알림 실패가 본 처리를 막지 않음).
 */
export async function notifySuppliersOfOrderEvent(
  DB: D1Database, orderId: number, type: string, title: string, body: string, link = '/supplier/wholesale-orders',
): Promise<void> {
  const rows = await DB.prepare(
    `SELECT DISTINCT supplier_id FROM wholesale_order_items WHERE wholesale_order_id = ? AND supplier_id IS NOT NULL`
  ).bind(orderId).all<{ supplier_id: number }>()
  for (const r of rows.results || []) {
    if (!Number.isFinite(r.supplier_id) || r.supplier_id <= 0) continue
    await createDashboardNotification(DB, 'supplier', String(r.supplier_id), type, title, body, link)
      .catch(swallow('wholesale:notify-supplier-event'))
  }
}

// ── POST /orders/bulk-preview — 대량주문(엑셀/CSV) 검증·미리보기 (결제 X) ───────────
//   BIZ-9 (2026-06-09): 작성본 업로드 → 서버가 product_id 로 매칭 + MOQ/박스단위/재고 검증 →
//   유효 라인(카트에 담을 항목 + 등급 단가) + 오류행(사유) + subtotal 반환. 절대 청구하지 않음.
//   유효 라인은 클라가 도매 카트에 담아 기존 예치금 체크아웃(/wholesale/checkout)으로 결제.
export const BULK_MAX_ROWS = 5000
