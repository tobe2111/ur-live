/**
 * 🔗 에이전시 매장 초대 링크 — 사장님 쪽 (에이전시 2단계, 2026-10-11 대표 *"응 링크 방식도 넣어줘"*)
 *   마운트: app.route('/api/store-agency-invite', storeAgencyInviteRoutes)
 *
 *   GET  /:token    — 링크가 살아 있나 · 어느 에이전시인가 (누구나 — 링크를 연 사람이 무엇을 맡기는지 봐야 한다)
 *   POST /accept    — { token, seller_ids[] } 내 매장(여럿 가능)을 이 에이전시에 맡긴다 (각 매장 **주인**만)
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
import { AGENCY_LINKS_PER_STORE_MAX } from './seller-agency-link.routes'

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

/** 한 번에 맡길 수 있는 매장 수 — 프랜차이즈 사장님이 지점을 한꺼번에 고른다(2026-10-31). */
export const ENTRUST_STORES_PER_REQUEST_MAX = 50

type EntrustResult = { seller_id: number; ok: boolean; already?: boolean; error?: string; storeName?: string }

/** 매장 하나를 맡긴다. 결과만 돌려주고 던지지 않는다 — 여러 매장 중 하나가 막혀도 나머지는 진행된다. */
async function entrustOne(
  DB: D1Database, inv: { id: number; agency_id: number; created_by_staff_id: number; agency_name: string },
  userId: number, sellerId: number,
): Promise<EntrustResult> {
  // 🔐 그 매장의 **주인**만 — 위임받은 운영자는 남의 매장을 다른 대행에 넘길 수 없다.
  if (!(await isStoreOwner(DB, userId, sellerId))) {
    return { seller_id: sellerId, ok: false, error: '이 매장의 사장님만 맡길 수 있어요.' }
  }
  const openCount = await DB.prepare("SELECT COUNT(*) AS n FROM agency_store_links WHERE seller_id = ? AND agency_id <> ? AND status IN ('pending','active')")
    .bind(sellerId, inv.agency_id).first<{ n: number }>()
  if ((Number(openCount?.n) || 0) >= AGENCY_LINKS_PER_STORE_MAX) {
    return { seller_id: sellerId, ok: false, error: `한 매장은 에이전시 ${AGENCY_LINKS_PER_STORE_MAX}곳까지 함께 할 수 있어요.` }
  }
  // 링크를 만든 것이 에이전시의 수락 — 바로 active. 같은 에이전시에 보낸 요청이 대기 중이면 그걸 수락으로 올린다.
  const ins = await DB.prepare(
    `INSERT OR IGNORE INTO agency_store_links (agency_id, seller_id, status, requested_by_user_id, decided_by_staff_id, accepted_at)
     VALUES (?, ?, 'active', ?, ?, datetime('now'))`,
  ).bind(inv.agency_id, sellerId, userId, inv.created_by_staff_id).run()
  if ((ins.meta?.changes ?? 0) === 0) {
    // 🤝 2026-10-24 — 한 매장이 여러 에이전시와 함께 한다. 막히는 건 **같은 에이전시**에 이미 열린 맡김뿐이다
    //   (부분 UNIQUE (매장, 에이전시)). 그게 요청 대기면 링크가 곧 수락이므로 올린다.
    const open = await DB.prepare(
      `SELECT id, status FROM agency_store_links
        WHERE seller_id = ? AND agency_id = ? AND status IN ('pending','active') LIMIT 1`,
    ).bind(sellerId, inv.agency_id).first<{ id: number; status: string }>()
    if (open?.status === 'pending') {
      await DB.prepare(
        `UPDATE agency_store_links SET status = 'active', accepted_at = datetime('now'), decided_by_staff_id = ?, updated_at = datetime('now')
          WHERE id = ? AND status = 'pending'`,
      ).bind(inv.created_by_staff_id, open.id).run()
    }
    if (open) return { seller_id: sellerId, ok: true, already: open.status === 'active' }
    return { seller_id: sellerId, ok: false, error: '맡기지 못했어요. 잠시 뒤 다시 시도해 주세요.' }
  }
  await DB.prepare('UPDATE agency_store_invites SET use_count = use_count + 1 WHERE id = ?').bind(inv.id).run().catch(() => {})
  const store = await DB.prepare('SELECT business_name, name FROM sellers WHERE id = ? LIMIT 1')
    .bind(sellerId).first<{ business_name: string | null; name: string | null }>()
  return { seller_id: sellerId, ok: true, storeName: store?.business_name || store?.name || '매장' }
}

/** 요청 본문 → 매장 id 목록. `seller_ids`(여럿) 우선, 옛 `seller_id`(하나)도 받는다. 중복 제거. */
export function entrustSellerIds(body: { seller_id?: unknown; seller_ids?: unknown }): number[] {
  const raw = Array.isArray(body.seller_ids) ? body.seller_ids : [body.seller_id]
  const ids = raw.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0)
  return [...new Set(ids)]
}

