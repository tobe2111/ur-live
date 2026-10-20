/**
 * 🟡 `--phone-audit` 의 "판정 보류" 규칙 — **거짓 🟡 를 내던 것** (2026-10-01).
 *
 * 🩸 왜 생겼나: 규칙이 `visual-preview.mjs` 안의 정규식 한 줄이라 아무도 재 본 적이 없었고,
 *   맨 `없습니다` 가 **안내 문장**에 걸려 `/seller/settlements` 를 상시 🟡 로 만들고 있었다.
 *   그 화면은 가로스크롤 0 · 잘린 글자 0 · 콘솔 진짜 예외 0 · `/api` 20건 응답으로 멀쩡했고,
 *   결재문이 *"정산·출금을 아직 못 쟀다"* 며 열어 둔 판단이 **사실은 재고 있었는데 판정만 틀린 것**이었다.
 *
 * 🧭 이 시험이 지키는 것: **🟡 가 신호 구실을 한다**(상시 켜지면 아무도 안 읽는다) +
 *   **진짜 빈 화면은 계속 🟡 다**(초록을 빈손으로 내주지 않는다 — 2026-09-30 측정 1차의 실패).
 *
 * ⚠️ 이 시험이 **못 하는 것**: 화면이 "쓸 만한가"는 안 본다(그건 숫자가 말한다) ·
 *   본문 일부만 빈 경우를 구분하지 못한다 · 한국어 밖의 빈 상태는 범위 밖이다.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { EMPTY_HINT, looksEmpty, emptyHintMatch } from '../../../scripts/preview-seeds/empty-screen-hint.mjs'

const ROOT = path.join(__dirname, '../../..')

/**
 * 🔬 **실측 본문**(2026-10-01, 430px · `--seller-lists --seller-work`).
 * 손으로 지어낸 문장이 아니라 하네스가 실제로 읽은 `innerText` 조각이다.
 *
 * 🩸 **첫 판에서 이 픽스처를 잘못 떴다** — 정산 화면의 앞부분만 잘라 와서 `empty: false` 를
 *   기대값으로 박았는데, 실제 본문 **아래쪽**에 *"아직 자동정산 내역이 없어요"*(교환권 자동정산
 *   블록)가 있다. 시험은 초록인데 하네스는 🟡 를 냈다. ⇒ **대표 화면의 일부만 떠서 전체라고
 *   단정하지 말 것.** 지금은 그 문구까지 넣고, 규칙이 실제로 뭘 말하는지를 그대로 고정한다.
 */
const MEASURED = [
  {
    route: '/seller/settlements',
    // 🟡 가 맞다 — 화면은 끝까지 그려지지만 **교환권 자동정산 블록이 진짜로 비어 있다**.
    //   (화면 전체가 못 쓰는 상태라는 뜻이 아니다. 그 구분은 하네스가 `↳ 근거:` 로 찍는다.)
    empty: true,
    body: '동네딜 공구·이용권 매출이 매주 자동 집계되어 등록하신 계좌로 순차 지급됩니다. '
      + '별도의 정산 신청은 필요 없습니다. 미지급 11,793,600 지급 예정 926,100 지급 완료 12,719,700 '
      + '딜 잔액 2,270,000 딜 교환권 기준으로 매일 새벽 자동 집계됩니다 아직 자동정산 내역이 없어요',
    firstScreen: 28,
    // 그 화면에서 **옛 규칙이 거짓으로 물던 자리** — 이것만으로는 빈 상태가 아니다.
    falseTrigger: '동네딜 매출이 순차 지급됩니다. 별도의 정산 신청은 필요 없습니다.',
  },
  {
    route: '/seller/influencer-deals',
    empty: true,
    body: '협업 코드 0 아직 코드가 없어요. 위에서 하나 만들어 보세요. 협업 deal (0) 협업 deal 이 없습니다',
    firstScreen: 16,
  },
  {
    route: '/seller/group-buy',
    empty: true,
    body: '이번 달 ₩0 판매 0건 판매 중 0 판매 중지 0 종료 0 등록된 이용권이 없습니다 이용권 상품을 등록하고',
    firstScreen: 15,
  },
]

