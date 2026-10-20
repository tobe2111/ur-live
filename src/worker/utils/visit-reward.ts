/**
 * 🏙️ 2026-07-05 상권 방문 리워드 (B2G 상권 패키지 — 실행계획 "첫 구매 시 무상 딜 지급").
 *
 * 캠페인(대상 상권 지역코드·기간·지급액·총액 캡) 단위로, 그 상권 매장 상품을 캠페인 기간에
 * **처음 구매 확정**한 유저에게 무상 딜을 1인 1회 지급한다.
 *
 * 불변식 (CLAUDE.md 머니 룰):
 *  1. 멱등: visit_reward_grants UNIQUE(campaign_id, user_id) + INSERT OR IGNORE claim-before-credit.
 *  2. 무상 태깅: 지급은 creditFreePoints(free 버킷 — 출금 제외·우선 차감, point-buckets SSOT).
 *  3. 총액 캡: Σ(granted amount) + 지급액 > total_budget 이면 지급 안 함 + 캠페인 자동 종료(ended)
 *     + 어드민 대시보드 알림. (soft cap — 동시 2건 레이스 시 1건 초과 가능, 가드레일 목적.)
 *  4. 적립-역전 대칭: 트리거 주문(order_ref) 환불 시 reverseVisitRewardOnRefund 가
 *     granted→revoked CAS 후 free 에서 회수 + 원장(visit_reward_reversal) 기록.
 *  5. fail-soft: 어떤 실패도 throw 하지 않음 — 결제/환불 흐름 보호 (호출측 waitUntil 권장).
 *
 * 상권 매칭: product_regions.region_dong_code 가 캠페인 region_code(시군구 5자리/행정동 10자리)
 * prefix 로 시작하면 그 상권 매장 상품 (상권관 /local/:code · 어드민 상권 리포트와 동일 규약).
 */
import type { D1Database } from '@cloudflare/workers-types'
import { creditFreePoints, ensureDealBuckets } from './point-buckets'
import { recordPointTransaction } from './point-ledger'

