/**
 * 🏭 2026-06-01 유통스타트 도매몰 — 유통사(셀러) 도매 카탈로그 + B2B 주문 (Phase 2).
 * (docs/design/wholesale-utongstart.md)
 *
 * - GET  /api/wholesale/me           — 내 등급/마진/특별할인 상태
 * - GET  /api/wholesale/catalog      — 등급가로 본 도매 상품 목록 (제조사 신원 비노출)
 * - GET  /api/wholesale/catalog/:id  — 도매 상품 상세 (등급가)
 *
 * ⚠️ 가격은 서버 재계산 (distributor-pricing). supply_price(제조사가)·supplier_id(제조사 신원) 는 응답에 절대 노출 X.
 * 마운트: app.route('/api/wholesale', wholesaleRoutes)
 */
import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { hashPassword, validatePasswordComplexity, verifyPassword } from '@/lib/password'
import { DEFAULT_COMMISSION_RATE } from '@/shared/constants'
import type { Env } from '@/worker/types/env'
import { safeError } from '@/worker/utils/safe-error'
import {
  resolveDistributorPrice, marginForGrade, effectiveGrade, tierUnitPrice, effectiveTierFloor, qtyTierDiscount,
  type GradeMargin, type DistributorGrade, type QtyTier,
} from '@/lib/distributor-pricing'
import { confirmTossPayment, cancelTossPayment } from '@/worker/utils/toss-gateway'
import { swallow } from '@/worker/utils/swallow'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { requireAuth } from '@/worker/middleware/auth'
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes'
import { creditSupplierOnWholesaleOrder } from './wholesale-settlement'
import { generateWholesaleSalesInvoice, generateWholesalePurchaseInvoices, listDistributorSalesInvoices } from './wholesale-tax-invoices'
import { ensureSupplyVisibilitySchema, visibilityWhere } from './supply-visibility'
import { ensureDepositSchema, deductDeposit, recordDepositTxn, compensateDepositOrderOnce } from './wholesale-deposit-core'
import { resolveMallId, registrationMallId, loadMallByHost } from './wholesale-malls'

const app = new Hono<{ Bindings: Env }>()

// ── B2B 주문 테이블 (선결제). 멱등 ensure. ───────────────────────────────────
const _whEnsured = new WeakSet<object>()
async function ensureOrderTables(DB: D1Database) {
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
    paid_at DATETIME
  )`).run().catch(swallow('wholesale:create-orders'))
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
    line_status TEXT NOT NULL DEFAULT 'PENDING'
  )`).run().catch(swallow('wholesale:create-items'))
  await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_wholesale_orders_seller ON wholesale_orders(distributor_seller_id, created_at DESC)`).run().catch(swallow('wholesale:idx1'))
  await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_wholesale_items_order ON wholesale_order_items(wholesale_order_id)`).run().catch(swallow('wholesale:idx2'))
  await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_wholesale_items_supplier ON wholesale_order_items(supplier_id)`).run().catch(swallow('wholesale:idx3'))
  // 🚚 2026-06-09 배송정책: wholesale_orders.shipping_total — 주문에 합산된 (제조사별) 배송비 총액.
  //   grand total = subtotal + shipping_total. 보상환불은 (subtotal+shipping_total) 전액 환불.
  await DB.prepare('ALTER TABLE wholesale_orders ADD COLUMN shipping_total INTEGER NOT NULL DEFAULT 0').run().catch(swallow('wholesale:alter-shipping-total'))
}

// ── 🚚 2026-06-09 제조사(공급자)별 배송/주문 정책 — suppliers 3컬럼 멱등 ensure. ──────
//   min_order_amount     = 이 제조사 라인 합이 이 금액 미만이면 주문 거부(0=제한 없음).
//   shipping_fee         = 이 제조사 배송비(0=무료/미설정).
//   free_ship_threshold  = 이 제조사 라인 합이 이 금액 이상이면 배송비 무료(0=무료배송 없음).
//   self-contained(repair-schema 와 멱등 동일). best-effort ADD COLUMN — 이미 있으면 swallow.
const _supPolicyEnsured = new WeakSet<object>()
async function ensureSupplierPolicySchema(DB: D1Database) {
  if (_supPolicyEnsured.has(DB)) return
  _supPolicyEnsured.add(DB)
  for (const sql of [
    'ALTER TABLE suppliers ADD COLUMN min_order_amount INTEGER DEFAULT 0',
    'ALTER TABLE suppliers ADD COLUMN shipping_fee INTEGER DEFAULT 0',
    'ALTER TABLE suppliers ADD COLUMN free_ship_threshold INTEGER DEFAULT 0',
  ]) { await DB.prepare(sql).run().catch(swallow('wholesale:supplier-policy:alter')) }
}

// 제조사별 배송/주문 정책 일괄 로드 — supplier_id → { min_order_amount, shipping_fee, free_ship_threshold }.
//   ⚠️ supplier_id(제조사 신원)는 유통사 응답에 절대 노출 X — 정책 숫자만 그룹 계산에 사용.
type SupplierPolicy = { min_order_amount: number; shipping_fee: number; free_ship_threshold: number }
async function loadSupplierPolicies(DB: D1Database, supplierIds: number[]): Promise<Map<number, SupplierPolicy>> {
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
function computeSupplierShipping(
  lines: Array<{ supplier_id: number | null; line_total: number }>,
  policies: Map<number, SupplierPolicy>,
): SupplierShipResult {
  // 제조사별 subtotal 합산. supplier_id 없는(NULL) 라인은 단일 'no-supplier' 그룹(정책 없음 → 배송비 0, min 0).
  const bySupplier = new Map<string, { supplier_id: number | null; subtotal: number; policy: SupplierPolicy }>()
  for (const l of lines) {
    const sid = (Number.isFinite(l.supplier_id as number) && (l.supplier_id as number) > 0) ? (l.supplier_id as number) : null
    const key = sid != null ? `s${sid}` : 'none'
    const pol = sid != null ? (policies.get(sid) || { min_order_amount: 0, shipping_fee: 0, free_ship_threshold: 0 }) : { min_order_amount: 0, shipping_fee: 0, free_ship_threshold: 0 }
    const cur = bySupplier.get(key) || { supplier_id: sid, subtotal: 0, policy: pol }
    cur.subtotal += Math.max(0, Math.floor(l.line_total || 0))
    bySupplier.set(key, cur)
  }
  const perSupplier: SupplierShipResult['perSupplier'] = []
  const shortfalls: SupplierShipResult['shortfalls'] = []
  let shippingTotal = 0
  for (const [key, g] of bySupplier) {
    const { min_order_amount, shipping_fee, free_ship_threshold } = g.policy
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

// ── BIZ-8 (2026-06-08) MOQ/단가 고도화 — pack_size / order_multiple 컬럼 멱등 ensure. ───
//   pack_size      = 1 박스에 든 낱개 수(표시용 — "1박스 = N개").
//   order_multiple = 주문 수량이 반드시 이 배수여야 함(박스 배수 강제). 1 = 제약 없음(낱개).
//   min_order_qty 는 기존 컬럼(최소 주문 수량) 재사용. ⚠️ 가격 산식 불변 — 수량 제약만 추가.
//   self-contained(repair-schema 미의존). best-effort ADD COLUMN — 이미 있으면 swallow.
const _biz8Ensured = new WeakSet<object>()
async function ensureQtyConstraintSchema(DB: D1Database) {
  if (_biz8Ensured.has(DB)) return
  _biz8Ensured.add(DB)
  for (const sql of [
    'ALTER TABLE products ADD COLUMN pack_size INTEGER DEFAULT 1',
    'ALTER TABLE products ADD COLUMN order_multiple INTEGER DEFAULT 1',
    // 🏭 2026-06-09 Wave 2 프리미엄 전용관 플래그(ensure-on-use — repair-schema 와 멱등 동일).
    'ALTER TABLE products ADD COLUMN is_premium INTEGER DEFAULT 0',
    // 🏬 2026-06-09 멀티-몰 테넌시 — products.mall_id(DEFAULT 1). 기본 몰만 있으면 전 행 1 → 카탈로그 동작 불변.
    'ALTER TABLE products ADD COLUMN mall_id INTEGER DEFAULT 1',
  ]) { await DB.prepare(sql).run().catch(swallow('wholesale:biz8:alter')) }
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_products_mall_supply ON products(mall_id) WHERE is_supply_product = 1').run().catch(swallow('wholesale:biz8:idx-mall'))
}

// ── GET /mall — PUBLIC 현재 몰(브랜딩) 조회 ─────────────────────────────────────
//   🏬 2026-06-09 멀티-몰 테넌시: host → mall(없으면 기본 몰 id=1). 프런트 헤더 브랜드명/로고/색/카테고리용.
//   ⚠️ 공개 브랜딩 필드만 반환 — deposit_account / commission_rate 절대 비노출.
//   캐시: per-host. 기본 몰 단일 호스트면 항상 유통스타트 브랜드값 → 동작 불변.
app.get('/mall', async (c) => {
  const { DB } = c.env
  try {
    let host: string | null = null
    try { host = new URL(c.req.url).hostname } catch { host = c.req.header('Host') || null }
    const mall = await loadMallByHost(DB, host)
    // categories_json 서버 parse → 배열(파싱 실패 시 null). 클라 JSON.parse 부담 제거.
    let categories: unknown = null
    if (mall?.categories_json) {
      try { categories = JSON.parse(mall.categories_json) } catch { categories = null }
    }
    c.header('Cache-Control', 'public, max-age=60')
    c.header('CDN-Cache-Control', 'max-age=300')
    return c.json({
      success: true,
      mall: {
        slug: mall?.slug ?? 'default',
        name: mall?.name ?? '유통스타트',
        brand_name: mall?.brand_name ?? null,
        brand_color: mall?.brand_color ?? null,
        logo_url: mall?.logo_url ?? null,
        categories: Array.isArray(categories) ? categories : null,
      },
    })
  } catch (err) {
    // 브랜딩 조회 실패 시에도 기본 몰 값으로 graceful — 헤더가 절대 비지 않도록.
    return c.json({ success: false, mall: { slug: 'default', name: '유통스타트', brand_name: null, brand_color: null, logo_url: null, categories: null } })
  }
})

// ── BIZ-2 v1 (2026-06-08) 여신/외상(credit terms) — 멱등 ensure. ─────────────────
//   "사입 0원" 핵심 모순(현재 100% Toss 선결제) 해소를 위한 ADDITIVE 외상 경로.
//   sellers 에 여신 한도/미수금/동결 3컬럼 + 감사가능 미수금 원장(wholesale_credit_ledger).
//   ⚠️ 선결제(prepay) 경로는 byte-identical 보존 — credit 은 별도 status 'ON_CREDIT' 분기.
const _creditEnsured = new WeakSet<object>()
async function ensureCreditSchema(DB: D1Database) {
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

/** 유통사 여신 상태 로드(미배정/컬럼 없는 환경은 0). */
interface SellerCreditRow { distributor_credit_limit: number | null; outstanding_balance: number | null; credit_frozen: number | null; status: string | null }
async function loadSellerCredit(DB: D1Database, sellerId: number): Promise<{ limit: number; outstanding: number; frozen: boolean; available: number; status: string | null }> {
  const row = await DB.prepare(
    'SELECT distributor_credit_limit, outstanding_balance, credit_frozen, status FROM sellers WHERE id = ?'
  ).bind(sellerId).first<SellerCreditRow>().catch(() => null)
  const limit = Math.max(0, Math.floor(Number(row?.distributor_credit_limit) || 0))
  const outstanding = Math.max(0, Math.floor(Number(row?.outstanding_balance) || 0))
  const frozen = Number(row?.credit_frozen) === 1
  return { limit, outstanding, frozen, available: Math.max(0, limit - outstanding), status: row?.status ?? null }
}

// ── 셀러(유통사) JWT → seller_id ──────────────────────────────────────────────
async function sellerIdFrom(authorization: string | undefined, jwtSecret: string): Promise<number | null> {
  if (!authorization?.startsWith('Bearer ')) return null
  try {
    const { verify } = await import('hono/jwt')
    const payload = await verify(authorization.substring(7), jwtSecret, 'HS256') as { seller_id?: number }
    return payload.seller_id ?? null
  } catch {
    return null
  }
}

// ── 👥 2026-06-09 유통사 직원 서브계정 ────────────────────────────────────────
//   회사(유통사 owner) 1계정에 여러 직원 로그인. 서브계정 토큰의 seller_id = PARENT(회사) seller_id →
//   기존 예치금/주문/카탈로그/정산 코드는 회사 계정 위에서 byte-identical 동작(전혀 인지 못함).
//   토큰에 sub_account_id / sub_role 추가 클레임만 얹어 (a) 직원 식별 (b) 권한 게이트에 사용.
//   ⚠️ 서브계정 없는 기존 유통사는 토큰/로그인/동작 전부 불변 — 이 코드 경로를 절대 타지 않음.
export type SubRole = 'admin' | 'staff' | 'viewer'
const SUB_ROLES: readonly SubRole[] = ['admin', 'staff', 'viewer'] as const

/** 서브계정 클레임 추출 — owner 토큰(서브계정 X)이면 sub_account_id/sub_role = null. seller_id 는 항상 PARENT. */
async function subClaimsFrom(authorization: string | undefined, jwtSecret: string): Promise<{ sellerId: number | null; subAccountId: number | null; subRole: SubRole | null }> {
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

// 서브계정 테이블 멱등 ensure (repair-schema 와 동일 정의).
const _subAcctEnsured = new WeakSet<object>()
async function ensureSubAccountSchema(DB: D1Database) {
  if (_subAcctEnsured.has(DB)) return
  _subAcctEnsured.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS wholesale_sub_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_seller_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'staff',
    active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT (datetime('now')),
    last_login_at DATETIME
  )`).run().catch(swallow('wholesale:subacct:create'))
  await DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_wh_sub_accounts_email ON wholesale_sub_accounts(email)').run().catch(swallow('wholesale:subacct:idx-email'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_wh_sub_accounts_parent ON wholesale_sub_accounts(parent_seller_id)').run().catch(swallow('wholesale:subacct:idx-parent'))
}

const SUB_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * 직원 계정 관리 권한 게이트 — owner(서브계정 클레임 X) OR sub_role='admin' 만 허용.
 * 반환: 통과 시 { sellerId }, 차단 시 { error, status }.
 * IDOR: sellerId 는 항상 토큰의 PARENT seller_id → 호출자는 본인 회사 서브계정만 관리.
 */
