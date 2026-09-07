/**
 * 🎟️ **매장에서 어떻게 쓰는지 상세가 말해 준다** (2026-09-04 대표).
 *
 * 대표: *"이용권 내 딜 안내 내용을 자세히 알려줘야겠어. 사용방법을 더 자세히 말이야.
 * qr코드 제시를 할 수도 있고 pin 입력 요청을 가게에 해야할 수도 있잖아."*
 *
 * 그전엔 상세의 이용 안내가 **`사용 방법: 매장에서 교환권 제시`** 한 줄이었다. 손님이 매장에서
 * 무엇을 꺼내 무엇을 눌러야 하는지 모르고, 그 막힘은 그대로 사장님 응대 부담이 된다.
 *
 * ## 고정하는 것
 * ① 상세가 사용 절차를 **실제로 보여 준다**(컴포넌트가 배선돼 있다)
 * ② 두 경로를 **둘 다** 말한다 — QR 직원 스캔 · 매장 확인코드
 * ③ **"집에서 미리 못 쓴다"** 를 말한다(2026-09-03 셀프 사용 게이트의 사용자향 표현)
 *
 * ⚠️ 못 막는 것: 문구가 *상품별 모드*와 맞는지. 상세 API 가 모드를 안 내려주므로
 *   (`group-buy-public.routes` 는 사용 시점에만 조회) 문구는 **모드와 무관하게 참인 순서**로 쓴다.
 *   모드를 내려주게 되면 그때 분기 + 이 테스트 확장.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments as codeOnly } from '../helpers/source-text'

const HOWTO = 'src/pages/group-buy/RedeemHowTo.tsx'
const DETAIL = codeOnly(readFileSync('src/pages/GroupBuyDetailPage.tsx', 'utf-8'))
const howto = codeOnly(readFileSync(HOWTO, 'utf-8'))

describe('① 상세가 사용 절차를 보여 준다', () => {
  it('컴포넌트가 배선돼 있다 — import 만으론 안 그려진다', () => {
    expect(DETAIL, '렌더가 빠지면 손님은 여전히 한 줄만 본다').toMatch(/<RedeemHowTo\s*\/>/)
  })

  it('옛 한 줄짜리 안내로 되돌아가지 않았다', () => {
    expect(DETAIL).not.toContain("v: '매장에서 교환권 제시'")
  })
})

describe('② 두 경로를 둘 다 말한다', () => {
  it('QR 을 직원이 스캔하는 길', () => {
    expect(howto).toMatch(/QR/)
    expect(howto, '누가 스캔하는지가 빠지면 손님이 자기가 스캔하는 줄 안다').toMatch(/직원/)
  })

  it('확인코드를 매장에 물어 입력하는 길', () => {
    expect(howto).toMatch(/확인코드/)
    // 자릿수를 적어야 손님이 "그런 게 있나요" 를 덜 묻는다. self-redeem-gate 의 4~6자리와 일치.
    expect(howto).toMatch(/4~6자리|4-6자리/)
  })
})

describe('③ 집에서 미리 쓸 수 없다는 것을 말한다', () => {
  it('셀프 소각 방지(2026-09-03)가 사용자 문구로도 드러난다', () => {
    expect(howto, '이 문장이 없으면 손님이 집에서 눌러 보고 실패한다').toMatch(/집에서|매장에서만/)
  })
})

describe('④ 절차가 실제로 여러 단계다 — 형태만 바꾼 게 아닌지', () => {
  it('단계가 3개 이상', () => {
    const steps = howto.match(/\{\s*n:\s*'\d'/g) ?? []
    expect(steps.length, `단계 ${steps.length}개 — 한 줄짜리로 되돌아간 것과 다름없다`).toBeGreaterThanOrEqual(3)
  })
})
