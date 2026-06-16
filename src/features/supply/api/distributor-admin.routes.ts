/**
 * 🏭 2026-06-01 유통스타트 도매몰 — 어드민 유통사 등급/마진 설정 API.
 * (docs/design/wholesale-utongstart.md, Phase 1b)
 *
 * - GET   /api/admin/distributor/grades              — 등급별 마진율 목록
 * - PUT   /api/admin/distributor/grades/:grade       — 등급 마진율/라벨/활성 수정
 * - GET   /api/admin/distributor/distributors?search= — 유통사(셀러) 검색 + 배정현황
 * - PATCH /api/admin/distributor/distributors/:id     — 유통사 등급 배정 + 특별할인 기간
 *
 * ⚠️ 도매몰 한정: distributor_grade 는 도매 카탈로그 가격 계산에서만 읽힘 — 일반 셀러 동작 불변.
 * 마운트: app.route('/api/admin/distributor', distributorAdminRoutes)
 */
import { Hono } from 'hono'
import { safeError } from '@/worker/utils/safe-error'
import type { Env } from '@/worker/types/env'
import { requireAdmin } from '@/worker/middleware/auth'
import { adminIpWhitelist, adminAuditMiddleware, writeAuditLog } from '@/worker/middleware/admin-security'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { swallow } from '@/worker/utils/swallow'
import { cancelTossPayment } from '@/worker/utils/toss-gateway'
import { reverseSupplierOnWholesaleRefund } from './wholesale-settlement'
import { ensureDepositSchema, refundDeposit, recordDepositTxn, hasDepositRefundTxn } from './wholesale-deposit-core'
import { ensureSupplyVisibilitySchema, normalizeVisibility } from './supply-visibility'
import { ensureOemSchema, normalizeOemStatus } from './oem-requests'
import { buildXlsx, xlsxResponse } from './xlsx'
import { distributorPriceFromRetail, marginForGrade, type GradeMargin } from '@/lib/distributor-pricing'
import { SUPPLY_CHANNELS, SUPPLY_CHANNEL_THRESHOLDS_KEY, parseChannelThresholds } from '@/shared/supply-channels'
import { ensureTaxDocSchema, splitVat, renderTaxDocHtml, type TaxDocRow } from './tax-documents'
import { isBarobillConfigured, issueBarobillTaxInvoice, type BarobillEnv } from '@/services/barobill'
import {
  evaluateWholesaleGrades,
  parseThresholds,
  DEFAULT_THRESHOLDS,
  AUTO_GRADE_ENABLED_KEY,
  AUTO_GRADE_THRESHOLDS_KEY,
  AUTO_GRADE_WINDOW_DAYS_KEY,
  AUTO_GRADE_LAST_RUN_KEY,
  type ThresholdRow,
} from '@/worker/cron/wholesale-grade-eval'
import { PLUS_FEE_KEY, DEFAULT_PLUS_ANNUAL_FEE } from './wholesale-plus.routes'

const app = new Hono<{ Bindings: Env }>()
// 🏭 2026-06-07 (보안 audit, 사용자 승인): 이 라우터는 adminApp 밖에 마운트돼 IP 화이트리스트·감사로그가
//   누락됐었음(환불/세금계산서 발행 등 민감 작업 포함). adminApp(worker/index.ts:278-280)과 동일 체인 적용.
//   adminIpWhitelist 는 ADMIN_IP_WHITELIST 미설정 시 fail-open(전체 허용)이라 잠김 위험 없음.
app.use('*', adminIpWhitelist())
app.use('*', requireAdmin())
app.use('*', adminAuditMiddleware())

const ASSIGNABLE = ['A', 'B', 'C', 'D', 'OEM'] // SPECIAL 은 직접 배정 X — 특별할인 기간으로만 적용

