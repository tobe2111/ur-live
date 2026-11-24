import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { GIFT_SEND_HIDDEN } from '@/shared/feature-flags'

/**
 * 2026-11-24 대표 결정 두 건(라이브 스키마 대조에서 나온 고장).
 *   ① [선물] 버튼 — 미완성 기능이고 라이브에 `gifts` 표가 없어 누르면 항상 오류 → 숨긴다("숨기기").
 *   ② 공구 마일스톤 알림 — 없는 찜 표를 UNION 으로 읽어 문장 전체가 실패, 단골 알림이 한 번도 안 나갔다
 *      → 단골(seller_follows)만 읽는다("고쳐서 알림 보내기").
 * 못 막는 것: ①을 켜기 전에 결제 연결·표 생성을 끝냈는지(플래그 주석에 조건을 적어 두었다).
 */
describe('선물 버튼 숨김 · 마일스톤 알림 대상', () => {
  it('① 선물 버튼과 보내기 창은 GIFT_SEND_HIDDEN 뒤에 있다', () => {
    expect(GIFT_SEND_HIDDEN).toBe(true)
    // 버튼(떠 있는 부품)은 플래그가 켜져 있으면 아무것도 안 그린다.
    const fab = readFileSync('src/components/gift/GiftSendFab.tsx', 'utf8')
    expect(fab).toMatch(/if \(GIFT_SEND_HIDDEN\) return null/)
    expect(fab.indexOf('if (GIFT_SEND_HIDDEN) return null')).toBeLessThan(fab.indexOf('<button'))
    // 상품 상세는 버튼을 그 부품으로만 그리고, 보내기 창도 플래그 뒤에 둔다.
    const page = readFileSync('src/pages/ProductDetailPage.tsx', 'utf8')
    expect(page).toContain('<GiftSendFab onOpen')
    expect(page).not.toMatch(/<button[^>]*\n?[^>]*setGiftModalOpen\(true\)/)
    expect(page).toContain('{!GIFT_SEND_HIDDEN && giftModalOpen && (')
  })
  it('② 마일스톤 알림 조회가 없는 표를 읽지 않는다', () => {
    const s = readFileSync('src/features/group-buy/api/group-buy.routes.ts', 'utf8')
    expect(s).not.toMatch(/FROM\s+interest_list/)
    expect(s).toMatch(/FROM seller_follows WHERE seller_id = \? AND notify_group_buy = 1/)
  })
})
