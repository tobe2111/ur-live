/**
 * ⏳ **기다리는 동안 빈 칸이 아니라 껍데기** (2026-10-01 — 대표 *"저런 로딩이 발생되는 근본적인
 *   원인을 모두 없애줘. 다른 페이지들도 분명히 있을거고. 의미없는 심각한 문제들이잖아."*)
 *
 * ## 무엇이 남아 있었나
 * 09-30 의 처방은 *지난 렌더에서 잰 높이만큼 **빈 칸***을 두는 것이었고, 그건 **재방문만** 고쳤다.
 * 10-01 에 소비자 19개 화면을 전수로 재 보니(`scripts/check-layout-shift.mjs`) **보이는 곳이
 * 밀리는 건 마이 하나**였고, 그 하나가 여전히 컸다:
 *
 * ```
 * 첫 방문  🔴 보이는 곳이 밀림 — 이동 29(보이는 곳 15) · 문서 1392→1801px
 *          👁️ 내가 산 것 214→617 (+403)   … 그 아래 손님 줄 전부
 * ```
 *
 * 즉 **대표가 찍은 그 그림이 첫 방문에는 그대로 남아 있었다.**
 *
 * ## 처방 — 마크업을 복제하지 않는다
 * 09-30 머리말은 스켈레톤을 안 그리는 이유를 *"마크업을 복제하면 두 벌이 갈린다"* 고 적어 뒀다.
 * 그 걱정은 **복제할 때만** 성립한다 — 껍데기를 따로 만들 게 아니라 **같은 컴포넌트를 숫자만 비워**
 * 그리면 된다(2026-09-16 `DealBalanceCard` 가 잔액에 이미 쓴 처방인데 여기엔 안 쓰고 있었다).
 *
 * 수리 후 실측: `첫 방문 🟢 · 재방문 🟢 — 이동 0(보이는 곳 0)`.
 *
 * ## ⚠️ 이 시험이 **못** 보는 것
 * jsdom 엔 레이아웃이 없다 — `offsetHeight` 가 늘 0 이라 *높이가 진짜로 같은지*는 여기서 못 잰다.
 * 그 판정은 브라우저가 한다(`node scripts/check-layout-shift.mjs`). 여기서는 **규약**만 고정한다:
 * 껍데기가 같은 줄들을 그리는가 · 숫자를 지어내지 않는가 · 눌리지 않는가 · 좌석으로 갈리는가.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { readCode } from '../helpers/source-text'
import SellerSectionLazy from '@/pages/user-profile/SellerSectionLazy'
import type { MyStoresState } from '@/pages/user-profile/useMyStores'

const SECTION = readCode('src/pages/user-profile/SellerSection.tsx')
const LAZY = readCode('src/pages/user-profile/SellerSectionLazy.tsx')
const ORDERS = readCode('src/pages/MyOrdersPage.tsx')

const loadingState: MyStoresState = {
  stores: [], totals: { today_revenue: 0, today_orders: 0, pending: 0 },
  currentSellerId: null, loading: true, failed: false, generation: 0, refetch: () => {},
}

beforeEach(() => { localStorage.clear() })

describe('① 기다리는 동안 같은 줄들이 자리를 잡는다', () => {
  it('🔴 셀러에게는 로딩 중에도 판매 줄이 그려진다 (빈 칸이 아니다)', async () => {
    localStorage.setItem('seller_token', 'preview')
    const { findByText } = render(<SellerSectionLazy state={loadingState} />)
    // 이 넷이 구역 높이의 대부분이다 — 하나라도 빠지면 도착 순간 그만큼 손님 줄이 밀린다.
    expect(await findByText('이용권 사용처리')).toBeTruthy()
    expect(await findByText('주문')).toBeTruthy()
    expect(await findByText('정산')).toBeTruthy()
    expect(await findByText('전체 도구')).toBeTruthy()
  })

  it('🔴 비셀러에게는 여전히 한 픽셀도 안 그린다 (청크 다이어트가 이 게이트에 걸려 있다)', () => {
    const { container } = render(<SellerSectionLazy state={loadingState} />)
    expect(container.innerHTML).toBe('')
  })

  it('로딩이 끝나고 좌석이 0곳이면 사라진다 (빈 껍데기가 영원히 남지 않는다)', () => {
    localStorage.setItem('seller_token', 'preview')
    const { container } = render(<SellerSectionLazy state={{ ...loadingState, loading: false }} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('② 모르는 값을 지어내지 않는다', () => {
  /**
   * 💸 머니 표면 룰: 모르는 것과 0 은 다르다. 잠깐이라도 `0원` 을 보여 주면 매출이 있는
   *   사장님에게 "오늘 0원" 이라고 말하는 셈이다. 자리는 남기되 **안 보이게** 한다.
   */
  it('🔴 숫자 자리는 `invisible` 이다 (0원을 띄우지 않는다)', async () => {
    localStorage.setItem('seller_token', 'preview')
    const { findByText } = render(<SellerSectionLazy state={loadingState} />)
    const won = await findByText('0')
    expect(won.className, '값이 그대로 보인다 — 오늘 매출 0원이라는 거짓말이 된다')
      .toContain('invisible')
  })

  it('비우는 방법이 한 곳에서 온다 (`blank` 헬퍼)', () => {
    expect(SECTION).toMatch(/const blank = \(v: string\) => \(awaiting \? <span className="invisible">\{v\}<\/span> : v\)/)
  })
})