const _ensured = new WeakSet<D1Database>()
export async function ensureVisitRewardTables(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS visit_reward_campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        region_code TEXT NOT NULL,
        reward_amount INTEGER NOT NULL,
        total_budget INTEGER NOT NULL,
        starts_at TEXT,
        ends_at TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run()
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS visit_reward_grants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        order_ref TEXT,
        amount INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'granted',
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(campaign_id, user_id)
      )
    `).run()
    await DB.prepare('CREATE INDEX IF NOT EXISTS idx_visit_reward_grants_order ON visit_reward_grants(order_ref)').run().catch(() => {})
  } catch { /* exists */ }
}

interface CampaignRow {
  id: number
  name: string
  region_code: string
  reward_amount: number
  total_budget: number
}

/** 캠페인 소진액 (granted 만 — revoked 는 예산 반환). */
async function spentOf(DB: D1Database, campaignId: number): Promise<number> {
  const row = await DB.prepare(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM visit_reward_grants WHERE campaign_id = ? AND status = 'granted'",
  ).bind(campaignId).first<{ total: number }>().catch(() => null)
  return Number(row?.total) || 0
}

async function endCampaign(DB: D1Database, campaign: CampaignRow, reason: string): Promise<void> {
  const cas = await DB.prepare(
    "UPDATE visit_reward_campaigns SET status = 'ended' WHERE id = ? AND status = 'active'",
  ).bind(campaign.id).run().catch(() => null)
  if (!cas?.meta?.changes) return // 다른 요청이 이미 종료 — 알림 중복 방지
  try {
    const { createDashboardNotification } = await import('../../features/notifications/api/dashboard-notifications.routes')
    await createDashboardNotification(
      DB, 'admin', null, 'visit_reward_ended',
      '🏙️ 방문 리워드 캠페인 자동 종료',
      `${campaign.name} — ${reason} (예산 ${Number(campaign.total_budget).toLocaleString('ko-KR')}딜)`,
      '/admin/visit-rewards',
    )
  } catch { /* fail-soft */ }
}

export interface VisitRewardGrantResult {
  granted: boolean
  reason?: string
  campaignId?: number
  amount?: number
}

/**
 * 구매 확정 트리거 — 상품이 활성 캠페인 상권에 속하면 1인 1회 무상 딜 지급.
 * 호출: group-buy /join(딜)·/confirm-toss(카드) 성공 side-effect (waitUntil, fail-soft).
 */
export async function grantVisitRewardOnPurchase(
  DB: D1Database,
  input: { userId: string | number; productId: number; orderRef?: string | null },
): Promise<VisitRewardGrantResult> {
  try {
    const uid = String(input.userId ?? '')
    const pid = Number(input.productId)
    if (!uid || !Number.isFinite(pid)) return { granted: false, reason: 'invalid' }
    await ensureVisitRewardTables(DB)
    await ensureDealBuckets(DB)

    // 이 상품의 상권에 걸린 활성·기간내 캠페인 (여러 개면 순차 — 보통 0~1개)
    const campaigns = await DB.prepare(
      `SELECT c.id, c.name, c.region_code, c.reward_amount, c.total_budget
         FROM visit_reward_campaigns c
        WHERE c.status = 'active'
          AND (c.starts_at IS NULL OR c.starts_at = '' OR datetime('now') >= datetime(c.starts_at))
          AND (c.ends_at IS NULL OR c.ends_at = '' OR datetime('now') <= datetime(c.ends_at))
          AND EXISTS (
            SELECT 1 FROM product_regions pr
             WHERE pr.product_id = ? AND pr.region_dong_code LIKE (c.region_code || '%')
          )
        LIMIT 5`,
    ).bind(pid).all<CampaignRow>().catch(() => ({ results: [] as CampaignRow[] }))

    for (const camp of campaigns.results || []) {
      const amount = Math.max(0, Math.round(Number(camp.reward_amount) || 0))
      if (amount <= 0) continue

      // 총액 캡 — 지급 전 검사 (초과면 지급 없이 자동 종료)
      const spent = await spentOf(DB, camp.id)
      if (spent + amount > Number(camp.total_budget)) {
        await endCampaign(DB, camp, '총액 캡 도달')
        continue
      }

      // claim-before-credit: UNIQUE(campaign_id, user_id) — 1인 1회 멱등
      const claim = await DB.prepare(
        "INSERT OR IGNORE INTO visit_reward_grants (campaign_id, user_id, order_ref, amount, status) VALUES (?, ?, ?, ?, 'granted')",
      ).bind(camp.id, uid, input.orderRef != null ? String(input.orderRef) : null, amount).run().catch(() => null)
      if (!claim?.meta?.changes) continue // 이미 받음 (재구매 중복 미지급)

      // 무상 딜 지급 — 실패 시 claim 롤백 (다음 구매에서 재시도 가능)
      // ⚠️ 원장 order_id 는 주문 ref 가 아니라 `vr:{campaignId}` — 주문 ref 에 리워드 적립(+free_delta)이
      //   섞이면 computeFreeRestorePortion 의 주문 환불 무상 복원분이 왜곡됨(환불 매칭은 grants.order_ref 가 담당).
      const credited = await creditFreePoints(DB, {
        userId: uid,
        amount,
        type: 'visit_reward',
        description: `[상권 방문 리워드] ${camp.name}`,
        orderId: `vr:${camp.id}`,
      })
      if (!credited) {
        await DB.prepare('DELETE FROM visit_reward_grants WHERE campaign_id = ? AND user_id = ?')
          .bind(camp.id, uid).run().catch(() => {})
        continue
      }

      // 유저 인앱 알림 (best-effort)
      await DB.prepare(
        `INSERT INTO user_notifications (user_id, type, title, message, link)
         VALUES (?, 'visit_reward', ?, ?, '/my-deal-history')`,
      ).bind(
        uid,
        `🏙️ 동네 방문 리워드 +${amount.toLocaleString('ko-KR')}딜`,
        `${camp.name} 첫 구매 감사 리워드가 적립됐어요!`,
      ).run().catch(() => {})

      // 지급 후 캡 도달 → 자동 종료 + 어드민 알림
      if (spent + amount >= Number(camp.total_budget)) {
        await endCampaign(DB, camp, '총액 캡 소진')
      }
      return { granted: true, campaignId: camp.id, amount }
    }
    return { granted: false, reason: 'no_campaign' }
  } catch {
    return { granted: false, reason: 'error' }
  }
}

/**
 * 적립-역전 대칭: 트리거 주문 환불 시 회수 (granted→revoked CAS, free 버킷에서 회수).
 * orderRef 로 매칭 — 다른 주문의 환불은 리워드에 영향 없음. 멱등·fail-soft.
 */
export async function reverseVisitRewardOnRefund(
  DB: D1Database,
  orderRef: string | null | undefined,
): Promise<void> {
  try {
    if (!orderRef) return
    await ensureVisitRewardTables(DB)
    await ensureDealBuckets(DB)
    const rows = await DB.prepare(
      "SELECT id, campaign_id, user_id, amount FROM visit_reward_grants WHERE order_ref = ? AND status = 'granted'",
    ).bind(String(orderRef)).all<{ id: number; campaign_id: number; user_id: string; amount: number }>()
      .catch(() => ({ results: [] as Array<{ id: number; campaign_id: number; user_id: string; amount: number }> }))

    for (const g of rows.results || []) {
      // claim-before-debit: granted→revoked CAS — 동시/중복 환불에도 1회만 회수
      const cas = await DB.prepare(
        "UPDATE visit_reward_grants SET status = 'revoked' WHERE id = ? AND status = 'granted'",
      ).bind(g.id).run().catch(() => null)
      if (!cas?.meta?.changes) continue
      const amt = Math.max(0, Math.round(Number(g.amount) || 0))
      if (amt <= 0) continue
      // 무상 적립의 회수 — free 동반 회수 (MAX(0,…) clamp, 음수 방지)
      await DB.prepare(
        "UPDATE user_points SET balance = MAX(0, balance - ?), free_balance = MAX(0, COALESCE(free_balance, 0) - ?), updated_at = datetime('now') WHERE user_id = ?",
      ).bind(amt, amt, String(g.user_id)).run().catch(() => {})
      await recordPointTransaction(DB, {
        userId: String(g.user_id),
        delta: -amt,
        type: 'visit_reward_reversal',
        description: '상권 방문 리워드 회수 (주문 환불)',
        orderId: `vr:${g.campaign_id}`, // 주문 ref 오염 방지 — 적립(vr:)과 동일 네임스페이스
        freeDelta: -amt,
      }).catch(() => {})
    }
  } catch { /* fail-soft */ }
}
