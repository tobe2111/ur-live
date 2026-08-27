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

/**
 * 🤝 같은 SSOT 의 **배치판** — "이 사람이 지금 활성 딜을 맺고 있는 매장들과 그 %" (2026-08-27)
 *
 * ## 왜 필요한가
 * 목록 화면(소개자 카탈로그 100개 상품 · 유어샵 핀 N개)에서 상품마다 `findActiveDealPct` 를
 * 부르면 **왕복이 N번**이다. 그래서 호출부들이 각자 WHERE 절을 **복사**하기 시작했고,
 * 그게 이 파일이 막으려던 바로 그 드리프트다(화면은 "N% 받는다"인데 정산은 0).
 *
 * ⇒ 조건을 한 번 더 쓰지 말고 **여기서 한 번에 가져간다.** 한 사람의 활성 딜은 많아야 수십 건이라
 *   매장 필터 없이 전부 읽어도 싸다.
 *
 * ⚠️ WHERE 절은 위 `findActiveDealPct` 와 **글자 그대로 같아야 한다** — 이 파일 안에서만
 *    같으면 되므로, 밖에서 복사할 이유가 사라진다.
 */
export async function findActiveDealPctsBySeller(
  DB: D1Database,
  influencerId: string,
): Promise<Map<number, number>> {
  const out = new Map<number, number>()
  if (!influencerId) return out
  const { results } = await DB.prepare(
    `SELECT seller_id, commission_pct FROM seller_influencer_deals
      WHERE influencer_id = ? AND status = 'active'
        AND (ends_at IS NULL OR ends_at > datetime('now'))
        AND (COALESCE(requires_content_proof, 0) = 0 OR proof_status = 'approved')`
  ).bind(influencerId).all<{ seller_id: number; commission_pct: number }>()
    .catch(() => ({ results: [] as { seller_id: number; commission_pct: number }[] }))
  for (const r of results || []) {
    const pct = Number(r.commission_pct)
    // 0% 딜은 보상이 없는 것과 같다 — 단건 함수(`pct > 0`)와 같은 기준으로 버린다.
    if (Number.isFinite(pct) && pct > 0) out.set(Number(r.seller_id), pct)
  }
  return out
}
