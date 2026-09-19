/**
 * 🔑 **협업 코드 · 딜 조정 · 인플루언서 수락** — 2026-09-19 대표 확정 플로우 5~8·10번의 API
 *
 * ## 무엇을 채우나
 *   ① 매장(주인·운영자 = 셀러 토큰)이 **협업 코드**를 만든다 — 기본 %, 승인 필요 여부, 라벨, 상한 사용 수.
 *      `GET/POST /api/seller-marketing/codes` · `POST /codes/:code/revoke`
 *   ② 인플루언서(유저)가 코드를 넣는다 → 딜 활성(`influencer-code-redeem.ts`).
 *      `POST /api/influencer-settlement/codes/redeem`
 *   ③ 🩸 **매장이 제안한 조건 없는 딜을 인플루언서가 수락할 길이 없었다** — `sellerApp /deals/:id/respond` 는
 *      `proposed_by='influencer'` 만 받고, influencerApp 엔 `submit-proof` 뿐이었다. 조건 없는 제안은
 *      '대기'에서 영원히 멈췄다(엔드포인트 0). `POST /api/influencer-settlement/deals/:id/respond` 로 메운다.
 *   ④ 케이스별 조정(대표: *"커미션 % 를 매번 케이스마다 조정 가능하긴 해야해"*) —
 *      `PATCH /api/seller-marketing/deals/:id` 가 활성·대기 딜의 % 를 바꾼다. **이후 판매분부터** 적용
 *      (결제 시점이 `findActiveDealPct` 로 그때 값을 읽는다 — 소급 없음). 상대에게 알림.
 *   ⑤ 로그인 전 미리보기 — `/i/join/:code` 페이지가 "어느 매장·몇 %" 를 보여 준 뒤 로그인으로 보낸다.
 *      `GET /api/influencer-discover/code/:code` (optionalAuth — 값은 코드 주인이 뿌린 공개 정보다).
 *
 * ## 상한
 *   코드 %·딜 % 모두 `DEAL_PCT_MAX`(90) 와 매장의 `influencer_pct_cap`(중개사가 등록 때 정한 예산 상한) 을
 *   못 넘는다. 상한을 넘기려면 요율부터 고쳐야 한다(`/api/seller/stores/:id/broker-terms`).
 */
