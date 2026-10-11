/**
 * 💬 카카오톡으로 매장 관리 — 셀러 대시보드 쪽 (2026-10-10). 챗봇 쪽은 `worker/routes/kakao-skill-webhook.routes.ts`.
 *
 * 마운트: `/api/seller` (seller-operators.routes 가 등록)
 *   POST /kakao-bot/link-code            — 6자리 1회용 연결 코드 발급(10분)
 *   GET  /kakao-bot/links                — 이 매장에 연결된 채팅 계정 + 게이트 상태
 *   POST /kakao-bot/links/:key/revoke    — 연결 해제(이 매장의 것만)
 *
 * ## 🔐 누가 코드를 받나
 * 코드는 (그 사람, 그 매장) 에 묶인다. 매장은 **토큰의 seller_id** 에서만 오고, 사람은
 * 토큰의 `operator_user_id`(위임 좌석) → 매장의 `linked_user_id`(소유 좌석) → 소비자 세션 순으로 정한 뒤
 * `canOperateStore` 로 그 사람이 정말 그 매장 좌석에 있는지 **다시** 확인한다(클라이언트 값은 안 믿는다).
 */
import type { Hono, Context } from 'hono'
import type { Env } from '@/worker/types/env'
import { resolveStoreActor } from '../../../worker/utils/store-actor'
import { parseSessionCookie } from '../../../worker/utils/session'
import { safeError } from '../../../worker/utils/safe-error'
import { rateLimit } from '../../../worker/middleware/rate-limit'
import { canOperateStore } from '../../../worker/utils/seller-operators'
import { resolveTokenActorUserId } from '../../../worker/utils/store-seat-guard'
import {
  issueLinkCode, listStoreLinks, revokeStoreLink, isStoreOpsEnabled, LINK_CODE_TTL_SEC,
} from '../../../worker/utils/kakao-bot-store'

type Ctx = Context<{ Bindings: Env }>

/** (매장, 사람) — 둘 다 서버가 확정한 값. 좌석이 없으면 null. */
async function resolveBotSeat(c: Ctx): Promise<{ sellerId: number; userId: number } | null> {
  const actor = await resolveStoreActor(c.req.header('Authorization'), c.env.JWT_SECRET, c.env.DB)
  if (!actor.sellerId) return null
  const candidates: number[] = []
  if (actor.operatorUserId) candidates.push(actor.operatorUserId)
  // 🪑 좌석 토큰이 가리키는 사람(주인 좌석 포함 — `/store/new` 사장님은 linked_user_id 가 비어 있다). 살아 있는 좌석일 때만.
  const seatUser = await resolveTokenActorUserId(c.env.DB, c.req.header('Authorization'), c.env.JWT_SECRET).catch(() => null)
  if (seatUser) candidates.push(seatUser)
  const row = await c.env.DB.prepare('SELECT linked_user_id FROM sellers WHERE id = ? LIMIT 1')
    .bind(actor.sellerId).first<{ linked_user_id: number | null }>().catch(() => null)
  const linked = Number(row?.linked_user_id)
  if (Number.isFinite(linked) && linked > 0) candidates.push(linked)
  const sess = await parseSessionCookie(c.req.header('Cookie'), c.env.JWT_SECRET, ['user']).catch(() => null)
  const sid = Number(sess?.userId)
  if (Number.isFinite(sid) && sid > 0) candidates.push(sid)
  for (const userId of candidates) {
    const ok = await canOperateStore(c.env.DB, userId, actor.sellerId)
    if (ok.ok) return { sellerId: actor.sellerId, userId }
  }
  return null
}

/** 화면에 보일 봇 키 — 끝 4자리만. 원문은 해제 요청에만 쓴다. */
const maskKey = (k: string) => (k.length <= 4 ? '****' : `····${k.slice(-4)}`)

export function registerKakaoBotLinkRoutes(app: Hono<{ Bindings: Env }>): void {
  app.post('/kakao-bot/link-code', rateLimit({ action: 'kakao_bot_link_code', max: 10, windowSec: 600 }), async (c) => {
    try {
      const seat = await resolveBotSeat(c)
      if (!seat) return c.json({ success: false, error: '이 매장에 대한 권한이 없습니다' }, 403)
      if (!(await isStoreOpsEnabled(c.env as { KAKAO_BOT_STORE_OPS_ENABLED?: string }, c.env.DB))) {
        return c.json({ success: false, error: '카카오톡 매장 관리는 준비 중이에요', code: 'NOT_ENABLED' }, 409)
      }
      const code = await issueLinkCode(c.env.DB, seat.userId, seat.sellerId)
      if (!code) return c.json({ success: false, error: '코드를 만들지 못했어요. 잠시 후 다시 시도해 주세요' }, 503)
      return c.json({ success: true, data: { code, utterance: `연결 ${code}`, expires_in_sec: LINK_CODE_TTL_SEC } })
    } catch (err) {
      return safeError(c, err, '연결 코드를 만들지 못했습니다', '[seller-kakao-bot]')
    }
  })

  app.get('/kakao-bot/links', async (c) => {
    try {
      const seat = await resolveBotSeat(c)
      if (!seat) return c.json({ success: false, error: '이 매장에 대한 권한이 없습니다' }, 403)
      const enabled = await isStoreOpsEnabled(c.env as { KAKAO_BOT_STORE_OPS_ENABLED?: string }, c.env.DB)
      const links = await listStoreLinks(c.env.DB, seat.sellerId)
      return c.json({
        success: true,
        data: {
          enabled,
          links: links.map((l) => ({
            key: l.bot_user_key, key_masked: maskKey(l.bot_user_key),
            user_name: l.user_name, linked_at: l.linked_at, last_used_at: l.last_used_at,
          })),
        },
      })
    } catch (err) {
      return safeError(c, err, '연결 목록을 불러오지 못했습니다', '[seller-kakao-bot]')
    }
  })

  app.post('/kakao-bot/links/:key/revoke', rateLimit({ action: 'kakao_bot_link_revoke', max: 30, windowSec: 600 }), async (c) => {
    try {
      const seat = await resolveBotSeat(c)
      if (!seat) return c.json({ success: false, error: '이 매장에 대한 권한이 없습니다' }, 403)
      const key = String(c.req.param('key') || '').slice(0, 128)
      if (!key) return c.json({ success: false, error: '잘못된 요청입니다' }, 400)
      const ok = await revokeStoreLink(c.env.DB, seat.sellerId, key)
      if (!ok) return c.json({ success: false, error: '연결을 찾을 수 없습니다' }, 404)
      return c.json({ success: true })
    } catch (err) {
      return safeError(c, err, '연결을 해제하지 못했습니다', '[seller-kakao-bot]')
    }
  })
}
