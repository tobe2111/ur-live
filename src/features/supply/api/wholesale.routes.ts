/**
 * 🏭 2026-06-01 유통스타트 도매몰 — 판매사(셀러) 도매 카탈로그 + B2B 주문 (Phase 2).
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
import { dispatchSignupContract } from '@/worker/utils/signup-contract'
import { hasUnsignedContract } from '@/worker/utils/contract-signatures'
import {
  resolveDistributorPrice, marginForGrade, effectiveGrade, tierUnitPrice, effectiveTierFloor, qtyTierDiscount,
  type GradeMargin, type DistributorGrade, type QtyTier,
} from '@/lib/distributor-pricing'
import { confirmTossPayment, cancelTossPayment } from '@/worker/utils/toss-gateway'
import { swallow } from '@/worker/utils/swallow'
import { getSupplyMeta, ensureSupplyMetaTable } from '@/worker/utils/product-supply-meta'
import { startDashboardSession } from '@/worker/utils/dashboard-session'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { requireAuth } from '@/worker/middleware/auth'
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes'
import { creditSupplierOnWholesaleOrder, loadPlatformCommissionPct, splitWholesaleUnit } from './wholesale-settlement'
import { generateWholesaleSalesInvoice, generateWholesalePurchaseInvoices, listDistributorSalesInvoices } from './wholesale-tax-invoices'
import { ensureSupplyVisibilitySchema, visibilityWhere, gradeExposureWhere } from './supply-visibility'
import { ensureDepositSchema, deductDeposit, recordDepositTxn, compensateDepositOrderOnce } from './wholesale-deposit-core'
import { resolveMallId, registrationMallId, loadMallByHost } from './wholesale-malls'
import {
  ensureOrderTables, ensureSupplierPolicySchema, loadSupplierPolicies, computeSupplierShipping,
  parseProductShipFee, hasRestrictedVisibility, _supplyCatalogReady, ensureQtyConstraintSchema,
  ensureCreditSchema, loadSellerCredit, sellerIdFrom, sellerIdFromCookieGet, isSellerBlocked,
  type SubRole, SUB_ROLES, subClaimsFrom, SUB_EMAIL_RE, requireSubAdmin,
  loadGradeTable, loadMinPlatformMarginPct, loadSellerGrade, loadQtyTiers,
  ftsAvailable, buildFtsMatch, CATALOG_SORT_ORDER, ensureDistributorSellerSchema,
  notifySuppliersOfPaidOrder, BULK_MAX_ROWS,
} from './wholesale-helpers'
// public API 보존 — wholesale-board.routes.ts 가 `from './wholesale.routes'` 로 가져옴(re-export).
export { loadGradeTable, loadSellerGrade } from './wholesale-helpers'

const app = new Hono<{ Bindings: Env }>()

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

// ── POST /register — 판매사(도매 바이어) 경량 전용 가입 ─────────────────────────────
//   라이브커머스 셀러 온보딩(유튜브·NTS·seller_type)과 분리. seller 계정을 재사용하되
//   distributor_grade='C' + is_distributor=1 로 표시 → /seller 대시보드 대신 /wholesale 에서 완결.
//   ⚠️ 사업자번호는 세금계산서용 선택값. 가입 즉시 사용 가능(status='approved').
app.post('/register', rateLimit({ action: 'wholesale_register', max: 20, windowSec: 3600 }), async (c) => {
  const { DB, JWT_SECRET } = c.env
  if (!JWT_SECRET) return c.json({ success: false, error: '서버 설정 오류' }, 500)
  try {
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const name = String(body.name || '').trim()                 // 담당자명
    const business_name = String(body.business_name || '').trim() // 상호(회사명)
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const phone = String(body.phone || '').trim()
    const business_number_raw = String(body.business_number || '').replace(/[^0-9]/g, '') // 🏭 사업자등록번호 숫자만(하이픈 무관)
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
    // 🔓 2026-06-23 (대표 요청 "358533aa 강도로도 가입"): relaxed — 8자 이상 + 영문·숫자·특수 중 2종.
    const pw = validatePasswordComplexity(password, { relaxed: true })
    if (!pw.ok) return c.json({ success: false, error: pw.error }, 400)
    // 🏭 2026-06-04 (사용자 결정): 유통회원도 사업자 정보 필수 + 관리자 승인. 사업자번호 필수.
    // 🔢 2026-06-23: 하이픈 유무 무관 — 숫자 10자리 검증 후 하이픈 정규화 저장.
    if (!/^\d{10}$/.test(business_number_raw)) {
      return c.json({ success: false, error: '사업자등록번호 10자리를 정확히 입력해주세요' }, 400)
    }
    const business_number = `${business_number_raw.slice(0, 3)}-${business_number_raw.slice(3, 5)}-${business_number_raw.slice(5)}`
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
    const mallId = await registrationMallId(c).catch(() => 1) // 🛡️ 2026-06-23 fail-soft: 몰 해석 실패가 가입 500 안 내게(기본 몰 1)
    // 🏁 2026-06-12 (P4 정책 확정 — "둘 다 수동 승인"): 국세청 결과는 참고 표시용 저장만. fail-soft.
    let ntsStatus2: string | null = null
    try {
      const { ntsCheckStatus } = await import('../../../worker/utils/nts-business-verify')
      const rows = await ntsCheckStatus((c.env as { NTS_API_KEY?: string }).NTS_API_KEY, [business_number])
      ntsStatus2 = rows[0]?.b_stt || null
    } catch { /* fail-soft */ }
    await DB.prepare('ALTER TABLE sellers ADD COLUMN nts_status TEXT').run().catch(() => { /* exists */ })

    // 🛡️ 2026-06-23 (대표 "더는 절대로 이 에러가 떠선 안돼"): 가입 INSERT 자가치유.
    //   원인 분석: sellers 는 D1 한도(100) 근접 97컬럼 + prod 스키마 드리프트로 일부 컬럼이 prod 에
    //   누락 → inline ALTER 가 (한도/transient) 실패해 swallow → 풀 INSERT 가 '없는 컬럼' 참조로 500
    //   (계정은 INSERT 실패라 미생성, 단 별도 시도의 중복은 409). 바인딩(17=17)·dispatchSignupContract
    //   (fail-soft)는 정상 확인.
    //   해법(KakaoAuthService.upsertUser 동일 패턴): 풀 INSERT 실패 시 ① 이메일 UNIQUE → 409 명확화
    //   ② 그 외 → **수년째 존재하는 base 컬럼만으로 최소 INSERT**(절대 성공) 후 나머지는 컬럼별
    //   fail-soft UPDATE(누락 컬럼은 무시). → 스키마가 어떻든 **계정 반드시 생성 + 500 0**.
    const isEmailDupErr = (m: string) => /unique|constraint|already exists/i.test(m) && /email/i.test(m)
    // 선택(비-base) 컬럼 — 풀 INSERT 실패 시 개별 UPDATE 로 best-effort 적용(누락돼도 무시).
    const optionalCols: Array<[string, unknown]> = [
      ['business_number', business_number || null], // business_name 은 최소 INSERT 에 포함(NOT NULL)
      ['representative_name', representative || null], ['phone', phone || null],
      ['representative_phone', representative_phone || null], ['manager_name', manager_name || null],
      ['manager_phone', manager_phone || null], ['manager_email', manager_email || null],
      ['business_registration_image_url', business_license_url || null],
      ['business_registration_status', 'pending'], ['commission_rate', DEFAULT_COMMISSION_RATE],
      ['seller_type', 'influencer'], ['distributor_grade', 'C'], ['is_distributor', 1],
      ['mall_id', mallId], ['nts_status', ntsStatus2],
    ]
    let sellerId = 0
    try {
      const ins = await DB.prepare(`
        INSERT INTO sellers (username, email, password_hash, name, business_name, business_number, representative_name, phone,
          representative_phone, manager_name, manager_phone, manager_email,
          business_registration_image_url, business_registration_status,
          status, commission_rate, seller_type, distributor_grade, is_distributor, mall_id, nts_status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, 'influencer', 'C', 1, ?, ?, datetime('now'), datetime('now'))
      `).bind(username, email, passwordHash, name, business_name, business_number, representative || null, phone || null,
        representative_phone || null, manager_name || null, manager_phone || null, manager_email || null,
        business_license_url || null, 'pending', DEFAULT_COMMISSION_RATE, mallId, ntsStatus2).run()
      sellerId = Number(ins.meta?.last_row_id)
    } catch (insErr) {
      const msg = String((insErr as Error)?.message || '')
      // 진단(prod 로그) — 어느 컬럼/제약인지 가시화. self-heal 로 가입은 계속 진행.
      console.error('[wholesale:register] 풀 INSERT 실패 → 자가치유 진입:', msg)
      if (isEmailDupErr(msg)) return c.json({ success: false, error: '이미 가입된 이메일입니다. 로그인해주세요' }, 409)
      // 원본(0003) base 컬럼만 — 수년째 존재 + NOT NULL(no-default) 전부 포함(특히 business_name).
      //   나머지 NOT NULL 컬럼(seller_type/is_active/commission_rate/base_shipping_fee 등)은 DB DEFAULT 보유
      //   (풀 INSERT 도 일부 생략하는데 동작했으므로 default 확정) → 생략 안전.
      try {
        const insMin = await DB.prepare(
          `INSERT INTO sellers (username, email, password_hash, name, business_name, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))`
        ).bind(username, email, passwordHash, name, business_name).run()
        sellerId = Number(insMin.meta?.last_row_id)
      } catch (minErr) {
        const m2 = String((minErr as Error)?.message || '')
        if (isEmailDupErr(m2)) return c.json({ success: false, error: '이미 가입된 이메일입니다. 로그인해주세요' }, 409)
        throw minErr // 최소 INSERT 마저 실패 = 진짜 DB 장애 → 외부 catch(safeError). 극히 드묾.
      }
      // 나머지 필드 best-effort — 컬럼별 개별 UPDATE(누락 컬럼은 fail-soft 무시).
      if (sellerId) {
        for (const [col, val] of optionalCols) {
          await DB.prepare(`UPDATE sellers SET ${col} = ? WHERE id = ?`).bind(val as string | number | null, sellerId)
            .run().catch(swallow('wholesale:register:opt-col'))
        }
      }
    }
    // last_row_id 가 falsy 여도 방금 만든 행을 email 로 복구(절대 500 미연발).
    if (!sellerId) {
      const row = await DB.prepare('SELECT id FROM sellers WHERE email = ?').bind(email).first<{ id: number }>().catch(() => null)
      sellerId = Number(row?.id) || 0
    }
    if (!sellerId) return c.json({ success: false, error: '가입 처리 중 오류가 발생했습니다' }, 500)

    // 어드민 승인 큐 알림 (셀러 승인 페이지에서 처리 — 유통회원도 동일 큐).
    createDashboardNotification(DB, 'admin', null, 'distributor_pending', '판매사 승인 요청',
      `${business_name} (${business_number})${ntsStatus2 ? ` — 국세청: ${ntsStatus2}` : ' — 국세청: 조회 안 됨'}`,
      '/admin/seller-approval').catch(swallow('wholesale:register:notify'))

    // 🖋️ 2026-06-22: 가입 시 전자계약서 자동발송(모두싸인 카카오). fail-soft — 미설정/실패가 가입 안 막음.
    dispatchSignupContract(c, { accountType: 'distributor', accountId: sellerId, signerName: representative || name, signerPhone: phone || manager_phone || representative_phone, businessName: business_name })

    return c.json({
      success: true,
      status: 'pending',
      message: '판매사 가입 신청이 완료되었습니다. 사업자 정보 확인 후 관리자 승인되면 이용할 수 있습니다.',
    })
  } catch (err) {
    // 🛡️ 2026-06-25: 임시 _diag 노출 제거(보안 — raw DB 에러 클라 반환 금지 룰). safeError 가 Sentry/DEV 로깅 담당.
    return safeError(c, err, '가입 처리 중 오류가 발생했습니다', '[wholesale:register]')
  }
})

