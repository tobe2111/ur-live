/**
 * 👁️ 어드민 주문 목록 · 대시보드 활동 피드 — 연락처 마스킹 제거 (2026-10-14 대표 *"응 다 보이게 해줘"*).
 *
 * 유저 관리 목록(`admin-users-unmasked-2026-10-14.test.ts`)과 같은 결정이다. 세 화면 중 하나만 다시 가려지면
 * 같은 사람의 번호가 화면마다 다르게 보이고 에러는 0 이다 — 그래서 세 곳을 같은 날짜로 고정한다.
 *
 * ⚠️ 못 보는 것: 화면이 실제로 그리는 값(브라우저 밖) · 서버 응답이 이미 가린 값을 주는 경우(지금은 원본을 준다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const ORDERS = 'src/pages/AdminOrdersPage.tsx'
const FEED = 'src/pages/admin-page/AdminActivityFeed.tsx'

describe('어드민 주문 목록·활동 피드 — 연락처를 그대로 보인다', () => {
  it('주문 목록은 shipping_phone 을 그대로 그린다', () => {
    const src = stripComments(readFileSync(ORDERS, 'utf8'))
    expect(src).not.toMatch(/mask(Phone|Email|PersonName)\s*\(/)
    expect(src).toContain("{order.shipping_phone || '-'}")
  })
  it('활동 피드는 shipping_phone 을 그대로 쓴다', () => {
    const src = stripComments(readFileSync(FEED, 'utf8'))
    expect(src).not.toMatch(/mask(Phone|Email|PersonName)\s*\(/)
    expect(src).toMatch(/const phone = \(o\.shipping_phone \|\| ''\)\.trim\(\)/)
  })
})