const _ensured = new WeakSet<object>()
async function ensureGrades(db: D1Database) {
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

// ── GET /grades ──────────────────────────────────────────────────────────────
app.get('/grades', async (c) => {
  try {
    await ensureGrades(c.env.DB)
    const { results } = await c.env.DB.prepare(
      `SELECT grade, label, margin_pct, sort_order, is_special, active, updated_at
       FROM distributor_grades ORDER BY sort_order ASC`
    ).all()
    return c.json({ success: true, grades: results ?? [] })
  } catch (err) {
    return safeError(c, err, '등급 조회 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// ── PUT /grades/:grade ───────────────────────────────────────────────────────
app.put('/grades/:grade', async (c) => {
  try {
    await ensureGrades(c.env.DB)
    const grade = c.req.param('grade').toUpperCase()
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const margin = Number(body.margin_pct)
    if (!Number.isFinite(margin) || margin < 0 || margin > 100) {
      return c.json({ success: false, error: '마진율은 0~100% 사이여야 합니다' }, 400)
    }
    const label = typeof body.label === 'string' ? body.label.slice(0, 40) : null
    const active = body.active === false ? 0 : 1
    // 변경 전 값 캡처 (감사로그 before).
    const prevGrade = await c.env.DB.prepare(
      'SELECT margin_pct, label, active FROM distributor_grades WHERE grade = ?'
    ).bind(grade).first<{ margin_pct: number; label: string | null; active: number }>().catch(() => null)
    const res = await c.env.DB.prepare(
      `UPDATE distributor_grades SET margin_pct=?, label=COALESCE(?,label), active=?, updated_at=datetime('now') WHERE grade=?`
    ).bind(margin, label, active, grade).run()
    if (!res.meta.changes) return c.json({ success: false, error: '존재하지 않는 등급입니다' }, 404)
    await writeAuditLog(c, {
      action: 'wholesale_grade_margin_change',
      targetType: 'distributor_grade',
      targetId: grade,
      before: { margin_pct: prevGrade?.margin_pct ?? null, label: prevGrade?.label ?? null, active: prevGrade?.active ?? null },
      after: { margin_pct: margin, label: label ?? prevGrade?.label ?? null, active },
    }).catch(() => { /* audit 실패해도 성공 처리 */ })
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '등급 수정 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// ── GET /distributors?search=&assigned=1 ─────────────────────────────────────
app.get('/distributors', async (c) => {
  try {
    const search = (c.req.query('search') || '').trim().slice(0, 60)
    const onlyAssigned = c.req.query('assigned') === '1'
    const binds: unknown[] = []
    let where = '1=1'
    if (onlyAssigned) where += ' AND s.distributor_grade IS NOT NULL'
    if (search) {
      where += ' AND (s.username LIKE ? OR s.name LIKE ? OR s.business_name LIKE ? OR s.email LIKE ?)'
      const like = `%${search}%`
      binds.push(like, like, like, like)
    }
    // 🏬 멀티-몰: ?mall_id= 가 주어지면 해당 몰만(옵션 — 기존 무필터 뷰 보존). mall name 도 join 해 표시.
    const mallQ = c.req.query('mall_id')
    if (mallQ != null && mallQ !== '') {
      const mid = Math.floor(Number(mallQ))
      if (Number.isFinite(mid) && mid > 0) { where += ' AND COALESCE(s.mall_id,1) = ?'; binds.push(mid) }
    }
    // 🏭 BIZ-2: 여신 컬럼 보강(없는 환경 self-heal) 후 함께 반환 — UI 가 한도/미수금/동결 인라인 표시.
    await ensureCreditSchemaAdmin(c.env.DB)
    const { results } = await c.env.DB.prepare(
      `SELECT s.id, s.username, s.name, s.business_name, s.email, s.seller_type, s.distributor_grade, s.special_discount_until,
              COALESCE(s.distributor_credit_limit,0) AS distributor_credit_limit,
              COALESCE(s.outstanding_balance,0) AS outstanding_balance,
              COALESCE(s.credit_frozen,0) AS credit_frozen,
              COALESCE(s.mall_id,1) AS mall_id, m.name AS mall_name
       FROM sellers s
       LEFT JOIN wholesale_malls m ON m.id = COALESCE(s.mall_id,1)
       WHERE ${where}
       ORDER BY (s.distributor_grade IS NOT NULL) DESC, s.id DESC LIMIT 100`
    ).bind(...binds).all()
    return c.json({ success: true, distributors: results ?? [] })
  } catch (err) {
    return safeError(c, err, '유통사 조회 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// ── PATCH /distributors/:id ──────────────────────────────────────────────────
app.patch('/distributors/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 유통사 ID' }, 400)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))

    // 등급: A/B/C/D/OEM 또는 해제(null/'')
    let grade: string | null = null
    if (body.distributor_grade !== null && body.distributor_grade !== '' && body.distributor_grade !== undefined) {
      const g = String(body.distributor_grade).toUpperCase()
      if (!ASSIGNABLE.includes(g)) {
        return c.json({ success: false, error: '등급은 A/B/C/D/OEM 또는 해제만 가능합니다' }, 400)
      }
      grade = g
    }

    // 특별할인 종료일: ISO 또는 null
    let special: string | null = null
    if (body.special_discount_until) {
      const d = new Date(String(body.special_discount_until))
      if (Number.isNaN(d.getTime())) return c.json({ success: false, error: '특별할인 종료일 형식 오류' }, 400)
      special = d.toISOString()
    }

    // 변경 전 값 캡처 (감사로그 before) — 전 주문 마진을 좌우하는 최고 레버리지라 추적 필수.
    const prevSeller = await c.env.DB.prepare(
      'SELECT distributor_grade, special_discount_until FROM sellers WHERE id = ?'
    ).bind(id).first<{ distributor_grade: string | null; special_discount_until: string | null }>().catch(() => null)
    const res = await c.env.DB.prepare(
      `UPDATE sellers SET distributor_grade=?, special_discount_until=?, updated_at=datetime('now') WHERE id=?`
    ).bind(grade, special, id).run()
    if (!res.meta.changes) return c.json({ success: false, error: '존재하지 않는 유통사입니다' }, 404)
    await writeAuditLog(c, {
      action: 'wholesale_distributor_grade_change',
      targetType: 'seller',
      targetId: String(id),
      before: { grade: prevSeller?.distributor_grade ?? null, special_discount_until: prevSeller?.special_discount_until ?? null },
      after: { grade, special_discount_until: special },
    }).catch(() => { /* audit 실패해도 성공 처리 */ })
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '유통사 등급 설정 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// ── BIZ-2 v1 (2026-06-08) 여신/외상(credit terms) 관리 ─────────────────────────
//   sellers 의 distributor_credit_limit / outstanding_balance / credit_frozen + 미수금 원장.
//   ⚠️ wholesale.routes ensureCreditSchema 와 동일 스키마 — cold isolate 대비 여기서도 멱등 보장.
const _creditEnsuredAdmin = new WeakSet<object>()
async function ensureCreditSchemaAdmin(DB: D1Database) {
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

// GET /distributors/:id/credit — 여신 한도/미수금/원장 (어드민 UI)
app.get('/distributors/:id/credit', async (c) => {
  try {
    await ensureCreditSchemaAdmin(c.env.DB)
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 유통사 ID' }, 400)
    const seller = await c.env.DB.prepare(
      'SELECT id, business_name, name, username, status, COALESCE(distributor_credit_limit,0) AS limit, COALESCE(outstanding_balance,0) AS outstanding, COALESCE(credit_frozen,0) AS frozen FROM sellers WHERE id = ?'
    ).bind(id).first<{ id: number; business_name: string | null; name: string | null; username: string | null; status: string | null; limit: number; outstanding: number; frozen: number }>()
    if (!seller) return c.json({ success: false, error: '존재하지 않는 유통사입니다' }, 404)
    const { results } = await c.env.DB.prepare(
      'SELECT id, order_id, type, amount, balance_after, memo, created_at FROM wholesale_credit_ledger WHERE distributor_seller_id = ? ORDER BY created_at DESC, id DESC LIMIT 100'
    ).bind(id).all().catch(() => ({ results: [] }))
    const available = Math.max(0, (seller.limit || 0) - (seller.outstanding || 0))
    return c.json({ success: true, credit: { ...seller, available }, ledger: results ?? [] })
  } catch (err) {
    return safeError(c, err, '여신 정보 조회 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// PATCH /distributors/:id/credit — 여신 한도 설정 + 동결 토글 (감사로그)
app.patch('/distributors/:id/credit', async (c) => {
  try {
    await ensureCreditSchemaAdmin(c.env.DB)
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 유통사 ID' }, 400)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const sets: string[] = []
    const params: (string | number)[] = []
    let nextLimit: number | undefined
    let nextFrozen: number | undefined
    if (body.distributor_credit_limit !== undefined) {
      const lim = Math.floor(Number(body.distributor_credit_limit))
      if (!Number.isFinite(lim) || lim < 0 || lim > 1_000_000_000) {
        return c.json({ success: false, error: '여신 한도는 0 이상 10억 이하여야 합니다' }, 400)
      }
      nextLimit = lim
      sets.push('distributor_credit_limit = ?'); params.push(lim)
    }
    if (body.credit_frozen !== undefined) {
      nextFrozen = body.credit_frozen === true || body.credit_frozen === 1 || body.credit_frozen === '1' ? 1 : 0
      sets.push('credit_frozen = ?'); params.push(nextFrozen)
    }
    if (!sets.length) return c.json({ success: false, error: '변경할 내용이 없습니다 (한도 또는 동결)' }, 400)

    const prev = await c.env.DB.prepare(
      'SELECT COALESCE(distributor_credit_limit,0) AS limit, COALESCE(credit_frozen,0) AS frozen FROM sellers WHERE id = ?'
    ).bind(id).first<{ limit: number; frozen: number }>().catch(() => null)
    sets.push("updated_at = datetime('now')")
    const res = await c.env.DB.prepare(`UPDATE sellers SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id).run()
    if (!res.meta.changes) return c.json({ success: false, error: '존재하지 않는 유통사입니다' }, 404)
    await writeAuditLog(c, {
      action: 'wholesale_credit_terms_change',
      targetType: 'seller',
      targetId: String(id),
      before: { credit_limit: prev?.limit ?? null, credit_frozen: prev?.frozen ?? null },
      after: { credit_limit: nextLimit ?? prev?.limit ?? null, credit_frozen: nextFrozen ?? prev?.frozen ?? null },
    }).catch(() => { /* audit 실패해도 성공 처리 */ })
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '여신 설정 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// POST /distributors/:id/credit-repayment — 미수금 상환 기록 (outstanding 차감 + 원장 + 감사)
//   v1 수동. (월별 자동 청구서/명세 + 연체 자동 동결 cron = 향후 follow-up.)
app.post('/distributors/:id/credit-repayment', rateLimit({ action: 'admin-credit-repayment', max: 30, windowSec: 60 }), async (c) => {
  try {
    await ensureCreditSchemaAdmin(c.env.DB)
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 유통사 ID' }, 400)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const amount = Math.floor(Number(body.amount))
    if (!Number.isFinite(amount) || amount <= 0) return c.json({ success: false, error: '상환 금액이 올바르지 않습니다' }, 400)
    const memo = typeof body.memo === 'string' ? body.memo.slice(0, 200) : null

    const seller = await c.env.DB.prepare(
      'SELECT COALESCE(outstanding_balance,0) AS outstanding FROM sellers WHERE id = ?'
    ).bind(id).first<{ outstanding: number }>()
    if (!seller) return c.json({ success: false, error: '존재하지 않는 유통사입니다' }, 404)
    const prevOut = Math.max(0, seller.outstanding || 0)
    // 미수금 초과 상환은 잔액까지만(clamp ≥0). 실제 차감액 = min(amount, prevOut).
    const applied = Math.min(amount, prevOut)
    const newOut = prevOut - applied

    const batch = await c.env.DB.batch([
      c.env.DB.prepare("UPDATE sellers SET outstanding_balance = ?, updated_at = datetime('now') WHERE id = ?").bind(newOut, id),
      c.env.DB.prepare(
        "INSERT INTO wholesale_credit_ledger (distributor_seller_id, order_id, type, amount, balance_after, memo) VALUES (?, NULL, 'repayment', ?, ?, ?)"
      ).bind(id, applied, newOut, memo || `미수금 상환 ${applied.toLocaleString('ko-KR')}원`),
    ])
    if ((batch[0]?.meta?.changes ?? 0) === 0) return c.json({ success: false, error: '상환 처리에 실패했습니다' }, 500)
    await writeAuditLog(c, {
      action: 'wholesale_credit_repayment',
      targetType: 'seller',
      targetId: String(id),
      before: { outstanding_balance: prevOut },
      after: { outstanding_balance: newOut, repaid: applied, requested: amount },
    }).catch(() => { /* audit 실패해도 성공 처리 */ })
    return c.json({ success: true, repaid: applied, outstanding: newOut })
  } catch (err) {
    return safeError(c, err, '미수금 상환 처리 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// ── 상품제안 (어드민 → 유통사) ────────────────────────────────────────────────
async function ensureProposals(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS wholesale_proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT, distributor_seller_id INTEGER NOT NULL, product_id INTEGER NOT NULL,
    note TEXT, status TEXT NOT NULL DEFAULT 'active', created_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(swallow('distributor-admin:ensure-proposals'))
}

// POST /proposals — 제안 생성
app.post('/proposals', async (c) => {
  try {
    await ensureProposals(c.env.DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const sellerId = Number(body.distributor_seller_id)
    const productId = Number(body.product_id)
    const note = typeof body.note === 'string' ? body.note.slice(0, 200) : null
    if (!Number.isFinite(sellerId) || sellerId <= 0 || !Number.isFinite(productId) || productId <= 0) {
      return c.json({ success: false, error: '유통사와 상품을 선택해주세요' }, 400)
    }
    // 상품이 도매 상품인지 확인.
    const prod = await c.env.DB.prepare(
      "SELECT 1 FROM products WHERE id = ? AND is_supply_product = 1 AND supply_source_id IS NULL"
    ).bind(productId).first()
    if (!prod) return c.json({ success: false, error: '도매 상품이 아닙니다' }, 400)
    await c.env.DB.prepare(
      "INSERT INTO wholesale_proposals (distributor_seller_id, product_id, note, status) VALUES (?, ?, ?, 'active')"
    ).bind(sellerId, productId, note).run()
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '제안 생성 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// GET /proposals?seller_id= — 제안 목록
app.get('/proposals', async (c) => {
  try {
    await ensureProposals(c.env.DB)
    const sellerId = Number(c.req.query('seller_id'))
    const binds: unknown[] = []
    let where = "wp.status = 'active'"
    if (Number.isFinite(sellerId) && sellerId > 0) { where += ' AND wp.distributor_seller_id = ?'; binds.push(sellerId) }
    const { results } = await c.env.DB.prepare(`
      SELECT wp.id, wp.distributor_seller_id, wp.note, wp.created_at, p.name AS product_name, p.id AS product_id
      FROM wholesale_proposals wp JOIN products p ON p.id = wp.product_id
      WHERE ${where} ORDER BY wp.created_at DESC LIMIT 200
    `).bind(...binds).all()
    return c.json({ success: true, proposals: results ?? [] })
  } catch (err) {
    return safeError(c, err, '제안 조회 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// DELETE /proposals/:id — 제안 철회
app.delete('/proposals/:id', async (c) => {
  try {
    await ensureProposals(c.env.DB)
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 ID' }, 400)
    await c.env.DB.prepare("UPDATE wholesale_proposals SET status = 'withdrawn' WHERE id = ?").bind(id).run()
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '제안 철회 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// ── GET /tax-summary?month=YYYY-MM — 세금계산서 집계 (1차 수동 발행 참고) ───────
//   유통스타트→유통사 매출(유통사별 매입합) + 제조사→유통스타트 매입(제조사별 정산합).
app.get('/tax-summary', async (c) => {
  try {
    const month = (c.req.query('month') || '').slice(0, 7)
    const m = /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7)

    const byDistributor = await c.env.DB.prepare(`
      SELECT o.distributor_seller_id AS seller_id, s.business_name, s.name,
             COUNT(*) AS order_count, COALESCE(SUM(MAX(0, o.subtotal - COALESCE(o.refunded_amount,0))),0) AS sales_total
      FROM wholesale_orders o LEFT JOIN sellers s ON s.id = o.distributor_seller_id
      WHERE o.status IN ('PAID','SHIPPED','PARTIAL_REFUNDED') AND strftime('%Y-%m', COALESCE(o.paid_at, o.created_at)) = ?
      GROUP BY o.distributor_seller_id ORDER BY sales_total DESC
    `).bind(m).all().catch(() => ({ results: [] }))

    const bySupplier = await c.env.DB.prepare(`
      SELECT i.supplier_id, sup.business_name,
             COALESCE(SUM(i.base_supply_price * i.qty),0) AS purchase_total, COUNT(DISTINCT i.wholesale_order_id) AS order_count
      FROM wholesale_order_items i
      JOIN wholesale_orders o ON o.id = i.wholesale_order_id
      LEFT JOIN suppliers sup ON sup.id = i.supplier_id
      WHERE o.status IN ('PAID','SHIPPED','PARTIAL_REFUNDED') AND strftime('%Y-%m', COALESCE(o.paid_at, o.created_at)) = ?
        AND i.line_status != 'REFUNDED'
      GROUP BY i.supplier_id ORDER BY purchase_total DESC
    `).bind(m).all().catch(() => ({ results: [] }))

    return c.json({ success: true, month: m, by_distributor: byDistributor.results ?? [], by_supplier: bySupplier.results ?? [] })
  } catch (err) {
    return safeError(c, err, '세금 집계 조회 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// ── 도매주문 모니터 (어드민 오버사이트) ───────────────────────────────────────
// GET /orders?status=&search=&page= — 전체 B2B 도매 주문
app.get('/orders', async (c) => {
  try {
    const status = (c.req.query('status') || '').toUpperCase()
    const search = (c.req.query('search') || '').trim().slice(0, 60)
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
    const limit = Math.min(parseInt(c.req.query('limit') || '30', 10), 100)
    const offset = (page - 1) * limit
    const VALID = ['PENDING', 'PAID', 'ON_CREDIT', 'SHIPPED', 'PARTIAL_REFUNDED', 'REFUNDED', 'FAILED']
    const binds: unknown[] = []
    let where = '1=1'
    if (VALID.includes(status)) { where += ' AND o.status = ?'; binds.push(status) }
    if (search) { where += ' AND (s.business_name LIKE ? OR s.name LIKE ? OR s.username LIKE ?)'; const l = `%${search}%`; binds.push(l, l, l) }
    const { results } = await c.env.DB.prepare(`
      SELECT o.id, o.distributor_seller_id, o.status, o.grade, o.subtotal, o.supply_total, o.margin_total,
             o.refunded_amount, o.created_at, o.paid_at,
             s.business_name, s.name AS seller_name, s.username,
             (SELECT COUNT(*) FROM wholesale_order_items wi WHERE wi.wholesale_order_id = o.id) AS item_count
      FROM wholesale_orders o LEFT JOIN sellers s ON s.id = o.distributor_seller_id
      WHERE ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?
    `).bind(...binds, limit, offset).all().catch(() => ({ results: [] }))
    const totalRow = await c.env.DB.prepare(`SELECT COUNT(*) AS c FROM wholesale_orders o LEFT JOIN sellers s ON s.id = o.distributor_seller_id WHERE ${where}`)
      .bind(...binds).first<{ c: number }>().catch(() => ({ c: 0 }))
    return c.json({ success: true, orders: results ?? [], total: totalRow?.c ?? 0, page, limit })
  } catch (err) {
    return safeError(c, err, '도매주문 조회 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// GET /orders/:id — 주문 상세 (라인별 제조사/금액)
app.get('/orders/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 주문 ID' }, 400)
    const order = await c.env.DB.prepare(`
      SELECT o.*, s.business_name, s.name AS seller_name, s.username
      FROM wholesale_orders o LEFT JOIN sellers s ON s.id = o.distributor_seller_id WHERE o.id = ?
    `).bind(id).first()
    if (!order) return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404)
    const { results } = await c.env.DB.prepare(`
      SELECT i.product_id, i.name, i.qty, i.base_supply_price, i.distributor_unit_price, i.line_total,
             i.line_status, i.courier, i.tracking_number, i.supplier_id, sup.business_name AS supplier_name
      FROM wholesale_order_items i LEFT JOIN suppliers sup ON sup.id = i.supplier_id
      WHERE i.wholesale_order_id = ?
    `).bind(id).all().catch(() => ({ results: [] }))
    return c.json({ success: true, order, items: results ?? [] })
  } catch (err) {
    return safeError(c, err, '주문 조회 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// POST /orders/:id/refund — 어드민 강제 전액 환불 (분쟁/멈춘 주문 개입)
app.post('/orders/:id/refund', rateLimit({ action: 'admin-wholesale-refund', max: 20, windowSec: 60 }), async (c) => {
  try {
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 주문 ID' }, 400)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const reason = String(body.reason || '관리자 환불').slice(0, 100)

    const order = await c.env.DB.prepare(
      'SELECT id, distributor_seller_id, status, payment_key, subtotal, COALESCE(shipping_total,0) AS shipping_total, refunded_amount FROM wholesale_orders WHERE id = ?'
    ).bind(id).first<{ id: number; distributor_seller_id: number; status: string; payment_key: string | null; subtotal: number; shipping_total: number; refunded_amount: number }>()
    if (!order) return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404)
    if (order.status === 'REFUNDED') return c.json({ success: true, already: true })
    if (!['PAID', 'SHIPPED', 'PARTIAL_REFUNDED'].includes(order.status) || !order.payment_key) {
      return c.json({ success: false, error: '환불할 수 없는 주문 상태입니다' }, 400)
    }
    // 남은 환불 가능액 = (상품합 + 배송비) - 이미 환불액. (감사 🔴#2: 청구액=subtotal+shipping 전액 환불)
    const remaining = Math.max(0, (order.subtotal || 0) + (order.shipping_total || 0) - (order.refunded_amount || 0))
    if (remaining <= 0) return c.json({ success: false, error: '환불할 잔액이 없습니다' }, 400)
    const isDeposit = order.payment_key === 'deposit'

    // CAS claim — PAID/SHIPPED/PARTIAL_REFUNDED → REFUNDED. changes=0 이면 이미 처리됨(멱등).
    const claim = await c.env.DB.prepare(
      "UPDATE wholesale_orders SET status='REFUNDED', refunded_amount = subtotal + COALESCE(shipping_total,0) WHERE id = ? AND status IN ('PAID','SHIPPED','PARTIAL_REFUNDED')"
    ).bind(id).run()
    if ((claim.meta?.changes ?? 0) === 0) return c.json({ success: true, already: true })

    if (isDeposit) {
      // 💰 예치금 주문 — Toss 미경유. 잔액 복원(원자 +) + refund 원장(ref_id=order.id 멱등 가드).
      await ensureDepositSchema(c.env.DB)
      const already = await hasDepositRefundTxn(c.env.DB, id)
      if (!already) {
        const bal = await refundDeposit(c.env.DB, order.distributor_seller_id, remaining)
        await recordDepositTxn(c.env.DB, order.distributor_seller_id, 'refund', remaining, bal, String(id), `관리자 환불 #${id} (${reason})`)
      }
    } else {
      // 레거시 Toss 주문 — 기존 cancelTossPayment 경로 유지.
      const res = await cancelTossPayment({
        env: c.env, paymentKey: order.payment_key, cancelReason: reason,
        cancelAmount: remaining, idempotencyKey: `whs-admin-refund-${id}`,
      })
      if (!res.ok) {
        // 롤백.
        await c.env.DB.prepare("UPDATE wholesale_orders SET status='PAID', refunded_amount=? WHERE id=? AND status='REFUNDED'")
          .bind(order.refunded_amount || 0, id).run().catch(swallow('admin:refund-rollback'))
        return c.json({ success: false, error: res.message || '환불 처리에 실패했습니다', code: res.code }, 402)
      }
    }

    // 남은 모든 라인 REFUNDED + 정산 역전(전체) + 재고복원.
    //   ⚠️ 재고는 '이번에 새로 환불되는 라인'만 복원 — 제조사가 이미 부분환불해 재고 복원된 라인을
    //   중복 복원하지 않도록(이중 복원 버그 방지). UPDATE 전에 미환불 라인을 먼저 캡처.
    const newLines = await c.env.DB.prepare(
      "SELECT product_id, qty FROM wholesale_order_items WHERE wholesale_order_id = ? AND line_status != 'REFUNDED'"
    ).bind(id).all<{ product_id: number; qty: number }>().catch(() => ({ results: [] as { product_id: number; qty: number }[] }))
    await c.env.DB.prepare("UPDATE wholesale_order_items SET line_status='REFUNDED' WHERE wholesale_order_id = ? AND line_status != 'REFUNDED'").bind(id).run().catch(swallow('admin:refund-line-update'))
    try { await reverseSupplierOnWholesaleRefund(c.env.DB, id, reason) } catch { /* best-effort */ }
    for (const l of newLines.results || []) {
      await c.env.DB.prepare(
        "UPDATE products SET stock = COALESCE(stock,0) + ?, sold_count = MAX(0, COALESCE(sold_count,0) - ?), updated_at = datetime('now') WHERE id = ? AND stock IS NOT NULL"
      ).bind(l.qty, l.qty, l.product_id).run().catch(swallow('admin:refund-stock-restore'))
    }
    return c.json({ success: true, refunded_amount: remaining })
  } catch (err) {
    return safeError(c, err, '환불 처리 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// ── 공급 범위(유통채널 선별) 관리 — 스펙: 유통스타트 유통채널 공급 → 유통회원 선정/삭제 ──────

// PATCH /products/:id/visibility — 상품 공급 범위 설정 (ALL/APPROVED_CHANNEL/UTONGSTART_ONLY)
app.patch('/products/:id/visibility', async (c) => {
  try {
    await ensureSupplyVisibilitySchema(c.env.DB)
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 상품 ID' }, 400)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const vis = normalizeVisibility(body.supply_visibility)
    const res = await c.env.DB.prepare(
      "UPDATE products SET supply_visibility = ?, updated_at = datetime('now') WHERE id = ? AND is_supply_product = 1 AND supply_source_id IS NULL"
    ).bind(vis, id).run()
    if (!res.meta.changes) return c.json({ success: false, error: '도매 상품을 찾을 수 없습니다' }, 404)
    return c.json({ success: true, supply_visibility: vis })
  } catch (err) {
    return safeError(c, err, '공급 범위 설정 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// GET /product-access?product_id= — 해당 상품에 선정된 유통회원 목록 + 상품 가시성
app.get('/product-access', async (c) => {
  try {
    await ensureSupplyVisibilitySchema(c.env.DB)
    const productId = Number(c.req.query('product_id'))
    if (!Number.isFinite(productId) || productId <= 0) return c.json({ success: false, error: '상품을 선택해주세요' }, 400)
    const prod = await c.env.DB.prepare(
      "SELECT id, name, COALESCE(supply_visibility,'ALL') AS supply_visibility FROM products WHERE id = ? AND is_supply_product = 1"
    ).bind(productId).first<{ id: number; name: string; supply_visibility: string }>()
    if (!prod) return c.json({ success: false, error: '도매 상품을 찾을 수 없습니다' }, 404)
    const { results } = await c.env.DB.prepare(`
      SELECT pda.id, pda.distributor_seller_id, pda.created_at,
             s.business_name, s.name AS seller_name, s.username, s.distributor_grade
      FROM product_distributor_access pda LEFT JOIN sellers s ON s.id = pda.distributor_seller_id
      WHERE pda.product_id = ? ORDER BY pda.created_at DESC
    `).bind(productId).all()
    return c.json({ success: true, product: prod, distributors: results ?? [] })
  } catch (err) {
    return safeError(c, err, '선정 유통회원 조회 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// POST /product-access — 유통회원 선정 (허용목록 추가)
app.post('/product-access', async (c) => {
  try {
    await ensureSupplyVisibilitySchema(c.env.DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const productId = Number(body.product_id)
    const sellerId = Number(body.distributor_seller_id)
    if (!Number.isFinite(productId) || productId <= 0 || !Number.isFinite(sellerId) || sellerId <= 0) {
      return c.json({ success: false, error: '상품과 유통회원을 선택해주세요' }, 400)
    }
    const prod = await c.env.DB.prepare(
      "SELECT 1 FROM products WHERE id = ? AND is_supply_product = 1 AND supply_source_id IS NULL"
    ).bind(productId).first()
    if (!prod) return c.json({ success: false, error: '도매 상품이 아닙니다' }, 400)
    const seller = await c.env.DB.prepare('SELECT 1 FROM sellers WHERE id = ?').bind(sellerId).first()
    if (!seller) return c.json({ success: false, error: '존재하지 않는 유통회원입니다' }, 400)
    const adminId = Number(((c.get as (k: string) => unknown)('user') as { id?: number } | undefined)?.id) || null
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO product_distributor_access (product_id, distributor_seller_id, granted_by) VALUES (?, ?, ?)'
    ).bind(productId, sellerId, adminId).run()
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '유통회원 선정 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// DELETE /product-access/:id — 선정 해제
app.delete('/product-access/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 ID' }, 400)
    await c.env.DB.prepare('DELETE FROM product_distributor_access WHERE id = ?').bind(id).run()
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '선정 해제 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// GET /price-history?product_id= — 공급가 수정 이력 (관리자만 — 스펙: 수정 전 금액 기록)
app.get('/price-history', async (c) => {
  try {
    await ensureSupplyVisibilitySchema(c.env.DB)
    const productId = Number(c.req.query('product_id'))
    if (!Number.isFinite(productId) || productId <= 0) return c.json({ success: false, error: '상품을 선택해주세요' }, 400)
    const { results } = await c.env.DB.prepare(`
      SELECT id, product_id, supplier_id, old_supply_price, new_supply_price, changed_by, created_at
      FROM supply_price_history WHERE product_id = ? ORDER BY created_at DESC LIMIT 100
    `).bind(productId).all()
    return c.json({ success: true, history: results ?? [] })
  } catch (err) {
    return safeError(c, err, '공급가 이력 조회 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// ── OEM/ODM 신청 관리 (어드민) — 제조사 매칭/상태 관리 ─────────────────────────

// GET /oem-requests?status= — 신청 목록
app.get('/oem-requests', async (c) => {
  try {
    await ensureOemSchema(c.env.DB)
    const status = normalizeOemStatus(c.req.query('status'))
    const binds: unknown[] = []
    let where = '1=1'
    if (status) { where += ' AND r.status = ?'; binds.push(status) }
    const { results } = await c.env.DB.prepare(`
      SELECT r.id, r.distributor_seller_id, r.kind, r.product_name, r.category, r.target_qty, r.target_price,
             r.note, r.status, r.admin_memo, r.matched_supplier_id, r.created_at, r.updated_at,
             s.business_name AS distributor_business_name, s.name AS distributor_name, s.username,
             sup.business_name AS matched_supplier_name
      FROM oem_requests r
      LEFT JOIN sellers s ON s.id = r.distributor_seller_id
      LEFT JOIN suppliers sup ON sup.id = r.matched_supplier_id
      WHERE ${where} ORDER BY r.created_at DESC LIMIT 200
    `).bind(...binds).all()
    return c.json({ success: true, requests: results ?? [] })
  } catch (err) {
    return safeError(c, err, 'OEM/ODM 신청 조회 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// PATCH /oem-requests/:id — 상태/메모/매칭 제조사 갱신
app.patch('/oem-requests/:id', async (c) => {
  try {
    await ensureOemSchema(c.env.DB)
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 ID' }, 400)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const sets: string[] = []
    const params: (string | number | null)[] = []
    if (body.status !== undefined) {
      const st = normalizeOemStatus(body.status)
      if (!st) return c.json({ success: false, error: '잘못된 상태값입니다' }, 400)
      sets.push('status = ?'); params.push(st)
    }
    if (typeof body.admin_memo === 'string') { sets.push('admin_memo = ?'); params.push(body.admin_memo.slice(0, 2000)) }
    if (body.matched_supplier_id !== undefined) {
      const sup = body.matched_supplier_id === null || body.matched_supplier_id === '' ? null : Number(body.matched_supplier_id)
      if (sup !== null && (!Number.isFinite(sup) || sup <= 0)) return c.json({ success: false, error: '잘못된 제조사 ID' }, 400)
      if (sup !== null) {
        const exists = await c.env.DB.prepare('SELECT 1 FROM suppliers WHERE id = ?').bind(sup).first()
        if (!exists) return c.json({ success: false, error: '존재하지 않는 제조사입니다' }, 400)
      }
      sets.push('matched_supplier_id = ?'); params.push(sup)
    }
    if (!sets.length) return c.json({ success: false, error: '변경할 내용이 없습니다' }, 400)
    sets.push("updated_at = datetime('now')")
    const res = await c.env.DB.prepare(`UPDATE oem_requests SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id).run()
    if (!res.meta.changes) return c.json({ success: false, error: '신청을 찾을 수 없습니다' }, 404)
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, 'OEM/ODM 신청 처리 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// GET /products/export — 상품정보 엑셀(CSV) 다운로드 (등급별 공급가 A/B/C 컬럼 — 유통채널 제안용)
app.get('/products/export', async (c) => {
  try {
    await ensureSupplyVisibilitySchema(c.env.DB)
    const gradesRes = await c.env.DB.prepare('SELECT grade, margin_pct, is_special FROM distributor_grades WHERE active = 1')
      .all<{ grade: string; margin_pct: number; is_special: number }>().catch(() => ({ results: [] as { grade: string; margin_pct: number; is_special: number }[] }))
    const table: GradeMargin[] = (gradesRes.results || []).map(r => ({ grade: r.grade, margin_pct: r.margin_pct, is_special: !!r.is_special }))
    const rows = await c.env.DB.prepare(`
      SELECT p.id, p.name, p.category, p.stock, p.barcode, COALESCE(p.supply_visibility,'ALL') AS supply_visibility,
             COALESCE(p.supply_price,0) AS supply_price, COALESCE(p.price,0) AS retail_price, p.supply_margin_override_pct AS margin_override, sup.business_name AS supplier_name
      FROM products p LEFT JOIN suppliers sup ON sup.id = p.supplier_id
      WHERE p.is_supply_product = 1 AND p.supply_source_id IS NULL
      ORDER BY p.created_at DESC LIMIT 10000
    `).all<{ id: number; name: string; category: string | null; stock: number; barcode: string | null; supply_visibility: string; supply_price: number; retail_price: number; margin_override: number | null; supplier_name: string | null }>()
    const out = (rows.results || []).map(r => {
      // 상품별 마진 override(고정) 설정 시 등급 무관 동일가 — A/B/C 컬럼 모두 override 가로 표기.
      const ovSet = r.margin_override != null && Number.isFinite(Number(r.margin_override)) && Number(r.margin_override) >= 0
      const effMargin = (g: string) => (ovSet ? Number(r.margin_override) : marginForGrade(g, table))
      // 🆕 2026-06-16 신모델: 공급가 = max(원가, 판매가×(1−보장마진%)).
      return [
        r.id, r.name, r.supplier_name || '', r.category || '', r.stock, r.barcode || '', r.supply_visibility, r.supply_price,
        distributorPriceFromRetail(r.retail_price, r.supply_price, effMargin('A')),
        distributorPriceFromRetail(r.retail_price, r.supply_price, effMargin('B')),
        distributorPriceFromRetail(r.retail_price, r.supply_price, effMargin('C')),
        ovSet ? `${Number(r.margin_override)}%` : '',
      ]
    })
    const headers = ['product_id', '상품명', '제조사', '카테고리', '재고', '바코드', '공급범위', '제조사공급가', 'A등급가', 'B등급가', 'C등급가', '상품별마진override']
    return xlsxResponse(buildXlsx(headers, out), `supply-products-${new Date().toISOString().slice(0, 10)}.xlsx`)
  } catch (err) {
    return safeError(c, err, '상품 내보내기 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// PATCH /products/:id/margin-override — 상품별 등급마진 override 설정/해제 (관리자, 사용자 확정 2026-06-04)
//   body: { margin_pct: number|null }. null/빈값 = 해제(등급별 마진 복귀). 설정 시 등급 무관 동일가.
//   ⚠️ 가격(구매자 결제액) 직결 — wholesale.routes 의 서버 재계산이 같은 컬럼을 읽어 일괄 반영.
app.patch('/products/:id/margin-override', async (c) => {
  try {
    await ensureSupplyVisibilitySchema(c.env.DB)
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 상품 ID' }, 400)
    const body = await c.req.json<{ margin_pct?: number | string | null }>().catch(() => ({} as { margin_pct?: number | string | null }))
    let val: number | null = null
    if (body.margin_pct != null && String(body.margin_pct).trim() !== '') {
      const m = Number(body.margin_pct)
      if (!Number.isFinite(m) || m < 0 || m > 500) return c.json({ success: false, error: '마진율은 0~500(%) 사이여야 합니다' }, 400)
      val = Math.round(m * 100) / 100
    }
    // 공급상품 원본(supplier 직등록)만 대상 — 셀러 복제본/일반상품 제외.
    //   변경 전 override 값도 함께 캡처 (감사로그 before).
    const prod = await c.env.DB.prepare(
      "SELECT id, supply_margin_override_pct FROM products WHERE id = ? AND is_supply_product = 1 AND supply_source_id IS NULL"
    ).bind(id).first<{ id: number; supply_margin_override_pct: number | null }>().catch(() => null)
    if (!prod) return c.json({ success: false, error: '공급상품을 찾을 수 없습니다' }, 404)
    await c.env.DB.prepare(
      "UPDATE products SET supply_margin_override_pct = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(val, id).run()
    await writeAuditLog(c, {
      action: 'wholesale_margin_override_change',
      targetType: 'product',
      targetId: String(id),
      before: { supply_margin_override_pct: prod.supply_margin_override_pct ?? null },
      after: { supply_margin_override_pct: val },
    }).catch(() => { /* audit 실패해도 성공 처리 */ })
    return c.json({ success: true, product_id: id, margin_override_pct: val })
  } catch (err) {
    return safeError(c, err, '상품별 마진 설정 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// 플랫폼(유통스타트) 사업자정보 — 전자세금계산서(바로빌) 발행에 필요. platform_settings 저장.
const COMPANY_KEYS = ['company_business_number', 'company_name', 'company_ceo', 'company_address', 'company_biz_type', 'company_biz_class', 'company_email', 'company_tel'] as const

app.get('/company-info', async (c) => {
  try {
    const ph = COMPANY_KEYS.map(() => '?').join(',')
    const { results } = await c.env.DB.prepare(`SELECT key, value FROM platform_settings WHERE key IN (${ph})`)
      .bind(...COMPANY_KEYS).all<{ key: string; value: string }>().catch(() => ({ results: [] as { key: string; value: string }[] }))
    const company: Record<string, string> = {}
    for (const r of results || []) company[r.key] = r.value
    return c.json({ success: true, company })
  } catch (err) {
    return safeError(c, err, '사업자정보 조회 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

app.put('/company-info', async (c) => {
  try {
    const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>))
    // 형식 검증 — 세금계산서 다운스트림 깨짐 방지. (값이 있을 때만 검사)
    const bizNum = body.company_business_number != null ? String(body.company_business_number).trim() : null
    if (bizNum && !/^\d{3}-?\d{2}-?\d{5}$/.test(bizNum)) {
      return c.json({ success: false, error: '사업자등록번호 형식 오류 (000-00-00000)' }, 400)
    }
    const email = body.company_email != null ? String(body.company_email).trim() : null
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return c.json({ success: false, error: '이메일 형식 오류' }, 400)
    }
    const stmts = COMPANY_KEYS.filter(k => k in body).map(k =>
      c.env.DB.prepare(
        `INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
      ).bind(k, String(body[k] ?? '').slice(0, 200)))
    if (stmts.length) await c.env.DB.batch(stmts)
    return c.json({ success: true, saved: stmts.length })
  } catch (err) {
    return safeError(c, err, '사업자정보 저장 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// 🏭 2026-06-12 (영업단 제안): 공급 채널 안내 기준 — 채널별 임계 공급률(%) 조회/저장.
//   제조사 등록 폼의 "제안 가능 유통채널" 안내에 사용. 표시 전용(결제가/visibility 무영향).
//   임계값 하드코딩 금지 룰 — platform_settings 저장, 영업단(어드민)이 조정.
app.get('/channel-thresholds', async (c) => {
  try {
    const row = await c.env.DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
      .bind(SUPPLY_CHANNEL_THRESHOLDS_KEY).first<{ value: string }>().catch(() => null)
    return c.json({ success: true, thresholds: parseChannelThresholds(row?.value), is_default: !row })
  } catch (err) {
    return safeError(c, err, '채널 기준 조회 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

app.put('/channel-thresholds', async (c) => {
  try {
    const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>))
    const next: Record<string, number> = {}
    for (const ch of SUPPLY_CHANNELS) {
      const v = Number(body[ch.key])
      if (!Number.isFinite(v) || v < 1 || v > 100) {
        return c.json({ success: false, error: `${ch.label} 임계 공급률은 1~100 사이여야 합니다` }, 400)
      }
      next[ch.key] = Math.round(v * 10) / 10
    }
    await c.env.DB.prepare(
      `INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    ).bind(SUPPLY_CHANNEL_THRESHOLDS_KEY, JSON.stringify(next)).run()
    return c.json({ success: true, thresholds: next })
  } catch (err) {
    return safeError(c, err, '채널 기준 저장 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// GET/PUT /products/:id/qty-tiers — 수량 구간 할인(volume tier) 조회/일괄설정 (관리자, 2026-06-04)
//   tier = 등급가 위에 "min_qty 이상 구매 시 discount_pct% 추가 할인". 전체 교체(replace).
//   ⚠️ 결제액 직결 — wholesale.routes /orders 가 같은 tier 를 읽어 authoritative 단가 재계산.
app.get('/products/:id/qty-tiers', async (c) => {
  try {
    await ensureSupplyVisibilitySchema(c.env.DB)
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 상품 ID' }, 400)
    const { results } = await c.env.DB.prepare(
      'SELECT min_qty, discount_pct FROM product_qty_tiers WHERE product_id = ? ORDER BY min_qty ASC'
    ).bind(id).all<{ min_qty: number; discount_pct: number }>()
    return c.json({ success: true, tiers: results || [] })
  } catch (err) {
    return safeError(c, err, '수량 구간 조회 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

app.put('/products/:id/qty-tiers', async (c) => {
  try {
    await ensureSupplyVisibilitySchema(c.env.DB)
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 상품 ID' }, 400)
    const prod = await c.env.DB.prepare(
      "SELECT id FROM products WHERE id = ? AND is_supply_product = 1 AND supply_source_id IS NULL"
    ).bind(id).first<{ id: number }>().catch(() => null)
    if (!prod) return c.json({ success: false, error: '공급상품을 찾을 수 없습니다' }, 404)

    const body = await c.req.json<{ tiers?: Array<{ min_qty?: number; discount_pct?: number }> }>().catch(() => ({} as { tiers?: Array<{ min_qty?: number; discount_pct?: number }> }))
    const raw = Array.isArray(body.tiers) ? body.tiers : []
    // 정규화 + 검증: min_qty>=1, discount 0~90, min_qty 중복 제거(마지막 우선).
    const dedup = new Map<number, number>()
    for (const t of raw) {
      const mq = Math.floor(Number(t.min_qty))
      const dp = Number(t.discount_pct)
      if (!Number.isFinite(mq) || mq < 1 || mq > 1000000) return c.json({ success: false, error: '최소 수량은 1 이상이어야 합니다' }, 400)
      if (!Number.isFinite(dp) || dp <= 0 || dp > 90) return c.json({ success: false, error: '할인율은 0 초과 90 이하(%)여야 합니다' }, 400)
      dedup.set(mq, Math.round(dp * 100) / 100)
    }
    // 전체 교체.
    await c.env.DB.prepare('DELETE FROM product_qty_tiers WHERE product_id = ?').bind(id).run()
    const entries = [...dedup.entries()].sort((a, b) => a[0] - b[0])
    if (entries.length) {
      const stmts = entries.map(([mq, dp]) =>
        c.env.DB.prepare('INSERT INTO product_qty_tiers (product_id, min_qty, discount_pct) VALUES (?, ?, ?)').bind(id, mq, dp))
      await c.env.DB.batch(stmts)
    }
    return c.json({ success: true, product_id: id, tiers: entries.map(([min_qty, discount_pct]) => ({ min_qty, discount_pct })) })
  } catch (err) {
    return safeError(c, err, '수량 구간 설정 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// ── 세금계산서/거래명세서 발행 (내부 발행 + 인쇄용 문서) ───────────────────────

// POST /tax-documents/issue — 해당 월 집계로 발행 기록 생성 (멱등 upsert)
//   body: { month: 'YYYY-MM', doc_type?: 'tax_invoice'|'transaction_statement' }
app.post('/tax-documents/issue', async (c) => {
  try {
    await ensureTaxDocSchema(c.env.DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const month = String(body.month || '').slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(month)) return c.json({ success: false, error: '월 형식 오류 (YYYY-MM)' }, 400)
    const docType = body.doc_type === 'transaction_statement' ? 'transaction_statement' : 'tax_invoice'

    // 매출(유통스타트→유통사): 유통사별 순매출(subtotal − 환불액) 합. 부분/전액 환불분 차감.
    const byDist = await c.env.DB.prepare(`
      SELECT o.distributor_seller_id AS seller_id, s.business_name, s.name,
             COUNT(*) AS order_count, COALESCE(SUM(MAX(0, o.subtotal - COALESCE(o.refunded_amount,0))),0) AS total
      FROM wholesale_orders o LEFT JOIN sellers s ON s.id = o.distributor_seller_id
      WHERE o.status IN ('PAID','SHIPPED','PARTIAL_REFUNDED') AND strftime('%Y-%m', COALESCE(o.paid_at, o.created_at)) = ?
      GROUP BY o.distributor_seller_id
    `).bind(month).all<{ seller_id: number; business_name: string | null; name: string | null; order_count: number; total: number }>().catch(() => ({ results: [] }))

    // 매입(제조사→유통스타트): 제조사별 base_supply_price 합 (환불된 라인 제외).
    const bySup = await c.env.DB.prepare(`
      SELECT i.supplier_id, sup.business_name,
             COUNT(DISTINCT i.wholesale_order_id) AS order_count, COALESCE(SUM(i.base_supply_price * i.qty),0) AS total
      FROM wholesale_order_items i JOIN wholesale_orders o ON o.id = i.wholesale_order_id
      LEFT JOIN suppliers sup ON sup.id = i.supplier_id
      WHERE o.status IN ('PAID','SHIPPED','PARTIAL_REFUNDED') AND strftime('%Y-%m', COALESCE(o.paid_at, o.created_at)) = ?
        AND i.supplier_id IS NOT NULL AND i.line_status != 'REFUNDED'
      GROUP BY i.supplier_id
    `).bind(month).all<{ supplier_id: number; business_name: string | null; order_count: number; total: number }>().catch(() => ({ results: [] }))

    let issued = 0
    for (const r of byDist.results || []) {
      if (!r.total) continue
      const { supply, vat, total } = splitVat(r.total)
      // supplier_id=0 sentinel — SQLite UNIQUE 는 NULL 을 서로 다르게 취급해 dedup 실패하므로 0 사용.
      const res = await c.env.DB.prepare(`
        INSERT INTO tax_documents (doc_type, direction, period_month, distributor_seller_id, supplier_id, party_name, supply_amount, vat_amount, total_amount, order_count, status, issued_at)
        VALUES (?, 'sales', ?, ?, 0, ?, ?, ?, ?, ?, 'issued', datetime('now'))
        ON CONFLICT(doc_type, direction, period_month, distributor_seller_id, supplier_id)
        DO UPDATE SET supply_amount=excluded.supply_amount, vat_amount=excluded.vat_amount, total_amount=excluded.total_amount, order_count=excluded.order_count, status='issued', issued_at=datetime('now')
      `).bind(docType, month, r.seller_id, r.business_name || r.name || `유통사#${r.seller_id}`, supply, vat, total, r.order_count).run().catch(() => null)
      if (res) issued++
    }
    for (const r of bySup.results || []) {
      if (!r.total) continue
      const { supply, vat, total } = splitVat(r.total)
      // distributor_seller_id=0 sentinel (위와 동일 이유).
      const res = await c.env.DB.prepare(`
        INSERT INTO tax_documents (doc_type, direction, period_month, distributor_seller_id, supplier_id, party_name, supply_amount, vat_amount, total_amount, order_count, status, issued_at)
        VALUES (?, 'purchase', ?, 0, ?, ?, ?, ?, ?, ?, 'issued', datetime('now'))
        ON CONFLICT(doc_type, direction, period_month, distributor_seller_id, supplier_id)
        DO UPDATE SET supply_amount=excluded.supply_amount, vat_amount=excluded.vat_amount, total_amount=excluded.total_amount, order_count=excluded.order_count, status='issued', issued_at=datetime('now')
      `).bind(docType, month, r.supplier_id, r.business_name || `제조사#${r.supplier_id}`, supply, vat, total, r.order_count).run().catch(() => null)
      if (res) issued++
    }
    return c.json({ success: true, issued, month, doc_type: docType })
  } catch (err) {
    return safeError(c, err, '세금계산서 발행 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// GET /tax-documents?month=&direction=&doc_type= — 발행 목록
app.get('/tax-documents', async (c) => {
  try {
    await ensureTaxDocSchema(c.env.DB)
    const binds: unknown[] = []
    let where = '1=1'
    const month = (c.req.query('month') || '').slice(0, 7)
    if (/^\d{4}-\d{2}$/.test(month)) { where += ' AND period_month = ?'; binds.push(month) }
    const direction = c.req.query('direction')
    if (direction === 'sales' || direction === 'purchase') { where += ' AND direction = ?'; binds.push(direction) }
    const docType = c.req.query('doc_type')
    if (docType === 'tax_invoice' || docType === 'transaction_statement') { where += ' AND doc_type = ?'; binds.push(docType) }
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM tax_documents WHERE ${where} ORDER BY period_month DESC, direction, total_amount DESC LIMIT 500`
    ).bind(...binds).all()
    return c.json({ success: true, documents: results ?? [] })
  } catch (err) {
    return safeError(c, err, '세금계산서 조회 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// GET /tax-documents/:id/html — 인쇄용 문서 (세금계산서/거래명세서)
app.get('/tax-documents/:id/html', async (c) => {
  try {
    await ensureTaxDocSchema(c.env.DB)
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.text('잘못된 ID', 400)
    const doc = await c.env.DB.prepare('SELECT * FROM tax_documents WHERE id = ?').bind(id).first<TaxDocRow>()
    if (!doc) return c.text('문서를 찾을 수 없습니다', 404)
    return c.html(renderTaxDocHtml(doc))
  } catch (err) {
    return safeError(c, err, '문서 생성 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// POST /tax-documents/:id/issue-nts — 바로빌 전자세금계산서 발행 (국세청)
//   매출(sales=유통스타트→유통사) 방향만. 발행자=유통스타트(바로빌 계정), 공급받는자=유통사.
//   매입(제조사→유통스타트)은 제조사가 발행하는 것이라 플랫폼 계정으로 발행 불가(역발행 별도).
//   자격증명(BAROBILL_*) 또는 플랫폼 사업자정보 미설정 시 actionable 에러(fail-soft).
app.post('/tax-documents/:id/issue-nts', rateLimit({ action: 'admin-nts-issue', max: 30, windowSec: 60 }), async (c) => {
  try {
    await ensureTaxDocSchema(c.env.DB)
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 ID' }, 400)
    const doc = await c.env.DB.prepare('SELECT * FROM tax_documents WHERE id = ?').bind(id).first<TaxDocRow & {
      direction: string; distributor_seller_id: number | null; supply_amount: number; vat_amount: number; total_amount: number; nts_confirm_num: string | null
    }>()
    if (!doc) return c.json({ success: false, error: '문서를 찾을 수 없습니다' }, 404)
    if (doc.nts_confirm_num) return c.json({ success: true, already: true, nts_confirm_num: doc.nts_confirm_num })
    if (doc.direction !== 'sales') {
      return c.json({ success: false, error: '매입(제조사→유통스타트) 세금계산서는 제조사가 발행합니다. 플랫폼 발행은 매출 방향만 가능합니다' }, 400)
    }
    if (!isBarobillConfigured(c.env as unknown as BarobillEnv)) {
      return c.json({ success: false, error: '전자세금계산서 발급사(바로빌) 자격증명 미설정 — Cloudflare 환경변수 BAROBILL_TEST_API_KEY/BAROBILL_PROD_API_KEY 등록 필요', needs_config: true }, 503)
    }

    // 플랫폼(유통스타트) 사업자정보 — platform_settings.
    const ps = await c.env.DB.prepare(
      "SELECT key, value FROM platform_settings WHERE key IN ('company_business_number','company_name','company_ceo','company_address','company_biz_type','company_biz_class','company_email','company_tel')"
    ).all<{ key: string; value: string }>().catch(() => ({ results: [] as { key: string; value: string }[] }))
    const ps_map: Record<string, string> = {}
    for (const r of ps.results || []) ps_map[r.key] = r.value
    if (!ps_map.company_business_number || !ps_map.company_name) {
      return c.json({ success: false, error: '플랫폼 사업자정보 미설정 — platform_settings(company_business_number/company_name/company_ceo/company_address) 등록 필요', needs_config: true }, 503)
    }

    // 공급받는자(유통사).
    const seller = await c.env.DB.prepare(
      'SELECT business_number, business_name, name, email, phone FROM sellers WHERE id = ?'
    ).bind(doc.distributor_seller_id).first<{ business_number: string | null; business_name: string | null; name: string | null; email: string | null; phone: string | null }>()
    if (!seller) return c.json({ success: false, error: '유통사 정보를 찾을 수 없습니다' }, 404)

    let result: { success: boolean; ntsConfirmNumber?: string; invoiceKey?: string; message?: string }
    try {
      result = await issueBarobillTaxInvoice(c.env as unknown as BarobillEnv, {
        supplierBusinessNumber: ps_map.company_business_number,
        supplierBusinessName: ps_map.company_name,
        supplierCEO: ps_map.company_ceo || ps_map.company_name,
        supplierAddress: ps_map.company_address || '',
        supplierBusinessType: ps_map.company_biz_type,
        supplierBusinessCategory: ps_map.company_biz_class,
        supplierEmail: ps_map.company_email,
        supplierTel: ps_map.company_tel,
        buyerBusinessNumber: seller.business_number || undefined,
        buyerBusinessName: seller.business_name || seller.name || `유통사#${doc.distributor_seller_id}`,
        buyerEmail: seller.email || undefined,
        buyerTel: seller.phone || undefined,
        writeDate: `${doc.period_month}-01`,
        purposeType: '02', // 청구
        taxType: '01', // 과세
        items: [{ name: `${doc.period_month} 도매 거래 합계`, quantity: 1, unitPrice: doc.supply_amount, supplyPrice: doc.supply_amount, taxAmount: doc.vat_amount }],
        totalSupplyPrice: doc.supply_amount,
        totalTaxAmount: doc.vat_amount,
        totalAmount: doc.total_amount,
        memo: `유통스타트 도매 ${doc.period_month}`,
      })
    } catch (e) {
      await c.env.DB.prepare("UPDATE tax_documents SET external_status='failed' WHERE id=?").bind(id).run().catch(swallow('distributor-admin:tax-mark-failed'))
      return safeError(c, e, '전자세금계산서 발행 실패', '[distributor-admin]', 503)
    }
    if (!result.success) {
      await c.env.DB.prepare("UPDATE tax_documents SET external_status='failed' WHERE id=?").bind(id).run().catch(swallow('distributor-admin:tax-mark-failed'))
      return c.json({ success: false, error: result.message || '전자세금계산서 발행 실패' }, 502)
    }
    await c.env.DB.prepare(
      "UPDATE tax_documents SET nts_confirm_num=?, invoice_key=?, external_status='issued', status='issued', issued_at=datetime('now') WHERE id=?"
    ).bind(result.ntsConfirmNumber || null, result.invoiceKey || null, id).run()
    return c.json({ success: true, nts_confirm_num: result.ntsConfirmNumber, invoice_key: result.invoiceKey })
  } catch (err) {
    return safeError(c, err, '전자세금계산서 발행 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// PATCH /tax-documents/:id — 상태 변경 (issued/void)
app.patch('/tax-documents/:id', async (c) => {
  try {
    await ensureTaxDocSchema(c.env.DB)
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 ID' }, 400)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const status = String(body.status || '')
    if (!['issued', 'void', 'draft'].includes(status)) return c.json({ success: false, error: '잘못된 상태값' }, 400)
    const res = await c.env.DB.prepare(
      "UPDATE tax_documents SET status = ?, issued_at = CASE WHEN ?='issued' THEN datetime('now') ELSE issued_at END WHERE id = ?"
    ).bind(status, status, id).run()
    if (!res.meta.changes) return c.json({ success: false, error: '문서를 찾을 수 없습니다' }, 404)
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '문서 상태 변경 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 🏭 2026-06-04 도매몰 데모 상품 시드 (어드민) — 멱등. 카탈로그에 바로 노출되는 공급상품 10개.
//   is_active=1 + is_supply_product=1 + supply_price>0 + visibility=ALL → /wholesale 카탈로그 즉시 표시.
//   slug 'demo-wholesale-N' 마커로 식별 → 재실행 시 중복 안 함, DELETE 로 일괄 제거.
//   ⚠️ 표시용 데모 — supplier_id=NULL (주문 시 정산은 데모이므로 무의미). 운영 데이터 아님.
const DEMO_SLUG_PREFIX = 'demo-wholesale-'
const DEMO_PRODUCTS: { name: string; category: string; supply: number; retail: number; stock: number; moq: number; color: string; img: string }[] = [
  { name: '프리미엄 블렌드 원두 커피 1kg', category: 'food', supply: 9800, retail: 16000, stock: 480, moq: 10, color: '#6F4E37', img: 'https://picsum.photos/seed/urwh1/600/600' },
  { name: '유기농 데일리 견과 믹스 500g', category: 'food', supply: 7200, retail: 12900, stock: 320, moq: 10, color: '#C8A06A', img: 'https://picsum.photos/seed/urwh2/600/600' },
  { name: '수분 진정 마스크팩 30매', category: 'beauty', supply: 8500, retail: 19900, stock: 150, moq: 5, color: '#9FD8CB', img: 'https://picsum.photos/seed/urwh3/600/600' },
  { name: '비타민C 브라이트닝 앰플 30ml', category: 'beauty', supply: 11200, retail: 24000, stock: 90, moq: 3, color: '#F2B705', img: 'https://picsum.photos/seed/urwh4/600/600' },
  { name: '호텔 컬렉션 극세사 수건 10장', category: 'living', supply: 14500, retail: 26000, stock: 60, moq: 2, color: '#D9E4EC', img: 'https://picsum.photos/seed/urwh5/600/600' },
  { name: '진공 보온 스테인리스 텀블러 500ml', category: 'living', supply: 6900, retail: 13900, stock: 240, moq: 6, color: '#4A5A6A', img: 'https://picsum.photos/seed/urwh6/600/600' },
  { name: '베이직 무지 반팔 티셔츠 (5color)', category: 'fashion', supply: 4300, retail: 9900, stock: 600, moq: 10, color: '#2E2E2E', img: 'https://picsum.photos/seed/urwh7/600/600' },
  { name: '데일리 컴포트 양말 10족 세트', category: 'fashion', supply: 3200, retail: 7900, stock: 800, moq: 10, color: '#B0A8B9', img: 'https://picsum.photos/seed/urwh8/600/600' },
  { name: '고속 충전 USB-C 케이블 3개입', category: 'digital', supply: 5100, retail: 11900, stock: 360, moq: 5, color: '#1F6FEB', img: 'https://picsum.photos/seed/urwh9/600/600' },
  { name: '차량용 디퓨저 방향제 세트', category: 'lifestyle', supply: 4600, retail: 9900, stock: 280, moq: 5, color: '#7FB069', img: 'https://picsum.photos/seed/urwh10/600/600' },
]

app.post('/seed-demo-products', rateLimit({ action: 'wholesale-seed-demo', max: 5, windowSec: 60 }), async (c) => {
  const { DB } = c.env
  try {
    await ensureSupplyVisibilitySchema(DB)
    await DB.prepare('ALTER TABLE products ADD COLUMN dominant_color TEXT').run().catch(swallow('seed-demo:dc'))
    const existing = await DB.prepare(`SELECT COUNT(*) AS c FROM products WHERE slug LIKE ?`).bind(DEMO_SLUG_PREFIX + '%').first<{ c: number }>()
    if ((existing?.c ?? 0) > 0) {
      return c.json({ success: true, seeded: 0, existing: existing?.c ?? 0, message: '이미 데모 상품이 있습니다 (삭제 후 재생성하세요)' })
    }
    let seeded = 0
    for (let i = 0; i < DEMO_PRODUCTS.length; i++) {
      const d = DEMO_PRODUCTS[i]
      await DB.prepare(
        `INSERT INTO products (name, description, price, supply_price, stock, image_url, category, product_type,
           is_active, is_supply_product, supplier_id, supply_approval_status, supply_visibility, is_brand_product,
           min_order_qty, dominant_color, slug, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'regular', 1, 1, NULL, 'approved', 'ALL', 0, ?, ?, ?, datetime('now'), datetime('now'))`,
      ).bind(
        d.name, `검증 제조사 공급 데모 상품 — ${d.name}`, d.retail, d.supply, d.stock, d.img, d.category, d.moq, d.color, DEMO_SLUG_PREFIX + (i + 1),
      ).run()
      seeded++
    }
    return c.json({ success: true, seeded })
  } catch (err) {
    return safeError(c, err, '데모 상품 생성 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

app.delete('/seed-demo-products', async (c) => {
  const { DB } = c.env
  try {
    const r = await DB.prepare(`DELETE FROM products WHERE slug LIKE ?`).bind(DEMO_SLUG_PREFIX + '%').run()
    return c.json({ success: true, deleted: r.meta?.changes ?? 0 })
  } catch (err) {
    return safeError(c, err, '데모 상품 삭제 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// ── 🏭 BIZ-7 (2026-06-08) 등급 자동화 (GMV 기반 auto-grade) 설정 + 수동 실행 ──────
//   cron(wholesale-grade-eval) 과 platform_settings 키를 공유. 가격 산식 불변 — distributor_grade 만 자동 승급.
//   설계: 승급 전용(promote-only). 자동 강등은 v1 없음(수동 PATCH /distributors/:id 으로만).

async function readSettingRaw(DB: D1Database, key: string): Promise<string | null> {
  const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
    .bind(key).first<{ value: string }>().catch(() => null)
  return row?.value ?? null
}

async function writeSettingRaw(DB: D1Database, key: string, value: string): Promise<void> {
  await DB.prepare(
    `INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).bind(key, value).run()
}

// GET /auto-grade/settings — enable 플래그 + 임계값 + 윈도우 + 마지막 실행시각
app.get('/auto-grade/settings', async (c) => {
  try {
    const DB = c.env.DB
    const [enabledRaw, thresholdsRaw, windowRaw, lastRun, plusFeeRaw] = await Promise.all([
      readSettingRaw(DB, AUTO_GRADE_ENABLED_KEY),
      readSettingRaw(DB, AUTO_GRADE_THRESHOLDS_KEY),
      readSettingRaw(DB, AUTO_GRADE_WINDOW_DAYS_KEY),
      readSettingRaw(DB, AUTO_GRADE_LAST_RUN_KEY),
      readSettingRaw(DB, PLUS_FEE_KEY),
    ])
    const enabled = enabledRaw === '1' || enabledRaw === 'true'
    const thresholds = parseThresholds(thresholdsRaw)
    const w = Number(windowRaw)
    const windowDays = Number.isFinite(w) && w >= 1 && w <= 365 ? Math.floor(w) : 90
    const pf = Math.floor(Number(plusFeeRaw))
    const plusAnnualFee = Number.isFinite(pf) && pf > 0 ? pf : DEFAULT_PLUS_ANNUAL_FEE
    return c.json({
      success: true,
      enabled,
      thresholds,        // [{ grade, min_gmv }] (min_gmv 내림차순)
      window_days: windowDays,
      plus_annual_fee: plusAnnualFee, // 🏅 프로 연 구독료(원) — 0 이하/미설정이면 기본 1,000,000
      last_run: lastRun, // ISO 또는 null (한 번도 안 돌면)
      defaults: DEFAULT_THRESHOLDS,
    })
  } catch (err) {
    return safeError(c, err, '자동등급 설정 조회 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// PATCH /auto-grade/settings — enable / 임계값 / 윈도우 갱신 (검증 + 감사)
app.patch('/auto-grade/settings', async (c) => {
  try {
    const DB = c.env.DB
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))

    // 변경 전 값 캡처 (감사 before).
    const [prevEnabled, prevThresholds, prevWindow] = await Promise.all([
      readSettingRaw(DB, AUTO_GRADE_ENABLED_KEY),
      readSettingRaw(DB, AUTO_GRADE_THRESHOLDS_KEY),
      readSettingRaw(DB, AUTO_GRADE_WINDOW_DAYS_KEY),
    ])

    const stmts: D1PreparedStatement[] = []
    const after: Record<string, unknown> = {}

    if (body.enabled !== undefined) {
      const en = body.enabled === true || body.enabled === 1 || body.enabled === '1' || body.enabled === 'true' ? '1' : '0'
      stmts.push(DB.prepare(
        `INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
      ).bind(AUTO_GRADE_ENABLED_KEY, en))
      after.enabled = en === '1'
    }

    if (body.thresholds !== undefined) {
      // 클라이언트가 배열 또는 JSON 문자열로 보낼 수 있음 → 정규화 후 검증.
      let arr: unknown = body.thresholds
      if (typeof arr === 'string') { try { arr = JSON.parse(arr) } catch { return c.json({ success: false, error: '임계값 JSON 형식 오류' }, 400) } }
      if (!Array.isArray(arr)) return c.json({ success: false, error: '임계값은 배열이어야 합니다' }, 400)
      const ALLOWED = new Set(['A', 'B', 'C', 'D'])
      const clean: ThresholdRow[] = []
      const seen = new Set<string>()
      for (const r of arr as Array<Record<string, unknown>>) {
        const grade = String(r?.grade ?? '').toUpperCase()
        const minGmv = Number(r?.min_gmv)
        if (!ALLOWED.has(grade)) return c.json({ success: false, error: `등급은 A/B/C/D 만 가능합니다 (받음: ${grade || '빈값'})` }, 400)
        if (seen.has(grade)) return c.json({ success: false, error: `등급 ${grade} 가 중복되었습니다` }, 400)
        if (!Number.isFinite(minGmv) || minGmv < 0 || minGmv > 100_000_000_000) {
          return c.json({ success: false, error: `${grade}등급 최소 GMV 값이 올바르지 않습니다` }, 400)
        }
        seen.add(grade)
        clean.push({ grade, min_gmv: Math.floor(minGmv) })
      }
      if (!clean.length) return c.json({ success: false, error: '최소 1개 이상의 등급 임계값이 필요합니다' }, 400)
      clean.sort((a, b) => b.min_gmv - a.min_gmv)
      const json = JSON.stringify(clean)
      stmts.push(DB.prepare(
        `INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
      ).bind(AUTO_GRADE_THRESHOLDS_KEY, json))
      after.thresholds = clean
    }

    if (body.window_days !== undefined) {
      const w = Math.floor(Number(body.window_days))
      if (!Number.isFinite(w) || w < 1 || w > 365) return c.json({ success: false, error: '집계 기간(일)은 1~365 사이여야 합니다' }, 400)
      stmts.push(DB.prepare(
        `INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
      ).bind(AUTO_GRADE_WINDOW_DAYS_KEY, String(w)))
      after.window_days = w
    }

    // 🏅 프로 연 구독료 — 1,000 ~ 1,000만원. 0/미설정이면 기본값 적용(엔드포인트 fallback).
    if (body.plus_annual_fee !== undefined) {
      const f = Math.floor(Number(body.plus_annual_fee))
      if (!Number.isFinite(f) || f < 1000 || f > 10_000_000) return c.json({ success: false, error: '프로 연 구독료는 1,000원 ~ 1,000만원 사이여야 합니다' }, 400)
      stmts.push(DB.prepare(
        `INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
      ).bind(PLUS_FEE_KEY, String(f)))
      after.plus_annual_fee = f
    }

    if (!stmts.length) return c.json({ success: false, error: '변경할 내용이 없습니다 (enabled / thresholds / window_days / plus_annual_fee)' }, 400)
    await DB.batch(stmts)

    await writeAuditLog(c, {
      action: 'wholesale_auto_grade_settings_change',
      targetType: 'platform_settings',
      targetId: 'wholesale_auto_grade',
      before: {
        enabled: prevEnabled === '1' || prevEnabled === 'true',
        thresholds: parseThresholds(prevThresholds),
        window_days: prevWindow,
      },
      after,
    }).catch(() => { /* audit 실패해도 성공 처리 */ })

    return c.json({ success: true, ...after })
  } catch (err) {
    return safeError(c, err, '자동등급 설정 저장 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// POST /auto-grade/run — 수동 트리거 ("지금 평가 실행"). cron 과 동일 평가함수 호출 (force=true).
//   rate-limited — 무거운 배치라 짧은 시간 연타 방지.
app.post('/auto-grade/run', rateLimit({ action: 'wholesale-auto-grade-run', max: 5, windowSec: 60 }), async (c) => {
  try {
    const result = await evaluateWholesaleGrades(c.env, true)
    await writeAuditLog(c, {
      action: 'wholesale_auto_grade_manual_run',
      targetType: 'platform_settings',
      targetId: 'wholesale_auto_grade',
      before: null,
      after: { evaluated: result.evaluated, promoted: result.promoted, window_days: result.windowDays },
    }).catch(() => { /* audit 실패해도 성공 처리 */ })
    return c.json({ success: true, ...result })
  } catch (err) {
    return safeError(c, err, '자동등급 수동 실행 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

export { app as distributorAdminRoutes }