storeAgencyInviteRoutes.get('/:token', rateLimit({ action: 'store_agency_invite_lookup', max: 60, windowSec: 600 }), async (c) => {
  try {
    const token = c.req.param('token') || ''
    if (!TOKEN_RE.test(token)) return c.json(LINK_DEAD, 404)
    await ensureAgencyConsoleTables(c.env.DB)
    const inv = await liveInvite(c.env.DB, token)
    if (!inv) return c.json(LINK_DEAD, 404)
    // 🏪 2026-10-31 — 로그인한 사장님이면 **이미 이 에이전시가 운영 중인 내 매장**을 알려 준다(다시 고르지 않게).
    //   로그인이 없으면 이름만(카톡 카드·크롤러가 이 경로를 부른다 — 응답은 사람마다 같아야 한다).
    let entrustedSellerIds: number[] = []
    const sess = await parseSessionCookie(c.req.header('Cookie'), c.env.JWT_SECRET, ['user']).catch(() => null)
    const userId = Number(sess?.userId)
    if (Number.isInteger(userId) && userId > 0) {
      const { results } = await c.env.DB.prepare(
        // 소유는 두 길이다(`canOperateStore` 와 같다) — 옛 `sellers.linked_user_id` · 주인 좌석(`seller_operators` owner).
        `SELECT l.seller_id FROM agency_store_links l
         WHERE l.agency_id = ? AND l.status = 'active'
           AND (l.seller_id IN (SELECT id FROM sellers WHERE linked_user_id = ?)
             OR l.seller_id IN (SELECT seller_id FROM seller_operators WHERE user_id = ? AND role = 'owner' AND revoked_at IS NULL))`,
      ).bind(inv.agency_id, userId, userId).all<{ seller_id: number }>().catch(() => ({ results: [] as { seller_id: number }[] }))
      entrustedSellerIds = (results || []).map((r) => Number(r.seller_id))
      c.header('Cache-Control', 'private, no-store')
    }
    return c.json({ success: true, agencyName: inv.agency_name, entrustedSellerIds })
  } catch (err) {
    return safeError(c, err, '링크를 확인하지 못했어요', '[store-agency-invite]')
  }
})

storeAgencyInviteRoutes.post('/accept', cors(), rateLimit({ action: 'store_agency_invite_accept', max: 20, windowSec: 600 }), async (c) => {
  try {
    const sess = await parseSessionCookie(c.req.header('Cookie'), c.env.JWT_SECRET, ['user']).catch(() => null)
    const userId = Number(sess?.userId)
    if (!Number.isInteger(userId) || userId <= 0) return c.json({ success: false, code: 'LOGIN_REQUIRED', error: '로그인이 필요해요.' }, 401)
    type AcceptBody = { token?: string; seller_id?: unknown; seller_ids?: unknown }
    const body = await c.req.json<AcceptBody>().catch((): AcceptBody => ({}))
    const token = typeof body.token === 'string' ? body.token : ''
    const sellerIds = entrustSellerIds(body)
    if (!TOKEN_RE.test(token)) return c.json(LINK_DEAD, 404)
    if (sellerIds.length === 0) return c.json({ success: false, error: '맡길 매장을 골라 주세요.' }, 400)
    if (sellerIds.length > ENTRUST_STORES_PER_REQUEST_MAX) {
      return c.json({ success: false, error: `한 번에 ${ENTRUST_STORES_PER_REQUEST_MAX}곳까지 맡길 수 있어요.` }, 400)
    }

    const DB = c.env.DB
    await ensureAgencyConsoleTables(DB)
    const inv = await liveInvite(DB, token)
    if (!inv) return c.json(LINK_DEAD, 404)

    const results: EntrustResult[] = []
    for (const id of sellerIds) results.push(await entrustOne(DB, inv, userId, id))
    const ok = results.filter((r) => r.ok)
    if (ok.length === 0) {
      // 하나만 골랐다면 종전과 같은 응답(그 매장의 이유 그대로) — 주인이 아니면 403.
      const first = results[0]
      const notOwner = results.every((r) => r.error === '이 매장의 사장님만 맡길 수 있어요.')
      return c.json({ success: false, code: notOwner ? 'NOT_OWNER' : undefined, error: first?.error || '맡기지 못했어요.', results }, notOwner ? 403 : 409)
    }

    // 에이전시 관리자에게 알린다 — 새로 맡긴 매장만, 메일은 **한 통**(매장 열 곳이면 열 통이 가던 일을 막는다).
    const fresh = ok.filter((r) => !r.already && r.storeName)
    if (fresh.length > 0) {
      const names = fresh.map((r) => r.storeName as string)
      const label = names.length === 1 ? names[0] : `${names[0]} 외 ${names.length - 1}곳`
      const { results: admins } = await DB.prepare(
        "SELECT email FROM agency_staff WHERE agency_id = ? AND role = 'admin' AND status = 'active' LIMIT 10",
      ).bind(inv.agency_id).all<{ email: string }>()
      for (const a of admins || []) {
        await sendSystemEmail(c.env, a.email, {
          subject: `[유어딜] ${label} 사장님이 초대 링크로 매장을 맡기셨어요`,
          html: buildSystemEmailHtml({
            title: `${label} 운영 시작`, greeting: '안녕하세요.',
            body: `${names.join(', ')} 사장님이 ${inv.agency_name} 에이전시의 초대 링크로 매장 운영을 맡기셨어요.\n지금부터 직원 누구나 에이전시 화면의 [운영하기]로 이 매장을 관리할 수 있어요.`,
            actionLabel: '에이전시 화면 열기', actionUrl: `${frontendBase(c.env)}/agency`,
          }),
        }, { ignorePreference: true }).catch(() => {})
      }
    }
    return c.json({
      success: true,
      agencyName: inv.agency_name,
      already: ok.every((r) => r.already),
      entrusted: ok.length,
      failed: results.length - ok.length,
      results,
    })
  } catch (err) {
    return safeError(c, err, '맡기는 중 오류가 발생했어요', '[store-agency-invite]')
  }
})
