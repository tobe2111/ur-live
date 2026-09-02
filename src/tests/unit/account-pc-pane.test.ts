import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments as codeOnly } from '../helpers/source-text'

/**
 * 🖥️ 2026-09-02 (대표 — "PC 모드 답지 않은 페이지야") PC 마이 "왼쪽 메뉴 + 오른쪽은 내용" 계약.
 *   종전 PC 는 모바일 메뉴 목록을 600px 에 세운 것이라 좌우가 같은 항목을 두 번 보여 줬다.
 *   ⚠️ 못 막는 것: 실제 배치(그리드 폭·정렬)는 `visual-preview --route=/user/profile --pc` 로 본다.
 */
const read = (f: string) => readFileSync(f, 'utf-8')
const PAGE = codeOnly(read('src/pages/UserProfilePage.tsx'))
const PANE = codeOnly(read('src/pages/user-profile/AccountPcPane.tsx'))
const NAV = codeOnly(read('src/pages/user-profile/AccountSideNav.tsx'))

describe('PC 마이 — 우측 칸은 메뉴가 아니라 내용', () => {
  it('lg+ 는 AccountPcPane, 모바일은 종전 흐름(딜 카드 → 이용 내역 목록) — 동기 미디어쿼리 분기', () => {
    expect(PAGE).toMatch(/const isPc = useMediaQuery\('\(min-width: 1024px\)'\)/)
    expect(PAGE).toMatch(/\{isPc \? \(\s*<AccountPcPane counts=\{counts\}/)
    expect(PAGE).toMatch(/<TeamPointsCard \/>/)
    expect(PAGE).toMatch(/<ShoppingGroup counts=\{counts\} \/>/)
  })
  it('보라 그라디언트 헤더 띠가 없다(표면 규칙 ⑥) — PC 에선 모바일 헤더를 숨긴다', () => {
    expect(PAGE).not.toContain('#171026')
    expect(PAGE).not.toMatch(/bg-gradient-to-b from-white via-warm/)
    expect(PAGE).toMatch(/className=\{isPc \? 'hidden' : ''\}/)
  })
  it('숫자 넷(딜·이용권·교환권·쿠폰)이 주인공 — 각자 목적지로 간다', () => {
    for (const p of ['/my-deal-history', '/my-vouchers', '/my-gifticons', '/my-coupons']) expect(PANE, p).toContain(`path: '${p}'`)
    expect(PANE).toMatch(/grid-cols-4 gap-4/)
  })
  it('곧 쓸 이용권은 지갑·결제 완료와 같은 TicketCard 부품, 사용 가능 매장 이용권만 만료 임박순 3장', () => {
    expect(PANE).toContain("from '@/components/ticket/TicketCard'")
    expect(PANE).toMatch(/v\.status === 'unused' && isStoreVoucher\(v\)/)
    expect(PANE).toMatch(/\.slice\(0, 3\)/)
  })
  it('바로가기 타일 넷은 모바일 목록의 나머지 행과 같은 목적지', () => {
    for (const p of ['/my-stays', '/my/digital', '/my/follows', '/wishlist']) expect(PANE, p).toContain(`path: '${p}'`)
  })
  it('왼쪽 메뉴 — 선택은 블루 면, 내 교환권 항목이 있다', () => {
    expect(NAV).toContain("? 'bg-brand text-white'")
    expect(NAV).toContain("path: '/my-gifticons'")
  })
})