describe('③ 기다리는 껍데기는 눌리지 않는다', () => {
  /**
   * 핸들러는 전부 `!store` 로 일찍 돌아간다 — 그래서 누르면 **말없이 아무 일도 안 일어난다**.
   * 말없이 삼키는 탭을 만들지 않으려고 아예 안 눌리게 한다. 흐리게(`opacity`)는 하지 않는다 —
   * 도착 순간 화면이 또 한 번 바뀐다.
   */
  it('🔴 awaiting 이면 `pointer-events-none` + `aria-busy`', async () => {
    localStorage.setItem('seller_token', 'preview')
    const { findByText } = render(<SellerSectionLazy state={loadingState} />)
    const row = await findByText('전체 도구')
    const root = row.closest('[aria-busy]') as HTMLElement | null
    expect(root, 'aria-busy 가 없다 — 보조기술이 "다 그려졌다" 고 읽는다').toBeTruthy()
    expect(root!.className).toContain('pointer-events-none')
  })
})

describe('④ 껍데기 높이를 예약값으로 적지 않는다', () => {
  /**
   * 껍데기엔 상태 안내문(`note`)이 없어 진짜보다 짧다. 그걸 적어 두면 다음 방문의 예약이
   * 모자라 **그만큼 또 밀린다** — 고치려던 것을 되살리는 셈이다.
   */
  it('🔴 측정 effect 가 `store` 가 있을 때만 적는다', () => {
    const i = SECTION.indexOf('writeReservedHeight(el.offsetHeight)')
    expect(i).toBeGreaterThan(-1)
    const head = SECTION.slice(Math.max(0, i - 400), i)
    expect(head, '껍데기 높이가 예약값으로 굳는다').toContain('if (!el || !store) return')
  })
})

describe('⑤ 맨 아래 줄은 좌석으로 갈린다', () => {
  /**
   * 🩸 실측이 잡은 것: 껍데기가 늘 '주문 확인' 버튼(60px)을 그렸더니, 좌석에 앉은 사람은 도착
   *   순간 그 60px 이 사라지며 손님 줄이 위로 당겨졌다 — **빈 칸 예약으로 이미 0 이던 재방문까지
   *   나빠졌다**(−60px). 좌석은 토큰에서 **동기로** 읽히므로 첫 프레임에 가를 수 있다.
   */
  it('🔴 awaiting 이면 좌석 토큰으로 가른다', () => {
    expect(SECTION).toContain('{(awaiting ? seatId != null : seated) ? (')
  })

  it('좌석이 있으면 껍데기는 그 자리를 비운다 (`PendingOrders` 는 아직 그릴 것이 없다)', () => {
    const i = SECTION.indexOf('{(awaiting ? seatId != null : seated) ? (')
    const body = SECTION.slice(i, i + 200)
    expect(body).toContain('awaiting ? null : (')
  })
})

describe('⑥ 래퍼가 로딩 중에도 구역을 렌더한다', () => {
  it('🔴 `state.loading` 분기가 `<SellerSection` 를 그린다', () => {
    const i = LAZY.indexOf('if (state.loading)')
    expect(i).toBeGreaterThan(-1)
    const body = LAZY.slice(i, LAZY.indexOf('if (state.failed'))
    expect(body, '로딩 분기가 빈 칸만 돌려준다 — 첫 방문이 다시 404px 밀린다')
      .toContain('<SellerSection state={state} />')
    expect(body, '비셀러 게이트가 사라지면 청크 다이어트가 깨진다').toContain("localStorage.getItem('seller_token')")
  })
})

