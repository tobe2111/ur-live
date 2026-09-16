/**
 * 🪙 **딜을 얼마나 쓸지 고른다** — 계산과 배선 (2026-09-13)
 *
 * 대표 신고: *"딜을 쓰고 결제할지, 딜 일부만 쓰고 결제할지 등 선택도 안돼."*
 *
 * 부분결제 게이트는 라이브에서 **이미 켜져 있었고**, 서버는 말없이 가진 딜을 최대한 썼다.
 * 사용자는 고를 수 없었고 그 사실을 **결제창에 가서야** 알았다(16,500원짜리에 5,300원이 떠 있다).
 *
 * ## 이 시험이 지키는 것
 * ① 고른 값이 실제로 반영되는가 (0 = 안 씀 · 일부 · 최대)
 * ② **안 고르면 종전과 완전히 같은가** — 기존 클라이언트/흐름이 안 깨져야 한다
 * ③ 고른 값을 그대로 믿지 않는가 (잔액·카드최소액으로 클램프)
 * ④ 화면이 서버 값을 쓰는가 (게이트가 꺼지면 아무것도 안 그린다)
 *
 * ⚠️ 못 막는 것: 실제 카드 청구액(외부 PG — staging 실결제 몫) · 브라우저에서 버튼이
 *   실제로 눌리는지(렌더 시험 아님 — 아래는 계산과 배선만 본다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { planPartialDeal, MIN_CARD_AMOUNT } from '@/features/group-buy/api/partial-deal'
import { stripComments } from '../helpers/source-text'

// 대표의 실제 조건: 치즈돈가스 16,500원 · 딜 11,200
const TOTAL = 16500
const BALANCE = 11200

describe('🪙 고른 값이 반영된다 — 대표의 실제 잔액으로', () => {
  it('안 쓰기(0) — 카드로 전액', () => {
    const p = planPartialDeal({ enabled: true, totalAmount: TOTAL, balance: BALANCE, requested: 0 })
    expect(p.dealUsed).toBe(0)
    expect(p.cardAmount).toBe(TOTAL)
  })

  it('일부(5,000) — 딱 그만큼만 쓴다', () => {
    const p = planPartialDeal({ enabled: true, totalAmount: TOTAL, balance: BALANCE, requested: 5000 })
    expect(p.dealUsed).toBe(5000)
    expect(p.cardAmount).toBe(11500)
  })

  it('최대 — 가진 딜 전부, 카드는 나머지', () => {
    const p = planPartialDeal({ enabled: true, totalAmount: TOTAL, balance: BALANCE, requested: BALANCE })
    expect(p.dealUsed).toBe(11200)
    expect(p.cardAmount).toBe(5300)
  })

  it('🔴 안 고르면(undefined) 종전과 완전히 같다 — 기존 흐름이 안 깨진다', () => {
    const chosen = planPartialDeal({ enabled: true, totalAmount: TOTAL, balance: BALANCE })
    const legacy = planPartialDeal({ enabled: true, totalAmount: TOTAL, balance: BALANCE, requested: null })
    expect(chosen).toEqual(legacy)
    expect(chosen.dealUsed).toBe(BALANCE)
  })
})

describe('🔒 고른 값을 그대로 믿지 않는다', () => {
  it('잔액보다 많이 달라고 해도 잔액까지만', () => {
    expect(planPartialDeal({ enabled: true, totalAmount: TOTAL, balance: BALANCE, requested: 999999 }).dealUsed).toBe(BALANCE)
  })

  it('총액보다 많이 달라고 해도 카드 최소액은 남는다 — 0원 결제는 PG 가 거절한다', () => {
    const p = planPartialDeal({ enabled: true, totalAmount: 5000, balance: 999999, requested: 999999 })
    expect(p.cardAmount).toBe(MIN_CARD_AMOUNT)
    expect(p.dealUsed).toBe(5000 - MIN_CARD_AMOUNT)
  })

  it('음수·쓰레기 값은 0 으로 — 카드 전액', () => {
    for (const bad of [-1, -99999, NaN]) {
      expect(planPartialDeal({ enabled: true, totalAmount: TOTAL, balance: BALANCE, requested: bad }).dealUsed).toBe(0)
    }
  })

  it('🔴 게이트가 꺼져 있으면 무엇을 골라도 딜은 0 이다', () => {
    for (const req of [0, 5000, BALANCE, null, undefined]) {
      const p = planPartialDeal({ enabled: false, totalAmount: TOTAL, balance: BALANCE, requested: req })
      expect(p.dealUsed).toBe(0)
      expect(p.cardAmount).toBe(TOTAL)
    }
  })
})

describe('🔌 배선 — 고른 값이 서버까지 가는가', () => {
  const page = stripComments(readFileSync('src/pages/GroupBuyDetailPage.tsx', 'utf8'))
  const route = stripComments(readFileSync('src/features/group-buy/api/group-buy.routes.ts', 'utf8'))
  const chooser = stripComments(readFileSync('src/pages/group-buy/DealUseChooser.tsx', 'utf8'))
  // 🧺 2026-09-15: 모바일 하단 결제 바가 `DealBottomBar` 로 분리됐다(상세가 동결선에 붙어 자리가 없었다).
  //    성질은 그대로라 **지우지 않고 재조준**한다 — 고르는 자리가 구매 버튼 위여야 한다.
  const bottomBar = stripComments(readFileSync('src/pages/group-buy/DealBottomBar.tsx', 'utf8'))
  const plan = stripComments(readFileSync('src/features/group-buy/api/deal-plan.routes.ts', 'utf8'))

  it('상세 화면이 고른 값을 /join 에 실어 보낸다', () => {
    expect(page).toMatch(/deal_use: dealUse/)
  })

  it('🔴 안 골랐으면 필드를 아예 안 보낸다 — 보내면 종전 동작(최대한)이 깨진다', () => {
    expect(page).toMatch(/dealUse == null \? \{\} : \{ deal_use: dealUse \}/)
  })

  it('서버가 그 값을 계획 계산에 넘긴다', () => {
    expect(route).toMatch(/resolvePartialDealPlan\(DB, \{ userId, totalAmount, requested: deal_use \}\)/)
  })

  it('🔴 화면이 잔액으로 추정하지 않는다 — 서버가 준 계획만 쓴다', () => {
    // 잔액·상한·총액을 화면이 직접 계산하면 게이트가 꺼진 순간 안내가 거짓말이 된다.
    expect(chooser).toMatch(/api\.get\(`\/api\/group-buy\/deal-plan\//)
    expect(chooser).toMatch(/plan\.max_deal_usable/)
    expect(chooser).not.toMatch(/useBalance\(/)   // 잔액 훅으로 혼자 판단하지 않는다
  })

  it('🔴 게이트가 꺼져 있으면 선택 블록을 통째로 안 그린다', () => {
    expect(chooser).toMatch(/if \(!plan \|\| !plan\.enabled \|\| plan\.max_deal_usable <= 0\) return null/)
  })

  it('조회 엔드포인트는 읽기 전용이다 — 딜을 여기서 차감하지 않는다', () => {
    expect(plan).not.toMatch(/spendPartialDeal|adjustUserPoints|INSERT INTO|UPDATE /)
    expect(plan).toMatch(/requireAuth\(\)/)
  })

  it('🔴 모바일 — 고르는 자리가 구매 버튼 **위**에 있다', () => {
    // 아래에 두면 "누르고 나서 고르라"는 순서가 된다. 그리고 이 바는 fixed bottom-0 이라
    // 아래로 자란 만큼이 모든 방문자의 화면을 영구히 먹는다.
    // ⚠️ 페이지 전체에서 indexOf 하면 **PC 박스**가 먼저 잡혀 헛돈다(첫 판이 실제로 그랬다).
    //    모바일 고정 바 구간만 잘라서 그 안의 순서를 본다(이제 그 바는 `DealBottomBar` 다).
    const barAt = bottomBar.indexOf('fixed bottom-0 inset-x-0')
    expect(barAt).toBeGreaterThan(-1)
    const bar = bottomBar.slice(barAt)
    const chooserAt = bar.indexOf('<DealUseChooser plan=')
    const ctaAt = bar.indexOf('disabled={(!isJoinable && !isPrelaunch) || joining}')
    expect(chooserAt).toBeGreaterThan(-1)
    expect(ctaAt).toBeGreaterThan(-1)
    expect(chooserAt).toBeLessThan(ctaAt)
  })

  it('🔴 PC(lg+)도 고를 수 있다 — 우측 구매 박스가 같은 슬롯을 받는다', () => {
    // PC 는 하단 바 대신 `DealPurchaseBox` 를 쓴다. 여기를 빼면 PC 사용자는 종전대로
    // **말없이 딜이 빠지는** 상태로 남는다(에러도 안 난다 — 그래서 놓치기 쉽다).
    expect(page).toMatch(/dealSlot=\{<DealUseChooser /)
    const box = stripComments(readFileSync('src/pages/group-buy/DealPurchaseBox.tsx', 'utf8'))
    const slotAt = box.indexOf('{dealSlot}')
    const ctaAt = box.indexOf('onClick={isPrelaunch ? onPrelaunchApply : onBuy}')
    expect(slotAt).toBeGreaterThan(-1)
    expect(ctaAt).toBeGreaterThan(-1)
    expect(slotAt).toBeLessThan(ctaAt)
  })

  it('🔴 접혀 있어도 결과를 말한다 — 펼쳐야만 알 수 있으면 "말 안 하고 쓰는" 문제가 남는다', () => {
    // 요약 줄은 `open` 게이트 **밖**이어야 한다.
    const openBlockAt = chooser.indexOf('{open && (')
    const summaryAt = chooser.indexOf('카드 <b')
    expect(summaryAt).toBeGreaterThan(-1)
    expect(openBlockAt).toBeGreaterThan(-1)
    expect(summaryAt).toBeLessThan(openBlockAt)
  })

  it('총액을 /join 과 같은 식으로 센다 — 달리 세면 화면과 청구액이 갈린다', () => {
    const formula = /Math\.round\(product\.price \* \(1 - maxTierDiscount\(product\.group_buy_tiers\) \/ 100\)\) \* qty/
    expect(plan).toMatch(formula)
    expect(route).toMatch(/Math\.round\(product\.price \* \(1 - tierDiscountPct \/ 100\)\) \* qty/)
  })
})