import type { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import type { AuthUser } from '@/worker/middleware/auth'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { DEAL_PCT_MAX } from '../commission-rates'
import {
  issueStoreCode, listStoreCodes, revokeStoreCode, findStoreCode, judgeStoreCode,
  formatStoreCode, STORE_CODE_REASON_MESSAGE,
} from '@/worker/utils/store-codes'
import { redeemInfluencerCode, resolveCodeCommissionPct } from '@/worker/utils/influencer-code-redeem'
import { readBrokerTerms } from '@/worker/utils/broker-share'
import { notifyUser, notifySeller } from '@/lib/notifications'

type MarketingVars = {
  user?: { id: string | number; email?: string }
  seller?: { id: number; email?: string }
}
type MarketingApp = Hono<{ Bindings: Env; Variables: MarketingVars }>

function getSellerId(c: { get: (k: string) => unknown }): number {
  return Number((c.get('user') as AuthUser).id)
}
function getUserId(c: { get: (k: string) => unknown }): string {
  return String((c.get('user') as AuthUser).id)
}

/** 코드·딜의 % 를 매장 상한 안으로 검증한다. 순수 판정은 `resolveCodeCommissionPct` 와 같은 규칙. */
function checkPct(raw: unknown, capPct: number | null): { ok: true; pct: number } | { ok: false; error: string } {
  const pct = Number(raw)
  if (!Number.isFinite(pct) || pct <= 0 || pct > DEAL_PCT_MAX) return { ok: false, error: `커미션 % 은 0 ~ ${DEAL_PCT_MAX} 사이여야 해요` }
  if (capPct != null && pct > capPct) return { ok: false, error: `이 매장의 인플루언서 커미션 상한은 ${capPct}% 예요 — 상한은 매장 요율에서 바꿀 수 있어요` }
  return { ok: true, pct: resolveCodeCommissionPct(pct, capPct) }
}

export function registerCollabCodeRoutes(sellerApp: MarketingApp, influencerApp: MarketingApp, discoverApp: MarketingApp): void {
  // ───────── ① 매장: 협업 코드 ─────────
  sellerApp.get('/codes', async (c) => {
    const sellerId = getSellerId(c)
    const [rows, terms] = await Promise.all([listStoreCodes(c.env.DB, sellerId, 'influencer'), readBrokerTerms(c.env.DB, sellerId)])
    return c.json({ success: true, data: {
      codes: rows.map((r) => ({ ...r, display: formatStoreCode(r.code), join_url: `https://urdeal.kr/i/join/${r.code}` })),
      influencer_pct_cap: terms.influencerCapPct,
    } })
  })

  sellerApp.post('/codes', rateLimit({ action: 'collab_code_issue', max: 20, windowSec: 3600 }), async (c) => {
    const sellerId = getSellerId(c)
    const b = await c.req.json<{ commission_pct?: unknown; requires_approval?: unknown; label?: unknown; max_uses?: unknown; expires_at?: unknown }>()
      .catch(() => ({} as Record<string, unknown>))
    const terms = await readBrokerTerms(c.env.DB, sellerId)
    const v = checkPct(b.commission_pct, terms.influencerCapPct)
    if (!v.ok) return c.json({ success: false, error: v.error }, 400)
    const label = b.label == null ? null : String(b.label).trim().slice(0, 40) || null
    const maxUsesRaw = b.max_uses == null || b.max_uses === '' ? null : Number(b.max_uses)
    if (maxUsesRaw !== null && (!Number.isInteger(maxUsesRaw) || maxUsesRaw < 1 || maxUsesRaw > 10000)) {
      return c.json({ success: false, error: '사용 횟수는 1 ~ 10000 사이 정수예요' }, 400)
    }
    let expiresAt: string | null = null
    if (b.expires_at) {
      const t = new Date(String(b.expires_at))
      if (!Number.isFinite(t.getTime()) || t.getTime() < Date.now()) return c.json({ success: false, error: '만료일은 미래여야 해요' }, 400)
      expiresAt = t.toISOString()
    }
    const row = await issueStoreCode(c.env.DB, {
      sellerId, kind: 'influencer', createdBy: sellerId, commissionPct: v.pct,
      requiresApproval: b.requires_approval === true || b.requires_approval === 1 || b.requires_approval === '1' || b.requires_approval === 'true',
      label, maxUses: maxUsesRaw, expiresAt,
    })
    if (!row) return c.json({ success: false, error: '코드를 만들지 못했어요. 잠시 후 다시 시도해주세요' }, 500)
    return c.json({ success: true, data: { ...row, display: formatStoreCode(row.code), join_url: `https://urdeal.kr/i/join/${row.code}` } })
  })

  sellerApp.post('/codes/:code/revoke', async (c) => {
    const sellerId = getSellerId(c)
    const ok = await revokeStoreCode(c.env.DB, sellerId, c.req.param('code'))
    if (!ok) return c.json({ success: false, error: '코드를 찾을 수 없거나 이미 회수됐어요' }, 404)
    return c.json({ success: true })
  })

  // ───────── ④ 매장: 딜 % 조정 (케이스별) ─────────
  sellerApp.patch('/deals/:id', rateLimit({ action: 'deal_adjust', max: 60, windowSec: 3600 }), async (c) => {
    const sellerId = getSellerId(c)
    const dealId = Number(c.req.param('id'))
    if (!Number.isFinite(dealId) || dealId <= 0) return c.json({ success: false, error: 'invalid id' }, 400)
    const b = await c.req.json<{ commission_pct?: unknown; ends_at?: unknown }>().catch(() => ({} as Record<string, unknown>))
    const terms = await readBrokerTerms(c.env.DB, sellerId)
    const v = checkPct(b.commission_pct, terms.influencerCapPct)
    if (!v.ok) return c.json({ success: false, error: v.error }, 400)
    let endsAt: string | null | undefined
    if (b.ends_at === null || b.ends_at === '') endsAt = null
    else if (b.ends_at != null) {
      const t = new Date(String(b.ends_at))
      if (!Number.isFinite(t.getTime())) return c.json({ success: false, error: '만료일 형식이 잘못됐어요' }, 400)
      endsAt = t.toISOString()
    }
    const before = await c.env.DB.prepare(
      `SELECT influencer_id, commission_pct, status FROM seller_influencer_deals WHERE id = ? AND seller_id = ? LIMIT 1`,
    ).bind(dealId, sellerId).first<{ influencer_id: string; commission_pct: number; status: string }>().catch(() => null)
    if (!before || (before.status !== 'active' && before.status !== 'proposed')) {
      return c.json({ success: false, error: '조정할 수 있는 딜이 아니에요(활성 또는 대기 상태만)' }, 404)
    }
    const r = await c.env.DB.prepare(
      `UPDATE seller_influencer_deals SET commission_pct = ?, ends_at = CASE WHEN ? = 1 THEN ? ELSE ends_at END
        WHERE id = ? AND seller_id = ? AND status IN ('active','proposed')`,
    ).bind(v.pct, endsAt === undefined ? 0 : 1, endsAt ?? null, dealId, sellerId).run().catch(() => null)
    if (!r?.meta?.changes) return c.json({ success: false, error: '조정에 실패했어요' }, 409)
    // 협의된 값이 바뀌었으면 상대가 알아야 한다 — 이후 판매분부터 적용된다는 사실까지.
    if (Number(before.commission_pct) !== v.pct) {
      await notifyUser(c.env.DB, before.influencer_id, 'deal_pct_changed', '협업 커미션이 조정됐어요',
        `매장이 커미션을 ${before.commission_pct}% → ${v.pct}% 로 바꿨어요. 지금부터 팔리는 건부터 적용돼요.`, '/influencer/settlement')
        .catch(() => {})
    }
    return c.json({ success: true, data: { id: dealId, commission_pct: v.pct, ends_at: endsAt === undefined ? undefined : endsAt } })
  })

  // ───────── ② 인플루언서: 코드 입력 ─────────
  influencerApp.post('/codes/redeem', rateLimit({ action: 'collab_code_redeem', max: 20, windowSec: 600 }), async (c) => {
    const userId = getUserId(c)
    const b = await c.req.json<{ code?: unknown }>().catch(() => ({} as { code?: unknown }))
    const r = await redeemInfluencerCode(c.env.DB, b.code, userId)
    if (!r.ok) return c.json({ success: false, code: r.code, error: r.error }, r.code === 'NOT_FOUND' ? 404 : 400)
    if (!r.existed && r.status === 'proposed') {
      // 승인 필요 코드 — 매장이 알아야 수락한다(셀러 알림함).
      await notifySeller(c.env.DB, r.sellerId!, 'deal_code_pending', '협업 코드로 신청이 들어왔어요',
        `인플루언서가 코드로 협업을 신청했어요 (${r.commissionPct}%). 협업 제안 화면에서 수락해주세요.`, '/seller/influencer-deals')
        .catch(() => {})
    }
    return c.json({ success: true, data: {
      deal_id: r.dealId, status: r.status, seller_id: r.sellerId, seller_name: r.sellerName,
      commission_pct: r.commissionPct, existed: !!r.existed,
      store_link: `https://urdeal.kr/s/${r.sellerId}?ref=${encodeURIComponent(userId)}`,
    } })
  })

  // ───────── ③ 인플루언서: 매장 제안 수락/거절 ─────────
  influencerApp.post('/deals/:id/respond', async (c) => {
    const userId = getUserId(c)
    const dealId = Number(c.req.param('id'))
    const body = await c.req.json<{ action?: string }>().catch(() => ({ action: 'reject' }))
    const newStatus = body.action === 'accept' ? 'active' : 'rejected'
    // ⚠️ 조건부(콘텐츠 인증) 제안은 이 길로 못 지나간다 — 그건 링크 제출 → 매장 승인이 발효 조건이다.
    const r = await c.env.DB.prepare(
      `UPDATE seller_influencer_deals SET status = ?, responded_at = datetime('now')
        WHERE id = ? AND influencer_id = ? AND status = 'proposed' AND proposed_by IN ('seller','code')
          AND COALESCE(requires_content_proof, 0) = 0`,
    ).bind(newStatus, dealId, userId).run().catch(() => null)
    if (!r?.meta?.changes) return c.json({ success: false, error: '수락할 수 있는 제안이 아니에요(이미 처리됐거나 조건부 제안)' }, 404)
    return c.json({ success: true, status: newStatus })
  })

  // ───────── ⑤ 로그인 전 미리보기 ─────────
  discoverApp.get('/code/:code', rateLimit({ action: 'collab_code_preview', max: 60, windowSec: 600 }), async (c) => {
    const row = await findStoreCode(c.env.DB, c.req.param('code'))
    const judged = judgeStoreCode(row, 'influencer')
    if (!judged.ok) return c.json({ success: false, code: judged.reason, error: STORE_CODE_REASON_MESSAGE[judged.reason] }, 404)
    const s = await c.env.DB.prepare('SELECT id, name, business_name, address, status FROM sellers WHERE id = ? LIMIT 1')
      .bind(judged.row.seller_id).first<{ id: number; name: string | null; business_name: string | null; address: string | null; status: string | null }>().catch(() => null)
    if (!s || s.status === 'suspended') return c.json({ success: false, code: 'NOT_FOUND', error: '매장을 찾을 수 없어요' }, 404)
    const terms = await readBrokerTerms(c.env.DB, s.id)
    return c.json({ success: true, data: {
      code: formatStoreCode(judged.row.code),
      seller_id: s.id, seller_name: s.business_name || s.name, address: s.address,
      commission_pct: resolveCodeCommissionPct(judged.row.commission_pct, terms.influencerCapPct),
      requires_approval: !!judged.row.requires_approval,
      label: judged.row.label,
    } })
  })
}
