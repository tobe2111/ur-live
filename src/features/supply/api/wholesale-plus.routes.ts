/**
 * 🏅 2026-06-16 유통스타트 도매몰 — 플러스 멤버십(연 구독) 자가 구매.
 *   등급 모델: 일반(C, 승인 가입) / 플러스(B, 연 구독) / 프리미엄(A, 매출 자동승급).
 *   ⚠️ 도매몰은 PG(Toss) 미사용 — 결제는 예치금(계좌이체로 충전된 잔액)에서 차감.
 *   프리미엄(A) 자동승급은 기존 GMV cron(handleWholesaleGradeEval, BIZ-7)이 담당 — 여기선 플러스만.
 *
 * 머니-크리티컬: 차감(deductDeposit) = 원자 CAS. 구독 갱신/등급세팅도 claim-before-charge(행 CAS) →
 *   동시요청/더블클릭 이중차감 차단. 차감 실패(잔액부족) 시 등급/만료 claim 즉시 롤백.
 *
 * 마운트: app.route('/api/wholesale/plus', wholesalePlusRoutes)
 *   - GET  /info      — 구독료 · 내 잔액 · 등급 · 만료일 · 플러스/프리미엄 여부
 *   - POST /subscribe — 예치금에서 연 구독료 차감 → 플러스(B) + plus_until=+365일 (멱등 CAS)
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { safeError } from '@/worker/utils/safe-error'
import { swallow } from '@/worker/utils/swallow'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes'
import { ensureDepositSchema, loadDepositBalance, deductDeposit, recordDepositTxn } from './wholesale-deposit-core'
import { isViewerToken } from './sub-account-gate'

type D1Database = Env['DB']

export const DEFAULT_PLUS_ANNUAL_FEE = 99_000
export const PLUS_FEE_KEY = 'wholesale_plus_annual_fee'

async function distributorFrom(authorization: string | undefined, jwtSecret: string): Promise<{ sellerId: number; isDistributor: boolean } | null> {
  if (!authorization?.startsWith('Bearer ')) return null
  try {
    const { verify } = await import('hono/jwt')
    const payload = await verify(authorization.substring(7), jwtSecret, 'HS256') as { seller_id?: number; is_distributor?: number | boolean }
    if (!payload.seller_id) return null
    return { sellerId: payload.seller_id, isDistributor: !!payload.is_distributor }
  } catch {
    return null
  }
}

// sellers.plus_until 컬럼 보장 (isolate 당 1회). repair-schema 에도 등록.
const _plusSchemaEnsured = new WeakSet<object>()
async function ensurePlusSchema(DB: D1Database): Promise<void> {
  if (_plusSchemaEnsured.has(DB)) return
  await DB.prepare('ALTER TABLE sellers ADD COLUMN plus_until TEXT').run().catch(() => { /* 이미 존재 */ })
  _plusSchemaEnsured.add(DB)
}

/** 연 구독료(원) — platform_settings.wholesale_plus_annual_fee, 미설정/이상치면 기본 99,000. */
async function loadPlusFee(DB: D1Database): Promise<number> {
  const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
    .bind(PLUS_FEE_KEY).first<{ value: string }>().catch(() => null)
  const n = Math.floor(Number(row?.value))
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PLUS_ANNUAL_FEE
}

const plus = new Hono<{ Bindings: Env }>()

// ── GET /info — 구독 안내(잔액·등급·만료) ──────────────────────────────────────
plus.get('/info', async (c) => {
  const auth = await distributorFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!auth) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensurePlusSchema(DB)
    await ensureDepositSchema(DB)
    const [fee, balance, row] = await Promise.all([
      loadPlusFee(DB),
      loadDepositBalance(DB, auth.sellerId),
      DB.prepare('SELECT distributor_grade, plus_until FROM sellers WHERE id = ?')
        .bind(auth.sellerId).first<{ distributor_grade: string | null; plus_until: string | null }>().catch(() => null),
    ])
    const grade = (row?.distributor_grade || 'C').toUpperCase()
    const plusUntil = row?.plus_until || null
    // plus_until 은 SQLite datetime 포맷('YYYY-MM-DD HH:MM:SS', UTC) — 같은 포맷 비교.
    const active = await DB.prepare(
      'SELECT (? IS NOT NULL AND ? > datetime(\'now\')) AS a'
    ).bind(plusUntil, plusUntil).first<{ a: number }>().catch(() => ({ a: 0 }))
    const isPlus = grade === 'B' && !!active?.a
    const isPremium = grade === 'A'
    return c.json({
      success: true,
      fee, balance, grade, plus_until: plusUntil,
      is_plus: isPlus, is_premium: isPremium,
      can_afford: balance >= fee,
    })
  } catch (err) {
    return safeError(c, err, '플러스 구독 정보 조회 중 오류가 발생했습니다', '[wholesale-plus]')
  }
})

