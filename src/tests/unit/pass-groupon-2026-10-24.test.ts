/**
 * 🛍️ 이용권 상세 그루폰식 (2026-10-24 대표 승인 "그루폰식으로 하자")
 *
 * 지키는 것:
 *  ① 본문 '옵션 선택' 카드의 구매하기는 **하단 바와 같은 구매 창**을 연다 — 결제를 따로 부르면
 *     딜 사용 칸이 빠진 두 번째 결제 경로가 생긴다.
 *  ② 그 카드는 주인·사전 응모에선 안 뜬다(하단 바가 [관리하기]·[사전 응모하기] 를 낸다).
 *  ③ '이렇게 써요' 는 지어낸 문구가 없다 — 선물하기·카운트다운·포함 내역을 그리지 않는다.
 * ⚠️ 못 보는 것: 실제로 보기 좋은지(렌더로 본다) · 구매 창이 열린 뒤의 결제(기존 시험 몫).
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'

const CARD = 'src/pages/group-buy/PassOptionCard.tsx'
const BAR = 'src/pages/group-buy/DealBottomBar.tsx'
const PAGE = 'src/pages/GroupBuyDetailPage.tsx'

describe('이용권 상세 그루폰식', () => {
  it('① 옵션 카드는 결제를 직접 부르지 않고 같은 구매 창을 연다', () => {
    const card = readCode(CARD)
    expect(card).toContain('onClick={onOpen}')
    expect(card).not.toMatch(/onJoin|handleJoin|api\./)
    const page = readCode(PAGE)
    expect(page).toContain('onOpen={() => setBuyOpen(n => n + 1)}')
    expect(page).toContain('openRequest={buyOpen}')
    expect(readCode(BAR)).toMatch(/if \(openRequest > 0 && isJoinable && !isPrelaunch && !isOwner\) setOpen\(true\)/)
  })

  it('② 주인·사전 응모에선 옵션 카드를 안 그린다', () => {
    expect(readCode(PAGE)).toContain('{!isOwnProduct && !isPrelaunch && <PassOptionCard ')
  })

  it('③ 지어낸 약속이 없다', () => {
    const card = readCode(CARD)
    for (const w of ['선물', '종료까지', '포함 내역', '프로모']) expect(card, `${w} 가 들어왔다`).not.toContain(w)
  })
})
