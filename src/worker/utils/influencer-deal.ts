/**
 * 🤝 소개자 딜 조회 SSOT — "이 사람이 이 매장과 맺은 활성 딜의 %는 얼마인가" (2026-08-26)
 *
 * 이 WHERE 절이 **두 곳에서 같아야 한다**:
 *   ① 결제 시점 — 실제로 얼마를 적립할지 (`group-buy.routes` 커미션 계산)
 *   ② 표시 시점 — 이용권 상세의 "내 링크로 팔리면 N% 적립" 배너
 *
 * 갈리면 화면은 "N% 받는다"인데 정산은 0 이 된다. 그건 버그가 아니라 **약속 위반**이고,
 * 되돌리는 데 드는 비용(환급 + 신뢰)이 훨씬 크다. 그래서 조건을 함수 하나로 못 박는다.
 *
 * 조건 3개 (하나라도 빠지면 안 되는 이유):
 *   - `status='active'` — 제안만 하고 수락 안 한 딜은 없는 딜이다
 *   - 기간 내(`ends_at`) — 끝난 딜로 계속 받을 수는 없다
 *   - 콘텐츠 인증을 요구하는 딜이면 승인됨 — 매장이 "영상 올려주면"이라 했으면 그게 조건이다
 *
 * ⚠️ 커미션 축은 이것 **하나**다. 2026-08-22 대표 결정으로 어필리에이트(누구나 링크 공유 2%)는
 *   종료됐다 — "어필리에이트 전략은 빼려고 해. 심플하게". 그러니 이 함수가 null 을 주면
 *   **보상이 없는 것**이지, 다른 경로로 찾아볼 것이 아니다.
 */
import type { D1Database } from '@cloudflare/workers-types'

/** 활성 딜의 커미션 %(0 초과)만 반환. 없거나 조회 실패면 null(= 보상 없음). */
export async function findActiveDealPct(
  DB: D1Database,
  sellerId: number,
  influencerId: string,
): Promise<number | null> {
  if (!Number.isFinite(sellerId) || sellerId <= 0 || !influencerId) return null
  const row = await DB.prepare(
    `SELECT commission_pct FROM seller_influencer_deals
      WHERE seller_id = ? AND influencer_id = ? AND status = 'active'
        AND (ends_at IS NULL OR ends_at > datetime('now'))
        AND (COALESCE(requires_content_proof, 0) = 0 OR proof_status = 'approved')
      LIMIT 1`
  ).bind(sellerId, influencerId).first<{ commission_pct: number }>().catch(() => null)
  const pct = Number(row?.commission_pct)
  return Number.isFinite(pct) && pct > 0 ? pct : null
}