describe('⑦ 목록 화면은 개수를 맞히는 대신 푸터를 화면 밖으로 보낸다', () => {
  /**
   * 🩸 **추측이 두 번 틀렸고 측정이 둘 다 잡았다.**
   *   스켈레톤 높이와 결과 높이는 원리상 같을 수 없다(몇 건이 올지 모른다). 그 차이만큼
   *   바로 아래 푸터가 화면을 가로질러 움직인다 — 실측으로 **두 방향 다** 봤다:
   *
   *   | 스켈레톤 | 0건인 사람의 밀림 | 가드 |
   *   |---|---|---|
   *   | 카드 셋(종전) | **−212px**(위로 당겨짐) | 🔴 보이는 곳 1 |
   *   | 카드 하나(첫 시도) | **+154px**(아래로 밀림) | 🔴 보이는 곳 12 — **더 나빠졌다** |
   *   | 카드 하나 + 본문 `min-h-[60dvh]` | **0** | 🟢 |
   *
   *   ⇒ 개수를 맞히려 들면 둘 다 틀린다. **맞히지 말고 푸터를 첫 화면 밖으로 보낸다.**
   *   두 처방은 **짝**이다 — 카드가 많아 본문이 `min-h` 를 넘기면 다시 밀린다.
   */
  it('🔴 본문이 최소 한 화면을 채운다 (푸터가 첫 화면 밖)', () => {
    const i = ORDERS.indexOf('<main className="ur-content-medium')
    expect(i).toBeGreaterThan(-1)
    expect(ORDERS.slice(i, i + 200), '푸터가 결과 높이에 따라 화면을 가로질러 움직인다')
      .toContain('min-h-[60dvh]')
  })

  it('🔴 스켈레톤이 그 한 화면을 넘지 않는다 (카드 하나)', () => {
    const i = ORDERS.indexOf('function OrdersSkeleton')
    expect(i).toBeGreaterThan(-1)
    const body = ORDERS.slice(i, i + 2200)
    expect(body, '개수를 늘리면 min-h 를 넘겨 다시 밀린다').toContain('{[0].map(i => (')
    expect(body).not.toContain('{[0, 1, 2].map(i => (')
  })
})

describe('⑧ 가드가 실제로 존재한다', () => {
  /**
   * 🔴 이 시험들이 전부 통과해도 **다음 화면**에서 같은 일이 또 생긴다. 그걸 막는 것은 단위시험이
   *   아니라 브라우저 측정이다 — 그 측정기가 레포에 있고 워크플로가 부르는지 여기서 고정한다.
   */
  it('측정기와 워크플로가 둘 다 있다', () => {
    const GUARD = readCode('scripts/check-layout-shift.mjs')
    const WF = readCode('.github/workflows/layout-shift.yml')
    expect(GUARD).toContain('SHIFT_RESULT ')
    expect(GUARD, '줄을 못 읽어도 통과하면 영원히 헛돈다').toContain('rows.length === 0')
    expect(WF).toContain('node scripts/check-layout-shift.mjs')
  })

  /**
   * 🩸 주입이 이 둘을 **헛돈다고 잡았다**(2026-10-01). 처음엔
   *   `toContain('SHIFT_RESULT ${JSON.stringify…')` / `toContain('movedVisible')` 로 썼는데,
   *   ⓐ 출력 줄을 `void 0 && console.log(...)` 로 꺼 버려도 그 **문자열은 그대로 남아** 통과했고
   *   ⓑ 보이는 곳 판정을 `const vis = true` 로 무력화해도 `movedVisible` 이라는 **이름이 남아** 통과했다.
   *   ⇒ 이름이 아니라 **실제로 일하는 모양**을 앵커로 삼는다.
   */
  it('하네스가 기계 줄을 찍는다 (형식이 바뀌면 가드가 0건을 읽는다)', () => {
    const HARNESS = readCode('scripts/visual-preview.mjs')
    expect(HARNESS, '출력이 꺼져 있으면 가드가 읽을 줄이 없다')
      .toContain('\n    console.log(`SHIFT_RESULT ${JSON.stringify({ route: ROUTE')
    expect(HARNESS, '보이는 곳/화면 밖을 안 가르면 푸터 흔들림이 결함으로 올라온다')
      .toContain('const vis = y < fold')
  })
})
