/**
 * 📐 **마이 로딩 밀림 — 손님 줄이 +336px 밀려나던 것** (2026-09-30 대표 신고)
 *
 * 대표: *"지금 2번째 이미지가 로딩에 나오다가 첫번째 이미지로 바뀌더라?"*
 *
 * ## 실측 (하네스 `--slow=1500 --shift`)
 * 판매 구역(`SellerSection`)은 좌석 조회가 끝나야 그려진다. 그 전까지 `SellerSectionLazy` 가
 * **`null`** 을 돌려줘서 자리가 0 이었고, 게다가 매장 계산대 폴백이 `stores.length === 0` 으로
 * 잠깐 떴다가 사라졌다. 결과:
 *
 * ```
 * 첫 방문(수리 전)  내가 산 것 286→622 (+336) … 그 아래 12줄 전부  ·  사라짐 ["매장 계산대", …]
 * 재방문(수리 후)   이동 0 · 사라짐 0 · 문서높이 1902→1901px
 * ```
 *
 * ## 이 시험이 고정하는 것
 * ① 로딩 중 셀러에게는 **자리를 예약**한다(비셀러에게는 아무것도 안 그린다 — 청크 다이어트 유지)
 * ② 예약 높이는 **지난 렌더에서 잰 값**이다(손으로 적은 숫자가 아니다)
 * ③ 계산대 폴백은 좌석이 **확정된 뒤에만** 뜬다
 *
 * ## ⚠️ 못 보는 것
 * jsdom 엔 레이아웃이 없다 — `offsetHeight` 는 늘 0 이라 *실제로 안 밀리는지*는 여기서 못 잰다.
 * 그 판정은 브라우저 프레임 측정(`node scripts/visual-preview.mjs --slow=1500 --shift`)이 한다.
 * 여기서는 **배선과 규약**만 고정한다.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { readCode } from '../helpers/source-text'
import SellerSectionLazy from '@/pages/user-profile/SellerSectionLazy'
import { readReservedHeight, writeReservedHeight } from '@/pages/user-profile/seller-reserve'
import type { MyStoresState } from '@/pages/user-profile/useMyStores'

const LAZY = readCode('src/pages/user-profile/SellerSectionLazy.tsx')
const PAGE = readCode('src/pages/UserProfilePage.tsx')
const SECTION = readCode('src/pages/user-profile/SellerSection.tsx')

const baseState: MyStoresState = {
  stores: [], totals: { today_revenue: 0, today_orders: 0, pending: 0 },
  currentSellerId: null, loading: true, failed: false, generation: 0, refetch: () => {},
}

beforeEach(() => { localStorage.clear() })

describe('① 로딩 중 자리 예약', () => {
  it('셀러 + 잰 값이 있으면 그 높이만큼 비워 둔다', () => {
    localStorage.setItem('seller_token', 'preview')
    writeReservedHeight(420)
    const { container } = render(<SellerSectionLazy state={baseState} />)
    const el = container.firstElementChild as HTMLElement | null
    expect(el, '예약이 아예 안 그려졌다 — 손님 줄이 그만큼 밀린다').toBeTruthy()
    expect(el!.style.height).toBe('420px')
  })

  it('🔴 비셀러에게는 한 픽셀도 안 그린다 (청크 다이어트가 이 게이트에 걸려 있다)', () => {
    writeReservedHeight(420)
    const { container } = render(<SellerSectionLazy state={baseState} />)
    expect(container.innerHTML).toBe('')
  })

  it('잰 값이 없으면 예약하지 않는다 — 없는 높이를 지어내지 않는다', () => {
    localStorage.setItem('seller_token', 'preview')
    const { container } = render(<SellerSectionLazy state={baseState} />)
    expect(container.innerHTML).toBe('')
  })

  /**
   * 🩸 주입이 잡아낸 구멍: 데이터가 와도 **셀러 청크는 아직 네트워크에 있다**. 그 사이 폴백이
   *   `null` 이면 예약이 한 프레임 접혔다 다시 펴져 **두 번** 밀린다. 첫 처방만 보면 안 보인다.
   *   (렌더로는 못 잰다 — 청크가 즉시 해석돼 폴백 프레임이 안 생긴다. 배선으로 고정한다.)
   */
  it('🔴 청크가 오는 동안에도 같은 높이를 붙들고 있다', () => {
    expect(LAZY).toContain('<Suspense fallback={<Reserve />}>')
  })

  it('좌석이 0곳으로 확정되면 예약이 사라진다 (빈 칸이 영원히 남지 않는다)', () => {
    localStorage.setItem('seller_token', 'preview')
    writeReservedHeight(420)
    const { container } = render(<SellerSectionLazy state={{ ...baseState, loading: false }} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('② 예약 높이는 잰 값이다', () => {
  it('구역이 자기 높이를 적는다 (손으로 적은 숫자가 코드에 없다)', () => {
    expect(SECTION).toContain('writeReservedHeight(el.offsetHeight)')
    expect(SECTION).toContain('ref={rootRef}')
    expect(LAZY, '래퍼가 높이를 상수로 들고 있다 — 디자인이 바뀌면 조용히 어긋난다')
      .not.toMatch(/height:\s*\d{3}/)
  })

  it('터무니없는 값은 안 굳는다 (울타리 밖은 쓰지도 읽지도 않는다)', () => {
    writeReservedHeight(5)
    expect(readReservedHeight()).toBe(0)
    writeReservedHeight(99999)
    expect(readReservedHeight()).toBe(0)
    writeReservedHeight(400)
    expect(readReservedHeight()).toBe(400)
  })

  it('PC 와 폰이 서로를 덮어쓰지 않는다', () => {
    const KEYS = readCode('src/pages/user-profile/seller-reserve.ts')
    expect(KEYS).toMatch(/ur_my_seller_h_v1_\$\{pc \? 'pc' : 'mo'\}/)
  })
})

describe('④ 설정 구역은 펼쳐져 있다', () => {
  /**
   * 대표 *"설정 및 고객지원도 왜 굳이 열고 닫게 해두는거지? … 가시적이지 않아 보는데에 불편해"*.
   * 🩸 소스 검사(`not.toContain('<FoldRow')`)만으로는 `{false && …}` 한 줄에 통과한다 —
   *   주입이 그걸 잡아 **실제로 렌더**하도록 고쳤다.
   */
  it('자식이 첫 렌더에 그대로 보인다 (한 번 더 누르지 않는다)', async () => {
    const { default: SettingsGroup } = await import('@/pages/user-profile/SettingsGroup')
    const { getByText } = render(<SettingsGroup><p>알림 설정</p></SettingsGroup>)
    expect(getByText('알림 설정')).toBeTruthy()
    expect(getByText('설정 · 고객지원')).toBeTruthy()
  })
})

describe('③ 계산대 폴백은 좌석이 확정된 뒤에만', () => {
  it('`!sellerSeats.loading` 게이트가 있다', () => {
    const i = PAGE.indexOf("navigate('/store/scan')")
    expect(i).toBeGreaterThan(-1)
    const head = PAGE.slice(Math.max(0, i - 600), i)
    expect(head, '로딩 중에도 떠서, 응답이 오면 사라진다(대표가 본 그 깜빡임)')
      .toContain('!sellerSeats.loading')
    expect(head).toContain('sellerSeats.stores.length === 0')
  })
})