// ── POST /become-distributor — 카카오(일반 유저)가 유통회원으로 전환/가입 ──────────────
//   카카오 로그인=유저 세션. 유통회원=sellers(is_distributor=1) 행. 이 엔드포인트가 유저↔셀러
//   (distributor) 행을 생성/연결(linked_user_id) 후 seller_token 발급 → 도매몰 즉시 이용.
//   ⚠️ 한 유저당 셀러 1행(idx_sellers_linked_user_id). 이미 셀러면 is_distributor 승급만.
// 🛡️ 2026-06-18 (인증 audit): 유통회원 셀러 컬럼 self-heal(ensureDistributorSellerSchema, wholesale-helpers)
//   — 핸들러 안 매 호출 16 ALTER 루프 대신 isolate 당 1회 메모이즈(멱등 self-heal — sellers 컬럼 예산 무영향).
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

    await ensureDistributorSellerSchema(DB) // 🛡️ 셀러/유저 컬럼 self-heal(멱등, isolate당 1회 — 기존 inline 16 ALTER 대체)
    const u = await DB.prepare('SELECT id, email, name, email_verified FROM users WHERE id = ?').bind(userId)
      .first<{ id: number; email: string | null; name: string | null; email_verified: number | null }>().catch(() => null)
    const email = (authed.email || u?.email || '').trim().toLowerCase()
    const name = (authed.name || u?.name || '판매사').trim()
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
        return c.json({ success: true, status: seller.status || 'pending', message: '판매사 승인 대기 중입니다. 관리자 승인 후 이용할 수 있습니다.' })
      }
      // 🏁 2026-06-12 (전 플로우 감사 🟡): 기존 승인 셀러 즉시 승급은 '검증된 사업자' 전제였는데
      //   인플루언서 승인 기준 ≠ 도매(사업자) 기준 — business_number 없는 셀러는 즉시 토큰 대신
      //   사업자 정보 보완 안내(아래 신규 가입 흐름과 동일 검증 경로로 유도).
      const bizNo = await DB.prepare('SELECT business_number FROM sellers WHERE id = ?')
        .bind(seller.id).first<{ business_number: string | null }>().catch(() => null)
      if (!bizNo?.business_number) {
        return c.json({ success: true, status: 'needs_business_info', code: 'BUSINESS_INFO_REQUIRED', message: '도매 이용을 위해 사업자 정보 등록이 필요합니다.' })
      }
      const nowSec = Math.floor(Date.now() / 1000)
      const payload = { sub: String(seller.id), seller_id: seller.id, email: seller.email || email, name: seller.name || name, username: seller.username, type: 'seller', status: seller.status, seller_type: seller.seller_type || 'influencer', is_distributor: 1, iat: nowSec, exp: nowSec + 30 * 24 * 60 * 60 }
      const token = await sign(payload, JWT_SECRET)
      const refreshToken = await sign({ ...payload, exp: nowSec + 90 * 24 * 60 * 60 }, JWT_SECRET)
      // 🔐 단일 세션: 도매 대표 1차 로그인은 /api/seller/login(seller.routes, 이미 커버) 경유.
      //   become 은 카탈로그 자동연결 프로브로도 토큰을 재발급 → 여기서 세션 갱신하면 churn/ping-pong
      //   위험 → 의도적으로 호출 안 함(seller 로그인이 도매 사장 세션을 관장).
      return c.json({ success: true, status: 'approved', data: { accessToken: token, refreshToken, token, seller: { id: seller.id, username: seller.username, email: seller.email || email, name: seller.name || name, status: seller.status, seller_type: seller.seller_type || 'influencer', is_distributor: 1 } } })
    }

    // 3) 신규 → 사업자 정보 필수 + status='pending'(어드민 승인). 토큰 미발급.
    //   🏭 2026-06-08: 빈 body 자동 probe(카탈로그/로그인 후 '기존 판매사 자동연결' 시도)는 에러가 아니라
    //   '가입 필요' 상태 — 신규 유저에게 400(콘솔 에러·"가입 안됨" 오해) 대신 needs_registration(200) 반환.
    //   사업자 정보가 하나라도 들어온 실제 신청만 아래 필드 검증으로 400 처리.
    if (!business_name && !business_number && !business_license_url) {
      return c.json({ success: true, status: 'needs_registration', message: '판매사 가입(사업자 정보 입력)이 필요합니다.' })
    }
    if (!email) return c.json({ success: false, error: '이메일 정보가 필요합니다. 카카오 이메일 제공에 동의해주세요' }, 400)
    if (!business_name) return c.json({ success: false, error: '상호(사업자명)를 입력해주세요' }, 400)
    if (!/^\d{10}$/.test(business_number.replace(/[^0-9]/g, ''))) return c.json({ success: false, error: '사업자등록번호 10자리를 정확히 입력해주세요' }, 400)
    if (!business_license_url) return c.json({ success: false, error: '사업자등록증 이미지를 업로드해주세요' }, 400)
    // 🛡️ 2026-06-10 (인적사항 게이트 보강): 대표자/담당자는 클라 폼만 필수였음 — API 직접 호출 우회 차단.
    if (!representative || !representative_phone) return c.json({ success: false, error: '대표자 성명·연락처를 입력해주세요' }, 400)
    if (!manager_name || !manager_phone) return c.json({ success: false, error: '담당자 성명·연락처를 입력해주세요' }, 400)
    const base = (email.split('@')[0] || 'dist').replace(/[^a-z0-9]/gi, '').slice(0, 16).toLowerCase() || 'dist'
    let username = ''
    for (let i = 0; i < 6; i++) {
      const cand = `${base}${Math.floor(1000 + Math.random() * 9000)}`
      const ex = await DB.prepare('SELECT id FROM sellers WHERE username = ?').bind(cand).first()
      if (!ex) { username = cand; break }
    }
    if (!username) username = `dist${Date.now().toString().slice(-8)}`
    // 🏬 멀티-몰: 가입 대상 몰 = host(또는 ?mall=slug). 기본(단일 호스트) 환경은 1 → 동작 불변.
    const mallId = await registrationMallId(c).catch(() => 1) // 🛡️ 2026-06-23 fail-soft: 몰 해석 실패가 가입 500 안 내게(기본 몰 1)

    // 🏁 2026-06-12 (P4 정책 확정 — 사용자: "둘 다 수동 승인"): 국세청 상태조회는 **참고 표시용**으로만
    //   저장·알림 표기 — 자동 승인 없음. 승인은 항상 어드민 수동. fail-soft.
    let ntsStatus: string | null = null
    try {
      const { ntsCheckStatus } = await import('../../../worker/utils/nts-business-verify')
      const rows = await ntsCheckStatus((c.env as { NTS_API_KEY?: string }).NTS_API_KEY, [business_number])
      ntsStatus = rows[0]?.b_stt || null
    } catch { /* fail-soft */ }

    const ins = await DB.prepare(`
      INSERT INTO sellers (username, email, password_hash, name, business_name, business_number, representative_name, phone,
        representative_phone, manager_name, manager_phone, manager_email,
        business_registration_image_url, business_registration_status,
        status, commission_rate, seller_type, distributor_grade, is_distributor, linked_user_id, mall_id, nts_status, created_at, updated_at)
      VALUES (?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, 'influencer', 'C', 1, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(username, email, name, business_name, business_number, representative || null, phone || null,
      representative_phone || null, manager_name || null, manager_phone || null, manager_email || null,
      business_license_url || null, 'pending', DEFAULT_COMMISSION_RATE, userId, mallId, ntsStatus).run()
    const sid = Number(ins.meta?.last_row_id)
    if (!sid) return c.json({ success: false, error: '판매사 신청 중 오류가 발생했습니다' }, 500)
    createDashboardNotification(DB, 'admin', null, 'distributor_pending', '판매사 승인 요청',
      `${business_name} (${business_number})${ntsStatus ? ` — 국세청: ${ntsStatus}` : ' — 국세청: 조회 안 됨'}`,
      '/admin/seller-approval').catch(swallow('wholesale:become:notify'))
    return c.json({ success: true, status: 'pending', message: '판매사 가입 신청이 완료되었습니다. 사업자 정보 확인 후 관리자 승인되면 이용할 수 있습니다.' })
  } catch (err) {
    return safeError(c, err, '판매사 전환 중 오류가 발생했습니다', '[wholesale:become]')
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

    // 부모(회사) 판매사 계정이 여전히 유효(판매사 + 승인/활성)한지 확인.
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

    // 🔐 단일 세션 강제 — 도매 직원(서브계정)은 sub_account_id 시트로 독립 단일 세션.
    await startDashboardSession(c.env.DB, 'seller_sub', sub.id, nowSec, { userAgent: c.req.header('User-Agent'), ip: c.req.header('CF-Connecting-IP') })

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
    await Promise.all([ensureSupplyVisibilitySchema(DB), ensureSupplyMetaTable(DB)])
    const [sg, table, homeMallId] = await Promise.all([loadSellerGrade(DB, sellerId), loadGradeTable(DB), resolveMallId(c)])  // 🏭 2026-06-07: 순차 await → 병렬(1 RTT 절약)
    const grade = effectiveGrade({ grade: sg.distributor_grade, specialUntil: sg.special_discount_until })
    // 🏁 2026-06-12 (전 플로우 감사 🟡): /home 만 mall_id 스코프 누락 — 멀티몰 2개+ 가동 시
    //   베스트/신상에 타 몰 상품 노출(주문은 차단되나 혼선). 카탈로그(:1090)와 동일 조건으로 정합.
    // 🏷️ 2026-06-18 등급별 노출 — baseWhere 끝에 gradeExposureWhere AND. bind 순서: ... visibility(?) → grade(?).
    //   각 쿼리의 .bind() 끝에 grade 1개 추가. 미설정 상품은 불변(현행 동일). home 은 로그인 전용이라 grade 항상 유효.
    const baseWhere = `p.is_supply_product = 1 AND p.is_active = 1 AND p.supply_source_id IS NULL AND COALESCE(p.supply_price,0) > 0 AND COALESCE(p.mall_id,1) = ${Number(homeMallId) || 1} AND ${visibilityWhere('p')} AND ${gradeExposureWhere('p')}`
    const cols = `p.id, p.name, p.image_url, p.category, p.stock, COALESCE(p.supply_price,0) AS supply_price, COALESCE(p.price,0) AS retail_price, COALESCE(p.min_order_qty,1) AS moq, EXISTS(SELECT 1 FROM product_qty_tiers t WHERE t.product_id = p.id) AS has_tiers, p.supply_margin_override_pct AS margin_override, p.dominant_color, COALESCE(p.sold_count,0) AS sold_count`
    const enrich = (rows: HomeRow[]) => (rows || []).map(r => {
      const { price } = resolveDistributorPrice({ baseSupplyPrice: r.supply_price, retailPrice: (r as { retail_price?: number }).retail_price, grade: sg.distributor_grade, specialUntil: sg.special_discount_until, table, marginOverridePct: r.margin_override })
      // ⚠️ retail_price = 권장소비자가(공급자 입력) — 원가(supply_price)/제조사 신원은 비노출. 판매사 마진 산출용.
      return { id: r.id, name: r.name, image_url: r.image_url, category: r.category, stock: r.stock, dominant_color: r.dominant_color ?? null, distributor_price: price, retail_price: r.retail_price || null, moq: Math.max(1, r.moq || 1), has_tiers: !!r.has_tiers, sold_count: r.sold_count || 0 }
    })

    const [best, fresh, cats, proposalsRes] = await Promise.all([
      DB.prepare(`SELECT ${cols} FROM products p WHERE ${baseWhere} ORDER BY COALESCE(p.sold_count,0) DESC, p.created_at DESC LIMIT 12`).bind(sellerId, grade).all<HomeRow>().catch(() => ({ results: [] as HomeRow[] })),
      DB.prepare(`SELECT ${cols} FROM products p WHERE ${baseWhere} ORDER BY p.created_at DESC LIMIT 12`).bind(sellerId, grade).all<HomeRow>().catch(() => ({ results: [] as HomeRow[] })),
      DB.prepare(`SELECT p.category AS category, COUNT(*) AS cnt FROM products p WHERE ${baseWhere} AND p.category IS NOT NULL GROUP BY p.category ORDER BY cnt DESC LIMIT 12`).bind(sellerId, grade).all<{ category: string; cnt: number }>().catch(() => ({ results: [] as { category: string; cnt: number }[] })),
      DB.prepare(`
        SELECT ${cols} FROM wholesale_proposals wp JOIN products p ON p.id = wp.product_id
        WHERE wp.status = 'active' AND wp.distributor_seller_id = ? AND ${baseWhere} ORDER BY wp.created_at DESC LIMIT 12
      `).bind(sellerId, sellerId, grade).all<HomeRow>().catch(() => ({ results: [] as HomeRow[] })),
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
//   판매사 본인 주문 라인에서 상품별 최신 1건 추출(현재 구매 가능 + 가시성 통과 한정).
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
        AND ${gradeExposureWhere('p')}
    `).bind(...ids, sellerId, effectiveGrade({ grade: sg.distributor_grade, specialUntil: sg.special_discount_until })).all<{ id: number; name: string; image_url: string | null; stock: number; supply_price: number; retail_price: number; moq: number; margin_override: number | null }>()
    const byId = new Map((prods.results || []).map(p => [p.id, p]))
    const items = ids.map(id => {
      const p = byId.get(id); const meta = seen.get(id)
      if (!p) return null
      const { price } = resolveDistributorPrice({ baseSupplyPrice: p.supply_price, retailPrice: (p as { retail_price?: number }).retail_price, grade: sg.distributor_grade, specialUntil: sg.special_discount_until, table, marginOverridePct: p.margin_override })
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
  // 🔐 2026-06-11: Bearer 없으면 ud_seller_token 쿠키 fallback (beta SSR 개인화 — GET 전용 helper).
  const sellerId = (await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET))
    ?? (await sellerIdFromCookieGet(c, c.env.JWT_SECRET))
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
  // 👑 2026-06-10 (사용자 요청): 프리미엄 전용관은 로그인(유통회원)만 — guest 는 빈 목록 + requires_login.
  //   클라(nav 버튼 숨김)와 이중 게이트 — URL 파라미터 직접 조작으로도 미노출.
  if (premiumOnly && guest) {
    c.header('Cache-Control', 'private, no-store')
    c.header('X-WS-Reason', 'premium-guest-locked')
    return c.json({ success: true, items: [], total: 0, page, limit, has_more: false, grade: null, requires_login: true, premium_locked: true })
  }
  // 🏷️ 2026-06-09 브랜드 전시관 — ?brand=<name> 이면 brand_name 정확 일치 + is_brand_product=1 만(additive WHERE).
  //   ?brands=1 이면 상품 목록 대신 현재 몰의 브랜드(brand_name) distinct 목록 + 상품수 반환(브랜드 그리드용).
  //   둘 다 미지정 = 현행 동작 완전 불변(byte-identical 요청).
  const brand = (c.req.query('brand') || '').slice(0, 120).trim()
  const brandsMode = c.req.query('brands') === '1'

  try {
    // 🏭 2026-06-16 [LOADING_ADDITIVE] (사용자 신고 — 도매 느림, 전수조사): 게스트 기본 카탈로그 조기 캐시 단락.
    //   실측: 도매 catalog 는 publicCache 미적용 → 매 요청 워커 풀(server-timing 200-470ms, 저트래픽 cold isolate 빈발).
    //   소비자(/api/products)는 edge HIT(0.14s). 여기서 핸들러 맨 앞(pragma/ensure/lookup/query 전)에 caches.default(canon)
    //   를 직접 read → guest HIT 면 즉시 반환(setup 전부 skip). 아래 put(비어있지 않을 때만)·prewarm 과 동일 키.
    //   guest = 가격 null 이라 머니 무관. 로그인은 미적용(등급가 → 기존 grade-cache 경로).
    {
      const isDefaultGuestReqEarly = guest && page === 1 && !search && !category && !sortKey
        && minPrice == null && maxPrice == null && !inStock && !premiumOnly && !brand && !brandsMode
      if (isDefaultGuestReqEarly) {
        // 🏎️ 2026-06-19 (B: 글로벌 KV 캐시) — caches.default 는 colo별이라 저트래픽 도매몰은 대부분 colo가 cold
        //   → 매번 무거운 cold D1(행 13~26s). KV(CACHE_KV)는 전 지역 복제 → 어느 colo든 즉시 HIT.
        //   cron self-fetch(guest)가 아래 put 으로 전 지역 KV를 채움. CACHE_KV 미바인딩 시 폴백(아래 caches.default).
        //   키는 host 별(멀티-몰 분리) — cron 이 live + utongstart 양 origin self-fetch 하므로 둘 다 워밍됨.
        try {
          const kv = (c.env as { CACHE_KV?: { get: (k: string) => Promise<string | null>; put: (k: string, v: string, o?: { expirationTtl?: number }) => Promise<void> } }).CACHE_KV
          if (kv) {
            const host = new URL(c.req.url).hostname
            const kvBody = await kv.get(`ws:cat:g:${host}`).catch(() => null)
            if (kvBody) return c.body(kvBody, 200, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60', 'CDN-Cache-Control': 'public, max-age=300', 'X-WS-Cache': 'KV-HIT' })
          }
        } catch { /* KV 미지원/오류 — caches.default 로 진행 */ }
        try {
          // @ts-expect-error — Cloudflare Workers 전역 caches (edge-cache.ts 동일 패턴)
          const early = (await caches.default.match(new Request(c.req.url, { method: 'GET' })).catch(() => null)) as Response | null
          if (early) {
            const body = await early.text()
            if (body) return c.body(body, 200, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60', 'CDN-Cache-Control': 'public, max-age=300', 'X-WS-Cache': 'HIT' })
          }
        } catch { /* caches 미지원/오류 — 라이브 쿼리로 진행 */ }
      }
    }
    // 🏭 2026-06-16 [LOADING_ADDITIVE] 로그인 등급캐시 조기 단락 — 저트래픽 mall 의 cold isolate 에서 무거운
    //   setup(pragma/ensure/lookup/query) 전에 colo 공유 등급캐시를 먼저 read → HIT 면 즉시 반환(setup skip).
    //   miss 면 아래 기존 흐름 그대로(lookup 재로드 — 가격계산/캐시키 무변경, additive). 필요 lookup 은 product-column
    //   ensure 불필요(loadSellerGrade=sellers / resolveMallId=host / hasRestrictedVisibility=catch 폴백) → 안전.
    if (!guest && !brandsMode) {
      try {
        const [sgE, mallIdE, visE] = await Promise.all([
          loadSellerGrade(DB, sellerId!),
          resolveMallId(c),
          hasRestrictedVisibility(DB).catch(() => true), // 못 정하면 restricted 취급 → 조기캐시 미사용(안전)
        ])
        if (visE === false) {
          const gradeE = effectiveGrade({ grade: sgE.distributor_grade, specialUntil: sgE.special_discount_until })
          const u = new URL(c.req.url)
          u.searchParams.set('__g', gradeE)
          u.searchParams.set('__m', String(mallIdE))
          // @ts-expect-error — Cloudflare Workers 전역 caches
          const hit = (await caches.default.match(new Request(u.toString(), { method: 'GET' })).catch(() => null)) as Response | null
          if (hit) {
            const body = await hit.text()
            if (body) return c.body(body, 200, { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60', 'X-Grade-Cache': 'HIT-EARLY' })
          }
        }
      } catch { /* 폴백: 아래 정상 경로로 진행 */ }
    }
    // 🏭 2026-06-10 (사용자 신고 — 카탈로그 느림, 전수조사): pragma 존재 체크를 isolate 당 1회로.
    //   기존: 매 요청 pragma_table_info 쿼리(+1 RTT). 양성(컬럼 있음)만 캐시 — 음성은 repair 후 즉시 복귀.
    if (!_supplyCatalogReady.has(DB)) {
      // 🚑 2026-06-16 (사용자 — "상품 안 뜨는 문제 예방"): 일시적 스키마 체크 오류를 '상품 0개(성공)'로
      //   위장하지 않는다. 빈 결과를 반환하면 캐시/SSR 로 빈 그리드가 퍼지는 게 '상품 안 뜸'의 근본 producer.
      //   → 오류면 throw(→ safeError 500 → 클라 retry 로 자동 복구, 절대 캐시 안 됨). 컬럼이 '실제로' 없을 때만
      //   (repair 전) 빈 응답 + no-store. COUNT(*) 은 항상 row 반환하므로 정상 경로에선 c≥1.
      let hasCol: { c: number } | null
      try {
        hasCol = await DB.prepare(
          "SELECT COUNT(*) as c FROM pragma_table_info('products') WHERE name='is_supply_product'"
        ).first<{ c: number }>()
      } catch {
        throw new Error('wholesale-catalog: supply schema check failed (transient)')
      }
      if (!hasCol || hasCol.c === 0) {
        // 컬럼 실제 부재(repair-schema 실행 전) — 빈 응답이지만 절대 캐시 금지(빈 그리드 고착 방지).
        c.header('Cache-Control', 'private, no-store')
        c.header('X-WS-Total', '0')
        c.header('X-WS-Reason', 'schema-missing-is_supply_product')
        return c.json({ success: true, items: [], total: 0, page, limit, has_more: false, grade: 'C' })
      }
      _supplyCatalogReady.add(DB)
    }

    // ensure 류는 WeakSet 메모이즈(첫 요청 후 no-op) — 병렬 실행으로 첫 요청 RTT 도 단축.
    await Promise.all([ensureSupplyVisibilitySchema(DB), ensureQtyConstraintSchema(DB), ensureSupplierPolicySchema(DB), ensureSupplyMetaTable(DB)])
    // 🏭 등급/등급표/몰/가시성제한 — 상호 독립 쿼리 4개 순차 await → 병렬(1 RTT).
    const [sg, table, mallId, visRestricted] = await Promise.all([
      guest ? Promise.resolve({ distributor_grade: null, special_discount_until: null } as Awaited<ReturnType<typeof loadSellerGrade>>) : loadSellerGrade(DB, sellerId!),
      loadGradeTable(DB),
      resolveMallId(c),
      hasRestrictedVisibility(DB),
    ])
    const grade: DistributorGrade = effectiveGrade({ grade: sg.distributor_grade, specialUntil: sg.special_discount_until })

    // 🏭 2026-06-10 (최속화): 등급 단위 엣지 캐시 — 같은 (등급, 몰, 쿼리)는 같은 응답이므로
    //   로그인 사용자끼리 60초 공유. 단, 허용목록 제한 상품이 1개라도 있으면 per-seller 응답이라 비활성.
    //   guest 는 기존 CDN-Cache-Control 공유캐시 경로 그대로(이 캐시 미사용).
    let gradeCacheKey: Request | null = null
    if (!guest && !brandsMode && !visRestricted) {
      try {
        const u = new URL(c.req.url)
        u.searchParams.set('__g', grade)
        u.searchParams.set('__m', String(mallId))
        gradeCacheKey = new Request(u.toString(), { method: 'GET' })
        // @ts-expect-error — Cloudflare Workers 전역 caches (edge-cache.ts:110 동일 패턴)
        const hit = (await caches.default.match(gradeCacheKey).catch(() => null)) as Response | null
        if (hit) {
          const body = await hit.text()
          return c.body(body, 200, {
            'Content-Type': 'application/json',
            'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
            'X-Grade-Cache': 'HIT',
          })
        }
      } catch { gradeCacheKey = null /* caches 미지원 환경 — 라이브 쿼리로 진행 */ }
    }

    // 도매 가능 = 제조사 공급상품(공급자 직등록 원본). supply_source_id IS NULL = 원본(셀러 복제본 제외).
    // + 공급 범위(supply_visibility) 가시성: ALL 이거나 허용목록(선정된 유통회원)에 포함.
    // + 몰 스코핑: p.mall_id = 요청 몰(기본 1 → 기존 데이터 전 행 1 → byte-identical).
    let where = `p.is_supply_product = 1 AND p.is_active = 1 AND p.supply_source_id IS NULL AND COALESCE(p.supply_price,0) > 0 AND COALESCE(p.mall_id,1) = ? AND ${visibilityWhere('p')}`
    const params: (string | number)[] = [mallId, visBind]
    // 🏷️ 2026-06-18 등급별 노출 — visible_grades 제한 상품은 해당 등급 판매사에게만(게스트 '' → 제한상품 전부 제외).
    //   미설정 상품은 절(NOT EXISTS)이 항상 참이라 byte-identical(현행 불변). bind 1개 = viewer 등급(effective).
    //   ⚠️ 등급캐시 키(__g=grade)가 노출 차원을 이미 분할 → guest 공유캐시/등급캐시 모두 정합.
    where += ` AND ${gradeExposureWhere('p')}`
    params.push(guest ? '' : grade)
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
    // 🏷️ 2026-06-09 브랜드 전시관 필터(additive — 미지정 시 조건 미추가로 현행 동작 불변).
    //   브랜드 상품(is_brand_product=1)만 + 정확한 brand_name 일치. 기존 mall/visibility WHERE 와 AND-ed.
    if (brand) { where += ' AND COALESCE(p.is_brand_product,0) = 1 AND p.brand_name = ?'; params.push(brand) }

    // 🏷️ 브랜드 목록 모드 — 상품 그리드 대신 현재 몰의 브랜드(brand_name) distinct + 상품수 반환.
    //   ⚠️ 동일 where(mall + visibility + 검색/카테고리/가격/재고 필터) 위에서 집계 → 가시성/스코프 AND 보존.
    //   브랜드 상품만 집계(is_brand_product=1 + brand_name NOT NULL/공백). 가격/공급가 절대 비노출(이름·개수만).
    if (brandsMode) {
      const brandWhere = `${where} AND COALESCE(p.is_brand_product,0) = 1 AND p.brand_name IS NOT NULL AND TRIM(p.brand_name) <> ''`
      const brandRows = await DB.prepare(`
        SELECT p.brand_name AS brand_name, COUNT(*) AS product_count,
               MAX(p.brand_logo_url) AS brand_logo_url
        FROM products p
        WHERE ${brandWhere}
        GROUP BY p.brand_name
        ORDER BY product_count DESC, p.brand_name ASC
        LIMIT 200
      `).bind(...params).all<{ brand_name: string; product_count: number; brand_logo_url: string | null }>().catch(() => ({ results: [] as { brand_name: string; product_count: number; brand_logo_url: string | null }[] }))
      // guest(가격 비노출) → 공유캐시 / 로그인 → private(브랜드 목록 자체는 등급 무관이나 일관성 위해 동일 정책).
      if (guest) {
        c.header('Cache-Control', 'public, max-age=60')
        c.header('CDN-Cache-Control', 'public, max-age=300')
      } else {
        c.header('Cache-Control', 'private, no-store')
      }
      return c.json({ success: true, brands: (brandRows.results || []).map(r => ({ name: r.brand_name, product_count: r.product_count, logo_url: r.brand_logo_url || null })) })
    }

    // 정렬: 화이트리스트만(injection 불가). 미지정 = 현행 popular 정렬과 동일 리터럴.
    const orderBy = CATALOG_SORT_ORDER[sortKey] || CATALOG_SORT_ORDER.popular

    // 🏭 2026-06-10 (전수조사): 목록 + COUNT 동일 WHERE — 순차(2 RTT) → 병렬(1 RTT).
    //   제조사 배송정책도 별도 쿼리(loadSupplierPolicies, +1 RTT) → suppliers LEFT JOIN 으로 합침.
    const [rows, totalRow] = await Promise.all([
      DB.prepare(`
      SELECT p.id, p.name, p.description, p.image_url, p.category, p.stock, p.supplier_id,
             COALESCE(p.supply_price, 0) AS supply_price, COALESCE(p.price,0) AS retail_price,
             COALESCE(p.min_order_qty,1) AS moq,
             COALESCE(p.pack_size,1) AS pack_size, COALESCE(p.order_multiple,1) AS order_multiple,
             COALESCE(p.is_premium,0) AS is_premium, COALESCE(p.is_brand_product,0) AS is_brand_product, p.brand_name, p.brand_logo_url,
             EXISTS(SELECT 1 FROM product_qty_tiers t WHERE t.product_id = p.id) AS has_tiers,
             COALESCE(p.sold_count,0) AS sold_count, p.supply_margin_override_pct AS margin_override,
             COALESCE(sup.min_order_amount,0) AS sup_min_order, COALESCE(sup.shipping_fee,0) AS sup_ship_fee, COALESCE(sup.free_ship_threshold,0) AS sup_free_ship
      FROM products p
      LEFT JOIN suppliers sup ON sup.id = p.supplier_id
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all<{
        id: number; name: string; description: string | null; image_url: string | null;
        category: string | null; stock: number; supplier_id: number | null; supply_price: number; retail_price: number; moq: number; pack_size: number; order_multiple: number; is_premium: number; is_brand_product: number; brand_name: string | null; brand_logo_url: string | null; has_tiers: number; sold_count: number; margin_override: number | null;
        sup_min_order: number; sup_ship_fee: number; sup_free_ship: number
      }>(),
      DB.prepare(`SELECT COUNT(*) AS c FROM products p WHERE ${where}`)
        .bind(...params).first<{ c: number }>().catch(() => ({ c: 0 })),
    ])
    const total = totalRow?.c ?? 0

    // 🔭 2026-06-18 (대표 신고 — "0개 + 거기까지도 느림", 전수조사): 카탈로그 0개 '원인'을 응답 헤더로 즉시 판별.
    //   브라우저 Network 탭(F12) → /api/wholesale/catalog 응답 헤더만 보면 mall 불일치 vs 데이터필터 구분 가능.
    //   X-WS-Mall(해석된 몰) · X-WS-Total(WHERE 통과 수) · X-WS-Guest · X-WS-Vis-Restricted.
    //   추가 COUNT 2개는 total===0(이미 깨진 경로)일 때만 실행 → 상품이 보이는 정상 경로엔 추가쿼리 0(perf 무영향).
    c.header('X-WS-Mall', String(mallId))
    c.header('X-WS-Total', String(total))
    c.header('X-WS-Guest', guest ? '1' : '0')
    c.header('X-WS-Vis-Restricted', visRestricted ? '1' : '0')
    if (total === 0) {
      try {
        const [anyMallVis, rawSupply] = await Promise.all([
          // mall/visibility 무시 — is_active+source+supply_price 만. 이게 >0 인데 X-WS-Total=0 → 원인=mall 또는 visibility.
          DB.prepare("SELECT COUNT(*) c FROM products p WHERE p.is_supply_product=1 AND p.is_active=1 AND p.supply_source_id IS NULL AND COALESCE(p.supply_price,0)>0").first<{ c: number }>().catch(() => ({ c: -1 })),
          // 모든 공급상품(필터 0). 이게 >0 인데 위(NoMallVis)=0 → 원인=is_active/supply_source_id/supply_price.
          DB.prepare("SELECT COUNT(*) c FROM products p WHERE p.is_supply_product=1").first<{ c: number }>().catch(() => ({ c: -1 })),
        ])
        c.header('X-WS-Total-NoMallVis', String(anyMallVis?.c ?? -1))
        c.header('X-WS-Supply-Raw', String(rawSupply?.c ?? -1))
      } catch { /* 진단 COUNT 실패 — 본 응답엔 영향 없음 */ }
    }


    //   비로그인(guest) → 도매가/권장가/마진 전부 가림(null) + requires_login. (옵션 A: 도매가 숨김)
    const items = (rows.results || []).map(r => {
      const price = guest ? null : resolveDistributorPrice({
        baseSupplyPrice: r.supply_price, retailPrice: r.retail_price, grade: sg.distributor_grade,
        specialUntil: sg.special_discount_until, table, marginOverridePct: r.margin_override,
      }).price
      const supId = (Number.isFinite(r.supplier_id as number) && (r.supplier_id as number) > 0) ? (r.supplier_id as number) : null
      // 🚚 정책은 JOIN 으로 동봉됨 (loadSupplierPolicies 별도 RTT 제거) — 동일 값.
      const supPol = supId != null ? { min_order_amount: Math.max(0, Math.floor(r.sup_min_order || 0)), shipping_fee: Math.max(0, Math.floor(r.sup_ship_fee || 0)), free_ship_threshold: Math.max(0, Math.floor(r.sup_free_ship || 0)) } : undefined
      return {
        id: r.id, name: r.name, description: r.description, image_url: r.image_url,
        category: r.category, stock: r.stock, distributor_price: price,
        retail_price: guest ? null : (r.retail_price || null), moq: Math.max(1, r.moq || 1),
        // BIZ-8: pack_size(박스당 낱개 — 표시용) / order_multiple(주문 배수 강제). 둘 다 최소 1.
        pack_size: Math.max(1, r.pack_size || 1), order_multiple: Math.max(1, r.order_multiple || 1),
        is_premium: !!r.is_premium,
        // 🏷️ 브랜드 전시관 — 브랜드제품이면 brand_name/brand_logo_url 노출(카드/필터 표시용). 일반제품은 null.
        is_brand_product: !!r.is_brand_product,
        brand_name: (r.is_brand_product && r.brand_name) ? r.brand_name : null,
        brand_logo_url: (r.is_brand_product && r.brand_logo_url) ? r.brand_logo_url : null,
        has_tiers: !!r.has_tiers, sold_count: r.sold_count || 0,
        // 🚚 제조사별 배송/주문 정책(비식별 group key + 정책 숫자) — 카트 그룹 계산용.
        supplier_group: supId != null ? `s${supId}` : null,
        supplier_policy: supId != null ? { min_order_amount: supPol?.min_order_amount ?? 0, shipping_fee: supPol?.shipping_fee ?? 0, free_ship_threshold: supPol?.free_ship_threshold ?? 0 } : null,
        requires_login: guest,
      }
    })

    // 🏭 캐시 분리: guest(가격 비노출 → grade 무관 동일 응답)만 공유캐시. 로그인 응답은 등급가 개인화라 private.
    //   guest 카탈로그는 banners 와 동일 분리 헤더(브라우저 60s + edge 300s). KV write 미사용(edge only).
    // 🏭 2026-06-10 (전수조사): 로그인도 no-store → private+max-age=30 — 같은 사용자 브라우저만 30초 재사용
    //   (탭 이동/뒤로가기 즉시). 등급 변경 반영 지연 최대 30초 — 허용 범위. 공유캐시는 여전히 금지(private).
    const payload = JSON.stringify({ success: true, items, total, page, limit, has_more: offset + items.length < total, grade: guest ? null : grade, requires_login: guest })
    // 🚑 2026-06-16 (사용자 신고 — "상품이 안 뜰 때도 있고 왔다갔다"): 빈 결과(콜드 isolate/일시 D1 오류로
    //   items=0)는 절대 공유 캐시 금지. 캐시되면 max-age 동안 모든 사용자에게 빈 그리드 + SSR 가 빈 배열을
    //   initialData 로 주입 → guest 가 refetch 없이 빈 화면 고착. 비어있으면 no-store 로 다음 요청이 즉시 재시도.
    const isEmptyCatalog = items.length === 0
    // 기본 guest 요청(검색/카테고리/정렬/가격/프리미엄/브랜드 미지정) — SSR/prewarm 이 읽는 캐논 키와 1:1.
    const isDefaultGuestReq = guest && page === 1 && !search && !category && !sortKey
      && minPrice == null && maxPrice == null && !inStock && !premiumOnly && !brand && !brandsMode
    if (guest) {
      if (isEmptyCatalog) {
        c.header('Cache-Control', 'private, no-store')
      } else {
        c.header('Cache-Control', 'public, max-age=60')
        c.header('CDN-Cache-Control', 'public, max-age=300')
        // 🏭 2026-06-16: 기본 guest 카탈로그(비어있지 않을 때만)를 SSR/prewarm 캐논 키에 명시적 edge put.
        //   기존엔 put 이 없어 worker SSR 의 caches.default.match 가 매번 miss → self-fetch(261ms). 이제 edge-hit(~3ms).
        //   빈 응답은 위 분기에서 제외돼 절대 캐시되지 않음(빈 그리드 고착 방지).
        if (isDefaultGuestReq && c.executionCtx) {
          const origin = new URL(c.req.url).origin
          const mkRes = () => new Response(payload, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' } })
          // 🏎️ 2026-06-19 (B): 글로벌 KV write — cron self-fetch(guest)가 이걸 트리거해 전 지역 KV를 채움.
          //   host 별 키(early KV read 와 1:1). TTL 600s(>cron 5분 주기 → 항상 신선 유지). CACHE_KV 없으면 skip.
          const kv = (c.env as { CACHE_KV?: { put: (k: string, v: string, o?: { expirationTtl?: number }) => Promise<void> } }).CACHE_KV
          const host = new URL(c.req.url).hostname
          c.executionCtx.waitUntil(Promise.all([
            // @ts-expect-error — Cloudflare Workers 전역 caches
            caches.default.put(new Request(`${origin}/api/wholesale/catalog`, { method: 'GET' }), mkRes()).catch(swallow('wholesale:guest-catalog-cache')),
            // @ts-expect-error — Cloudflare Workers 전역 caches
            caches.default.put(new Request(`${origin}/api/wholesale/catalog?`, { method: 'GET' }), mkRes()).catch(swallow('wholesale:guest-catalog-cache')),
            kv ? kv.put(`ws:cat:g:${host}`, payload, { expirationTtl: 600 }).catch(swallow('wholesale:guest-catalog-kv')) : Promise.resolve(),
          ]))
        }
      }
    } else {
      c.header('Cache-Control', 'private, max-age=30, stale-while-revalidate=60')
      // 🏭 등급 단위 엣지 캐시 저장 (60s) — 같은 등급의 다음 사용자/요청은 D1 0회. 빈 결과는 캐시 금지(고착 방지).
      if (gradeCacheKey && !isEmptyCatalog && c.executionCtx) {
        c.executionCtx.waitUntil(
          // @ts-expect-error — Cloudflare Workers 전역 caches (edge-cache.ts:110 동일 패턴)
          caches.default.put(gradeCacheKey, new Response(payload, {
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
          })).catch(swallow('wholesale:grade-cache-put')),
        )
      }
    }
    c.header('Content-Type', 'application/json')
    return c.body(payload)
  } catch (err) {
    return safeError(c, err, '카탈로그 조회 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── GET /catalog/:id ──────────────────────────────────────────────────────────
app.get('/catalog/:id', async (c) => {
  // 🏭 2026-06-04 몰-first: 비로그인도 상품 상세 열람 가능. 가격(등급가/권장가/tier)은 로그인 시에만.
  // 🔐 2026-06-11: Bearer 없으면 ud_seller_token 쿠키 fallback (beta SSR 개인화 — GET 전용 helper).
  const sellerId = (await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET))
    ?? (await sellerIdFromCookieGet(c, c.env.JWT_SECRET))
  const guest = !sellerId
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 상품 ID' }, 400)
  try {
    await ensureSupplyVisibilitySchema(DB)
    await ensureQtyConstraintSchema(DB) // BIZ-8: pack_size / order_multiple 컬럼 보장(SELECT 전). (+ products.mall_id 보장)
    await ensureSupplyMetaTable(DB) // 🏷️ 등급별 노출 서브쿼리(visible_grades) 대상 테이블 보장(SELECT 전)
    // 🏬 멀티-몰: 요청 몰 스코핑(기본 1 → 기존 데이터 전 행 1 → byte-identical).
    const mallId = await resolveMallId(c)
    // 🏷️ 2026-06-18 등급별 노출 게이트 — 직접 URL 접근(ID 추측)으로도 제한상품 못 보게 SELECT WHERE 에 포함.
    //   게스트는 ''(제한상품 제외), 로그인은 effective 등급. sg 는 아래 가격계산(1461)에서 재사용(중복 로드 X).
    const sg = guest
      ? ({ distributor_grade: null, special_discount_until: null } as Awaited<ReturnType<typeof loadSellerGrade>>)
      : await loadSellerGrade(DB, sellerId!)
    const viewerGrade = guest ? '' : effectiveGrade({ grade: sg.distributor_grade, specialUntil: sg.special_discount_until })
    const r = await DB.prepare(`
      SELECT p.id, p.name, p.description, p.image_url, p.detail_images, p.category, p.stock, p.supplier_id,
             COALESCE(p.supply_price,0) AS supply_price, COALESCE(p.price,0) AS retail_price,
             COALESCE(p.min_order_qty,1) AS moq,
             COALESCE(p.pack_size,1) AS pack_size, COALESCE(p.order_multiple,1) AS order_multiple,
             COALESCE(p.sold_count,0) AS sold_count, p.supply_margin_override_pct AS margin_override
      FROM products p
      WHERE p.id = ? AND p.is_supply_product = 1 AND p.is_active = 1
        AND p.supply_source_id IS NULL AND COALESCE(p.supply_price,0) > 0
        AND COALESCE(p.mall_id,1) = ?
        AND ${visibilityWhere('p')}
        AND ${gradeExposureWhere('p')}
    `).bind(id, mallId, sellerId ?? -1, viewerGrade).first<{
      id: number; name: string; description: string | null; image_url: string | null; detail_images: string | null;
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
    // 🚚 2026-06-16: 상품별 배송비(product_supply_meta.wholesale_shipping_fee) — 설정 시 제조사 정책 배송비 대신
    //   이 값 우선(체크아웃 computeSupplierShipping 과 동일 SSOT). 미설정이면 null → 클라가 정책 배송비로 폴백 표시.
    const shipMeta = (await getSupplyMeta(DB, [id]).catch(() => undefined))?.get(id)
    const productShippingFee = parseProductShipFee(shipMeta) ?? null

    const moq = Math.max(1, r.moq || 1)
    const packSize = Math.max(1, r.pack_size || 1)
    const orderMultiple = Math.max(1, r.order_multiple || 1)
    // 🖼️ 2026-06-12: 상세페이지 이미지(JSON 배열) — 썸네일과 분리 노출 (guest 포함, 가격정보 아님).
    let detailImages: string[] = []
    try { const arr = JSON.parse(r.detail_images || '[]'); if (Array.isArray(arr)) detailImages = arr.filter(u => typeof u === 'string').slice(0, 10) } catch { /* 손상 JSON — 무시 */ }
    if (guest) {
      // 🏭 guest 상세는 가격 비노출 → 공유캐시 안전(브라우저 60s + edge 300s, banners 와 동일 분리). KV 미사용.
      c.header('Cache-Control', 'public, max-age=60')
      c.header('CDN-Cache-Control', 'public, max-age=300')
      return c.json({
        success: true,
        item: {
          id: r.id, name: r.name, description: r.description, image_url: r.image_url,
          detail_images: detailImages,
          category: r.category, stock: r.stock, distributor_price: null,
          retail_price: null, moq, pack_size: packSize, order_multiple: orderMultiple,
          sold_count: r.sold_count || 0, tiers: [], requires_login: true,
          supplier_group: supplierGroup, supplier_policy: supplierPolicy,
          product_shipping_fee: productShippingFee,
          inquirable: supId != null,
        },
        grade: null, requires_login: true,
      })
    }

    // 🛡️ PRC-1: 최소 플랫폼 마진율(%) — DISPLAY 와 CHARGE 가 동일 floor 를 쓰도록 요청당 1회 읽음(기본 0=현행 불변).
    //   네 쿼리 모두 독립 → 병렬(3 RTT 절약, 카탈로그 리스트와 동일 패턴).
    const [table, minMarginPct, tierMap] = await Promise.all([
      loadGradeTable(DB),
      loadMinPlatformMarginPct(DB),
      loadQtyTiers(DB, [id]),
    ]) // sg 는 SELECT 전 등급게이트에서 이미 로드됨(재사용 — 중복 쿼리 제거)
    const { price, grade } = resolveDistributorPrice({
      baseSupplyPrice: r.supply_price, retailPrice: r.retail_price, grade: sg.distributor_grade,
      specialUntil: sg.special_discount_until, table, marginOverridePct: r.margin_override,
    })
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
        detail_images: detailImages,
        category: r.category, stock: r.stock, distributor_price: price,
        retail_price: r.retail_price || null, moq, pack_size: packSize, order_multiple: orderMultiple,
        sold_count: r.sold_count || 0,
        tiers,
        supplier_group: supplierGroup, supplier_policy: supplierPolicy,
        product_shipping_fee: productShippingFee,
        // 🛡️ 2026-06-13 (채팅 fix): 연결된 제조사 있을 때만 '제조사에 문의' 노출 (신원 비공개 — boolean 만).
        inquirable: supId != null,
      },
      grade,
    })
  } catch (err) {
    return safeError(c, err, '상품 조회 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── 📊 GET /market-signal — 판매사용 시장 신호 (2026-06-12 감사 개선 ⑤) ─────────
//   제조사 등록 폼에 만든 자산(네이버 최저가 + 수요/시즌 신호)을 판매사 사입 의사결정에도 재사용.
//   로그인 판매사 전용(가격 책정 보조 — guest 비노출), 키 미설정 시 configured:false(UI 숨김).
app.get('/market-signal', rateLimit({ action: 'wholesale-market-signal', max: 30, windowSec: 60 }), async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  try {
    const q = String(c.req.query('q') || '').trim().slice(0, 100)
    const category = String(c.req.query('category') || '').trim().slice(0, 30)
    // ⚠️ worker dynamic import 는 상대경로만 (CLAUDE.md — alias 조합 crash).
    const [{ checkNaverLowestPrice }, { fetchDemandSignal }] = await Promise.all([
      import('../../../worker/utils/naver-shopping-price'),
      import('../../../worker/utils/naver-datalab'),
    ])
    const [price, demand] = await Promise.all([
      checkNaverLowestPrice(c.env.NAVER_SEARCH_CLIENT_ID, c.env.NAVER_SEARCH_CLIENT_SECRET, q),
      fetchDemandSignal(c.env.NAVER_SEARCH_CLIENT_ID, c.env.NAVER_SEARCH_CLIENT_SECRET, q, category),
    ])
    if (!price.configured && !demand.configured) return c.json({ success: true, configured: false })
    return c.json({
      success: true,
      configured: true,
      lowest: price.ok ? price.lowest : null,
      items: price.ok ? (price.items || []).slice(0, 3) : [],
      shopping: demand.shopping ?? null,
      season: demand.season ?? null,
    })
  } catch (err) {
    return safeError(c, err, '시장 신호 조회 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── POST /orders — B2B 주문 생성(PENDING) + Toss 결제 파라미터 반환 ────────────
app.post('/orders', rateLimit({ action: 'wholesale-order', max: 30, windowSec: 60 }), async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  // 👥 ADDITIVE 권한 게이트: 'viewer' 직원은 주문 불가(조회만). owner/admin/staff/일반 판매사는 영향 없음.
  //   ⚠️ JWT 클레임만 읽는 추가 검사 — money-CAS/reserve-before-charge/결제 로직은 절대 미변경.
  const { subRole: orderSubRole } = await subClaimsFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (orderSubRole === 'viewer') return c.json({ success: false, error: '주문 권한이 없는 계정(뷰어)입니다' }, 403)
  const { DB } = c.env
  // 🖋️ 2026-06-22 (전자계약 차단): 미서명 계약이 있으면 발주 차단 — 카카오 서명 완료 후 거래.
  //   contract_signatures 행이 없으면(미설정·기존/자격증명 전 계정) 통과 → 락아웃 방지(grandfather).
  if (await hasUnsignedContract(DB, 'distributor', sellerId)) {
    return c.json({ success: false, error: '전자계약서 서명 완료 후 발주할 수 있습니다. 카카오로 받은 계약서에 서명해주세요.', code: 'CONTRACT_REQUIRED' }, 403)
  }
  // 🔐 2026-06-24 (전수조사): 승인 후 정지·거부된 판매사가 만료 전 토큰으로 발주(예치금 차감)하던 갭 차단.
  if (await isSellerBlocked(DB, sellerId)) {
    return c.json({ success: false, error: '계정이 정지·승인대기 상태입니다. 관리자에게 문의해주세요.', code: 'ACCOUNT_NOT_ACTIVE' }, 403)
  }
  try {
    await ensureOrderTables(DB)
    // 만료 정리(best-effort): 이 판매사의 1시간 경과 미결제(PENDING) 주문 = 체크아웃 이탈 → EXPIRED.
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
    await ensureSupplyMetaTable(DB) // 🏷️ 등급별 노출 게이트(visible_grades) 서브쿼리 대상 보장
    // 🛡️ PRC-1: 최소 플랫폼 마진율(%) 요청당 1회 — CHARGE 가 DISPLAY(카탈로그)와 동일 floor 를 쓰도록(기본 0=현행 불변).
    // 🆕 2026-06-16 commPct: 정산 분배(제조사 vs 플랫폼). 정산 호출(creditSupplier…)이 같은 요청에서 동기 실행 → drift 없음.
    const [sg, table, minMarginPct, commPct] = await Promise.all([loadSellerGrade(DB, sellerId), loadGradeTable(DB), loadMinPlatformMarginPct(DB), loadPlatformCommissionPct(DB)])  // 🏭 2026-06-07: 순차 await → 병렬(1 RTT 절약)
    // 🏷️ 2026-06-18 등급별 노출 게이트 — 카탈로그에서 안 보이는(등급 제한) 상품은 ID 직접 주문도 차단.
    const orderViewerGrade = effectiveGrade({ grade: sg.distributor_grade, specialUntil: sg.special_discount_until })
    const ids = [...reqMap.keys()]
    const placeholders = ids.map(() => '?').join(',')
    // 가시성 가드 — 판매사가 볼 수 없는(선정 안 된) 공급상품은 주문 불가.
    // 🏬 감사 🟡#3: mall 스코프 — 카탈로그처럼 주문도 요청 판매사의 몰로 제한(크로스몰 주문 차단).
    const orderMallId = await resolveMallId(c)
    const prods = await DB.prepare(`
      SELECT p.id, p.name, p.supplier_id, p.stock, COALESCE(p.supply_price,0) AS supply_price, COALESCE(p.price,0) AS retail_price, COALESCE(p.min_order_qty,1) AS moq, COALESCE(p.order_multiple,1) AS order_multiple, p.supply_margin_override_pct AS margin_override
      FROM products p
      WHERE p.id IN (${placeholders}) AND p.is_supply_product = 1 AND p.is_active = 1
        AND p.supply_source_id IS NULL AND COALESCE(p.supply_price,0) > 0
        AND COALESCE(p.mall_id,1) = ? AND ${visibilityWhere('p')}
        AND ${gradeExposureWhere('p')}
    `).bind(...ids, orderMallId, sellerId, orderViewerGrade).all<{ id: number; name: string; supplier_id: number | null; stock: number | null; supply_price: number; retail_price: number; moq: number; order_multiple: number; margin_override: number | null }>()
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
    const shipMeta = await getSupplyMeta(DB, ids) // 🚚 상품별 배송비(wholesale_shipping_fee) 일괄 로드 — 없으면 제조사 정책 폴백.
    let subtotal = 0, supplyTotal = 0
    const lines: Array<{ product_id: number; supplier_id: number | null; name: string; qty: number; base: number; unit: number; line_total: number; product_shipping_fee?: number }> = []
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
        baseSupplyPrice: p.supply_price, retailPrice: p.retail_price, grade: sg.distributor_grade,
        specialUntil: sg.special_discount_until, table, marginOverridePct: p.margin_override,
        defaultPlatformMarginPct: commPct, // 🆕 제품별 마진 미설정 시 어드민 전역 기본(%)
      })
      // 🛡️ PRC-1: CHARGE 도 DISPLAY(카탈로그 /catalog/:id) 와 동일 floor 사용 — display==charge 정합 필수.
      //   floor = effectiveTierFloor(등급가, 공급원가, 최소마진%) = min(등급가, round(공급가×(1+최소마진%))).
      //   원가+최소마진(PG 수수료 커버) 하한 + 등급가 초과 금지 clamp. 기본(minMargin=0)이면 = 공급가(현행 역마진 차단 동작 불변).
      const tierFloor = effectiveTierFloor(price, p.supply_price, minMarginPct)
      // 등급가 위에 수량 구간 할인 적용 → 최종 authoritative 단가.
      const unit = tierUnitPrice(price, qty, tierMap.get(p.id), tierFloor)
      const lineTotal = unit * qty
      subtotal += lineTotal
      // 🆕 2026-06-16 supply_total = 제조사 정산액(공급가×(1−수수료%), 원가 하한). margin_total = subtotal − supply_total = 플랫폼 수수료.
      const { manufacturerUnit } = splitWholesaleUnit(unit, p.supply_price, commPct)
      supplyTotal += manufacturerUnit * qty
      lines.push({ product_id: p.id, supplier_id: p.supplier_id, name: p.name, qty, base: p.supply_price, unit, line_total: lineTotal, product_shipping_fee: parseProductShipFee(shipMeta.get(p.id)) })
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
      await DB.prepare("DELETE FROM wholesale_orders WHERE id=? AND status='PENDING'").bind(dOrderId).run().catch(swallow('wholesale:pending-release'))
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
    await DB.prepare("UPDATE wholesale_orders SET status='PAID', paid_at=datetime('now') WHERE id=? AND status='PENDING'").bind(dOrderId).run().catch(swallow('wholesale:paid-cas'))

    // 제조사 정산 적립(Toss/credit 주문과 동일 — 멱등, fail-soft). 정산 실패가 결제완료를 막지 않음.
    try { await creditSupplierOnWholesaleOrder(DB, dOrderId) } catch { /* best-effort */ }

    // 🔔 제조사 신규주문 알림 (fail-soft — 감사 fix 2026-06-12).
    await notifySuppliersOfPaidOrder(DB, dOrderId).catch(swallow('wholesale:notify-suppliers'))

    // 🏭 Wave 3c: 전자세금계산서 자동발행 레코드(매출=플랫폼→판매사 / 매입=제조사→플랫폼 역발행).
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
  // 🔐 2026-06-24 (전수조사): 정지·거부 판매사 차단 — Toss 캡처(confirmTossPayment) 전에 차단해 무단결제 방지.
  if (await isSellerBlocked(DB, sellerId)) {
    return c.json({ success: false, error: '계정이 정지·승인대기 상태입니다. 관리자에게 문의해주세요.', code: 'ACCOUNT_NOT_ACTIVE' }, 403)
  }
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
      await DB.prepare("UPDATE wholesale_orders SET status='FAILED' WHERE id=?").bind(order.id).run().catch(swallow('wholesale:fail-mark'))
      return c.json({ success: false, error: '재고가 부족하여 자동 환불되었습니다. 다시 시도해주세요.', code: 'OVERSOLD' }, 409)
    }

    // 제조사 정산 적립 (멱등, fail-soft — 정산 실패가 결제완료를 막지 않음).
    try { await creditSupplierOnWholesaleOrder(DB, order.id) } catch { /* best-effort */ }

    // 🔔 제조사 신규주문 알림 (fail-soft — 감사 fix 2026-06-12, PAID CAS 승자 경로만 도달).
    await notifySuppliersOfPaidOrder(DB, order.id).catch(swallow('wholesale:notify-suppliers'))

    // 🏭 Wave 3c: 전자세금계산서 자동발행 레코드(멱등·fail-soft·additive — env-gated provider 발행).
    try { await generateWholesaleSalesInvoice(DB, c.env, order.id) } catch { /* best-effort */ }
    try { await generateWholesalePurchaseInvoices(DB, c.env, order.id) } catch { /* best-effort */ }

    return c.json({ success: true, order_id: order.id })
  } catch (err) {
    return safeError(c, err, '결제 확인 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── GET /orders/export — 도매 주문 내역 .xlsx 다운로드 (판매사 본인 것만, IDOR 가드) ─────
//   컬럼: 주문번호/주문일/결제일/상태/등급/상품합계/배송비/총결제/운송장. 최신 5000건.
//   Rate limit: 10건/분 — 반복 대량 추출 방지.
app.get('/orders/export', rateLimit({ action: 'wholesale-orders-export', max: 10, windowSec: 60 }), async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureOrderTables(DB)
    const { results } = await DB.prepare(`
      SELECT id, toss_order_id, status, grade,
             COALESCE(subtotal, 0) AS subtotal,
             COALESCE(shipping_total, 0) AS shipping_total,
             (COALESCE(subtotal, 0) + COALESCE(shipping_total, 0)) AS grand_total,
             courier, tracking_number,
             COALESCE(paid_at, '') AS paid_at,
             COALESCE(created_at, '') AS created_at
      FROM wholesale_orders
      WHERE distributor_seller_id = ?
      ORDER BY created_at DESC LIMIT 5000
    `).bind(sellerId).all<{
      id: number; toss_order_id: string | null; status: string; grade: string | null
      subtotal: number; shipping_total: number; grand_total: number
      courier: string | null; tracking_number: string | null; paid_at: string; created_at: string
    }>()
    const headers = ['주문번호', '주문일', '결제일', '상태', '등급', '상품합계', '배송비', '총결제', '택배사', '운송장번호']
    const STATUS_KO: Record<string, string> = {
      PENDING: '결제대기', PAID: '결제완료', ON_CREDIT: '여신(외상)', SHIPPED: '배송중',
      PARTIAL_REFUNDED: '부분환불', REFUNDED: '환불완료', CANCELLED: '취소', DONE: '구매확정', FAILED: '실패', EXPIRED: '만료',
    }
    const rows = (results || []).map(o => [
      o.toss_order_id || `W-${o.id}`,
      (o.created_at || '').slice(0, 19).replace('T', ' '),
      (o.paid_at || '').slice(0, 19).replace('T', ' '),
      STATUS_KO[o.status] || o.status,
      o.grade || '-',
      o.subtotal,
      o.shipping_total,
      o.grand_total,
      o.courier || '',
      o.tracking_number || '',
    ])
    const date = new Date().toISOString().slice(0, 10)
    return xlsxResponse(buildXlsx(headers, rows, '도매주문내역'), `wholesale-orders-${date}.xlsx`)
  } catch (err) {
    return safeError(c, err, '주문 내보내기 중 오류가 발생했습니다', '[wholesale]')
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

// ── GET /tax-invoices — 내(판매사) 매출 세금계산서 목록 (플랫폼→판매사) ─────────────
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
             COALESCE(p.supply_price,0) AS supply_price, COALESCE(p.price,0) AS retail_price, p.supply_margin_override_pct AS margin_override
      FROM wholesale_proposals wp
      JOIN products p ON p.id = wp.product_id
      WHERE wp.distributor_seller_id = ? AND wp.status = 'active'
        AND p.is_active = 1 AND p.is_supply_product = 1
      ORDER BY wp.created_at DESC LIMIT 50
    `).bind(sellerId).all<{ id: number; note: string | null; created_at: string; product_id: number; name: string; image_url: string | null; stock: number; supply_price: number; margin_override: number | null }>()
    const items = (results || []).map(r => {
      const { price } = resolveDistributorPrice({ baseSupplyPrice: r.supply_price, retailPrice: (r as { retail_price?: number }).retail_price, grade: sg.distributor_grade, specialUntil: sg.special_discount_until, table, marginOverridePct: r.margin_override })
      return { id: r.id, note: r.note, product_id: r.product_id, name: r.name, image_url: r.image_url, stock: r.stock, distributor_price: price }
    })
    return c.json({ success: true, proposals: items })
  } catch (err) {
    return safeError(c, err, '제안 조회 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── GET /statement?from=&to= — 거래내역서 (판매사 매입 내역) ──────────────────
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

// ── GET /documents — 판매사 본인 발행 자료(거래명세서/세금계산서, sales 방향만) ──────
import { ensureTaxDocSchema, renderTaxDocHtml, type TaxDocRow } from './tax-documents'

app.get('/documents', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureTaxDocSchema(DB)
    // sales = 유통스타트→판매사(본인 수취 자료). 매입(purchase)은 제조사 자료라 비노출.
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

// ── 엑셀 — 판매사 등급가 카탈로그 다운로드(.xlsx) + 주문 양식(.csv 재업로드용) ─────
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
      SELECT p.id, p.name, p.category, p.stock, COALESCE(p.supply_price,0) AS supply_price, COALESCE(p.price,0) AS retail_price, p.supply_margin_override_pct AS margin_override
      FROM products p
      WHERE p.is_supply_product = 1 AND p.is_active = 1 AND p.supply_source_id IS NULL
        AND COALESCE(p.supply_price,0) > 0 AND ${visibilityWhere('p')}
        AND ${gradeExposureWhere('p')}
      ORDER BY p.name LIMIT 10000
    `).bind(sellerId, effectiveGrade({ grade: sg.distributor_grade, specialUntil: sg.special_discount_until })).all<{ id: number; name: string; category: string | null; stock: number; supply_price: number; margin_override: number | null }>()
    const out = (rows.results || []).map(r => {
      const { price, grade } = resolveDistributorPrice({ baseSupplyPrice: r.supply_price, retailPrice: (r as { retail_price?: number }).retail_price, grade: sg.distributor_grade, specialUntil: sg.special_discount_until, table, marginOverridePct: r.margin_override })
      return [r.id, r.name, r.category || '', r.stock, price, grade]
    })
    return xlsxResponse(buildXlsx(['product_id', '상품명', '카테고리', '재고', '공급가(내등급)', '적용등급'], out), `wholesale-catalog-${new Date().toISOString().slice(0, 10)}.xlsx`)
  } catch (err) {
    return safeError(c, err, '카탈로그 내보내기 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── BIZ-8 (2026-06-08) GET /catalog/export?format=csv — 판매사 등급가 단가표 CSV ──────
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
      SELECT p.id, p.name, p.barcode, p.category, p.stock, COALESCE(p.supply_price,0) AS supply_price, COALESCE(p.price,0) AS retail_price,
             COALESCE(p.min_order_qty,1) AS moq, COALESCE(p.order_multiple,1) AS order_multiple,
             p.supply_margin_override_pct AS margin_override
      FROM products p
      WHERE p.is_supply_product = 1 AND p.is_active = 1 AND p.supply_source_id IS NULL
        AND COALESCE(p.supply_price,0) > 0 AND ${visibilityWhere('p')}
        AND ${gradeExposureWhere('p')}
      ORDER BY p.category, p.name LIMIT 10000
    `).bind(sellerId, effectiveGrade({ grade: sg.distributor_grade, specialUntil: sg.special_discount_until })).all<{ id: number; name: string; barcode: string | null; category: string | null; stock: number; supply_price: number; moq: number; order_multiple: number; margin_override: number | null }>()
    const header = ['상품명', '바코드', '공급가(내등급)', 'MOQ', '박스단위', '재고']
    const out = (rows.results || []).map(r => {
      // ⚠️ 내 등급 단가만 계산 — 타 등급가 누출 없음(카탈로그/주문과 동일 SSOT).
      const { price } = resolveDistributorPrice({ baseSupplyPrice: r.supply_price, retailPrice: (r as { retail_price?: number }).retail_price, grade: sg.distributor_grade, specialUntil: sg.special_discount_until, table, marginOverridePct: r.margin_override })
      return [r.name, r.barcode || '', price, Math.max(1, r.moq || 1), Math.max(1, r.order_multiple || 1), r.stock]
    })
    return csvResponse(buildCsv(header, out), `wholesale-pricelist-${new Date().toISOString().slice(0, 10)}.csv`)
  } catch (err) {
    return safeError(c, err, '단가표 내보내기 중 오류가 발생했습니다', '[wholesale]')
  }
})

// GET /order-template — 주문 양식 CSV. 로그인 시 내 카탈로그(등급가 포함) 프리필 →
//   판매사는 '주문수량' 칸만 채워 업로드. 비로그인은 빈 양식(헤더만).
app.get('/order-template', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  // BIZ-9 (2026-06-09): 박스단위(order_multiple) 열 추가 — 판매사가 양식에서 주문 배수 제약을 바로 보고 입력.
  //   product_id 가 robust 매칭 키(상품명 변경에도 안전). 주문수량 = 판매사 입력칸(빈칸).
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
      SELECT p.id, p.name, p.category, p.stock, COALESCE(p.supply_price,0) AS supply_price, COALESCE(p.price,0) AS retail_price,
             COALESCE(p.min_order_qty,1) AS moq, COALESCE(p.order_multiple,1) AS order_multiple,
             p.supply_margin_override_pct AS margin_override
      FROM products p
      WHERE p.is_supply_product = 1 AND p.is_active = 1 AND p.supply_source_id IS NULL
        AND COALESCE(p.supply_price,0) > 0 AND ${visibilityWhere('p')}
        AND ${gradeExposureWhere('p')}
      ORDER BY p.category, p.name LIMIT 10000
    `).bind(sellerId, effectiveGrade({ grade: sg.distributor_grade, specialUntil: sg.special_discount_until })).all<{ id: number; name: string; category: string | null; stock: number; supply_price: number; moq: number; order_multiple: number; margin_override: number | null }>()
    const out = (rows.results || []).map(r => {
      const { price } = resolveDistributorPrice({ baseSupplyPrice: r.supply_price, retailPrice: (r as { retail_price?: number }).retail_price, grade: sg.distributor_grade, specialUntil: sg.special_discount_until, table, marginOverridePct: r.margin_override })
      return [r.id, r.name, r.category || '', r.stock, price, Math.max(1, r.moq || 1), Math.max(1, r.order_multiple || 1), ''] // 주문수량은 빈칸 — 판매사가 입력
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
    // 🏬 감사 🟡#3: 미리보기도 주문과 동일 mall 스코프(크로스몰 차단).
    const previewMallId = await resolveMallId(c)
    const prods = await DB.prepare(`
      SELECT p.id, p.name, p.image_url, p.supplier_id, p.stock, COALESCE(p.supply_price,0) AS supply_price, COALESCE(p.price,0) AS retail_price,
             COALESCE(p.min_order_qty,1) AS moq, COALESCE(p.order_multiple,1) AS order_multiple,
             p.supply_margin_override_pct AS margin_override
      FROM products p
      WHERE p.id IN (${placeholders}) AND p.is_supply_product = 1 AND p.is_active = 1
        AND p.supply_source_id IS NULL AND COALESCE(p.supply_price,0) > 0
        AND COALESCE(p.mall_id,1) = ? AND ${visibilityWhere('p')}
        AND ${gradeExposureWhere('p')}
    `).bind(...ids, previewMallId, sellerId, effectiveGrade({ grade: sg.distributor_grade, specialUntil: sg.special_discount_until })).all<{ id: number; name: string; image_url: string | null; supplier_id: number | null; stock: number | null; supply_price: number; moq: number; order_multiple: number; margin_override: number | null }>()
    const found = new Map((prods.results || []).map(p => [p.id, p]))
    const tierMap = await loadQtyTiers(DB, ids)

    const items: Array<{ product_id: number; name: string; image_url: string | null; qty: number; unit_price: number; line_total: number; moq: number; order_multiple: number }> = []
    // 🚚 제조사별 min-order/배송비 계산용 라인(검증/표시 only — 청구 X). supplier_id 는 응답에 비노출.
    const shipMetaPreview = await getSupplyMeta(DB, ids) // 🚚 상품별 배송비 — 미리보기도 주문과 동일 산식.
    const previewLines: Array<{ supplier_id: number | null; line_total: number; product_shipping_fee?: number }> = []
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
      const { price } = resolveDistributorPrice({ baseSupplyPrice: p.supply_price, retailPrice: (p as { retail_price?: number }).retail_price, grade: sg.distributor_grade, specialUntil: sg.special_discount_until, table, marginOverridePct: p.margin_override })
      const tierFloor = effectiveTierFloor(price, p.supply_price, minMarginPct)
      const unit = tierUnitPrice(price, qty, tierMap.get(pid), tierFloor)
      const lineTotal = unit * qty
      subtotal += lineTotal
      items.push({ product_id: pid, name: p.name, image_url: p.image_url, qty, unit_price: unit, line_total: lineTotal, moq, order_multiple: orderMultiple })
      previewLines.push({ supplier_id: p.supplier_id, line_total: lineTotal, product_shipping_fee: parseProductShipFee(shipMetaPreview.get(pid)) })
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
    // 🔒 중개 룰: 제조사↔유통스타트↔판매사. 판매사에게 매칭 제조사 신원(이름/ID) 절대 비노출.
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
