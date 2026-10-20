/**
 * 💸 2026-07-12 (대표 결정 — flip 검증 당김): 파일럿 매장 스코프 게이트.
 *
 * flip 스위치(`commission_budget_enabled`/`promo_funding_source`)는 platform_settings 의
 * **전역 값**이고 이 프로젝트는 D1 이 하나뿐이라, 전역 스위치를 켜면 프로덕션 전 주문에 적용된다.
 * → 별도 staging 환경 없이 **프로덕션에서 지정한 테스트 매장 주문만** flip 경로(owner 펀딩)로
 *   태워 실카드 소액 결제로 축별 검증하기 위한 스코프 게이트.
 *
 * platform_settings.flip_pilot_seller_ids = CSV(예: "1234" 또는 "1234,5678").
 *   - 빈 값/미설정 = 파일럿 없음 → **완전 현행**(전역 스위치만 적용, OFF-parity 유지).
 *   - 지정 seller_id 주문 = 전역 스위치와 무관하게 예산 아비터 ON + owner 펀딩 강제.
 * 검증 통과 후: 이 키를 비우고 전역 스위치(`commission_budget_enabled`/`promo_funding_source`)를
 *   켜면 전 매장 적용. (파일럿 → 전역 순서 = 대표 조건 ①의 "검증 후 스위치".)
 *
 * ⚠️ 이 게이트도 머니 경로 — check-commission-budget.mjs [INV-CB] 가드 범위. 파일럿이라도
 *   적립/되갚기는 동일 오케스트레이터(creditOrderCommissions)·동일 헬퍼(debitOwnerPromoForOrder)
 *   경유라 불변식 동일 적용(축소만·5% 불변). 파일럿은 *스코프*만 바꿀 뿐 계산 규칙은 동일.
 */
import type { D1Database } from '@cloudflare/workers-types'

/** flip 파일럿 매장 seller_id 집합. 미설정/파싱실패 = 빈 집합(현행). */
export async function readFlipPilotSellerIds(DB: D1Database): Promise<Set<number>> {
  try {
    const row = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'flip_pilot_seller_ids'")
      .first<{ value: string }>()
    if (!row?.value) return new Set()
    return new Set(
      String(row.value)
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0),
    )
  } catch {
    return new Set()
  }
}
