/**
 * 🤝 **협업 코드 입력 → 딜 활성화** (2026-09-19, 대표 확정 플로우 7번)
 *
 * 인플루언서가 코드를 넣으면 `seller_influencer_deals` 에 그 매장과의 딜이 생긴다.
 *   - 코드의 `requires_approval=0` → **바로 `active`** (판매 즉시 적립 대상)
 *   - `requires_approval=1`          → `proposed` (매장이 `/deals/:id/respond` 로 수락해야 발효)
 *
 * ## 🔒 이 함수가 막는 것
 *   ① 자기 매장 — 그 매장의 주인·운영자는 자기 매장 딜을 못 맺는다(자가 커미션 루프).
 *      결제 시점의 `isSelfReferral` 이 한 번 더 막지만, 입력 시점에 안 막으면 화면에 "활성" 이
 *      떠서 거짓 약속이 된다.
 *   ② 차단된 인플루언서(`seller_blocked_influencers`) — 매장이 끊은 사람은 코드로 못 돌아온다.
 *   ③ 정지된 매장(`sellers.status='suspended'`) — 팔 것이 없는 곳에 딜을 걸어 주지 않는다.
 *   ④ 매장의 인플루언서 상한(`seller_meta.influencer_pct_cap`) — 코드의 % 가 상한을 넘으면
 *      **상한으로 잘라서** 건다(코드를 만든 뒤 상한이 낮아진 경우). 화면과 정산이 같은 값을 본다.
 *
 * ## 멱등
 * `seller_influencer_deals` 의 UNIQUE(seller_id, influencer_id) 를 그대로 쓴다. 같은 코드를 두 번
 * 넣으면 두 번째는 **기존 딜을 돌려준다**(활성 딜을 `proposed` 로 되돌리지 않는다 — 그러면 팔던
 * 사람의 적립이 끊긴다). 거절·만료된 딜은 코드로 다시 열 수 있다(매장이 코드를 살려 뒀다는 뜻이다).
 */
import type { D1Database } from '@cloudflare/workers-types'
import { findStoreCode, judgeStoreCode, consumeStoreCode, STORE_CODE_REASON_MESSAGE, type StoreCodeRow } from './store-codes'
import { canOperateStore } from './seller-operators'
import { getSellerMeta } from './seller-meta'

export interface RedeemResult {
  ok: boolean
  code?: string
  error?: string
  dealId?: number
  status?: 'active' | 'proposed'
  sellerId?: number
  sellerName?: string | null
  commissionPct?: number
  /** 이미 같은 매장과 딜이 있었다 — 새로 만든 게 아니다. */
  existed?: boolean
}

/** 순수 — 코드 % 와 매장 상한에서 실제 걸 % 를 정한다. 테스트가 이 경계를 잰다. */
export function resolveCodeCommissionPct(codePct: number | null | undefined, capPct: number | null | undefined, hardMax = 90): number {
  let pct = Number(codePct)
  if (!Number.isFinite(pct) || pct <= 0) pct = 0
  const cap = Number(capPct)
  if (Number.isFinite(cap) && cap > 0 && pct > cap) pct = cap
  if (pct > hardMax) pct = hardMax
  return Math.round(pct * 100) / 100
}