describe('--phone-audit 판정 보류 규칙', () => {
  it('① 실측 본문 셋을 규칙대로 가른다', () => {
    for (const m of MEASURED) {
      expect(looksEmpty(m.body, m.firstScreen), `${m.route} 판정`).toBe(m.empty)
    }
  })

  it('①-2 정산 화면에서 옛 규칙이 거짓으로 물던 자리는 더 이상 안 문다', () => {
    const settle = MEASURED.find((m) => m.route === '/seller/settlements')!
    // 그 화면이 🟡 인 **진짜 이유는 따로 있다**(빈 교환권 자동정산 블록).
    // 안내 문장만 떼어 놓으면 빈 상태가 아니어야 한다 — 그게 옛 규칙의 결함이었다.
    expect(EMPTY_HINT.test(settle.falseTrigger!), '안내 문장이 다시 빈 상태로 읽힌다').toBe(false)
    // 🔎 그리고 하네스가 **무엇 때문에 🟡 인지** 말해 줘야 사람이 둘을 구분한다.
    expect(emptyHintMatch(settle.body)).toContain('자동정산 내역이 없어요')
    expect(emptyHintMatch(settle.falseTrigger!)).toBe('')
  })

  it('② 안내 문장의 `없습니다` 에 걸리지 않는다 — 조사(이/가)가 없으면 빈 상태가 아니다', () => {
    for (const s of ['별도의 정산 신청은 필요 없습니다', '추가 서류는 필요 없습니다', '사용 제한은 없습니다']) {
      expect(EMPTY_HINT.test(s), `안내 문장이 빈 상태로 잡힘: ${s}`).toBe(false)
    }
  })

  it('③ 빈 상태의 말투는 계속 잡는다 — 초록을 빈손으로 내주지 않는다', () => {
    for (const s of [
      '정산 내역이 없습니다', '등록된 이용권이 없습니다', '협업 deal 이 없습니다',
      '아직 코드가 없어요', '주문이 없어요', '목록이 비어 있습니다',
      '문제가 발생했습니다', '오류가 발생했습니다', '불러오지 못했습니다',
    ]) {
      expect(EMPTY_HINT.test(s), `빈 상태를 놓침: ${s}`).toBe(true)
    }
  })

  it('④ 말투가 아예 없는 백지도 잡는다 — firstScreen 안전판', () => {
    expect(looksEmpty('', 0)).toBe(true)
    expect(looksEmpty('로딩', 3)).toBe(true)
    // 내용이 있으면 말투가 없는 한 통과한다(🟡 가 상시 켜지지 않는다)
    expect(looksEmpty('주문 3건 ₩12,537,900 배송중 2 · 완료 1', 22)).toBe(false)
  })

  it('⑤ 맨 `없습니다` 를 다시 넣지 못한다 — 그게 거짓 🟡 의 원인이었다', () => {
    const src = fs.readFileSync(path.join(ROOT, 'scripts/preview-seeds/empty-screen-hint.mjs'), 'utf8')
    const line = src.split('\n').find((l) => l.includes('export const EMPTY_HINT')) ?? ''
    expect(line, 'EMPTY_HINT 선언을 못 찾았다').toContain('EMPTY_HINT')
    // `|없습니다` 또는 `/없습니다` 처럼 **앞에 조사 클래스가 없는** 맨낱말이면 회귀다.
    expect(/[/|]없습니다/.test(line), '맨 `없습니다` 가 되살아났다 — 안내 문장이 다시 🟡 가 된다').toBe(false)
    expect(line).toContain('[이가]')
  })

  it('⑥ 하네스가 이 모듈을 실제로 쓴다 — 인라인 정규식으로 되돌아가지 않았다', () => {
    const src = fs.readFileSync(path.join(ROOT, 'scripts/visual-preview.mjs'), 'utf8')
    expect(src, '모듈 import 가 사라졌다').toContain("from './preview-seeds/empty-screen-hint.mjs'")
    expect(src, 'suspect 판정이 모듈을 안 쓴다').toContain('const suspect = looksEmpty(bodyText, audit.firstScreen)')
    expect(src.includes('const EMPTY_HINT = /'), '인라인 정규식이 되살아났다').toBe(false)
    // 🔎 판정만 찍고 이유를 안 찍으면 사람이 "화면 전체가 빈 것" 과 "블록 하나가 빈 것" 을 구분 못 한다.
    expect(src, '🟡 의 근거를 안 찍는다').toContain('↳ 근거:')
  })
})
