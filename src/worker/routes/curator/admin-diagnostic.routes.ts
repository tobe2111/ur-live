/**
 * 🔬 유어샵/추천 적립 **어드민 진단** (read-only) — `curator.routes.ts` 에서 분리 (2026-08-27).
 *
 * 분리 이유: 본체가 파일 크기 래칫(1491줄)을 넘었다. 규칙대로 **베이스라인을 올리는 대신 뽑아냈다**
 * — 그 래칫은 god 파일을 막으려고 있는 것이고, 올리면 다음 세션이 또 올린다.
 *
 * 이 블록은 어드민 전용 + 읽기 전용이라 소비자 경로와 섞일 이유가 없었다. **로직은 byte-불변**이고
 * 옮기기만 했다(라우트 경로도 그대로 `/admin/affiliate-diagnostic`).
 */

import { Hono } from 'hono'
import type { Env } from '../../types/env'
import { requireAdmin } from '../../middleware/auth'
import { safeError } from '../../utils/safe-error'

const curatorAdminDiagnostic = new Hono<{ Bindings: Env }>()

// ============================================================
// GET /api/curator/admin/affiliate-diagnostic  (requireAdmin)
// 🔬 유어샵/추천 적립 ground-truth — 코드 변경 전 prod 실태 수집 (read-only).
//   상태 분포 / 멀티상품 귀속 규모 / 환불-후-사용 누수 프록시 / 클릭 부풀림 / top 큐레이터.
//   CLAUDE.md "진단 페이지 먼저" 룰 — 추측 대신 실데이터로 개선 우선순위 결정.
// ============================================================
curatorAdminDiagnostic.get('/admin/affiliate-diagnostic', requireAdmin(), async (c) => {
  try {
    const DB = c.env.DB

    const [byStatus, multiItem, refundProxy, clicks, topReferrers, referralByStatus, referralStuck] = await Promise.all([
      // 1) affiliate_earnings 상태 분포 (NULL = legacy 'pending' 으로 합산)
      DB.prepare(
        `SELECT COALESCE(NULLIF(status, ''), 'pending') AS status,
                COUNT(*) AS cnt, COALESCE(SUM(commission), 0) AS total
         FROM affiliate_earnings GROUP BY 1 ORDER BY 2 DESC`,
      ).all<{ status: string; cnt: number; total: number }>().catch(() => ({ results: [] as any[] })),

      // 2) 멀티상품 주문에 붙은 적립 규모 — 라인별 귀속 개선 영향도 측정
      //    (order_items 가 2개 이상인 주문에 affiliate_earning 이 달린 건수/금액)
      DB.prepare(
        `SELECT COUNT(*) AS orders, COALESCE(SUM(ae.commission), 0) AS commission
         FROM affiliate_earnings ae
         WHERE ae.order_id IS NOT NULL
           AND (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = ae.order_id) > 1`,
      ).first<{ orders: number; commission: number }>().catch(() => null),

      // 3) 환불-후-사용 누수 프록시 — 환불된 적립이 있는데 현재 딜 잔액이 0 인 큐레이터
      //    (적립을 이미 쓰고 난 뒤 환불돼 MAX(0,...) clamp 로 회수 못 한 정황)
      DB.prepare(
        `SELECT COUNT(*) AS referrers,
                COALESCE(SUM(ae.refunded_commission), 0) AS refunded_total
         FROM (
           SELECT referrer_id, SUM(commission) AS refunded_commission
           FROM affiliate_earnings
           WHERE COALESCE(status, 'pending') = 'refunded'
           GROUP BY referrer_id
         ) ae
         LEFT JOIN user_points up ON up.user_id = ae.referrer_id
         WHERE COALESCE(up.balance, 0) = 0`,
      ).first<{ referrers: number; refunded_total: number }>().catch(() => null),

      // 4) 클릭 부풀림 — 최근 30일 전체 클릭 vs 순클릭(ip+ua+일자 dedup)
      DB.prepare(
        `SELECT COUNT(*) AS total,
                COUNT(DISTINCT ip_hash || '|' || user_agent_hash || '|' || date(created_at)) AS uniq
         FROM pin_click_logs WHERE created_at >= datetime('now', '-30 days')`,
      ).first<{ total: number; uniq: number }>().catch(() => null),

      // 5) top 큐레이터 (환불 제외 누적 적립)
      DB.prepare(
        `SELECT referrer_id, COUNT(*) AS earnings,
                COALESCE(SUM(commission), 0) AS total
         FROM affiliate_earnings
         WHERE COALESCE(status, 'pending') != 'refunded'
         GROUP BY referrer_id ORDER BY total DESC LIMIT 10`,
      ).all<{ referrer_id: string; earnings: number; total: number }>().catch(() => ({ results: [] as any[] })),

      // 6) 추천 트리(referral_commissions) 상태 분포 — 2026-06-15 T+7 hold 확장 후 모니터.
      //    pending=보류(미성숙·잔액 미반영) / granted=확정(잔액 적립됨) / withdrawn=환불역전·출금
      DB.prepare(
        `SELECT COALESCE(NULLIF(status, ''), 'pending') AS status,
                COUNT(*) AS cnt, COALESCE(SUM(commission_amount), 0) AS total
         FROM referral_commissions GROUP BY 1 ORDER BY 2 DESC`,
      ).all<{ status: string; cnt: number; total: number }>().catch(() => ({ results: [] as any[] })),

      // 7) 추천 적립 성숙 cron 헬스 — hold 기간(8일) 넘게 pending 인데 주문이 정상(미환불)인 건수.
      //    >0 이면 matureReferralCommissions cron(referral-mature)이 안 돌고 있을 가능성.
      DB.prepare(
        `SELECT COUNT(*) AS cnt, COALESCE(SUM(rc.commission_amount), 0) AS total
         FROM referral_commissions rc JOIN orders o ON o.id = rc.order_id
         WHERE rc.status = 'pending'
           AND rc.created_at <= datetime('now', '-8 days')
           AND UPPER(COALESCE(o.status, '')) NOT IN ('REFUNDED', 'CANCELLED', 'FAILED')`,
      ).first<{ cnt: number; total: number }>().catch(() => null),
    ])

    const totalClicks = clicks?.total ?? 0
    const uniqClicks = clicks?.uniq ?? 0

    return c.json({
      success: true,
      generated_at: new Date().toISOString(),
      earnings_by_status: byStatus.results ?? [],
      multi_item_attribution: {
        orders: multiItem?.orders ?? 0,
        commission: multiItem?.commission ?? 0,
        note: '2개 이상 상품 주문에 붙은 적립 규모(모니터링용). 2026-06-12 라인별 귀속 적용 완료 — affiliate-credit.computeOrderCommission 이 order_items 의 referral_enabled 라인만 각 상품 비율로 합산(배송비/비대상 제외). order_items 부재(레거시/직접결제)만 단일상품 비율×주문총액 fallback. /track·/confirm 동일 SSOT.',
      },
      refund_after_spend_proxy: {
        referrers: refundProxy?.referrers ?? 0,
        refunded_total: refundProxy?.refunded_total ?? 0,
        note: '환불 적립 보유 + 현재 딜 잔액 0 인 큐레이터 — 적립을 쓴 뒤 환불돼 회수 못 했을 가능성(T+7 hold 로 차단 대상)',
      },
      clicks_30d: {
        total: totalClicks,
        unique: uniqClicks,
        inflation_pct: totalClicks > 0 ? Math.round((1 - uniqClicks / totalClicks) * 100) : 0,
        note: '전체 클릭 대비 순클릭(ip+ua+일자) — 차이가 크면 새로고침/봇 부풀림',
      },
      top_referrers: topReferrers.results ?? [],
      referral_commissions: {
        by_status: referralByStatus.results ?? [],
        stuck_pending: {
          count: referralStuck?.cnt ?? 0,
          total: referralStuck?.total ?? 0,
          note: 'hold(7일) 초과인데 미확정(pending)+주문 정상 — >0 이면 성숙 cron(referral-mature) 점검 필요',
        },
        note: 'pending=보류(잔액 미반영)/granted=확정(잔액 적립)/withdrawn=환불역전·출금. 추천 트리도 affiliate 와 동일 T+7 hold(2026-06-15)',
      },
    })
  } catch (err) {
    return safeError(c, err, '진단 조회 중 오류가 발생했습니다', '[curator:affiliate-diagnostic]')
  }
})

export { curatorAdminDiagnostic }
