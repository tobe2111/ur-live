/** 🏭 distributor-admin: 판매사 등급 배정 + 여신/미수금 (byte-identical 분해). */
import type { Hono } from 'hono'
import { safeError } from '@/worker/utils/safe-error'
import { writeAuditLog } from '@/worker/middleware/admin-security'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { ASSIGNABLE, ensureCreditSchemaAdmin, type Env } from './helpers'
import { ensureWholesaleSignupMeta } from '@/worker/utils/wholesale-signup-meta'

export function registerDistributorsRoutes(app: Hono<{ Bindings: Env }>) {
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
      return safeError(c, err, '판매사 조회 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  // ── GET /distributors/pending-approvals ──────────────────────────────────────
  //   🆕 2026-06-24 (대표 신고: 대시보드 '판매사 승인 N' 클릭 시 빈 목록): 가입 대기(is_distributor=1,
  //   status='pending') 판매사 목록. 도매(wholesale)-스코프 엔드포인트(segment=distributor) — 도매 권한
  //   어드민이 403 없이 조회·승인 가능(소비자 /api/admin/sellers 는 스코프 밖이라 403 → 빈 목록이었음).
  //   카운트(wholesale-overview-admin: is_distributor=1 AND status='pending')와 동일 조건.
  app.get('/distributors/pending-approvals', async (c) => {
    try {
      // 🏭 2026-06-29 가입 메타(취급 카테고리·주력 판매채널) 표시 — 사이드테이블 LEFT JOIN(없으면 ensure).
      await ensureWholesaleSignupMeta(c.env.DB)
      const { results } = await c.env.DB.prepare(
        `SELECT s.id, s.username, s.name, s.business_name, s.business_number, s.email, s.phone,
                s.representative_name, s.representative_phone, s.manager_name, s.manager_phone,
                s.business_registration_image_url, s.business_registration_status,
                s.status, s.created_at, COALESCE(s.mall_id,1) AS mall_id,
                m.categories AS signup_categories, m.channel AS signup_channel
         FROM sellers s
         LEFT JOIN wholesale_signup_meta m ON m.member_type = 'distributor' AND m.member_id = s.id
         WHERE s.is_distributor = 1 AND s.status = 'pending'
         ORDER BY s.created_at ASC, s.id ASC LIMIT 200`
      ).all().catch(() => ({ results: [] }))
      return c.json({ success: true, distributors: results ?? [] })
    } catch (err) {
      return safeError(c, err, '판매사 승인 대기 조회 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  // ── PATCH /distributors/:id/approval ─────────────────────────────────────────
  //   승인(approved) / 거부(rejected). CAS(status='pending' 일 때만) → 동시요청·중복 처리 멱등.
  app.patch('/distributors/:id/approval', async (c) => {
    try {
      const id = Number(c.req.param('id'))
      if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 판매사 ID' }, 400)
      const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
      const action = String(body.action) === 'reject' ? 'reject' : 'approve'
      const newStatus = action === 'approve' ? 'approved' : 'rejected'
      const reason = typeof body.reason === 'string' ? body.reason.slice(0, 300) : null

      // CAS: 대기(pending) + 판매사(is_distributor=1) 일 때만 1회 전이.
      const res = await c.env.DB.prepare(
        "UPDATE sellers SET status = ?, updated_at = datetime('now') WHERE id = ? AND is_distributor = 1 AND status = 'pending'"
      ).bind(newStatus, id).run()
      if (!res.meta.changes) {
        return c.json({ success: false, error: '승인 대기 중인 판매사가 아닙니다 (이미 처리되었거나 존재하지 않음)' }, 409)
      }
      await writeAuditLog(c, {
        action: action === 'approve' ? 'wholesale_distributor_approve' : 'wholesale_distributor_reject',
        targetType: 'seller',
        targetId: String(id),
        before: { status: 'pending' },
        after: { status: newStatus, reason },
      }).catch(() => { /* audit 실패해도 성공 처리 */ })
      // 판매사 대시보드 알림(fail-soft).
      try {
        const { createDashboardNotification } = await import('@/features/notifications/api/dashboard-notifications.routes')
        await createDashboardNotification(
          c.env.DB, 'seller', String(id),
          action === 'approve' ? 'distributor_approved' : 'distributor_rejected',
          action === 'approve' ? '판매사 가입 승인' : '판매사 가입 거부',
          action === 'approve' ? '도매몰 이용이 승인되었습니다.' : (reason || '가입이 거부되었습니다.'),
          '/wholesale',
        )
      } catch { /* 알림 실패 무시 */ }
      // 🔔 2026-06-26 (알림 보강): 승인/거부를 접속 전 채널(알림톡)로도 — 벨은 접속해야 보임(제조사 패턴과 동일).
      //   판매사 phone 조회 후 fail-soft 발송. 알림톡 템플릿 미등록 시 silent skip(승인 자체는 막지 않음).
      try {
        const seller = await c.env.DB.prepare(
          'SELECT business_name, name, manager_phone, representative_phone, phone FROM sellers WHERE id = ?'
        ).bind(id).first<{ business_name: string | null; name: string | null; manager_phone: string | null; representative_phone: string | null; phone: string | null }>()
        const phone = seller?.manager_phone || seller?.representative_phone || seller?.phone
        if (phone) {
          const bn = seller?.business_name || seller?.name || '판매사'
          const msg = action === 'approve'
            ? `[유통스타트] 판매사 승인 완료\n\n· 상호: ${bn}\n\n이제 로그인해 도매가로 사입할 수 있습니다.\nhttps://utongstart.com/wholesale/login`
            : `[유통스타트] 판매사 가입이 반려되었습니다\n\n· 상호: ${bn}\n\n${reason || '자세한 내용은 고객센터로 문의해주세요.'}`
          const { sendSystemAlimtalk } = await import('../../../../lib/system-alimtalk')
          await sendSystemAlimtalk(c.env, phone, action === 'approve' ? 'distributor_approved' : 'distributor_rejected', msg)
        }
      } catch { /* fail-soft — 알림 실패가 승인을 막지 않음 */ }
      return c.json({ success: true, status: newStatus })
    } catch (err) {
      return safeError(c, err, '판매사 승인 처리 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  // ── PATCH /distributors/:id ──────────────────────────────────────────────────
  app.patch('/distributors/:id', async (c) => {
    try {
      const id = Number(c.req.param('id'))
      if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 판매사 ID' }, 400)
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
      if (!res.meta.changes) return c.json({ success: false, error: '존재하지 않는 판매사입니다' }, 404)
      await writeAuditLog(c, {
        action: 'wholesale_distributor_grade_change',
        targetType: 'seller',
        targetId: String(id),
        before: { grade: prevSeller?.distributor_grade ?? null, special_discount_until: prevSeller?.special_discount_until ?? null },
        after: { grade, special_discount_until: special },
      }).catch(() => { /* audit 실패해도 성공 처리 */ })
      // 🔔 2026-06-26 (알림 보강): 등급은 향후 모든 주문 단가를 좌우하는데 그간 통지가 전무했음.
      //   실제로 바뀐 경우에만 판매사 대시보드 알림(fail-soft).
      if ((prevSeller?.distributor_grade ?? null) !== grade) {
        try {
          const { createDashboardNotification } = await import('../../../notifications/api/dashboard-notifications.routes')
          await createDashboardNotification(
            c.env.DB, 'seller', String(id), 'distributor_grade_changed',
            '회원 등급이 변경되었습니다',
            grade ? `회원 등급이 ${grade} 등급으로 변경되었습니다. 공급가에 반영됩니다.` : '회원 등급이 해제되었습니다.',
            '/wholesale',
          )
        } catch { /* 알림 실패 무시 */ }
      }
      return c.json({ success: true })
    } catch (err) {
      return safeError(c, err, '판매사 등급 설정 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  // GET /distributors/:id/credit — 여신 한도/미수금/원장 (어드민 UI)
  app.get('/distributors/:id/credit', async (c) => {
    try {
      await ensureCreditSchemaAdmin(c.env.DB)
      const id = Number(c.req.param('id'))
      if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 판매사 ID' }, 400)
      const seller = await c.env.DB.prepare(
        'SELECT id, business_name, name, username, status, COALESCE(distributor_credit_limit,0) AS limit, COALESCE(outstanding_balance,0) AS outstanding, COALESCE(credit_frozen,0) AS frozen FROM sellers WHERE id = ?'
      ).bind(id).first<{ id: number; business_name: string | null; name: string | null; username: string | null; status: string | null; limit: number; outstanding: number; frozen: number }>()
      if (!seller) return c.json({ success: false, error: '존재하지 않는 판매사입니다' }, 404)
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
      if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 판매사 ID' }, 400)
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
      if (!res.meta.changes) return c.json({ success: false, error: '존재하지 않는 판매사입니다' }, 404)
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
      if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 판매사 ID' }, 400)
      const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
      const amount = Math.floor(Number(body.amount))
      if (!Number.isFinite(amount) || amount <= 0) return c.json({ success: false, error: '상환 금액이 올바르지 않습니다' }, 400)
      const memo = typeof body.memo === 'string' ? body.memo.slice(0, 200) : null

      const seller = await c.env.DB.prepare(
        'SELECT COALESCE(outstanding_balance,0) AS outstanding FROM sellers WHERE id = ?'
      ).bind(id).first<{ outstanding: number }>()
      if (!seller) return c.json({ success: false, error: '존재하지 않는 판매사입니다' }, 404)
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
}
