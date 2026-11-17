import { describe, it, expect } from 'vitest'
import { PROMO_BRIEF, findForbidden } from '@/features/blog/api/blog-ai'
import { TOPUP_DISABLED } from '@/shared/feature-flags'

/**
 * 🩸 2026-11-18 — AI 홍보 brief 가 종료된 기능을 홍보하고 있었다.
 *
 * 딜 충전은 2026-07-18 에 서비스에서 빠졌다(TOPUP_DISABLED). 그런데 블로그·소셜 자동화가 함께 쓰는
 * `PROMO_BRIEF` 에 "딜 포인트: 미리 충전해 두면 결제가 빠르다" 가 넉 달 동안 남아 있었고,
 * 어드민이 만든 AI 블로그 초안(#31)이 그 문장을 그대로 옮겼다. 에러가 안 나서 아무도 몰랐다.
 *
 * 고정하는 것:
 *   ① 충전이 꺼져 있는 동안 brief 가 충전을 '사실' 로 말하지 않는다.
 *   ② 출력 검증이 #31 의 실제 문장(마크다운 굵게 포함)을 잡는다 — 모델이 학습 기억으로 다시 써도 폐기된다.
 *   ③ '에너지 충전' 같은 일반어는 막지 않는다(소셜 문구를 불필요하게 폐기하지 않게).
 *
 * 못 막는 것: brief 의 다른 기능 서술이 낡는 경우(예: 후원·장바구니). 기능 플래그마다 이 시험을 늘려야 한다.
 */
describe('PROMO_BRIEF 는 종료된 딜 충전을 홍보하지 않는다', () => {
  it('① 충전이 꺼져 있으면 brief 에 "충전해 두면" 류의 권유가 없다', () => {
    if (!TOPUP_DISABLED) return
    expect(PROMO_BRIEF).not.toMatch(/미리\s*충전/)
    expect(PROMO_BRIEF).not.toMatch(/충전해\s*두/)
    expect(PROMO_BRIEF).not.toMatch(/후원/)
  })

  it('② 출력 검증이 #31 원문을 잡는다', () => {
    const original = '**딜 포인트**를 미리 충전해 두면 결제가 한층 빨라지고'
    expect(findForbidden(original)).not.toBeNull()
    expect(findForbidden('딜을 충전하세요')).not.toBeNull()
    expect(findForbidden('딜 포인트 충전')).not.toBeNull()
  })

  it('③ 일반어 "충전" 은 통과한다', () => {
    expect(findForbidden('주말엔 맛있는 한 끼로 에너지 충전해 보세요')).toBeNull()
    expect(findForbidden('휴대폰 충전 걱정 없는 카페')).toBeNull()
  })
})