export async function redeemInfluencerCode(
  DB: D1Database,
  rawCode: unknown,
  userId: string,
): Promise<RedeemResult> {
  const row = await findStoreCode(DB, rawCode)
  const judged = judgeStoreCode(row, 'influencer')
  if (!judged.ok) return { ok: false, code: judged.reason, error: STORE_CODE_REASON_MESSAGE[judged.reason] }
  const c: StoreCodeRow = judged.row
  const uid = Number(userId)

  // ① 자기 매장
  if (Number.isFinite(uid) && uid > 0) {
    const access = await canOperateStore(DB, uid, c.seller_id).catch(() => ({ ok: false } as { ok: boolean }))
    if (access.ok) return { ok: false, code: 'SELF', error: '내가 운영하는 매장에는 협업 코드를 쓸 수 없어요' }
  }
  // ③ 정지 매장
  const seller = await DB.prepare('SELECT id, name, business_name, status FROM sellers WHERE id = ? LIMIT 1')
    .bind(c.seller_id).first<{ id: number; name: string | null; business_name: string | null; status: string | null }>().catch(() => null)
  if (!seller) return { ok: false, code: 'NOT_FOUND', error: '매장을 찾을 수 없어요' }
  if (seller.status === 'suspended') return { ok: false, code: 'STORE_SUSPENDED', error: '지금은 운영하지 않는 매장이에요' }
  // ② 차단
  const blocked = await DB.prepare(
    'SELECT 1 FROM seller_blocked_influencers WHERE seller_id = ? AND influencer_id = ? AND unblocked_at IS NULL LIMIT 1',
  ).bind(c.seller_id, userId).first().catch(() => null)
  if (blocked) return { ok: false, code: 'BLOCKED', error: '이 매장과는 협업할 수 없어요' }

  // ④ 상한
  const meta = (await getSellerMeta(DB, [c.seller_id])).get(c.seller_id) || {}
  const pct = resolveCodeCommissionPct(c.commission_pct, meta.influencer_pct_cap ? Number(meta.influencer_pct_cap) : null)
  if (pct <= 0) return { ok: false, code: 'NO_PCT', error: '이 코드에는 커미션이 설정돼 있지 않아요. 매장에 문의해주세요' }

  const sellerName = seller.business_name || seller.name
  // 멱등 — 이미 살아 있는 딜은 그대로 돌려준다.
  const existing = await DB.prepare(
    `SELECT id, status FROM seller_influencer_deals WHERE seller_id = ? AND influencer_id = ? LIMIT 1`,
  ).bind(c.seller_id, userId).first<{ id: number; status: string }>().catch(() => null)
  if (existing && (existing.status === 'active' || existing.status === 'proposed')) {
    return { ok: true, dealId: existing.id, status: existing.status, sellerId: c.seller_id, sellerName, commissionPct: pct, existed: true }
  }

  if (!(await consumeStoreCode(DB, c.code))) {
    return { ok: false, code: 'EXHAUSTED', error: STORE_CODE_REASON_MESSAGE.EXHAUSTED }
  }
  const status: 'active' | 'proposed' = c.requires_approval ? 'proposed' : 'active'
  const ins = await DB.prepare(
    `INSERT INTO seller_influencer_deals
       (seller_id, influencer_id, commission_pct, ends_at, status, proposed_by, message, requires_content_proof, proof_status, responded_at)
     VALUES (?, ?, ?, ?, ?, 'code', ?, 0, NULL, CASE WHEN ? = 'active' THEN datetime('now') ELSE NULL END)
     ON CONFLICT(seller_id, influencer_id) DO UPDATE SET
       commission_pct = excluded.commission_pct,
       ends_at = excluded.ends_at,
       status = excluded.status,
       proposed_by = 'code',
       message = excluded.message,
       requires_content_proof = 0,
       proof_status = NULL,
       created_at = datetime('now'),
       responded_at = excluded.responded_at`,
  ).bind(c.seller_id, userId, pct, c.expires_at, status, c.label ? `협업 코드 · ${c.label}` : '협업 코드', status).run().catch(() => null)
  if (!ins) return { ok: false, code: 'DB', error: '딜을 만들지 못했어요. 잠시 후 다시 시도해주세요' }
  const deal = await DB.prepare(
    'SELECT id FROM seller_influencer_deals WHERE seller_id = ? AND influencer_id = ? LIMIT 1',
  ).bind(c.seller_id, userId).first<{ id: number }>().catch(() => null)
  return { ok: true, dealId: deal?.id, status, sellerId: c.seller_id, sellerName, commissionPct: pct, existed: false }
}