async function requireSubAdmin(c: { req: { header: (k: string) => string | undefined }; env: { JWT_SECRET: string } }): Promise<{ sellerId: number } | { error: string; status: 401 | 403 }> {
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

async function loadGradeTable(DB: D1Database): Promise<GradeMargin[]> {
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
async function loadMinPlatformMarginPct(DB: D1Database): Promise<number> {
  const row = await DB.prepare(
    "SELECT value FROM platform_settings WHERE key = 'wholesale_min_platform_margin_pct'"
  ).first<{ value: string }>().catch(() => null)
  const n = Number(row?.value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

async function loadSellerGrade(DB: D1Database, sellerId: number): Promise<SellerGradeRow> {
  const row = await DB.prepare(
    'SELECT distributor_grade, special_discount_until FROM sellers WHERE id = ?'
  ).bind(sellerId).first<SellerGradeRow>().catch(() => null)
  return row ?? { distributor_grade: null, special_discount_until: null }
}

/** 상품들의 수량 구간 할인 tier 로드 → Map<product_id, QtyTier[]> (min_qty 오름차순). */
async function loadQtyTiers(DB: D1Database, productIds: number[]): Promise<Map<number, QtyTier[]>> {
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
async function ftsAvailable(DB: D1Database): Promise<boolean> {
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
function buildFtsMatch(raw: string): string | null {
  const tokens = raw.trim().replace(/["*^():~+\-]/g, ' ').replace(/\s+/g, ' ').split(' ').filter(t => t.length >= 1)
  if (!tokens.length) return null
  return tokens.map(t => `"${t}"*`).join(' ')
}

/** sort 파라미터 → 안전한 ORDER BY (화이트리스트만; injection 불가). 미지정/미허용 = popular(현행 정렬). */
const CATALOG_SORT_ORDER: Record<string, string> = {
  popular:    'COALESCE(p.sold_count,0) DESC, p.created_at DESC', // = 기본(현행) 정렬 — 변경 금지
  price_low:  'COALESCE(p.supply_price,0) ASC, p.created_at DESC',
  price_high: 'COALESCE(p.supply_price,0) DESC, p.created_at DESC',
  discount:   'COALESCE(p.discount_rate,0) DESC, p.created_at DESC',
  newest:     'p.created_at DESC, p.id DESC',
}

// ── POST /register — 유통사(도매 바이어) 경량 전용 가입 ─────────────────────────────
//   라이브커머스 셀러 온보딩(유튜브·NTS·seller_type)과 분리. seller 계정을 재사용하되
//   distributor_grade='C' + is_distributor=1 로 표시 → /seller 대시보드 대신 /wholesale 에서 완결.
//   ⚠️ 사업자번호는 세금계산서용 선택값. 가입 즉시 사용 가능(status='approved').
app.post('/register', rateLimit({ action: 'wholesale_register', max: 5, windowSec: 3600 }), async (c) => {
  const { DB, JWT_SECRET } = c.env
  if (!JWT_SECRET) return c.json({ success: false, error: '서버 설정 오류' }, 500)
  try {
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const name = String(body.name || '').trim()                 // 담당자명
    const business_name = String(body.business_name || '').trim() // 상호(회사명)
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const phone = String(body.phone || '').trim()
    const business_number = String(body.business_number || '').trim() // 🏭 사업자등록번호 — 필수(승인 심사용)
    const representative = String(body.representative || '').trim()    // 대표자명
    const business_license_url = String(body.business_license_url || '').trim().slice(0, 500) // 사업자등록증 이미지
    // 🏭 2026-06-09 대표자 연락처 + 담당자(성명/연락처/이메일) — additive 수집. 길이 cap.
    const representative_phone = String(body.representative_phone || '').trim().slice(0, 40)
    const manager_name = String(body.manager_name || '').trim().slice(0, 80)
    const manager_phone = String(body.manager_phone || '').trim().slice(0, 40)
    const manager_email = String(body.manager_email || '').trim().slice(0, 160)

    if (!name || !business_name || !email || !password) {
      return c.json({ success: false, error: '담당자명·상호·이메일·비밀번호를 모두 입력해주세요' }, 400)
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ success: false, error: '이메일 형식이 올바르지 않습니다' }, 400)
    const pw = validatePasswordComplexity(password)
    if (!pw.ok) return c.json({ success: false, error: pw.error }, 400)
    // 🏭 2026-06-04 (사용자 결정): 유통회원도 사업자 정보 필수 + 관리자 승인. 사업자번호 필수.
    if (!/^\d{3}-\d{2}-\d{5}$/.test(business_number)) {
      return c.json({ success: false, error: '사업자등록번호를 정확히 입력해주세요 (000-00-00000)' }, 400)
    }
    if (!business_license_url) return c.json({ success: false, error: '사업자등록증 이미지를 업로드해주세요' }, 400)

    // 누락 가능 컬럼 보장 (idempotent)
    for (const sql of [
      "ALTER TABLE sellers ADD COLUMN seller_type TEXT DEFAULT 'influencer'",
      'ALTER TABLE sellers ADD COLUMN commission_rate REAL DEFAULT 5.00',
      'ALTER TABLE sellers ADD COLUMN business_number TEXT',
      'ALTER TABLE sellers ADD COLUMN representative_name TEXT',
      'ALTER TABLE sellers ADD COLUMN business_registration_image_url TEXT',
      "ALTER TABLE sellers ADD COLUMN business_registration_status TEXT DEFAULT 'pending'",
      'ALTER TABLE sellers ADD COLUMN phone TEXT',
      'ALTER TABLE sellers ADD COLUMN business_name TEXT',
      'ALTER TABLE sellers ADD COLUMN distributor_grade TEXT',
      'ALTER TABLE sellers ADD COLUMN is_distributor INTEGER DEFAULT 0',
      'ALTER TABLE sellers ADD COLUMN representative_phone TEXT',
      'ALTER TABLE sellers ADD COLUMN manager_name TEXT',
      'ALTER TABLE sellers ADD COLUMN manager_phone TEXT',
      'ALTER TABLE sellers ADD COLUMN manager_email TEXT',
      'ALTER TABLE sellers ADD COLUMN mall_id INTEGER DEFAULT 1', // 🏬 멀티-몰: 가입 시 어느 몰에 가입했는지
    ]) { await DB.prepare(sql).run().catch(swallow('wholesale:register:alter')) }

    const dup = await DB.prepare('SELECT id FROM sellers WHERE email = ?').bind(email).first()
    if (dup) return c.json({ success: false, error: '이미 가입된 이메일입니다. 로그인해주세요' }, 409)

    // username 생성 (unique 확보)
    const base = (email.split('@')[0] || 'dist').replace(/[^a-z0-9]/gi, '').slice(0, 16).toLowerCase() || 'dist'
    let username = ''
    for (let i = 0; i < 6; i++) {
      const cand = `${base}${Math.floor(1000 + Math.random() * 9000)}`
      const ex = await DB.prepare('SELECT id FROM sellers WHERE username = ?').bind(cand).first()
      if (!ex) { username = cand; break }
    }
    if (!username) username = `dist${Date.now().toString().slice(-8)}`

    const passwordHash = await hashPassword(password)
    // 🏬 멀티-몰: 가입 대상 몰 = host(또는 ?mall=slug). 기본(단일 호스트) 환경은 1 → 동작 불변.
    const mallId = await registrationMallId(c)
    // status='pending' — 관리자 승인 전까지 로그인 불가(seller login 이 pending 차단). 토큰 미발급.
    const ins = await DB.prepare(`
      INSERT INTO sellers (username, email, password_hash, name, business_name, business_number, representative_name, phone,
        representative_phone, manager_name, manager_phone, manager_email,
        business_registration_image_url, business_registration_status,
        status, commission_rate, seller_type, distributor_grade, is_distributor, mall_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?, 'influencer', 'C', 1, ?, datetime('now'), datetime('now'))
    `).bind(username, email, passwordHash, name, business_name, business_number, representative || null, phone || null,
      representative_phone || null, manager_name || null, manager_phone || null, manager_email || null,
      business_license_url || null, DEFAULT_COMMISSION_RATE, mallId).run()
    const sellerId = Number(ins.meta?.last_row_id)
    if (!sellerId) return c.json({ success: false, error: '가입 처리 중 오류가 발생했습니다' }, 500)

    // 어드민 승인 큐 알림 (셀러 승인 페이지에서 처리 — 유통회원도 동일 큐).
    createDashboardNotification(DB, 'admin', null, 'distributor_pending', '유통회원 승인 요청',
      `${business_name} (${business_number})`, '/admin/seller-approval').catch(swallow('wholesale:register:notify'))

    return c.json({
      success: true,
      status: 'pending',
      message: '유통회원 가입 신청이 완료되었습니다. 사업자 정보 확인 후 관리자 승인되면 이용할 수 있습니다.',
    })
  } catch (err) {
    return safeError(c, err, '가입 처리 중 오류가 발생했습니다', '[wholesale:register]')
  }
})

// ── POST /become-distributor — 카카오(일반 유저)가 유통회원으로 전환/가입 ──────────────
//   카카오 로그인=유저 세션. 유통회원=sellers(is_distributor=1) 행. 이 엔드포인트가 유저↔셀러
//   (distributor) 행을 생성/연결(linked_user_id) 후 seller_token 발급 → 도매몰 즉시 이용.
//   ⚠️ 한 유저당 셀러 1행(idx_sellers_linked_user_id). 이미 셀러면 is_distributor 승급만.
app.post('/become-distributor', requireAuth(), rateLimit({ action: 'wholesale-become-distributor', max: 10, windowSec: 600 }), async (c) => {
  const { DB, JWT_SECRET } = c.env
  if (!JWT_SECRET) return c.json({ success: false, error: '서버 설정 오류' }, 500)
  const authed = c.get('user' as never) as { id?: string | number; email?: string; name?: string; type?: string } | undefined
  // 카카오 일반 유저만 (seller/admin 토큰으로는 불가 — userId 의미 다름).
  if (!authed || authed.type !== 'user') return c.json({ success: false, error: '카카오 로그인이 필요합니다' }, 401)
  const userId = Number(authed.id)
  if (!Number.isFinite(userId) || userId <= 0) return c.json({ success: false, error: '유효하지 않은 사용자입니다' }, 400)
  try {
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const business_name = String(body.business_name || '').trim()
    const business_number = String(body.business_number || '').trim()
    const representative = String(body.representative || '').trim()
    const phone = String(body.phone || '').trim()
    const business_license_url = String(body.business_license_url || '').trim().slice(0, 500)
    // 🏭 2026-06-09 대표자 연락처 + 담당자(성명/연락처/이메일) — additive 수집. 길이 cap.
    const representative_phone = String(body.representative_phone || '').trim().slice(0, 40)
    const manager_name = String(body.manager_name || '').trim().slice(0, 80)
    const manager_phone = String(body.manager_phone || '').trim().slice(0, 40)
    const manager_email = String(body.manager_email || '').trim().slice(0, 160)

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
    ]) { await DB.prepare(sql).run().catch(swallow('wholesale:become:alter')) }

    // best-effort: email_verified 컬럼 ensure (become 첫 호출 환경 self-heal).
    await DB.prepare('ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0').run().catch(swallow('wholesale:become:add-verified'))
    const u = await DB.prepare('SELECT id, email, name, email_verified FROM users WHERE id = ?').bind(userId)
      .first<{ id: number; email: string | null; name: string | null; email_verified: number | null }>().catch(() => null)
    const email = (authed.email || u?.email || '').trim().toLowerCase()
    const name = (authed.name || u?.name || '유통회원').trim()
    const emailVerified = u?.email_verified === 1

    type SellerRow = { id: number; username: string; email: string | null; name: string | null; status: string; seller_type: string | null; is_distributor: number | null }
    // 1) 이미 이 유저에 연결된 셀러?
    let seller = await DB.prepare(
      'SELECT id, username, email, name, status, seller_type, is_distributor FROM sellers WHERE linked_user_id = ? LIMIT 1'
    ).bind(userId).first<SellerRow>().catch(() => null)
    // 2) 없으면 같은 이메일의 미연결 셀러를 연결.
    //   🛡️ 2026-06-06 (보안, 사용자 승인): verified 카카오 email 일 때만 자동연결 — 미verified email 로
    //   사전등록된(관리자 시드) 승인 셀러 행 takeover 차단. KakaoAuthService.upsertUser 의 동일 게이트와 대칭.
    if (!seller && email && emailVerified) {
      const byEmail = await DB.prepare(
        'SELECT id, username, email, name, status, seller_type, is_distributor FROM sellers WHERE email = ? AND (linked_user_id IS NULL OR linked_user_id = 0) LIMIT 1'
      ).bind(email).first<SellerRow>().catch(() => null)
      if (byEmail) {
        await DB.prepare("UPDATE sellers SET linked_user_id = ?, updated_at = datetime('now') WHERE id = ?").bind(userId, byEmail.id).run().catch(swallow('wholesale:become:link'))
        seller = byEmail
      }
    }

    if (seller) {
      // 기존 셀러 → 유통회원 승급(is_distributor). 이미 승인된 계정이면 즉시 토큰(검증 완료된 사업자).
      if (!seller.is_distributor) {
        await DB.prepare("UPDATE sellers SET is_distributor = 1, distributor_grade = COALESCE(distributor_grade,'C'), updated_at = datetime('now') WHERE id = ?").bind(seller.id).run().catch(swallow('wholesale:become:upgrade'))
        seller.is_distributor = 1
      }
      if (seller.status !== 'approved' && seller.status !== 'active') {
        return c.json({ success: true, status: seller.status || 'pending', message: '유통회원 승인 대기 중입니다. 관리자 승인 후 이용할 수 있습니다.' })
      }
      const nowSec = Math.floor(Date.now() / 1000)
      const payload = { sub: String(seller.id), seller_id: seller.id, email: seller.email || email, name: seller.name || name, username: seller.username, type: 'seller', status: seller.status, seller_type: seller.seller_type || 'influencer', is_distributor: 1, iat: nowSec, exp: nowSec + 30 * 24 * 60 * 60 }
      const token = await sign(payload, JWT_SECRET)
      const refreshToken = await sign({ ...payload, exp: nowSec + 90 * 24 * 60 * 60 }, JWT_SECRET)
      return c.json({ success: true, status: 'approved', data: { accessToken: token, refreshToken, token, seller: { id: seller.id, username: seller.username, email: seller.email || email, name: seller.name || name, status: seller.status, seller_type: seller.seller_type || 'influencer', is_distributor: 1 } } })
    }

    // 3) 신규 → 사업자 정보 필수 + status='pending'(어드민 승인). 토큰 미발급.
    //   🏭 2026-06-08: 빈 body 자동 probe(카탈로그/로그인 후 '기존 유통사 자동연결' 시도)는 에러가 아니라
    //   '가입 필요' 상태 — 신규 유저에게 400(콘솔 에러·"가입 안됨" 오해) 대신 needs_registration(200) 반환.
    //   사업자 정보가 하나라도 들어온 실제 신청만 아래 필드 검증으로 400 처리.
    if (!business_name && !business_number && !business_license_url) {
      return c.json({ success: true, status: 'needs_registration', message: '유통회원 가입(사업자 정보 입력)이 필요합니다.' })
    }
    if (!email) return c.json({ success: false, error: '이메일 정보가 필요합니다. 카카오 이메일 제공에 동의해주세요' }, 400)
    if (!business_name) return c.json({ success: false, error: '상호(사업자명)를 입력해주세요' }, 400)
    if (!/^\d{3}-\d{2}-\d{5}$/.test(business_number)) return c.json({ success: false, error: '사업자등록번호를 정확히 입력해주세요 (000-00-00000)' }, 400)
    if (!business_license_url) return c.json({ success: false, error: '사업자등록증 이미지를 업로드해주세요' }, 400)
    const base = (email.split('@')[0] || 'dist').replace(/[^a-z0-9]/gi, '').slice(0, 16).toLowerCase() || 'dist'
    let username = ''
    for (let i = 0; i < 6; i++) {
      const cand = `${base}${Math.floor(1000 + Math.random() * 9000)}`
      const ex = await DB.prepare('SELECT id FROM sellers WHERE username = ?').bind(cand).first()
      if (!ex) { username = cand; break }
    }
    if (!username) username = `dist${Date.now().toString().slice(-8)}`
    // 🏬 멀티-몰: 가입 대상 몰 = host(또는 ?mall=slug). 기본(단일 호스트) 환경은 1 → 동작 불변.
    const mallId = await registrationMallId(c)
    const ins = await DB.prepare(`
      INSERT INTO sellers (username, email, password_hash, name, business_name, business_number, representative_name, phone,
        representative_phone, manager_name, manager_phone, manager_email,
        business_registration_image_url, business_registration_status,
        status, commission_rate, seller_type, distributor_grade, is_distributor, linked_user_id, mall_id, created_at, updated_at)
      VALUES (?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?, 'influencer', 'C', 1, ?, ?, datetime('now'), datetime('now'))
    `).bind(username, email, name, business_name, business_number, representative || null, phone || null,
      representative_phone || null, manager_name || null, manager_phone || null, manager_email || null,
      business_license_url || null, DEFAULT_COMMISSION_RATE, userId, mallId).run()
    const sid = Number(ins.meta?.last_row_id)
    if (!sid) return c.json({ success: false, error: '유통회원 신청 중 오류가 발생했습니다' }, 500)
    createDashboardNotification(DB, 'admin', null, 'distributor_pending', '유통회원 승인 요청', `${business_name} (${business_number})`, '/admin/seller-approval').catch(swallow('wholesale:become:notify'))
    return c.json({ success: true, status: 'pending', message: '유통회원 가입 신청이 완료되었습니다. 사업자 정보 확인 후 관리자 승인되면 이용할 수 있습니다.' })
  } catch (err) {
    return safeError(c, err, '유통회원 전환 중 오류가 발생했습니다', '[wholesale:become]')
  }
})

// ════════════════════════════════════════════════════════════════════════════
// 👥 직원 서브계정 — 회사(owner) 관리 엔드포인트 + 직원 로그인
// ════════════════════════════════════════════════════════════════════════════

// ── POST /sub-accounts — 직원 계정 생성 (owner/admin 만) ───────────────────────
app.post('/sub-accounts', rateLimit({ action: 'wholesale-subacct-create', max: 20, windowSec: 600 }), async (c) => {
  const gate = await requireSubAdmin(c)
  if ('error' in gate) return c.json({ success: false, error: gate.error }, gate.status)
  const { DB } = c.env
  try {
    await ensureSubAccountSchema(DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const name = String(body.name || '').trim().slice(0, 80)
    const role = String(body.role || 'staff') as SubRole
    if (!SUB_EMAIL_RE.test(email)) return c.json({ success: false, error: '올바른 이메일을 입력해주세요' }, 400)
    if (!SUB_ROLES.includes(role)) return c.json({ success: false, error: '역할이 올바르지 않습니다' }, 400)
    // 비밀번호: 도매(공급자/유통)와 동일 완화 정책(영문+숫자 8자+). 해시는 동일 hashPassword 재사용.
    if (password.length < 8 || password.length > 128 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return c.json({ success: false, error: '비밀번호는 영문과 숫자를 포함해 8자 이상이어야 합니다' }, 400)
    }
    // 이메일 전역 UNIQUE(서브계정) — 충돌 시 409. (회사 owner 이메일과 충돌해도 생성 자체는 별 테이블이라 무방하나
    //   로그인 혼선 방지를 위해 서브계정끼리만 UNIQUE 강제.)
    const dupe = await DB.prepare('SELECT id FROM wholesale_sub_accounts WHERE email = ? LIMIT 1').bind(email).first<{ id: number }>().catch(() => null)
    if (dupe) return c.json({ success: false, error: '이미 등록된 이메일입니다' }, 409)
    const passwordHash = await hashPassword(password)
    const ins = await DB.prepare(
      `INSERT INTO wholesale_sub_accounts (parent_seller_id, email, password_hash, name, role, active, created_at)
       VALUES (?, ?, ?, ?, ?, 1, datetime('now'))`
    ).bind(gate.sellerId, email, passwordHash, name || null, role).run()
    return c.json({ success: true, data: { id: Number(ins.meta?.last_row_id), email, name, role, active: 1 } }, 201)
  } catch (err) {
    return safeError(c, err, '직원 계정 생성 중 오류가 발생했습니다', '[wholesale:subacct]')
  }
})

// ── GET /sub-accounts — 본 회사 직원 목록 (owner/admin 만) ──────────────────────
app.get('/sub-accounts', async (c) => {
  const gate = await requireSubAdmin(c)
  if ('error' in gate) return c.json({ success: false, error: gate.error }, gate.status)
  const { DB } = c.env
  try {
    await ensureSubAccountSchema(DB)
    // ⚠️ password_hash 절대 미노출.
    const rows = await DB.prepare(
      `SELECT id, email, name, role, active, created_at, last_login_at
         FROM wholesale_sub_accounts WHERE parent_seller_id = ? ORDER BY created_at DESC LIMIT 200`
    ).bind(gate.sellerId).all<{ id: number; email: string; name: string | null; role: string; active: number; created_at: string; last_login_at: string | null }>()
      .catch(() => ({ results: [] as Array<{ id: number; email: string; name: string | null; role: string; active: number; created_at: string; last_login_at: string | null }> }))
    return c.json({ success: true, items: rows.results || [] })
  } catch (err) {
    return safeError(c, err, '직원 목록 조회 중 오류가 발생했습니다', '[wholesale:subacct]')
  }
})

// ── PATCH /sub-accounts/:id — 역할/활성 변경 (owner/admin 만, 본 회사 한정 IDOR 가드) ──
app.patch('/sub-accounts/:id', rateLimit({ action: 'wholesale-subacct-update', max: 40, windowSec: 600 }), async (c) => {
  const gate = await requireSubAdmin(c)
  if ('error' in gate) return c.json({ success: false, error: gate.error }, gate.status)
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 ID' }, 400)
  try {
    await ensureSubAccountSchema(DB)
    // IDOR: parent_seller_id 일치 행만 조회/수정.
    const row = await DB.prepare('SELECT id, role, active FROM wholesale_sub_accounts WHERE id = ? AND parent_seller_id = ? LIMIT 1')
      .bind(id, gate.sellerId).first<{ id: number; role: string; active: number }>().catch(() => null)
    if (!row) return c.json({ success: false, error: '직원 계정을 찾을 수 없습니다' }, 404)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const sets: string[] = []
    const binds: unknown[] = []
    if (body.role !== undefined) {
      const role = String(body.role) as SubRole
      if (!SUB_ROLES.includes(role)) return c.json({ success: false, error: '역할이 올바르지 않습니다' }, 400)
      sets.push('role = ?'); binds.push(role)
    }
    if (body.active !== undefined) {
      const active = body.active === true || body.active === 1 || body.active === '1' ? 1 : 0
      sets.push('active = ?'); binds.push(active)
    }
    if (!sets.length) return c.json({ success: false, error: '변경할 항목이 없습니다' }, 400)
    binds.push(id, gate.sellerId)
    await DB.prepare(`UPDATE wholesale_sub_accounts SET ${sets.join(', ')} WHERE id = ? AND parent_seller_id = ?`).bind(...binds).run()
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '직원 계정 변경 중 오류가 발생했습니다', '[wholesale:subacct]')
  }
})

// ── DELETE /sub-accounts/:id — 직원 계정 삭제 (owner/admin 만, 본 회사 한정) ─────
app.delete('/sub-accounts/:id', rateLimit({ action: 'wholesale-subacct-delete', max: 40, windowSec: 600 }), async (c) => {
  const gate = await requireSubAdmin(c)
  if ('error' in gate) return c.json({ success: false, error: gate.error }, gate.status)
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 ID' }, 400)
  try {
    await ensureSubAccountSchema(DB)
    const res = await DB.prepare('DELETE FROM wholesale_sub_accounts WHERE id = ? AND parent_seller_id = ?').bind(id, gate.sellerId).run()
    if (!res.meta?.changes) return c.json({ success: false, error: '직원 계정을 찾을 수 없습니다' }, 404)
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '직원 계정 삭제 중 오류가 발생했습니다', '[wholesale:subacct]')
  }
})

// ── POST /sub-login — 직원 로그인 → PARENT seller_id 로 seller 토큰 발급 ──────────
//   ⚠️ 발급 토큰의 seller_id = parent_seller_id → 모든 기존 미들웨어/예치금/주문/카탈로그가
//   회사 계정 위에서 byte-identical 동작. sub_account_id/sub_role 추가 클레임만 얹음.
app.post('/sub-login', rateLimit({ action: 'wholesale-sub-login', max: 10, windowSec: 300 }), async (c) => {
  const { DB, JWT_SECRET } = c.env
  if (!JWT_SECRET) return c.json({ success: false, error: '서버 설정 오류' }, 500)
  try {
    await ensureSubAccountSchema(DB)
    const body = await c.req.json<{ email?: string; password?: string }>().catch(() => ({} as { email?: string; password?: string }))
    const email = (body.email || '').trim().toLowerCase()
    const password = body.password || ''
    if (!email || !password) return c.json({ success: false, error: '이메일과 비밀번호를 입력해주세요' }, 400)

    const sub = await DB.prepare(
      'SELECT id, parent_seller_id, email, password_hash, name, role, active FROM wholesale_sub_accounts WHERE email = ? LIMIT 1'
    ).bind(email).first<{ id: number; parent_seller_id: number; email: string; password_hash: string | null; name: string | null; role: string; active: number }>().catch(() => null)

    // 타이밍 공격 방어 — 계정 없어도 더미 검증 1회 (supplier-auth 와 동일 패턴).
    if (!sub || !sub.password_hash) {
      await verifyPassword(password, '$2b$10$CwTycUXWue0Thq9StjUM0uJ8mS8bL7JmJg0jVRjyZj3X5kQKqRHqO').catch(() => null)
      return c.json({ success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다' }, 401)
    }
    const { valid } = await verifyPassword(password, sub.password_hash)
    if (!valid) return c.json({ success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다' }, 401)
    if (sub.active !== 1) return c.json({ success: false, error: '비활성화된 계정입니다. 관리자에게 문의하세요' }, 403)

    // 부모(회사) 유통사 계정이 여전히 유효(유통사 + 승인/활성)한지 확인.
    const parent = await DB.prepare(
      'SELECT id, name, username, email, status, seller_type, is_distributor FROM sellers WHERE id = ? LIMIT 1'
    ).bind(sub.parent_seller_id).first<{ id: number; name: string | null; username: string | null; email: string | null; status: string | null; seller_type: string | null; is_distributor: number | null }>().catch(() => null)
    if (!parent || !parent.is_distributor) return c.json({ success: false, error: '회사 계정을 사용할 수 없습니다. 관리자에게 문의하세요' }, 403)
    if (parent.status !== 'approved' && parent.status !== 'active') {
      return c.json({ success: false, error: '회사 계정이 아직 승인되지 않았습니다' }, 403)
    }

    const subRole = SUB_ROLES.includes(sub.role as SubRole) ? (sub.role as SubRole) : 'staff'
    const nowSec = Math.floor(Date.now() / 1000)
    // ⚠️ seller_id = PARENT. 직원이름/이메일은 sub 의 것을 노출하되, 회사 계정 위에서 동작.
    const payload = {
      sub: String(parent.id),
      seller_id: parent.id,
      email: sub.email,
      name: sub.name || parent.name || '직원',
      username: parent.username || undefined,
      type: 'seller',
      status: parent.status || 'approved',
      seller_type: parent.seller_type || 'influencer',
      is_distributor: 1,
      sub_account_id: sub.id,
      sub_role: subRole,
      iat: nowSec,
      exp: nowSec + 30 * 24 * 60 * 60,
    }
    const token = await sign(payload, JWT_SECRET)
    const refreshToken = await sign({ ...payload, exp: nowSec + 90 * 24 * 60 * 60 }, JWT_SECRET)

    // last_login_at 갱신(best-effort).
    await DB.prepare("UPDATE wholesale_sub_accounts SET last_login_at = datetime('now') WHERE id = ?").bind(sub.id).run().catch(swallow('wholesale:sub-login:last-login'))

    return c.json({
      success: true,
      data: {
        accessToken: token,
        refreshToken,
        token,
        // seller 객체 shape 은 일반 seller login 과 동일 — 클라 저장 로직 byte-identical.
        seller: {
          id: parent.id,
          username: parent.username || '',
          email: sub.email,
          name: sub.name || parent.name || '직원',
          status: parent.status || 'approved',
          seller_type: parent.seller_type || 'influencer',
          is_distributor: 1,
          sub_account_id: sub.id,
          sub_role: subRole,
        },
      },
    })
  } catch (err) {
    return safeError(c, err, '직원 로그인 중 오류가 발생했습니다', '[wholesale:sub-login]')
  }
})

// ── GET /me ───────────────────────────────────────────────────────────────────
app.get('/me', async (c) => {
  const { sellerId, subAccountId, subRole } = await subClaimsFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  try {
    await ensureCreditSchema(c.env.DB)
    const sg = await loadSellerGrade(c.env.DB, sellerId)
    const table = await loadGradeTable(c.env.DB)
    const grade = effectiveGrade({ grade: sg.distributor_grade, specialUntil: sg.special_discount_until })
    const marginPct = marginForGrade(grade, table)
    // 🏭 BIZ-2 v1: 여신(외상) 상태 — UI 가 '여신 결제' 옵션 노출/한도 표시에 사용.
    const credit = await loadSellerCredit(c.env.DB, sellerId)
    return c.json({
      success: true,
      grade,
      assigned_grade: sg.distributor_grade,
      margin_pct: marginPct,
      special_active: grade === 'SPECIAL',
      special_discount_until: sg.special_discount_until,
      credit: {
        limit: credit.limit,
        outstanding: credit.outstanding,
        available: credit.available,
        frozen: credit.frozen,
        // 여신 사용 가능 = 한도>0 + 미동결 + 가용액>0. (주문 가능 여부는 서버가 주문 시 최종 재검증)
        enabled: credit.limit > 0 && !credit.frozen && credit.available > 0,
      },
      // 👥 직원 서브계정 컨텍스트 — owner(서브계정 X)면 null. UI 가 직원 배지/권한 분기에 사용.
      //   sub_role='viewer' 면 주문 불가(서버가 /orders 에서 최종 강제). owner/admin 만 직원 관리 메뉴 노출.
      sub_account_id: subAccountId,
      sub_role: subRole,
      can_order: subRole !== 'viewer',
      can_manage_staff: !subRole || subRole === 'admin',
    })
  } catch (err) {
    return safeError(c, err, '등급 조회 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── GET /home — 도매몰 쇼핑 홈 한 번에 (베스트/신상품/카테고리/추천제안) ──────────
//   🛡️ 2026-06-04: 쇼핑몰형 홈용. 등급가 서버계산 + 가시성 가드 + 제조사 신원 비노출. SSR inject 가능(1 콜).
interface HomeRow { id: number; name: string; image_url: string | null; category: string | null; stock: number; supply_price: number; retail_price?: number; moq?: number; has_tiers?: number; margin_override?: number | null; dominant_color?: string | null; sold_count?: number }
app.get('/home', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureSupplyVisibilitySchema(DB)
    const [sg, table] = await Promise.all([loadSellerGrade(DB, sellerId), loadGradeTable(DB)])  // 🏭 2026-06-07: 순차 await → 병렬(1 RTT 절약)
    const grade = effectiveGrade({ grade: sg.distributor_grade, specialUntil: sg.special_discount_until })
    const baseWhere = `p.is_supply_product = 1 AND p.is_active = 1 AND p.supply_source_id IS NULL AND COALESCE(p.supply_price,0) > 0 AND ${visibilityWhere('p')}`
    const cols = `p.id, p.name, p.image_url, p.category, p.stock, COALESCE(p.supply_price,0) AS supply_price, COALESCE(p.price,0) AS retail_price, COALESCE(p.min_order_qty,1) AS moq, EXISTS(SELECT 1 FROM product_qty_tiers t WHERE t.product_id = p.id) AS has_tiers, p.supply_margin_override_pct AS margin_override, p.dominant_color, COALESCE(p.sold_count,0) AS sold_count`
    const enrich = (rows: HomeRow[]) => (rows || []).map(r => {
      const { price } = resolveDistributorPrice({ baseSupplyPrice: r.supply_price, grade: sg.distributor_grade, specialUntil: sg.special_discount_until, table, marginOverridePct: r.margin_override })
      // ⚠️ retail_price = 권장소비자가(공급자 입력) — 원가(supply_price)/제조사 신원은 비노출. 유통사 마진 산출용.
      return { id: r.id, name: r.name, image_url: r.image_url, category: r.category, stock: r.stock, dominant_color: r.dominant_color ?? null, distributor_price: price, retail_price: r.retail_price || null, moq: Math.max(1, r.moq || 1), has_tiers: !!r.has_tiers, sold_count: r.sold_count || 0 }
    })

    const [best, fresh, cats, proposalsRes] = await Promise.all([
      DB.prepare(`SELECT ${cols} FROM products p WHERE ${baseWhere} ORDER BY COALESCE(p.sold_count,0) DESC, p.created_at DESC LIMIT 12`).bind(sellerId).all<HomeRow>().catch(() => ({ results: [] as HomeRow[] })),
      DB.prepare(`SELECT ${cols} FROM products p WHERE ${baseWhere} ORDER BY p.created_at DESC LIMIT 12`).bind(sellerId).all<HomeRow>().catch(() => ({ results: [] as HomeRow[] })),
      DB.prepare(`SELECT p.category AS category, COUNT(*) AS cnt FROM products p WHERE ${baseWhere} AND p.category IS NOT NULL GROUP BY p.category ORDER BY cnt DESC LIMIT 12`).bind(sellerId).all<{ category: string; cnt: number }>().catch(() => ({ results: [] as { category: string; cnt: number }[] })),
      DB.prepare(`
        SELECT ${cols} FROM wholesale_proposals wp JOIN products p ON p.id = wp.product_id
        WHERE wp.status = 'active' AND wp.distributor_seller_id = ? AND ${baseWhere} ORDER BY wp.created_at DESC LIMIT 12
      `).bind(sellerId, sellerId).all<HomeRow>().catch(() => ({ results: [] as HomeRow[] })),
    ])

    return c.json({
      success: true,
      grade,
      best: enrich(best.results || []),
      new: enrich(fresh.results || []),
      proposals: enrich(proposalsRes.results || []),
      categories: (cats.results || []).map(c2 => ({ key: c2.category, count: c2.cnt })),
    })
  } catch (err) {
    return safeError(c, err, '도매몰 홈 조회 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── GET /recent-items — 빠른 재주문 (최근 사입한 상품 + 마지막 수량, 등급가) ──────
//   유통사 본인 주문 라인에서 상품별 최신 1건 추출(현재 구매 가능 + 가시성 통과 한정).
app.get('/recent-items', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureOrderTables(DB)
    await ensureSupplyVisibilitySchema(DB)
    // 최근 주문 라인 (상품별 최신 1건 — JS dedupe). 결제완료 이상만.
    const lines = await DB.prepare(`
      SELECT i.product_id AS product_id, i.qty AS qty, o.created_at AS created_at
      FROM wholesale_order_items i JOIN wholesale_orders o ON o.id = i.wholesale_order_id
      WHERE o.distributor_seller_id = ? AND o.status IN ('PAID','SHIPPED','PARTIAL_REFUNDED','DONE')
      ORDER BY o.created_at DESC LIMIT 120
    `).bind(sellerId).all<{ product_id: number; qty: number; created_at: string }>().catch(() => ({ results: [] as { product_id: number; qty: number; created_at: string }[] }))
    const seen = new Map<number, { qty: number; created_at: string }>()
    for (const l of lines.results || []) if (!seen.has(l.product_id)) seen.set(l.product_id, { qty: l.qty, created_at: l.created_at })
    const ids = [...seen.keys()].slice(0, 12)
    if (!ids.length) return c.json({ success: true, items: [] })

    const [sg, table] = await Promise.all([loadSellerGrade(DB, sellerId), loadGradeTable(DB)])  // 🏭 2026-06-07: 순차 await → 병렬(1 RTT 절약)
    const ph = ids.map(() => '?').join(',')
    // 현재 구매 가능 + 가시성 통과한 원본 공급상품만 (단종/숨김 제외).
    const prods = await DB.prepare(`
      SELECT p.id, p.name, p.image_url, p.stock, COALESCE(p.supply_price,0) AS supply_price,
             COALESCE(p.price,0) AS retail_price, COALESCE(p.min_order_qty,1) AS moq, p.supply_margin_override_pct AS margin_override
      FROM products p
      WHERE p.id IN (${ph}) AND p.is_supply_product = 1 AND p.is_active = 1
        AND p.supply_source_id IS NULL AND COALESCE(p.supply_price,0) > 0 AND ${visibilityWhere('p')}
    `).bind(...ids, sellerId).all<{ id: number; name: string; image_url: string | null; stock: number; supply_price: number; retail_price: number; moq: number; margin_override: number | null }>()
    const byId = new Map((prods.results || []).map(p => [p.id, p]))
    const items = ids.map(id => {
      const p = byId.get(id); const meta = seen.get(id)
      if (!p) return null
      const { price } = resolveDistributorPrice({ baseSupplyPrice: p.supply_price, grade: sg.distributor_grade, specialUntil: sg.special_discount_until, table, marginOverridePct: p.margin_override })
      const moq = Math.max(1, p.moq || 1)
      return { id: p.id, name: p.name, image_url: p.image_url, stock: p.stock, distributor_price: price, retail_price: p.retail_price || null, moq, last_qty: Math.max(moq, meta?.qty || moq), last_date: (meta?.created_at || '').slice(0, 10) }
    }).filter(Boolean)
    return c.json({ success: true, items })
  } catch (err) {
    return safeError(c, err, '재주문 목록 조회 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── GET /catalog ────────────────────────────────────────────────────────────
//   🔭 향후(BIZ-4 후속, OUT OF SCOPE): 품절 상품 '재입고 알림 구독'(restock-alert) — 별도 구독 테이블 +
//      재고 0→N 전환 감지 cron + 알림 발송 필요. 이번 작업 범위 아님(검색/정렬/필터만).
app.get('/catalog', async (c) => {
  // 🏭 2026-06-04 몰-first: 비로그인도 카탈로그 둘러보기 가능. 가격(등급 공급가)은 로그인 시에만.
  //   비로그인 → distributor_price=null + requires_login. 가시성은 ALL 만(허용목록 매칭 X).
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  const guest = !sellerId
  const visBind = sellerId ?? -1 // visibilityWhere EXISTS 가 매칭 안 되도록(=ALL/NULL 만 노출)
  const { DB } = c.env
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '24', 10) || 24, 1), 100)
  const offset = (page - 1) * limit
  const search = (c.req.query('search') || '').slice(0, 100)
  const category = (c.req.query('category') || '').slice(0, 80)
  // ── BIZ-4 추가 파라미터 (모두 optional, 기본 미지정이면 현행 동작 불변) ──
  const sortParam = c.req.query('sort') || ''
  const sortKey = Object.prototype.hasOwnProperty.call(CATALOG_SORT_ORDER, sortParam) ? sortParam : ''
  const minPriceQ = Number(c.req.query('min_price'))
  const maxPriceQ = Number(c.req.query('max_price'))
  const minPrice = Number.isFinite(minPriceQ) && minPriceQ >= 0 ? Math.floor(minPriceQ) : null
  const maxPrice = Number.isFinite(maxPriceQ) && maxPriceQ >= 0 ? Math.floor(maxPriceQ) : null
  const inStock = c.req.query('in_stock') === '1'
  // 🏭 2026-06-09 Wave 2 프리미엄 전용관 — ?premium=1 이면 is_premium=1 만(additive WHERE). 미지정=현행 불변.
  const premiumOnly = c.req.query('premium') === '1'

  try {
    const hasCol = await DB.prepare(
      "SELECT COUNT(*) as c FROM pragma_table_info('products') WHERE name='is_supply_product'"
    ).first<{ c: number }>().catch(() => null)
    if (!hasCol || hasCol.c === 0) {
      return c.json({ success: true, items: [], total: 0, page, limit, has_more: false, grade: 'C' })
    }

    await ensureSupplyVisibilitySchema(DB)
    await ensureQtyConstraintSchema(DB) // BIZ-8: pack_size / order_multiple 컬럼 보장(SELECT 전). (+ products.mall_id 보장)
    const sg = guest ? { distributor_grade: null, special_discount_until: null } : await loadSellerGrade(DB, sellerId!)
    const table = await loadGradeTable(DB)
    const grade: DistributorGrade = effectiveGrade({ grade: sg.distributor_grade, specialUntil: sg.special_discount_until })
    // 🏬 멀티-몰: 로그인 유통사 → 본인 계정 몰 / 비로그인 → host 몰 / 기본 1. 기본 몰만 있으면 항상 1 → 동일 rows.
    const mallId = await resolveMallId(c)

    // 도매 가능 = 제조사 공급상품(공급자 직등록 원본). supply_source_id IS NULL = 원본(셀러 복제본 제외).
    // + 공급 범위(supply_visibility) 가시성: ALL 이거나 허용목록(선정된 유통회원)에 포함.
    // + 몰 스코핑: p.mall_id = 요청 몰(기본 1 → 기존 데이터 전 행 1 → byte-identical).
    let where = `p.is_supply_product = 1 AND p.is_active = 1 AND p.supply_source_id IS NULL AND COALESCE(p.supply_price,0) > 0 AND COALESCE(p.mall_id,1) = ? AND ${visibilityWhere('p')}`
    const params: (string | number)[] = [mallId, visBind]
    // ── 검색: FTS5(products_fts) 가용 시 name/description/category 전문검색, 아니면 LIKE 다컬럼 fallback.
    //   visibilityWhere 는 항상 AND-ed (FROM products p 구조 불변 — FTS 는 rowid subquery 로 합류).
    //   ⚠️ products 스키마에 brand_name/barcode 컬럼이 없어 그 두 컬럼 검색은 생략(있는 컬럼만).
    if (search) {
      const useFts = await ftsAvailable(DB)
      const match = useFts ? buildFtsMatch(search) : null
      if (useFts && match) {
        where += ' AND p.id IN (SELECT rowid FROM products_fts WHERE products_fts MATCH ?)'
        params.push(match)
      } else {
        where += ' AND (p.name LIKE ? OR p.description LIKE ?)'
        params.push(`%${search}%`, `%${search}%`)
      }
    }
    if (category) { where += ' AND p.category = ?'; params.push(category) }
    // ── 가격대 필터: distributor_price 는 등급별 서버 계산값이라 SQL 에서 직접 못 씀.
    //   supply_price(제조사 공급원가) 는 distributor_price 와 단조증가 관계(등급마진 적용) → 합리적 proxy.
    //   ⚠️ 비노출 컬럼이지만 필터 조건(WHERE)에만 사용, 응답엔 노출 X. 단위: 원(KRW).
    if (minPrice !== null) { where += ' AND COALESCE(p.supply_price,0) >= ?'; params.push(minPrice) }
    if (maxPrice !== null) { where += ' AND COALESCE(p.supply_price,0) <= ?'; params.push(maxPrice) }
    if (inStock) { where += ' AND COALESCE(p.stock,0) > 0' }
    // 🏭 2026-06-09 Wave 2: 프리미엄 전용관 필터(additive — 미지정 시 조건 미추가로 현행 동작 불변).
    if (premiumOnly) { where += ' AND COALESCE(p.is_premium,0) = 1' }

    // 정렬: 화이트리스트만(injection 불가). 미지정 = 현행 popular 정렬과 동일 리터럴.
    const orderBy = CATALOG_SORT_ORDER[sortKey] || CATALOG_SORT_ORDER.popular

    const rows = await DB.prepare(`
      SELECT p.id, p.name, p.description, p.image_url, p.category, p.stock, p.supplier_id,
             COALESCE(p.supply_price, 0) AS supply_price, COALESCE(p.price,0) AS retail_price,
             COALESCE(p.min_order_qty,1) AS moq,
             COALESCE(p.pack_size,1) AS pack_size, COALESCE(p.order_multiple,1) AS order_multiple,
             COALESCE(p.is_premium,0) AS is_premium,
             EXISTS(SELECT 1 FROM product_qty_tiers t WHERE t.product_id = p.id) AS has_tiers,
             COALESCE(p.sold_count,0) AS sold_count, p.supply_margin_override_pct AS margin_override
      FROM products p
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all<{
      id: number; name: string; description: string | null; image_url: string | null;
      category: string | null; stock: number; supplier_id: number | null; supply_price: number; retail_price: number; moq: number; pack_size: number; order_multiple: number; is_premium: number; has_tiers: number; sold_count: number; margin_override: number | null
    }>()

    const totalRow = await DB.prepare(`SELECT COUNT(*) AS c FROM products p WHERE ${where}`)
      .bind(...params).first<{ c: number }>().catch(() => ({ c: 0 }))
    const total = totalRow?.c ?? 0

    // 🚚 제조사별 배송/주문 정책 일괄 로드 — 카트가 제조사별 최소주문금액/배송비 그룹 계산하도록 정책 첨부.
    //   ⚠️ supplier_id(신원) 비노출 — 비식별 group key(s{id}) + 정책 숫자만 반환.
    const catSupplierIds = (rows.results || []).map(r => r.supplier_id).filter((x): x is number => Number.isFinite(x as number) && (x as number) > 0)
    const catPolicies = catSupplierIds.length ? await loadSupplierPolicies(DB, catSupplierIds) : new Map<number, SupplierPolicy>()

    // ⚠️ supply_price/supplier_id 비노출 — 등급가 + 권장소비자가(마진 산출용)만 반환.
    //   비로그인(guest) → 도매가/권장가/마진 전부 가림(null) + requires_login. (옵션 A: 도매가 숨김)
    const items = (rows.results || []).map(r => {
      const price = guest ? null : resolveDistributorPrice({
        baseSupplyPrice: r.supply_price, grade: sg.distributor_grade,
        specialUntil: sg.special_discount_until, table, marginOverridePct: r.margin_override,
      }).price
      const supId = (Number.isFinite(r.supplier_id as number) && (r.supplier_id as number) > 0) ? (r.supplier_id as number) : null
      const supPol = supId != null ? catPolicies.get(supId) : undefined
      return {
        id: r.id, name: r.name, description: r.description, image_url: r.image_url,
        category: r.category, stock: r.stock, distributor_price: price,
        retail_price: guest ? null : (r.retail_price || null), moq: Math.max(1, r.moq || 1),
        // BIZ-8: pack_size(박스당 낱개 — 표시용) / order_multiple(주문 배수 강제). 둘 다 최소 1.
        pack_size: Math.max(1, r.pack_size || 1), order_multiple: Math.max(1, r.order_multiple || 1),
        is_premium: !!r.is_premium,
        has_tiers: !!r.has_tiers, sold_count: r.sold_count || 0,
        // 🚚 제조사별 배송/주문 정책(비식별 group key + 정책 숫자) — 카트 그룹 계산용.
        supplier_group: supId != null ? `s${supId}` : null,
        supplier_policy: supId != null ? { min_order_amount: supPol?.min_order_amount ?? 0, shipping_fee: supPol?.shipping_fee ?? 0, free_ship_threshold: supPol?.free_ship_threshold ?? 0 } : null,
        requires_login: guest,
      }
    })

    // 🏭 캐시 분리: guest(가격 비노출 → grade 무관 동일 응답)만 공유캐시. 로그인 응답은 등급가 개인화라 private/no-store.
    //   guest 카탈로그는 banners 와 동일 분리 헤더(브라우저 60s + edge 300s). KV write 미사용(edge only).
    if (guest) {
      c.header('Cache-Control', 'public, max-age=60')
      c.header('CDN-Cache-Control', 'public, max-age=300')
    } else {
      c.header('Cache-Control', 'private, no-store')
    }
    return c.json({ success: true, items, total, page, limit, has_more: offset + items.length < total, grade: guest ? null : grade, requires_login: guest })
  } catch (err) {
    return safeError(c, err, '카탈로그 조회 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── GET /catalog/:id ──────────────────────────────────────────────────────────
app.get('/catalog/:id', async (c) => {
  // 🏭 2026-06-04 몰-first: 비로그인도 상품 상세 열람 가능. 가격(등급가/권장가/tier)은 로그인 시에만.
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  const guest = !sellerId
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 상품 ID' }, 400)
  try {
    await ensureSupplyVisibilitySchema(DB)
    await ensureQtyConstraintSchema(DB) // BIZ-8: pack_size / order_multiple 컬럼 보장(SELECT 전). (+ products.mall_id 보장)
    // 🏬 멀티-몰: 요청 몰 스코핑(기본 1 → 기존 데이터 전 행 1 → byte-identical).
    const mallId = await resolveMallId(c)
    const r = await DB.prepare(`
      SELECT p.id, p.name, p.description, p.image_url, p.category, p.stock, p.supplier_id,
             COALESCE(p.supply_price,0) AS supply_price, COALESCE(p.price,0) AS retail_price,
             COALESCE(p.min_order_qty,1) AS moq,
             COALESCE(p.pack_size,1) AS pack_size, COALESCE(p.order_multiple,1) AS order_multiple,
             COALESCE(p.sold_count,0) AS sold_count, p.supply_margin_override_pct AS margin_override
      FROM products p
      WHERE p.id = ? AND p.is_supply_product = 1 AND p.is_active = 1
        AND p.supply_source_id IS NULL AND COALESCE(p.supply_price,0) > 0
        AND COALESCE(p.mall_id,1) = ?
        AND ${visibilityWhere('p')}
    `).bind(id, mallId, sellerId ?? -1).first<{
      id: number; name: string; description: string | null; image_url: string | null;
      category: string | null; stock: number; supplier_id: number | null; supply_price: number; retail_price: number; moq: number; pack_size: number; order_multiple: number; sold_count: number; margin_override: number | null
    }>()
    if (!r) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)

    // 🚚 제조사별 배송/주문 정책(비식별 group key + 정책 숫자만 — supplier_id 신원 비노출).
    //   카트/체크아웃이 제조사별 최소주문금액·배송비 진행을 표시하도록 상품에 정책 첨부.
    const supId = (Number.isFinite(r.supplier_id as number) && (r.supplier_id as number) > 0) ? (r.supplier_id as number) : null
    const supPol = supId != null ? (await loadSupplierPolicies(DB, [supId])).get(supId) : undefined
    const supplierGroup = supId != null ? `s${supId}` : null
    const supplierPolicy = supId != null
      ? { min_order_amount: supPol?.min_order_amount ?? 0, shipping_fee: supPol?.shipping_fee ?? 0, free_ship_threshold: supPol?.free_ship_threshold ?? 0 }
      : null

    const moq = Math.max(1, r.moq || 1)
    const packSize = Math.max(1, r.pack_size || 1)
    const orderMultiple = Math.max(1, r.order_multiple || 1)
    if (guest) {
      // 🏭 guest 상세는 가격 비노출 → 공유캐시 안전(브라우저 60s + edge 300s, banners 와 동일 분리). KV 미사용.
      c.header('Cache-Control', 'public, max-age=60')
      c.header('CDN-Cache-Control', 'public, max-age=300')
      return c.json({
        success: true,
        item: {
          id: r.id, name: r.name, description: r.description, image_url: r.image_url,
          category: r.category, stock: r.stock, distributor_price: null,
          retail_price: null, moq, pack_size: packSize, order_multiple: orderMultiple,
          sold_count: r.sold_count || 0, tiers: [], requires_login: true,
          supplier_group: supplierGroup, supplier_policy: supplierPolicy,
        },
        grade: null, requires_login: true,
      })
    }

    const sg = await loadSellerGrade(DB, sellerId!)
    const table = await loadGradeTable(DB)
    // 🛡️ PRC-1: 최소 플랫폼 마진율(%) — DISPLAY 와 CHARGE 가 동일 floor 를 쓰도록 요청당 1회 읽음(기본 0=현행 불변).
    const minMarginPct = await loadMinPlatformMarginPct(DB)
    const { price, grade } = resolveDistributorPrice({
      baseSupplyPrice: r.supply_price, grade: sg.distributor_grade,
      specialUntil: sg.special_discount_until, table, marginOverridePct: r.margin_override,
    })
    // 수량 구간 할인 tier — 등급가 위에 적용한 구간별 단가 노출(없으면 빈 배열).
    const tierMap = await loadQtyTiers(DB, [r.id])
    const rawTiers = tierMap.get(r.id) || []
    // 🛡️ PRC-1: floor = effectiveTierFloor(등급가, 공급원가, 최소마진%) = min(등급가, round(공급가×(1+최소마진%))).
    //   원가+최소마진(PG 수수료 커버) 하한 + 등급가 초과 금지 clamp. 기본(minMargin=0)이면 = 공급가(현행 동작).
    const tierFloor = effectiveTierFloor(price, r.supply_price, minMarginPct)
    const tiers = rawTiers.map(t => ({ min_qty: t.min_qty, discount_pct: t.discount_pct, unit_price: tierUnitPrice(price, t.min_qty, rawTiers, tierFloor) }))
    c.header('Cache-Control', 'private, no-store') // 등급가 개인화 — 공유캐시 금지
    return c.json({
      success: true,
      item: {
        id: r.id, name: r.name, description: r.description, image_url: r.image_url,
        category: r.category, stock: r.stock, distributor_price: price,
        retail_price: r.retail_price || null, moq, pack_size: packSize, order_multiple: orderMultiple,
        sold_count: r.sold_count || 0,
        tiers,
        supplier_group: supplierGroup, supplier_policy: supplierPolicy,
      },
      grade,
    })
  } catch (err) {
    return safeError(c, err, '상품 조회 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── POST /orders — B2B 주문 생성(PENDING) + Toss 결제 파라미터 반환 ────────────
app.post('/orders', rateLimit({ action: 'wholesale-order', max: 30, windowSec: 60 }), async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  // 👥 ADDITIVE 권한 게이트: 'viewer' 직원은 주문 불가(조회만). owner/admin/staff/일반 유통사는 영향 없음.
  //   ⚠️ JWT 클레임만 읽는 추가 검사 — money-CAS/reserve-before-charge/결제 로직은 절대 미변경.
  const { subRole: orderSubRole } = await subClaimsFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (orderSubRole === 'viewer') return c.json({ success: false, error: '주문 권한이 없는 계정(뷰어)입니다' }, 403)
  const { DB } = c.env
  try {
    await ensureOrderTables(DB)
    // 만료 정리(best-effort): 이 유통사의 1시간 경과 미결제(PENDING) 주문 = 체크아웃 이탈 → EXPIRED.
    await DB.prepare(
      "UPDATE wholesale_orders SET status='EXPIRED' WHERE distributor_seller_id=? AND status='PENDING' AND created_at < datetime('now','-1 hour')"
    ).bind(sellerId).run().catch(() => { /* best-effort */ })
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const rawItems = Array.isArray(body.items) ? body.items : []
    if (!rawItems.length) return c.json({ success: false, error: '주문 항목이 없습니다' }, 400)
    // 🏭 BIZ-2 v1: 결제수단 — 'prepay'(기본, 기존 Toss 선결제 경로 byte-identical) | 'credit'(외상).
    //   credit 분기는 아래 subtotal 재계산(prepay 와 동일) 직후 갈라짐. 기본값은 절대 'prepay'.
    const payMethod = body.payment_method === 'credit' ? 'credit' : 'prepay'

    // product_id → qty 합산 + 검증
    const reqMap = new Map<number, number>()
    for (const it of rawItems as Array<{ product_id?: unknown; qty?: unknown }>) {
      const pid = Number(it.product_id)
      const qty = Math.floor(Number(it.qty))
      if (!Number.isFinite(pid) || pid <= 0 || !Number.isFinite(qty) || qty <= 0 || qty > 100000) {
        return c.json({ success: false, error: '주문 수량이 올바르지 않습니다' }, 400)
      }
      reqMap.set(pid, (reqMap.get(pid) || 0) + qty)
    }

    await ensureSupplyVisibilitySchema(DB)
    await ensureQtyConstraintSchema(DB) // BIZ-8: pack_size / order_multiple 컬럼 보장(SELECT 전).
    // 🛡️ PRC-1: 최소 플랫폼 마진율(%) 요청당 1회 — CHARGE 가 DISPLAY(카탈로그)와 동일 floor 를 쓰도록(기본 0=현행 불변).
    const [sg, table, minMarginPct] = await Promise.all([loadSellerGrade(DB, sellerId), loadGradeTable(DB), loadMinPlatformMarginPct(DB)])  // 🏭 2026-06-07: 순차 await → 병렬(1 RTT 절약)
    const ids = [...reqMap.keys()]
    const placeholders = ids.map(() => '?').join(',')
    // 가시성 가드 — 유통사가 볼 수 없는(선정 안 된) 공급상품은 주문 불가.
    const prods = await DB.prepare(`
      SELECT p.id, p.name, p.supplier_id, p.stock, COALESCE(p.supply_price,0) AS supply_price, COALESCE(p.min_order_qty,1) AS moq, COALESCE(p.order_multiple,1) AS order_multiple, p.supply_margin_override_pct AS margin_override
      FROM products p
      WHERE p.id IN (${placeholders}) AND p.is_supply_product = 1 AND p.is_active = 1
        AND p.supply_source_id IS NULL AND COALESCE(p.supply_price,0) > 0
        AND ${visibilityWhere('p')}
    `).bind(...ids, sellerId).all<{ id: number; name: string; supplier_id: number | null; stock: number | null; supply_price: number; moq: number; order_multiple: number; margin_override: number | null }>()
    const found = prods.results || []
    if (found.length !== ids.length) {
      // 어떤 상품이 주문 불가인지 이름으로 안내(카트 부분 불가 UX) — 비노출 정보 없이 name 만.
      const foundIds = new Set(found.map(p => p.id))
      const missing = ids.filter(id => !foundIds.has(id))
      const nm = await DB.prepare(`SELECT name FROM products WHERE id IN (${missing.map(() => '?').join(',')})`)
        .bind(...missing).all<{ name: string }>().catch(() => ({ results: [] as { name: string }[] }))
      const names = (nm.results || []).map(r => r.name).filter(Boolean).join(', ')
      return c.json({ success: false, error: `주문할 수 없는 상품이 포함되어 있습니다${names ? `: ${names}` : ''} (품절·중지·열람권한 변경)`, unavailable: missing }, 400)
    }

    // 수량 구간 할인 tier 일괄 로드 (authoritative 단가에 적용).
    const tierMap = await loadQtyTiers(DB, ids)
    let subtotal = 0, supplyTotal = 0
    const lines: Array<{ product_id: number; supplier_id: number | null; name: string; qty: number; base: number; unit: number; line_total: number }> = []
    for (const p of found) {
      const qty = reqMap.get(p.id) || 0
      // 🏭 2026-06-04 MOQ 검증 — 최소 주문 수량 미만 차단(서버 방어; 클라 UI 도 동일 강제).
      const moq = Math.max(1, p.moq || 1)
      if (qty < moq) {
        // BIZ-8: MOQ 미달 — 명시 코드 + 상품명/요구값 포함(부분불가 UX). ⚠️ 가격산식/Toss 미경유 — 청구 전 차단.
        return c.json({ success: false, error: `최소 주문 수량은 ${moq}개입니다: ${p.name}`, code: 'MOQ_NOT_MET', product_id: p.id, min_order_qty: moq }, 400)
      }
      // 🏭 BIZ-8 (2026-06-08) 주문 배수(박스 단위) 강제 — order_multiple>1 이면 그 배수여야 주문 가능.
      //   ⚠️ 가격 산식 불변 — 수량 제약만. Toss/amount-validation 블록보다 앞(이 루프는 subtotal 누적 전 검증).
      const orderMultiple = Math.max(1, p.order_multiple || 1)
      if (orderMultiple > 1 && qty % orderMultiple !== 0) {
        return c.json({ success: false, error: `${orderMultiple}개 단위로만 주문할 수 있습니다: ${p.name} (요청 ${qty}개)`, code: 'ORDER_MULTIPLE_VIOLATION', product_id: p.id, order_multiple: orderMultiple }, 400)
      }
      if (p.stock != null && p.stock < qty) {
        return c.json({ success: false, error: `재고가 부족합니다: ${p.name}` }, 400)
      }
      const { price } = resolveDistributorPrice({
        baseSupplyPrice: p.supply_price, grade: sg.distributor_grade,
        specialUntil: sg.special_discount_until, table, marginOverridePct: p.margin_override,
      })
      // 🛡️ PRC-1: CHARGE 도 DISPLAY(카탈로그 /catalog/:id) 와 동일 floor 사용 — display==charge 정합 필수.
      //   floor = effectiveTierFloor(등급가, 공급원가, 최소마진%) = min(등급가, round(공급가×(1+최소마진%))).
      //   원가+최소마진(PG 수수료 커버) 하한 + 등급가 초과 금지 clamp. 기본(minMargin=0)이면 = 공급가(현행 역마진 차단 동작 불변).
      const tierFloor = effectiveTierFloor(price, p.supply_price, minMarginPct)
      // 등급가 위에 수량 구간 할인 적용 → 최종 authoritative 단가.
      const unit = tierUnitPrice(price, qty, tierMap.get(p.id), tierFloor)
      const lineTotal = unit * qty
      subtotal += lineTotal
      supplyTotal += p.supply_price * qty
      lines.push({ product_id: p.id, supplier_id: p.supplier_id, name: p.name, qty, base: p.supply_price, unit, line_total: lineTotal })
    }
    if (subtotal <= 0) return c.json({ success: false, error: '결제 금액이 올바르지 않습니다' }, 400)

    // ── 🚚 2026-06-09 제조사별 최소주문금액 게이트 + 배송비 (청구 *전* 서버 계산·검증) ──────────
    //   ⚠️ MONEY GATE: PENDING insert/deduct 보다 *앞*. min-order 미달이면 청구 자체 안 함(돈 미이동).
    //   shipping_total 은 제조사별 정책으로 서버 계산 → 청구액 = subtotal + shipping_total.
    const supplierIds = lines.map((l) => l.supplier_id).filter((x): x is number => Number.isFinite(x as number) && (x as number) > 0)
    const policies = await loadSupplierPolicies(DB, supplierIds)
    const shipCalc = computeSupplierShipping(lines, policies)
    if (shipCalc.shortfalls.length > 0) {
      // 최소주문금액 미달 — 어느 제조사가 얼마 부족한지 안내(청구 전 차단). supplier_id(신원) 미노출 — group key 만.
      const krw = (n: number) => `${(Math.max(0, Math.floor(n || 0))).toLocaleString('ko-KR')}원`
      const detail = shipCalc.shortfalls
        .map((s) => `${krw(s.shortfall)} 더 담아야 주문 가능 (현재 ${krw(s.subtotal)} / 최소 ${krw(s.min_order_amount)})`)
        .join(', ')
      return c.json({
        success: false,
        error: `최소 주문 금액을 채우지 못한 공급처가 있습니다: ${detail}`,
        code: 'MIN_ORDER_NOT_MET',
        shortfalls: shipCalc.shortfalls,
      }, 422)
    }
    const shippingTotal = Math.max(0, Math.floor(shipCalc.shippingTotal || 0))
    const chargeTotal = subtotal + shippingTotal // 💰 실제 청구액(예치금 차감액) — 상품합 + 배송비.

    const grade = effectiveGrade({ grade: sg.distributor_grade, specialUntil: sg.special_discount_until })

    // 배송지 스냅샷 — body 우선, 없으면 셀러 프로필. 제조사(공급자) 직배송에 사용.
    const shipFromProfile = await DB.prepare(
      'SELECT recipient_name, shipping_phone, shipping_address, shipping_postal_code, name FROM sellers WHERE id = ?'
    ).bind(sellerId).first<{ recipient_name: string | null; shipping_phone: string | null; shipping_address: string | null; shipping_postal_code: string | null; name: string | null }>().catch(() => null)
    const ship = (body.shipping || {}) as Record<string, unknown>
    const shipName = String(ship.name || shipFromProfile?.recipient_name || shipFromProfile?.name || '').slice(0, 60) || null
    const shipPhone = String(ship.phone || shipFromProfile?.shipping_phone || '').slice(0, 30) || null
    const shipAddr = String(ship.address || shipFromProfile?.shipping_address || '').slice(0, 300) || null
    const shipPostal = String(ship.postal || shipFromProfile?.shipping_postal_code || '').slice(0, 20) || null

    const orderName = lines.length === 1
      ? lines[0].name.slice(0, 90)
      : `${lines[0].name.slice(0, 40)} 외 ${lines.length - 1}건`

    // ─────────────────────────────────────────────────────────────────────────
    // 🏦 2026-06-09 예치금(선불) 결제 — 도매 주문 결제수단을 예치금 차감으로 일원화.
    //   Toss 선결제·여신(credit) 분기 제거. subtotal 은 위에서 서버 재계산됨(클라 금액 불신).
    //   결제 = 예치금 원자 차감만. 차감 성공 시 주문을 즉시 PAID 로 생성하고 결제완료 side-effect 실행.
    //   ⚠️ payMethod 는 더 이상 사용 안 함(예치금 단일 경로) — 변수 무시.
    void payMethod
    await ensureDepositSchema(DB)

    // 🔁💰 reserve-before-charge (2026-06-09 코드리뷰 #1·#2 수정): 주문을 PENDING 으로 먼저 생성 →
    //   UNIQUE(distributor_seller_id, idempotency_key) 가 동시/재시도 race 를 단독 중재. 차감은 이 INSERT 를
    //   '이긴' 요청만 1회 수행 → 이중차감 불가. 차감 전 주문 행이 존재하므로 차감↔주문 사이 크래시에도
    //   '잔액만 빠지고 주문 없음'(무음 손실) 불가 — PENDING 주문이 감사추적 + EXPIRED 스윕 대상으로 남음.
    const idemKey = String(body.idempotency_key || '').slice(0, 64)
    // 합성 toss_order_id — wholesale_orders.toss_order_id 는 NOT NULL/UNIQUE.
    const depOrderId = `DEP-${sellerId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`

    // STEP 1 — 주문 PENDING INSERT (차감 전). idemKey 충돌(동시/재시도) → 기존 주문 반환(재차감 X).
    let dOrderId = 0
    let idemConflict = false
    try {
      const insD = await DB.prepare(`
        INSERT INTO wholesale_orders (distributor_seller_id, toss_order_id, status, grade, subtotal, supply_total, margin_total, shipping_total, payment_key, idempotency_key, ship_to_name, ship_to_phone, ship_to_address, ship_to_postal)
        VALUES (?, ?, 'PENDING', ?, ?, ?, ?, ?, 'deposit', ?, ?, ?, ?, ?)
      `).bind(sellerId, depOrderId, grade, subtotal, supplyTotal, subtotal - supplyTotal, shippingTotal, idemKey || null, shipName, shipPhone, shipAddr, shipPostal).run()
      dOrderId = Number(insD.meta?.last_row_id)
    } catch { idemConflict = true }
    if (idemConflict || !dOrderId) {
      if (idemKey) {
        const exist = await DB.prepare('SELECT id, status FROM wholesale_orders WHERE distributor_seller_id = ? AND idempotency_key = ? LIMIT 1')
          .bind(sellerId, idemKey).first<{ id: number; status: string }>().catch(() => null)
        if (exist) return c.json({ success: true, order_id: exist.id, status: exist.status, paid_by: 'deposit', already: true })
      }
      return c.json({ success: false, error: '주문 생성 중 오류가 발생했습니다' }, 500)
    }

    // STEP 2 — 예치금 원자 차감(CAS). 이 요청이 주문을 소유(INSERT 승리) → 단 1회만 차감.
    //   💰 차감액 = chargeTotal(상품합 + 제조사별 배송비). 클라 금액 불신 — 전부 서버 재계산값.
    const deduct = await deductDeposit(DB, sellerId, chargeTotal)
    if (!deduct.ok) {
      // 잔액 부족 — 돈 미이동. PENDING 예약 삭제(idemKey 해제 → 충전 후 동일 체크아웃 재시도 가능) 후 402.
      await DB.prepare("DELETE FROM wholesale_orders WHERE id=? AND status='PENDING'").bind(dOrderId).run().catch(() => {})
      return c.json({
        success: false,
        error: '예치금이 부족합니다',
        code: 'INSUFFICIENT_DEPOSIT',
        balance: deduct.balance,
        required: chargeTotal,
        shortfall: Math.max(0, chargeTotal - deduct.balance),
      }, 402)
    }
    const balanceAfterDeduct = deduct.balanceAfter

    // STEP 3 — 차감 원장(ref_id=order.id, 환불 멱등 가드가 이 ref_id 로 매칭). PAID 확정은 재고 확보 후(아래).
    await recordDepositTxn(DB, sellerId, 'order', -chargeTotal, balanceAfterDeduct, String(dOrderId), `도매 예치금 주문 #${dOrderId}`)

    // 주문 항목 + 재고 차감(oversell 가드) — 실패 시 주문 FAILED + 예치금 환불(보상).
    try {
      for (const l of lines) {
        await DB.prepare(`
          INSERT INTO wholesale_order_items (wholesale_order_id, product_id, supplier_id, name, qty, base_supply_price, distributor_unit_price, line_total)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(dOrderId, l.product_id, l.supplier_id ?? null, l.name, l.qty, l.base, l.unit, l.line_total).run()
      }

      // 재고 원자적 차감(oversell 가드 — Toss confirm 과 동일). 실패 시 성공분 복원 + 보상 환불.
      const dDecremented: Array<{ product_id: number; qty: number }> = []
      let dOversold = false
      for (const l of lines) {
        const upd = await DB.prepare(
          "UPDATE products SET stock = stock - ?, sold_count = COALESCE(sold_count,0) + ?, updated_at = datetime('now') WHERE id = ? AND (stock IS NULL OR stock >= ?)"
        ).bind(l.qty, l.qty, l.product_id, l.qty).run().catch(() => ({ meta: { changes: 0 } }))
        if ((upd.meta?.changes ?? 0) === 0) { dOversold = true; break }
        dDecremented.push({ product_id: l.product_id, qty: l.qty })
      }
      if (dOversold) {
        for (const d of dDecremented) {
          await DB.prepare(
            "UPDATE products SET stock = stock + ?, sold_count = MAX(0, COALESCE(sold_count,0) - ?), updated_at = datetime('now') WHERE id = ? AND stock IS NOT NULL"
          ).bind(d.qty, d.qty, d.product_id).run().catch(() => { /* best-effort */ })
        }
        // 💰 멱등 보상환불 — refunded_amount CAS 로 1회만(이중환불·reconcile cron 중복 차단). 배송비 포함 전액(chargeTotal) 환불.
        await compensateDepositOrderOnce(DB, dOrderId, sellerId, chargeTotal, `재고부족 자동 환불 #${dOrderId}`)
        return c.json({ success: false, error: '재고가 부족하여 주문이 취소되었습니다. 예치금은 환불되었습니다.', code: 'OVERSOLD' }, 409)
      }
    } catch (innerErr) {
      // 항목/재고 단계 예외 → 주문 FAILED + 보상 환불. (이미 차감된 재고는 best-effort 미복원 —
      //   드문 케이스이며 oversell 가드 경로에서만 복원. 여기선 예외 발생 시 자금 안전 최우선.)
      // 💰 멱등 보상환불 — refunded_amount CAS 로 1회만. 배송비 포함 전액(chargeTotal) 환불.
      await compensateDepositOrderOnce(DB, dOrderId, sellerId, chargeTotal, `주문 처리 오류 자동 환불 #${dOrderId}`)
      return safeError(c, innerErr, '주문 처리 중 오류가 발생했습니다. 예치금은 환불되었습니다.', '[wholesale]')
    }

    // 재고 확보 완료 → PENDING→PAID 확정(CAS). 주문은 결제+재고 확보가 모두 된 시점에만 PAID.
    await DB.prepare("UPDATE wholesale_orders SET status='PAID', paid_at=datetime('now') WHERE id=? AND status='PENDING'").bind(dOrderId).run().catch(() => {})

    // 제조사 정산 적립(Toss/credit 주문과 동일 — 멱등, fail-soft). 정산 실패가 결제완료를 막지 않음.
    try { await creditSupplierOnWholesaleOrder(DB, dOrderId) } catch { /* best-effort */ }

    // 🏭 Wave 3c: 전자세금계산서 자동발행 레코드(매출=플랫폼→유통사 / 매입=제조사→플랫폼 역발행).
    //   멱등·fail-soft·additive — 세금레코드 실패가 결제/정산을 절대 막지 않음. provider 발행은 env-gated.
    try { await generateWholesaleSalesInvoice(DB, c.env, dOrderId) } catch { /* best-effort */ }
    try { await generateWholesalePurchaseInvoices(DB, c.env, dOrderId) } catch { /* best-effort */ }

    return c.json({
      success: true,
      order_id: dOrderId,
      status: 'PAID',
      paid_by: 'deposit',
      balance_after: balanceAfterDeduct,
      amount: chargeTotal, // 실제 청구액 = 상품합 + 배송비
      subtotal,
      shipping_total: shippingTotal,
      order_name: orderName,
    })
  } catch (err) {
    return safeError(c, err, '주문 생성 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── POST /orders/confirm — Toss 승인 + 멱등 PAID 전환 + 재고 차감 ──────────────
app.post('/orders/confirm', rateLimit({ action: 'wholesale-confirm', max: 30, windowSec: 60 }), async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureOrderTables(DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const paymentKey = String(body.paymentKey || '')
    const tossOrderId = String(body.orderId || '')
    const amount = Number(body.amount)
    if (!paymentKey || !tossOrderId || !Number.isFinite(amount) || amount <= 0) {
      return c.json({ success: false, error: '결제 정보가 올바르지 않습니다' }, 400)
    }

    const order = await DB.prepare(
      'SELECT id, status, subtotal FROM wholesale_orders WHERE toss_order_id = ? AND distributor_seller_id = ?'
    ).bind(tossOrderId, sellerId).first<{ id: number; status: string; subtotal: number }>()
    if (!order) return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404)
    if (order.status === 'PAID') return c.json({ success: true, order_id: order.id, already: true })
    if (order.status !== 'PENDING') return c.json({ success: false, error: '처리할 수 없는 주문 상태입니다' }, 400)

    // 서버 재계산 금액과 일치 검증 (클라이언트 금액 신뢰 X)
    if (Number(order.subtotal) !== Math.round(amount)) {
      return c.json({ success: false, error: '결제 금액이 일치하지 않습니다' }, 400)
    }

    // Toss 승인 — 잠긴 SSOT helper 호출 (직접 fetch 금지 룰 준수).
    const res = await confirmTossPayment({ env: c.env, paymentKey, orderId: tossOrderId, amount: Math.round(amount) })
    if (!res.ok) {
      return c.json({ success: false, error: res.message || '결제 승인에 실패했습니다', code: res.code }, 402)
    }

    // CAS: PENDING → PAID (동시요청 중복 side-effect 차단)
    const claim = await DB.prepare(
      "UPDATE wholesale_orders SET status='PAID', paid_at=datetime('now'), payment_key=? WHERE id=? AND status='PENDING'"
    ).bind(paymentKey, order.id).run()
    if ((claim.meta?.changes ?? 0) === 0) {
      // 🛡️ 2026-06-04: CAS 실패 분기 — 다른 동시 confirm 이 PAID 처리(Toss 멱등 = 1회 청구)면 멱등 반환.
      //   그 외(만료 cron 이 PENDING→EXPIRED 로 sweep 등)면 '결제는 됐는데 주문이 죽은' 상태 →
      //   청구된 금액 자동 환불(고객 미회수 방지). 정산/재고 side-effect 는 PAID claim 한쪽만 실행되므로 안전.
      const cur = await DB.prepare("SELECT status FROM wholesale_orders WHERE id = ?").bind(order.id).first<{ status: string }>().catch(() => null)
      if (cur?.status === 'PAID') return c.json({ success: true, order_id: order.id, already: true })
      try {
        await cancelTossPayment({ env: c.env, paymentKey, cancelReason: '주문 만료 — 자동 환불', idempotencyKey: `whs-expired-refund-${order.id}` })
      } catch { /* best-effort */ }
      return c.json({ success: false, error: '주문이 만료되어 결제가 자동 취소되었습니다. 다시 주문해주세요.', code: 'ORDER_EXPIRED' }, 409)
    }

    // 재고 원자적 차감 (oversell 가드) — stock NULL(무제한)은 통과, stock<qty 면 실패.
    //   동시 주문이 마지막 재고를 동시에 claim 하는 것을 차단. 실패 시 전액 환불 + 롤백.
    const items = await DB.prepare('SELECT product_id, qty FROM wholesale_order_items WHERE wholesale_order_id = ?')
      .bind(order.id).all<{ product_id: number; qty: number }>().catch(() => ({ results: [] as { product_id: number; qty: number }[] }))
    const lineList = items.results || []
    const decremented: Array<{ product_id: number; qty: number }> = []
    let oversold = false
    for (const it of lineList) {
      const upd = await DB.prepare(
        "UPDATE products SET stock = stock - ?, sold_count = COALESCE(sold_count,0) + ?, updated_at = datetime('now') WHERE id = ? AND (stock IS NULL OR stock >= ?)"
      ).bind(it.qty, it.qty, it.product_id, it.qty).run().catch(() => ({ meta: { changes: 0 } }))
      if ((upd.meta?.changes ?? 0) === 0) { oversold = true; break }
      decremented.push(it)
    }

    if (oversold) {
      // 롤백 — 차감 성공분 복원.
      for (const d of decremented) {
        await DB.prepare(
          "UPDATE products SET stock = stock + ?, sold_count = MAX(0, COALESCE(sold_count,0) - ?), updated_at = datetime('now') WHERE id = ? AND stock IS NOT NULL"
        ).bind(d.qty, d.qty, d.product_id).run().catch(() => { /* best-effort */ })
      }
      // 자동 전액 환불 (이미 승인된 결제) + 주문 실패 처리.
      try {
        await cancelTossPayment({ env: c.env, paymentKey, cancelReason: '재고 부족(동시주문) 자동 환불', idempotencyKey: `whs-oversell-${order.id}` })
      } catch { /* best-effort */ }
      await DB.prepare("UPDATE wholesale_orders SET status='FAILED' WHERE id=?").bind(order.id).run().catch(() => {})
      return c.json({ success: false, error: '재고가 부족하여 자동 환불되었습니다. 다시 시도해주세요.', code: 'OVERSOLD' }, 409)
    }

    // 제조사 정산 적립 (멱등, fail-soft — 정산 실패가 결제완료를 막지 않음).
    try { await creditSupplierOnWholesaleOrder(DB, order.id) } catch { /* best-effort */ }

    // 🏭 Wave 3c: 전자세금계산서 자동발행 레코드(멱등·fail-soft·additive — env-gated provider 발행).
    try { await generateWholesaleSalesInvoice(DB, c.env, order.id) } catch { /* best-effort */ }
    try { await generateWholesalePurchaseInvoices(DB, c.env, order.id) } catch { /* best-effort */ }

    return c.json({ success: true, order_id: order.id })
  } catch (err) {
    return safeError(c, err, '결제 확인 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── GET /orders — 내 도매 주문 목록 ──────────────────────────────────────────
app.get('/orders', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureOrderTables(DB)
    const { results } = await DB.prepare(`
      SELECT id, toss_order_id, status, grade, subtotal, courier, tracking_number, created_at, paid_at, shipped_at
      FROM wholesale_orders WHERE distributor_seller_id = ?
      ORDER BY created_at DESC LIMIT 100
    `).bind(sellerId).all()
    return c.json({ success: true, orders: results ?? [] })
  } catch (err) {
    return safeError(c, err, '주문 조회 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── GET /tax-invoices — 내(유통사) 매출 세금계산서 목록 (플랫폼→유통사) ─────────────
//   🏭 Wave 3c: 주문 결제완료 시 자동발행된 sales 레코드를 본인 것만 조회. 공급가액/세액/합계/상태.
app.get('/tax-invoices', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  try {
    const invoices = await listDistributorSalesInvoices(c.env.DB, sellerId)
    return c.json({ success: true, invoices })
  } catch (err) {
    return safeError(c, err, '세금계산서 조회 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── GET /orders/:id — 주문 상세 (본인 소유만) ─────────────────────────────────
app.get('/orders/:id', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 주문 ID' }, 400)
  try {
    await ensureOrderTables(DB)
    const order = await DB.prepare(
      'SELECT id, toss_order_id, status, grade, subtotal, courier, tracking_number, created_at, paid_at, shipped_at FROM wholesale_orders WHERE id = ? AND distributor_seller_id = ?'
    ).bind(id, sellerId).first()
    if (!order) return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404)
    const { results } = await DB.prepare(
      'SELECT product_id, name, qty, distributor_unit_price, line_total FROM wholesale_order_items WHERE wholesale_order_id = ?'
    ).bind(id).all()
    return c.json({ success: true, order, items: results ?? [] })
  } catch (err) {
    return safeError(c, err, '주문 조회 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── GET /proposals — 나에게 제안된 상품 (등급가 포함) ─────────────────────────
app.get('/proposals', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureSupplyVisibilitySchema(DB) // supply_margin_override_pct 컬럼 보장 (cold isolate)
    await DB.prepare(`CREATE TABLE IF NOT EXISTS wholesale_proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT, distributor_seller_id INTEGER NOT NULL, product_id INTEGER NOT NULL,
      note TEXT, status TEXT NOT NULL DEFAULT 'active', created_at DATETIME DEFAULT (datetime('now'))
    )`).run().catch(swallow('wholesale:ensure-proposals'))
    const [sg, table] = await Promise.all([loadSellerGrade(DB, sellerId), loadGradeTable(DB)])  // 🏭 2026-06-07: 순차 await → 병렬(1 RTT 절약)
    const { results } = await DB.prepare(`
      SELECT wp.id, wp.note, wp.created_at, p.id AS product_id, p.name, p.image_url, p.stock,
             COALESCE(p.supply_price,0) AS supply_price, p.supply_margin_override_pct AS margin_override
      FROM wholesale_proposals wp
      JOIN products p ON p.id = wp.product_id
      WHERE wp.distributor_seller_id = ? AND wp.status = 'active'
        AND p.is_active = 1 AND p.is_supply_product = 1
      ORDER BY wp.created_at DESC LIMIT 50
    `).bind(sellerId).all<{ id: number; note: string | null; created_at: string; product_id: number; name: string; image_url: string | null; stock: number; supply_price: number; margin_override: number | null }>()
    const items = (results || []).map(r => {
      const { price } = resolveDistributorPrice({ baseSupplyPrice: r.supply_price, grade: sg.distributor_grade, specialUntil: sg.special_discount_until, table, marginOverridePct: r.margin_override })
      return { id: r.id, note: r.note, product_id: r.product_id, name: r.name, image_url: r.image_url, stock: r.stock, distributor_price: price }
    })
    return c.json({ success: true, proposals: items })
  } catch (err) {
    return safeError(c, err, '제안 조회 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── GET /statement?from=&to= — 거래내역서 (유통사 매입 내역) ──────────────────
app.get('/statement', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureOrderTables(DB)
    const from = (c.req.query('from') || '').slice(0, 10)
    const to = (c.req.query('to') || '').slice(0, 10)
    let where = "distributor_seller_id = ? AND status IN ('PAID','SHIPPED','REFUNDED')"
    const binds: unknown[] = [sellerId]
    if (/^\d{4}-\d{2}-\d{2}$/.test(from)) { where += ' AND date(COALESCE(paid_at, created_at)) >= ?'; binds.push(from) }
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) { where += ' AND date(COALESCE(paid_at, created_at)) <= ?'; binds.push(to) }
    const { results } = await DB.prepare(`
      SELECT id, status, subtotal, grade, paid_at, created_at
      FROM wholesale_orders WHERE ${where} ORDER BY COALESCE(paid_at, created_at) DESC LIMIT 500
    `).bind(...binds).all<{ id: number; status: string; subtotal: number; grade: string | null; paid_at: string | null; created_at: string }>()
    const rows = results || []
    const totalPaid = rows.filter(r => r.status !== 'REFUNDED').reduce((s, r) => s + (r.subtotal || 0), 0)
    const totalRefunded = rows.filter(r => r.status === 'REFUNDED').reduce((s, r) => s + (r.subtotal || 0), 0)
    return c.json({ success: true, orders: rows, summary: { count: rows.length, total_paid: totalPaid, total_refunded: totalRefunded, net: totalPaid - totalRefunded } })
  } catch (err) {
    return safeError(c, err, '거래내역 조회 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── GET /documents — 유통사 본인 발행 자료(거래명세서/세금계산서, sales 방향만) ──────
import { ensureTaxDocSchema, renderTaxDocHtml, type TaxDocRow } from './tax-documents'

app.get('/documents', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureTaxDocSchema(DB)
    // sales = 유통스타트→유통사(본인 수취 자료). 매입(purchase)은 제조사 자료라 비노출.
    const { results } = await DB.prepare(
      `SELECT id, doc_type, period_month, party_name, supply_amount, vat_amount, total_amount, order_count, status, issued_at, nts_confirm_num
       FROM tax_documents WHERE distributor_seller_id = ? AND direction = 'sales'
       ORDER BY period_month DESC, id DESC LIMIT 200`
    ).bind(sellerId).all()
    return c.json({ success: true, documents: results || [] })
  } catch (err) {
    return safeError(c, err, '자료 조회 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── GET /documents/:id/html — 인쇄용 HTML (본인 sales 문서만, IDOR 가드) ──────────
app.get('/documents/:id/html', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.text('로그인이 필요합니다', 401)
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.text('잘못된 문서 ID', 400)
  try {
    await ensureTaxDocSchema(DB)
    const doc = await DB.prepare(
      `SELECT id, doc_type, direction, period_month, party_name, supply_amount, vat_amount, total_amount, order_count, status, issued_at
       FROM tax_documents WHERE id = ? AND distributor_seller_id = ? AND direction = 'sales'`
    ).bind(id, sellerId).first<TaxDocRow>()
    if (!doc) return c.text('문서를 찾을 수 없습니다', 404)
    return c.html(renderTaxDocHtml(doc))
  } catch {
    return c.text('문서를 열 수 없습니다', 500)
  }
})

// ── 엑셀 — 유통사 등급가 카탈로그 다운로드(.xlsx) + 주문 양식(.csv 재업로드용) ─────
import { buildCsv, csvResponse } from './supply-csv'
import { buildXlsx, xlsxResponse } from './xlsx'

// GET /catalog-export — 내 등급가 카탈로그 .xlsx (제조사 신원 비노출 — 등급가만)
app.get('/catalog-export', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureSupplyVisibilitySchema(DB)
    const [sg, table] = await Promise.all([loadSellerGrade(DB, sellerId), loadGradeTable(DB)])  // 🏭 2026-06-07: 순차 await → 병렬(1 RTT 절약)
    const rows = await DB.prepare(`
      SELECT p.id, p.name, p.category, p.stock, COALESCE(p.supply_price,0) AS supply_price, p.supply_margin_override_pct AS margin_override
      FROM products p
      WHERE p.is_supply_product = 1 AND p.is_active = 1 AND p.supply_source_id IS NULL
        AND COALESCE(p.supply_price,0) > 0 AND ${visibilityWhere('p')}
      ORDER BY p.name LIMIT 10000
    `).bind(sellerId).all<{ id: number; name: string; category: string | null; stock: number; supply_price: number; margin_override: number | null }>()
    const out = (rows.results || []).map(r => {
      const { price, grade } = resolveDistributorPrice({ baseSupplyPrice: r.supply_price, grade: sg.distributor_grade, specialUntil: sg.special_discount_until, table, marginOverridePct: r.margin_override })
      return [r.id, r.name, r.category || '', r.stock, price, grade]
    })
    return xlsxResponse(buildXlsx(['product_id', '상품명', '카테고리', '재고', '공급가(내등급)', '적용등급'], out), `wholesale-catalog-${new Date().toISOString().slice(0, 10)}.xlsx`)
  } catch (err) {
    return safeError(c, err, '카탈로그 내보내기 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── BIZ-8 (2026-06-08) GET /catalog/export?format=csv — 유통사 등급가 단가표 CSV ──────
//   엑셀로 바로 여는 단가표. 컬럼: 상품명/바코드/공급가(등급가)/MOQ/박스단위(order_multiple)/재고.
//   ⚠️ 가격 = 카탈로그가 보여주는 것과 동일한 서버계산 등급가(resolveDistributorPrice) — 다른 등급가
//      누출 절대 없음(내 등급 1개만 계산). supply_price(제조사 원가)/supplier_id(신원) 미노출.
//   PDF 는 범위 밖(follow-up). format 파라미터는 csv 만 지원(미지정/그외 → csv).
app.get('/catalog/export', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureSupplyVisibilitySchema(DB)
    await ensureQtyConstraintSchema(DB) // pack_size / order_multiple 컬럼 보장(SELECT 전).
    const [sg, table] = await Promise.all([loadSellerGrade(DB, sellerId), loadGradeTable(DB)])
    const rows = await DB.prepare(`
      SELECT p.id, p.name, p.barcode, p.category, p.stock, COALESCE(p.supply_price,0) AS supply_price,
             COALESCE(p.min_order_qty,1) AS moq, COALESCE(p.order_multiple,1) AS order_multiple,
             p.supply_margin_override_pct AS margin_override
      FROM products p
      WHERE p.is_supply_product = 1 AND p.is_active = 1 AND p.supply_source_id IS NULL
        AND COALESCE(p.supply_price,0) > 0 AND ${visibilityWhere('p')}
      ORDER BY p.category, p.name LIMIT 10000
    `).bind(sellerId).all<{ id: number; name: string; barcode: string | null; category: string | null; stock: number; supply_price: number; moq: number; order_multiple: number; margin_override: number | null }>()
    const header = ['상품명', '바코드', '공급가(내등급)', 'MOQ', '박스단위', '재고']
    const out = (rows.results || []).map(r => {
      // ⚠️ 내 등급 단가만 계산 — 타 등급가 누출 없음(카탈로그/주문과 동일 SSOT).
      const { price } = resolveDistributorPrice({ baseSupplyPrice: r.supply_price, grade: sg.distributor_grade, specialUntil: sg.special_discount_until, table, marginOverridePct: r.margin_override })
      return [r.name, r.barcode || '', price, Math.max(1, r.moq || 1), Math.max(1, r.order_multiple || 1), r.stock]
    })
    return csvResponse(buildCsv(header, out), `wholesale-pricelist-${new Date().toISOString().slice(0, 10)}.csv`)
  } catch (err) {
    return safeError(c, err, '단가표 내보내기 중 오류가 발생했습니다', '[wholesale]')
  }
})

// GET /order-template — 주문 양식 CSV. 로그인 시 내 카탈로그(등급가 포함) 프리필 →
//   유통사는 '주문수량' 칸만 채워 업로드. 비로그인은 빈 양식(헤더만).
app.get('/order-template', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  // BIZ-9 (2026-06-09): 박스단위(order_multiple) 열 추가 — 유통사가 양식에서 주문 배수 제약을 바로 보고 입력.
  //   product_id 가 robust 매칭 키(상품명 변경에도 안전). 주문수량 = 유통사 입력칸(빈칸).
  const header = ['product_id', '상품명', '카테고리', '재고', '공급가(내등급)', 'MOQ', '박스단위', '주문수량']
  if (!sellerId) {
    return csvResponse(buildCsv(header, [['예: 123', '상품명(참고용)', '식품', '500', '9000', '1', '1', '10']]), 'wholesale-order-template.csv')
  }
  const { DB } = c.env
  try {
    await ensureSupplyVisibilitySchema(DB)
    await ensureQtyConstraintSchema(DB) // order_multiple 컬럼 보장(SELECT 전).
    const [sg, table] = await Promise.all([loadSellerGrade(DB, sellerId), loadGradeTable(DB)])  // 🏭 2026-06-07: 순차 await → 병렬(1 RTT 절약)
    const rows = await DB.prepare(`
      SELECT p.id, p.name, p.category, p.stock, COALESCE(p.supply_price,0) AS supply_price,
             COALESCE(p.min_order_qty,1) AS moq, COALESCE(p.order_multiple,1) AS order_multiple,
             p.supply_margin_override_pct AS margin_override
      FROM products p
      WHERE p.is_supply_product = 1 AND p.is_active = 1 AND p.supply_source_id IS NULL
        AND COALESCE(p.supply_price,0) > 0 AND ${visibilityWhere('p')}
      ORDER BY p.category, p.name LIMIT 10000
    `).bind(sellerId).all<{ id: number; name: string; category: string | null; stock: number; supply_price: number; moq: number; order_multiple: number; margin_override: number | null }>()
    const out = (rows.results || []).map(r => {
      const { price } = resolveDistributorPrice({ baseSupplyPrice: r.supply_price, grade: sg.distributor_grade, specialUntil: sg.special_discount_until, table, marginOverridePct: r.margin_override })
      return [r.id, r.name, r.category || '', r.stock, price, Math.max(1, r.moq || 1), Math.max(1, r.order_multiple || 1), ''] // 주문수량은 빈칸 — 유통사가 입력
    })
    return csvResponse(buildCsv(header, out), `wholesale-order-form-${new Date().toISOString().slice(0, 10)}.csv`)
  } catch (err) {
    return safeError(c, err, '주문 양식 생성 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── POST /orders/bulk-preview — 대량주문(엑셀/CSV) 검증·미리보기 (결제 X) ───────────
//   BIZ-9 (2026-06-09): 작성본 업로드 → 서버가 product_id 로 매칭 + MOQ/박스단위/재고 검증 →
//   유효 라인(카트에 담을 항목 + 등급 단가) + 오류행(사유) + subtotal 반환. 절대 청구하지 않음.
//   유효 라인은 클라가 도매 카트에 담아 기존 예치금 체크아웃(/wholesale/checkout)으로 결제.
const BULK_MAX_ROWS = 5000
app.post('/orders/bulk-preview', rateLimit({ action: 'wholesale-bulk-preview', max: 60, windowSec: 60 }), async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  // 👥 ADDITIVE 권한 게이트: 'viewer' 직원은 대량주문 미리보기(주문 흐름)도 차단. 그 외 영향 없음.
  const { subRole: bulkSubRole } = await subClaimsFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (bulkSubRole === 'viewer') return c.json({ success: false, error: '주문 권한이 없는 계정(뷰어)입니다' }, 403)
  const { DB } = c.env
  try {
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const rawItems = Array.isArray(body.items) ? body.items : Array.isArray(body.rows) ? body.rows : []
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return c.json({ success: false, error: '주문 항목이 없습니다' }, 400)
    }
    if (rawItems.length > BULK_MAX_ROWS) {
      return c.json({ success: false, error: `한 번에 처리 가능한 행은 최대 ${BULK_MAX_ROWS}개입니다 (현재 ${rawItems.length}개)`, code: 'TOO_MANY_ROWS' }, 400)
    }

    // 행 정규화 — product_id 로 합산(같은 상품 여러 줄). qty<=0/비숫자/blank 는 오류로 분류.
    type ErrRow = { row?: number; product_id?: number | null; name?: string; qty?: number; reason: string }
    const errors: ErrRow[] = []
    const reqMap = new Map<number, number>()
    const lineNoMap = new Map<number, number>() // product_id → 첫 등장 행번호(오류 표시용)
    rawItems.forEach((it: unknown, idx: number) => {
      const o = (it && typeof it === 'object') ? it as Record<string, unknown> : {}
      const pid = Math.floor(Number(o.product_id))
      const qty = Math.floor(Number(o.qty))
      const rowNo = Number.isFinite(Number(o.row)) ? Math.floor(Number(o.row)) : idx + 1
      if (!Number.isFinite(pid) || pid <= 0) {
        errors.push({ row: rowNo, product_id: null, reason: '상품코드(product_id)가 올바르지 않습니다' })
        return
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        errors.push({ row: rowNo, product_id: pid, qty: 0, reason: '주문수량이 비어있거나 0 이하입니다' })
        return
      }
      reqMap.set(pid, (reqMap.get(pid) || 0) + qty)
      if (!lineNoMap.has(pid)) lineNoMap.set(pid, rowNo)
    })

    const ids = [...reqMap.keys()]
    if (ids.length === 0) {
      return c.json({ success: true, items: [], subtotal: 0, matched: 0, error_count: errors.length, errors })
    }

    await ensureSupplyVisibilitySchema(DB)
    await ensureQtyConstraintSchema(DB)
    const [sg, table, minMarginPct] = await Promise.all([loadSellerGrade(DB, sellerId), loadGradeTable(DB), loadMinPlatformMarginPct(DB)])
    const placeholders = ids.map(() => '?').join(',')
    const prods = await DB.prepare(`
      SELECT p.id, p.name, p.image_url, p.supplier_id, p.stock, COALESCE(p.supply_price,0) AS supply_price,
             COALESCE(p.min_order_qty,1) AS moq, COALESCE(p.order_multiple,1) AS order_multiple,
             p.supply_margin_override_pct AS margin_override
      FROM products p
      WHERE p.id IN (${placeholders}) AND p.is_supply_product = 1 AND p.is_active = 1
        AND p.supply_source_id IS NULL AND COALESCE(p.supply_price,0) > 0
        AND ${visibilityWhere('p')}
    `).bind(...ids, sellerId).all<{ id: number; name: string; image_url: string | null; supplier_id: number | null; stock: number | null; supply_price: number; moq: number; order_multiple: number; margin_override: number | null }>()
    const found = new Map((prods.results || []).map(p => [p.id, p]))
    const tierMap = await loadQtyTiers(DB, ids)

    const items: Array<{ product_id: number; name: string; image_url: string | null; qty: number; unit_price: number; line_total: number; moq: number; order_multiple: number }> = []
    // 🚚 제조사별 min-order/배송비 계산용 라인(검증/표시 only — 청구 X). supplier_id 는 응답에 비노출.
    const previewLines: Array<{ supplier_id: number | null; line_total: number }> = []
    let subtotal = 0
    for (const pid of ids) {
      const qty = reqMap.get(pid) || 0
      const rowNo = lineNoMap.get(pid)
      const p = found.get(pid)
      if (!p) {
        errors.push({ row: rowNo, product_id: pid, qty, reason: '주문할 수 없는 상품입니다 (품절·중지·열람권한 없음)' })
        continue
      }
      const moq = Math.max(1, p.moq || 1)
      const orderMultiple = Math.max(1, p.order_multiple || 1)
      if (qty < moq) {
        errors.push({ row: rowNo, product_id: pid, name: p.name, qty, reason: `최소 주문 수량 ${moq}개 미만 (요청 ${qty}개)` })
        continue
      }
      if (orderMultiple > 1 && qty % orderMultiple !== 0) {
        errors.push({ row: rowNo, product_id: pid, name: p.name, qty, reason: `${orderMultiple}개 단위로만 주문 가능 (요청 ${qty}개)` })
        continue
      }
      if (p.stock != null && p.stock < qty) {
        errors.push({ row: rowNo, product_id: pid, name: p.name, qty, reason: `재고 부족 (재고 ${p.stock}개, 요청 ${qty}개)` })
        continue
      }
      // 등급 단가 → tier floor → 수량구간 할인 적용 (주문 생성과 동일 산식 — 표시 정합).
      const { price } = resolveDistributorPrice({ baseSupplyPrice: p.supply_price, grade: sg.distributor_grade, specialUntil: sg.special_discount_until, table, marginOverridePct: p.margin_override })
      const tierFloor = effectiveTierFloor(price, p.supply_price, minMarginPct)
      const unit = tierUnitPrice(price, qty, tierMap.get(pid), tierFloor)
      const lineTotal = unit * qty
      subtotal += lineTotal
      items.push({ product_id: pid, name: p.name, image_url: p.image_url, qty, unit_price: unit, line_total: lineTotal, moq, order_multiple: orderMultiple })
      previewLines.push({ supplier_id: p.supplier_id, line_total: lineTotal })
    }

    // 🚚 제조사별 최소주문금액 충족 여부 + 배송비 + 총 청구 예상액(결제 X). supplier_id 미노출(group key 만).
    const previewSupplierIds = previewLines.map((l) => l.supplier_id).filter((x): x is number => Number.isFinite(x as number) && (x as number) > 0)
    const previewPolicies = await loadSupplierPolicies(DB, previewSupplierIds)
    const previewShip = computeSupplierShipping(previewLines, previewPolicies)
    const shippingTotal = Math.max(0, Math.floor(previewShip.shippingTotal || 0))

    return c.json({
      success: true,
      items,
      subtotal,
      shipping_total: shippingTotal,
      grand_total: subtotal + shippingTotal,
      // 제조사별 최소주문금액/배송비 진행 상황 — UI 안내용(비식별 group key). meets_min=false 면 주문 불가.
      suppliers: previewShip.perSupplier.map((s) => ({
        supplier_group: s.supplier_group, subtotal: s.subtotal, min_order_amount: s.min_order_amount,
        meets_min: s.meets_min, shortfall: s.shortfall, shipping: s.shipping,
        free_ship_threshold: s.free_ship_threshold, free_ship_remaining: s.free_ship_remaining,
      })),
      all_min_met: previewShip.shortfalls.length === 0,
      matched: items.length,
      error_count: errors.length,
      errors: errors.slice(0, 500), // 응답 비대 방지 — 오류 500개 cap.
    })
  } catch (err) {
    return safeError(c, err, '주문서 미리보기 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── OEM/ODM 신청 (유통회원) — 스펙: 유통스타트가 제조사 찾기·연결·생산 지원 ──────────
import { ensureOemSchema } from './oem-requests'

// POST /oem-requests — OEM/ODM 신청
app.post('/oem-requests', rateLimit({ action: 'wholesale-oem', max: 20, windowSec: 3600 }), async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureOemSchema(DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const productName = String(body.product_name || '').trim().slice(0, 200)
    if (!productName) return c.json({ success: false, error: '제품명을 입력해주세요' }, 400)
    const kind = String(body.kind || 'OEM').toUpperCase() === 'ODM' ? 'ODM' : 'OEM'
    const category = body.category ? String(body.category).slice(0, 60) : null
    const note = body.note ? String(body.note).slice(0, 2000) : null
    const targetQty = Number.isFinite(Number(body.target_qty)) ? Math.max(0, Math.floor(Number(body.target_qty))) : null
    const targetPrice = Number.isFinite(Number(body.target_price)) ? Math.max(0, Math.floor(Number(body.target_price))) : null
    const ins = await DB.prepare(
      `INSERT INTO oem_requests (distributor_seller_id, kind, product_name, category, target_qty, target_price, note, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open')`
    ).bind(sellerId, kind, productName, category, targetQty, targetPrice, note).run()
    return c.json({ success: true, id: Number(ins.meta?.last_row_id), message: 'OEM/ODM 신청이 접수되었습니다. 유통스타트가 제조사를 매칭해 연락드립니다.' }, 201)
  } catch (err) {
    return safeError(c, err, 'OEM/ODM 신청 중 오류가 발생했습니다', '[wholesale]')
  }
})

// GET /oem-requests — 내 신청 목록
app.get('/oem-requests', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureOemSchema(DB)
    // 🔒 중개 룰: 제조사↔유통스타트↔유통사. 유통사에게 매칭 제조사 신원(이름/ID) 절대 비노출.
    //    매칭 여부(matched 1/0)만 반환 → UI 는 "제조사 매칭 완료"만 표시, 직접 컨택 차단.
    const { results } = await DB.prepare(`
      SELECT r.id, r.kind, r.product_name, r.category, r.target_qty, r.target_price, r.note,
             r.status, r.admin_memo, r.created_at, r.updated_at,
             CASE WHEN r.matched_supplier_id IS NOT NULL THEN 1 ELSE 0 END AS matched
      FROM oem_requests r
      WHERE r.distributor_seller_id = ? ORDER BY r.created_at DESC LIMIT 100
    `).bind(sellerId).all()
    return c.json({ success: true, requests: results ?? [] })
  } catch (err) {
    return safeError(c, err, 'OEM/ODM 신청 조회 중 오류가 발생했습니다', '[wholesale]')
  }
})

export { app as wholesaleRoutes }
