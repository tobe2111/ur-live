/**
 * 🔢 마이 — 숫자 잘림 · 제목 무게 · 주차된 레벨 카드 (2026-09-30 대표 지적 셋)
 *
 * 대표: *"홈 / 마이 페이지에서 내 딜이 10,30 이렇게 잘려보여 숫자가 다 안나와보인다는거지
 * 모바일 기준으로. 내 가게, 내가 산 것 이런 주제들의 폰트 하며 너무 투박해."* +
 * *"동네 리뷰어 lv.1 은 빼줘."*
 *
 * ## 이 시험이 **못 하는 것** (먼저 적는다)
 * jsdom 에는 레이아웃이 없어 **"잘리는가"를 여기서 잴 수 없다.** 실제 판정은 브라우저로 했다
 * (dist 를 띄워 `scrollWidth` vs `clientWidth`):
 *
 * | 폭 | 칸 안쪽 | 고치기 전 `10,300딜` | 고친 뒤 `10,300` |
 * |---|---|---|---|
 * | 430 | 111 → 116px | 105px 통과 | 통과 |
 * | **390**(아이폰 13) | 97 → 103px | 105px 🔴 **잘림** | 통과 |
 * | 360 | 87 → 93px | 105px 🔴 잘림 | 통과 |
 *
 * 천장도 쟀다 — 360px 에서 **6자(`99,999`)까지** 통과하고 7자(`999,999`, 104px)는 잘린다.
 * 라이브 실측(`user_points`, 2026-09-30)상 **최대 잔액 10,300 · 6자리 이상 0명**이라 실제를
 * 넉넉히 덮는다. 잔액이 자릿수를 넘기기 시작하면 이 표를 다시 재고 처방을 다시 고를 것
 * (칸을 더 조이는 게 아니라 — 이미 한계다 — 폰에서 칸 수를 줄이는 쪽이 맞다).
 *
 * ⇒ 여기서는 **그 실측이 성립하게 만든 조건이 되돌아가지 않는 것**만 지킨다.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { stripComments } from '../helpers/source-text'

const read = (p: string) => stripComments(fs.readFileSync(p, 'utf-8'))

const STATS = read('src/pages/user-profile/MyStats.tsx')
const GRAMMAR = read('src/pages/user-profile/list-grammar.tsx')
const PAGE = read('src/pages/UserProfilePage.tsx')
const PC = read('src/pages/user-profile/AccountPcPane.tsx')

describe('🔢 마이 숫자 한 줄 — 값이 칸 안에 들어간다', () => {
  it('🔴 값에 단위를 다시 붙이지 않는다', () => {
    // 단위 스팬(`{unit}`)이 그 17px 였다. 라벨이 이미 무엇인지 말하므로 값은 숫자만.
    expect(STATS, '값에 단위가 돌아왔다 — 390px 에서 다시 잘린다').not.toMatch(/\{unit\}/)
    expect(STATS, 'unit prop 이 돌아왔다').not.toMatch(/\bunit\s*[:=]/)
    // 호출부도 — prop 만 남고 안 그리면 다음 세션이 되살리기 쉽다.
    expect(STATS).not.toMatch(/unit="/)
  })

  it('🔴 칸 안쪽 여백이 조여 있다 (px-4 로 되돌아가면 잘린다)', () => {
    expect(STATS, '칸 여백이 px-3 이 아니다').toMatch(/flex-1 min-w-0 px-3 first:pl-4 last:pr-4/)
  })

  it('🔴 값이 여전히 24px 주인공이다 (잘림을 크기로 해결하지 않았다)', () => {
    // 규칙 ③ — 잘린다고 숫자를 줄이면 이 줄의 존재 이유가 사라진다.
    expect(STATS).toMatch(/text-\[24px\] font-extrabold tabular-nums/)
  })
})

describe('🔠 구역 제목 — 무게와 자간', () => {
  it('🔴 제목이 extrabold 로 되돌아가지 않는다', () => {
    const m = GRAMMAR.match(/<Tag className="[^"]*text-\[24px\][^"]*"/)
    expect(m, 'SectionTitle 의 제목 클래스를 못 찾았다 — 이 검사가 헛돌고 있다').not.toBeNull()
    const cls = (m as RegExpMatchArray)[0]
    expect(cls, '제목이 다시 extrabold 다(대표 "투박")').not.toContain('font-extrabold')
    expect(cls, '제목이 bold 가 아니다').toContain('font-bold')
    expect(cls, '자간을 다시 -3% 로 조였다').not.toContain('tracking-[-0.03em]')
  })

  it('🔴 제목 크기는 24px 그대로 (무게만 바꿨다)', () => {
    // ⚠️ 끝에 `\b` 를 붙이면 안 된다 — `]` 다음이 공백이라 둘 다 비-단어 경계가 아니다(처음에 그렇게 썼다).
    expect(GRAMMAR).toMatch(/<Tag className="[^"]*text-\[24px\][ "]/)
  })
})

describe('🅿️ 동네 리뷰어 레벨 카드 — 마이에서 뺐다', () => {
  it('🔴 마이 두 화면 어디에서도 렌더하지 않는다', () => {
    for (const [name, src] of [['UserProfilePage', PAGE], ['AccountPcPane', PC]] as const) {
      expect(src, `${name} 이 다시 레벨 카드를 그린다`).not.toMatch(/<ReviewLevelCard\b/)
      expect(src, `${name} 에 레벨 카드 import 가 남았다`).not.toMatch(/^import ReviewLevelCard\b/m)
    }
  })

  it('🔴 후기를 쓰는 진짜 문은 그대로다', () => {
    // 카드를 뺀 근거가 "다른 문이 있다" 였다. 그 문이 사라지면 근거가 무너진다.
    const btn = read('src/pages/my-vouchers/ReviewBonusButton.tsx')
    expect(btn).toMatch(/\/api\/review-bonus\/submit/)
    // 그 문은 **사용한** 이용권 티켓에 붙는다(후기는 쓰고 나서 쓴다) — 목록 페이지가 아니다.
    expect(read('src/pages/my-vouchers/VoucherTicket.tsx')).toMatch(/status === 'used' && <ReviewBonusButton\b/)
  })
})

describe('🧪 이 시험이 헛돌지 않는다', () => {
  it('대상 파일이 실제로 읽혔다', () => {
    expect(STATS.length).toBeGreaterThan(2000)
    expect(GRAMMAR.length).toBeGreaterThan(2000)
    expect(PAGE.length).toBeGreaterThan(5000)
    expect(PC.length).toBeGreaterThan(2000)
  })
})