// ── POST /subscribe — 예치금에서 연 구독료 차감 → 플러스(B) ──────────────────────
plus.post('/subscribe', rateLimit({ action: 'wholesale-plus-subscribe', max: 6, windowSec: 60 }), async (c) => {
  const auth = await distributorFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!auth) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  if (!auth.isDistributor) return c.json({ success: false, error: '유통회원 전용 기능입니다' }, 403)
  // 조회 전용(viewer) 직원은 결제성 행위 불가(예치금 충전 게이트와 동일 계약).
  if (await isViewerToken(c.req.header('Authorization'), c.env.JWT_SECRET)) {
    return c.json({ success: false, error: '조회 전용 직원 계정은 구독할 수 없습니다' }, 403)
  }
  const { DB } = c.env
  try {
    await ensurePlusSchema(DB)
    await ensureDepositSchema(DB)
    const fee = await loadPlusFee(DB)
    const sellerId = auth.sellerId

    const cur = await DB.prepare('SELECT distributor_grade, plus_until FROM sellers WHERE id = ?')
      .bind(sellerId).first<{ distributor_grade: string | null; plus_until: string | null }>().catch(() => null)
    const grade = (cur?.distributor_grade || '').toUpperCase()
    const prevGrade = cur?.distributor_grade ?? null
    const prevPlus = cur?.plus_until ?? null
    // 프리미엄(A)은 플러스보다 상위 — 구독 불필요(차감 금지).
    if (grade === 'A') {
      return c.json({ success: false, error: '이미 프리미엄 등급이라 플러스 구독이 필요 없어요', code: 'ALREADY_PREMIUM' }, 409)
    }

    // 🔒 claim-before-charge — 만료 30일 이내(또는 미가입/만료)일 때만 1회 선점.
    //   plus_until / 만료비교 전부 SQLite datetime 포맷으로 계산(JS/SQL 포맷 불일치 방지).
    //   갱신 시 기준일 = max(현재 plus_until, now) → +365일(잔여기간 보존 연장). 등급 A 면 등급 불변.
    const claim = await DB.prepare(
      `UPDATE sellers
         SET plus_until = datetime(CASE WHEN plus_until IS NOT NULL AND plus_until > datetime('now') THEN plus_until ELSE datetime('now') END, '+365 days'),
             distributor_grade = CASE WHEN UPPER(COALESCE(distributor_grade,'')) = 'A' THEN distributor_grade ELSE 'B' END,
             updated_at = datetime('now')
       WHERE id = ? AND (plus_until IS NULL OR plus_until < datetime('now','+30 days'))`
    ).bind(sellerId).run()
    if ((claim.meta?.changes ?? 0) === 0) {
      return c.json({ success: false, error: '이미 플러스 구독 중입니다 (만료 30일 전부터 연장할 수 있어요)', code: 'ALREADY_PLUS' }, 409)
    }

    // 예치금 차감(원자 CAS). 부족하면 claim 롤백 후 402.
    const deduct = await deductDeposit(DB, sellerId, fee)
    if (!deduct.ok) {
      await DB.prepare("UPDATE sellers SET plus_until = ?, distributor_grade = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(prevPlus, prevGrade, sellerId).run().catch(swallow('wholesale-plus:revert-claim'))
      return c.json({
        success: false, error: '예치금이 부족합니다', code: 'INSUFFICIENT_DEPOSIT',
        balance: deduct.balance, required: fee, shortfall: Math.max(0, fee - deduct.balance),
      }, 402)
    }

    // 차감 원장 + 갱신 만료일 회신.
    const after = await DB.prepare('SELECT plus_until FROM sellers WHERE id = ?')
      .bind(sellerId).first<{ plus_until: string | null }>().catch(() => null)
    const newUntil = after?.plus_until ?? null
    await recordDepositTxn(DB, sellerId, 'order', -fee, deduct.balanceAfter, `plus:${sellerId}:${(newUntil || '').slice(0, 10)}`, '플러스 멤버십 1년 구독')
    if (c.executionCtx) {
      c.executionCtx.waitUntil(
        createDashboardNotification(
          DB, 'seller', String(sellerId), 'wholesale_plus',
          '플러스 멤버십이 시작됐어요',
          `플러스 등급(연 구독)이 적용됐어요. 더 낮은 공급가로 사입하세요. (만료 ${(newUntil || '').slice(0, 10)})`,
          '/wholesale/dashboard',
        ).catch(swallow('wholesale-plus:notify')),
      )
    }
    return c.json({ success: true, grade: 'B', plus_until: newUntil, balance: deduct.balanceAfter, fee })
  } catch (err) {
    return safeError(c, err, '플러스 구독 처리 중 오류가 발생했습니다', '[wholesale-plus]')
  }
})

export { plus as wholesalePlusRoutes }
