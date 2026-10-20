/**
 * 🔗 에이전시 매장 초대 링크 — 사장님 쪽 (에이전시 2단계, 2026-10-11 대표 *"응 링크 방식도 넣어줘"*)
 *   마운트: app.route('/api/store-agency-invite', storeAgencyInviteRoutes)
 *
 *   GET  /:token    — 링크가 살아 있나 · 어느 에이전시인가 (누구나 — 링크를 연 사람이 무엇을 맡기는지 봐야 한다)
 *   POST /accept    — { token, seller_id } 내 매장을 이 에이전시에 맡긴다 (그 매장 **주인**만)
 *
 * 영업 흐름: 에이전시가 매장을 찾아가 "저희가 맡겠습니다" → 에이전시 화면에서 링크 복사 → 카톡으로 사장님께 →
 * 사장님은 링크를 눌러 카카오로 로그인 → 매장 고르고 [맡기기] 한 번. 링크를 만든 것이 에이전시의 수락이라
 * 요청 단계 없이 바로 운영이 시작된다. 사장님은 언제든 셀러 화면에서 끊는다(대표 규칙 3).
 *
 * ## 🔐 왜 `/api/seller/*` 가 아닌가
 * 이 화면은 **소비자 화면**이고 주체는 소비자 세션(카카오)이다. `/api/seller/*` 에 두면 공용 axios 가 그 브라우저의
 * `seller_token` 을 붙이고, 그 토큰이 회수돼 있으면 전역 좌석 가드가 401 을 내 셀러 로그아웃까지 일으킨다.
 * 그래서 경로를 갈랐고, 소유 판정은 **소비자 세션 쿠키 하나**로만 한다(좌석 토큰 폴백 없음).
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from '@/worker/types/env'
import { parseSessionCookie } from '@/worker/utils/session'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { safeError } from '@/worker/utils/safe-error'
import { buildSystemEmailHtml, sendSystemEmail } from '@/lib/system-email'
import { isStoreOwner } from '../../../worker/utils/seller-operators'
import { ensureAgencyConsoleTables } from '../../agency-console/api/agency-schema'
import { frontendBase } from '../../agency-console/api/agency-auth.routes'

export const storeAgencyInviteRoutes = new Hono<{ Bindings: Env }>()

const TOKEN_RE = /^[0-9a-f]{64}$/

async function liveInvite(DB: D1Database, token: string) {
  return DB.prepare(
    `SELECT i.id, i.agency_id, i.created_by_staff_id, a.name AS agency_name
       FROM agency_store_invites i JOIN agency_accounts a ON a.id = i.agency_id
      WHERE i.token = ? AND i.revoked_at IS NULL AND i.expires_at > datetime('now') AND a.status = 'active'
      LIMIT 1`,
  ).bind(token).first<{ id: number; agency_id: number; created_by_staff_id: number; agency_name: string }>()
}

const LINK_DEAD = { success: false, code: 'LINK_INVALID', error: '링크가 만료됐거나 더 이상 쓸 수 없어요. 에이전시에 새 링크를 요청해 주세요.' } as const

storeAgencyInviteRoutes.get('/:token', rateLimit({ action: 'store_agency_invite_lookup', max: 60, windowSec: 600 }), async (c) => {
  try {
    const token = c.req.param('token') || ''
    if (!TOKEN_RE.test(token)) return c.json(LINK_DEAD, 404)
    await ensureAgencyConsoleTables(c.env.DB)
    const inv = await liveInvite(c.env.DB, token)
    if (!inv) return c.json(LINK_DEAD, 404)
    return c.json({ success: true, agencyName: inv.agency_name })
  } catch (err) {
    return safeError(c, err, '링크를 확인하지 못했어요', '[store-agency-invite]')
  }
})

storeAgencyInviteRoutes.post('/accept', cors(), rateLimit({ action: 'store_agency_invite_accept', max: 20, windowSec: 600 }), async (c) => {
  try {
    const sess = await parseSessionCookie(c.req.header('Cookie'), c.env.JWT_SECRET, ['user']).catch(() => null)
    const userId = Number(sess?.userId)
    if (!Number.isInteger(userId) || userId <= 0) return c.json({ success: false, code: 'LOGIN_REQUIRED', error: '로그인이 필요해요.' }, 401)
    const body = await c.req.json<{ token?: string; seller_id?: number }>().catch(() => ({} as { token?: string; seller_id?: number }))
    const token = typeof body.token === 'string' ? body.token : ''
    const sellerId = Number(body.seller_id)
    if (!TOKEN_RE.test(token)) return c.json(LINK_DEAD, 404)
    if (!Number.isInteger(sellerId) || sellerId <= 0) return c.json({ success: false, error: '맡길 매장을 골라 주세요.' }, 400)

    const DB = c.env.DB
    await ensureAgencyConsoleTables(DB)
    const inv = await liveInvite(DB, token)
    if (!inv) return c.json(LINK_DEAD, 404)
    // 🔐 그 매장의 **주인**만 — 위임받은 운영자는 남의 매장을 다른 대행에 넘길 수 없다.
    if (!(await isStoreOwner(DB, userId, sellerId))) {
      return c.json({ success: false, code: 'NOT_OWNER', error: '이 매장의 사장님만 맡길 수 있어요.' }, 403)
    }

    // 링크를 만든 것이 에이전시의 수락 — 바로 active. 같은 에이전시에 보낸 요청이 대기 중이면 그걸 수락으로 올린다.
    const ins = await DB.prepare(
      `INSERT OR IGNORE INTO agency_store_links (agency_id, seller_id, status, requested_by_user_id, decided_by_staff_id, accepted_at)
       VALUES (?, ?, 'active', ?, ?, datetime('now'))`,
    ).bind(inv.agency_id, sellerId, userId, inv.created_by_staff_id).run()
    if ((ins.meta?.changes ?? 0) === 0) {
      const open = await DB.prepare(
        `SELECT l.id, l.agency_id, l.status, a.name AS agency_name FROM agency_store_links l
           JOIN agency_accounts a ON a.id = l.agency_id
          WHERE l.seller_id = ? AND l.status IN ('pending','active') LIMIT 1`,
      ).bind(sellerId).first<{ id: number; agency_id: number; status: string; agency_name: string }>()
      if (open && open.agency_id === inv.agency_id) {
        if (open.status === 'pending') {
          await DB.prepare(
            `UPDATE agency_store_links SET status = 'active', accepted_at = datetime('now'), decided_by_staff_id = ?, updated_at = datetime('now')
              WHERE id = ? AND status = 'pending'`,
          ).bind(inv.created_by_staff_id, open.id).run()
        }
        return c.json({ success: true, agencyName: inv.agency_name, already: open.status === 'active' })
      }
      return c.json({
        success: false, code: 'ALREADY_LINKED',
        error: `이 매장은 이미 ${open?.agency_name || '다른'} 에이전시에 맡겨져 있어요. 셀러 화면의 운영자 관리에서 먼저 끊어 주세요.`,
      }, 409)
    }
    await DB.prepare('UPDATE agency_store_invites SET use_count = use_count + 1 WHERE id = ?').bind(inv.id).run().catch(() => {})

    // 에이전시 관리자에게 알린다(덤 — 콘솔 '맡은 매장' 에 이미 '운영 중' 으로 떠 있다).
    const store = await DB.prepare('SELECT business_name, name FROM sellers WHERE id = ? LIMIT 1')
      .bind(sellerId).first<{ business_name: string | null; name: string | null }>()
    const storeName = store?.business_name || store?.name || '매장'
    const { results: admins } = await DB.prepare(
      "SELECT email FROM agency_staff WHERE agency_id = ? AND role = 'admin' AND status = 'active' LIMIT 10",
    ).bind(inv.agency_id).all<{ email: string }>()
    for (const a of admins || []) {
      await sendSystemEmail(c.env, a.email, {
        subject: `[유어딜] ${storeName} 사장님이 초대 링크로 매장을 맡기셨어요`,
        html: buildSystemEmailHtml({
          title: `${storeName} 운영 시작`, greeting: '안녕하세요.',
          body: `${storeName} 사장님이 ${inv.agency_name} 에이전시의 초대 링크로 매장 운영을 맡기셨어요.\n지금부터 직원 누구나 에이전시 화면의 [운영하기]로 이 매장을 관리할 수 있어요.`,
          actionLabel: '에이전시 화면 열기', actionUrl: `${frontendBase(c.env)}/agency`,
        }),
      }, { ignorePreference: true }).catch(() => {})
    }
    return c.json({ success: true, agencyName: inv.agency_name })
  } catch (err) {
    return safeError(c, err, '맡기는 중 오류가 발생했어요', '[store-agency-invite]')
  }
})
