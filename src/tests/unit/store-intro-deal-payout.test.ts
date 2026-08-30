import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments as codeOnly } from '../helpers/source-text'

/**
 * 💎 2026-08-30 — **매장 영입 보상을 딜로** (대표 *"매장 영입도 딜로 쌓아줘"*).
 *
 * ## 설계 (왜 성숙 시점인가)
 * 적립 즉시 딜을 주면 T+7 환불 유예가 사라진다 — 환불 시 이미 쓴 딜을 회수해야 하고 그건 잔액을
 * 음수로 만든다. 그래서 `influencer_attributions` 의 hold 를 그대로 쓰고, **성숙 순간에** 현금 대신
 * 딜을 준다. 유예·멱등·환불 역전이 전부 보존된다.
 *
 * ## 이 가드가 지키는 것
 *   ① 게이트 뒤에 있다 (기본 OFF = 종전 현금 경로와 동일)
 *   ② **claim-before-credit** — 선점에 성공한 행만 딜을 준다(머니 룰 #1, 이중지급 차단)
 *   ③ 적립 실패 시 선점을 되돌린다 (안 그러면 그 행이 영영 미지급으로 남는다)
 *   ④ `store_intro` 만 가져간다 (담아서 팔기·매칭 등 다른 축을 삼키면 안 된다)
 *
 * ## 못 막는 것
 *   - 딜이 실제로 잔액에 꽂히는지 → 게이트 ON 후 staging 실결제.
 *   - **세무 판정**: 현금은 원천징수(3.3%/8.8%)하는데 딜은 안 한다. 대표/세무 판단 사항이다.
 */
const CRON = 'src/worker/cron/influencer-payout.ts'
const src = () => readFileSync(CRON, 'utf-8')

describe('매장 영입 보상 — 딜 지급 배선', () => {
  it('게이트 뒤에 있다 (기본 OFF = 라이브 무변화)', () => {
    const code = codeOnly(src())
    expect(code).toContain("'store_intro_payout_in_deal'")
    expect(code, '게이트가 true 일 때만 도는 분기여야 한다').toMatch(/dealGate\?\.value === 'true'/)
  })

  it('설정 키가 검증 레지스트리에 등록돼 있다', () => {
    // 미등록이면 오타값('True' 등)이 저장돼 ==='true' 가 조용히 거짓이 된다.
    const v = readFileSync('src/worker/utils/platform-settings-validation.ts', 'utf-8')
    expect(codeOnly(v)).toContain('store_intro_payout_in_deal')
  })

  it('🔑 선점에 성공한 행만 딜을 준다 (claim-before-credit)', () => {
    const code = codeOnly(src())
    const i = code.indexOf("status = 'paid', paid_at = datetime('now')")
    const j = code.indexOf('adjustUserPoints(')
    expect(i, '선점 UPDATE 가 없다').toBeGreaterThan(-1)
    expect(j, '적립 호출이 없다').toBeGreaterThan(-1)
    expect(i, '적립이 선점보다 먼저면 이중지급이 난다').toBeLessThan(j)
    expect(code, '선점 결과(changes)를 안 보면 선점의 의미가 없다')
      .toMatch(/claim\?\.meta\?\.changes \?\? 0\) !== 1/)
  })

  it('적립이 실패하면 선점을 되돌린다 (영구 미지급 방지)', () => {
    const code = codeOnly(src())
    const tail = code.slice(code.indexOf('adjustUserPoints('))
    expect(tail, 'res.ok 를 안 보면 실패를 모른다').toContain('!res.ok')
    expect(tail, '되돌리는 UPDATE 가 없다').toMatch(/status = 'pending', paid_at = NULL/)
  })

  it('store_intro 축만 가져간다 (다른 적립을 삼키면 안 된다)', () => {
    const code = codeOnly(src())
    const sel = code.slice(code.indexOf('FROM influencer_attributions'))
    expect(sel.slice(0, 400), "source='store_intro' 필터가 없다").toContain("source = 'store_intro'")
  })

  it('T+7 유예를 지킨다 (성숙한 행만)', () => {
    const code = codeOnly(src())
    const sel = code.slice(code.indexOf("source = 'store_intro'"))
    expect(sel.slice(0, 300)).toContain('available_at <= ')
  })
})
