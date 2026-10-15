/**
 * 🚫 2026-10-15 — 카카오맵 후기 보너스는 2026-10-12 에 꺼졌다(`KAKAO_REVIEW_BONUS_ENABLED=false`).
 * 그런데 사장님 덱·입점 사실 파일은 "1,000딜" 을, 사장님 화면은 금액 설정 카드를 계속 보여 줬다.
 * 꺼져 있는 동안 **어느 표면도 금액을 약속하지 않는다**를 고정한다.
 * ⚠️ 못 보는 것: 이미 내보낸 PDF 덱 · 대표가 카톡으로 보낸 문구.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { KAKAO_REVIEW_BONUS_ENABLED } from '@/shared/feature-flags'
import { PARTNER_FACTS } from '@/shared/partners-facts'

const R = (p: string) => readFileSync(p, 'utf8')

describe('후기 보너스가 꺼져 있는 동안 금액을 약속하지 않는다', () => {
  it('전제: 플래그가 꺼져 있다(켜면 이 시험을 함께 고칠 것)', () => {
    expect(KAKAO_REVIEW_BONUS_ENABLED).toBe(false)
  })
  it('입점 사실 파일이 딜 금액을 말하지 않는다', () => {
    expect(PARTNER_FACTS.reviewBonus).not.toMatch(/\d/)
  })
  it('덱 원본이 딜 금액을 말하지 않는다', () => {
    const m = R('docs/business/proposals/deck-common.mjs').match(/reviewBonus:\s*'([^']*)'/)
    expect(m).not.toBeNull()
    expect(m![1]).not.toMatch(/\d/)
  })
  it('사장님 보너스 설정 카드는 플래그 뒤에 있다', () => {
    const s = R('src/components/seller/ReviewBonusCard.tsx')
    expect(s).toMatch(/if \(!KAKAO_REVIEW_BONUS_ENABLED\) return null/)
  })
  it('가이드 두 곳이 운영 중단을 먼저 말한다', () => {
    expect(R('src/features/guides/api/guide-seed-seller.ts')).toContain('지금은 운영하지 않습니다** (2026-10-12)')
    expect(R('src/features/guides/api/guide-seed-admin.ts')).toContain('2026-10-12 부터 운영 중단')
  })
})
