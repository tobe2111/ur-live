/**
 * 🩸 2026-09-03 대표 신고 — *"이용권 구매완료 사용가능 되어있는데 잘못됐어"*
 *
 * 마이페이지가 **한 화면 안에서 자기 자신과 모순**돼 있었다: 위 "이용권 현황"은
 * `구매완료 1 · 사용가능 1`, 바로 아래 "내 이용권" 행은 `0`.
 *
 * 라이브에서 실측한 그 1건의 정체(D1 읽기):
 *   `voucher_orders` id 1 · KT-알파 **교환권**(`아메리카노(Hot)(TAKE-OUT)`) · `status='failed'`
 *   — 발송 자체가 실패했고 `sent_at` 이 없다.
 *
 * 겹친 결함 두 개를 각각 고정한다.
 *   ① `/api/vouchers/my` 는 이용권(내부)과 교환권(KT)을 **한 배열**로 준다. 아래 두 행은
 *      `useMyCounts` 가 `voucher-wallet` SSOT 로 갈라 세는데 이 바만 통째로 셌다.
 *   ② 분류가 `used`/`refunded`/`expired` 만 알고 **나머지를 전부 `else → usable`** 로 떨어뜨렸다.
 *      KT 병합은 발송 실패를 `status:'unused'` + `kt_status:'failed'` 로 실어 보내므로
 *      (2026-06-17 — 카드가 실패 UI 를 그리라고), 발송조차 안 된 것이 '사용가능' 이 됐다.
 *
 * ⚠️ 이 파일이 못 잡는 것: 서버가 지갑 판정 필드(`source`/`deal_only`)를 **안 보내는** 경우.
 *   컬럼 누락 폴백 SELECT 는 `deal_only` 를 빼고 오는데(`group-buy-public.routes.ts`),
 *   그때는 `source` 만으로 판정된다 — 그 경로는 여기서 재현하지 않는다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import OrderStatusBar from '@/pages/user-profile/OrderStatusBar'

const vouchers = vi.fn()
vi.mock('@/hooks/queries/useMyData', () => ({ useMyVouchers: () => ({ data: vouchers() }) }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, o?: Record<string, unknown>) => String(o?.defaultValue ?? _k) }),
}))

/** 라벨 옆 숫자를 읽는다 — 버튼 하나가 `[숫자][라벨]` 이다. */
function countOf(label: string): number {
  const el = screen.getByText(label)
  const btn = el.closest('button') as HTMLButtonElement
  return Number(btn.querySelector('p')?.textContent ?? 'NaN')
}

/** 대표 계정의 실측 데이터 그대로 — 발송 실패한 KT 교환권 한 장. */
const CEO_FAILED_GIFTICON = {
  source: 'kt_alpha', id: 'kt-1', status: 'unused', kt_status: 'failed',
  expires_at: null, product_name: '아메리카노(Hot)(TAKE-OUT)',
}
const STORE_UNUSED = { source: 'internal', id: 7, status: 'unused', expires_at: null, deal_only: 0 }

beforeEach(() => vouchers.mockReset())

describe('① 교환권은 이용권으로 세지 않는다 (대표 신고의 재현)', () => {
  it('발송 실패한 KT 교환권만 가진 계정은 이용권 현황 자체가 안 뜬다', () => {
    vouchers.mockReturnValue([CEO_FAILED_GIFTICON])
    const { container } = render(<OrderStatusBar />)
    // 이용권 0장 → 바를 그릴 이유가 없다. "내 이용권 0" 과 같은 답이 된다.
    expect(container.firstChild).toBeNull()
  })

  it('`deal_only=1`(딜 전용 = 교환권)도 마찬가지로 빠진다 — 판정은 source 하나가 아니다', () => {
    vouchers.mockReturnValue([{ source: 'internal', id: 9, status: 'unused', deal_only: 1 }])
    const { container } = render(<OrderStatusBar />)
    expect(container.firstChild).toBeNull()
  })

  it('교환권과 이용권이 섞여 오면 이용권만 센다', () => {
    vouchers.mockReturnValue([CEO_FAILED_GIFTICON, STORE_UNUSED])
    render(<OrderStatusBar />)
    expect(countOf('구매완료')).toBe(1)
    expect(countOf('사용가능')).toBe(1)
  })
})

describe('② 모르는 상태를 사용가능으로 세지 않는다', () => {
  it("'사용가능' 은 unused 일 때만 — 낯선 상태는 어느 칸에도 안 들어간다", () => {
    vouchers.mockReturnValue([{ source: 'internal', id: 11, status: 'processing', deal_only: 0 }])
    render(<OrderStatusBar />)
    expect(countOf('구매완료')).toBe(1)   // 산 것은 맞으니 총계에는 남는다
    expect(countOf('사용가능')).toBe(0)   // 🔑 옛 `else → usable` 이면 1 이 된다
    expect(countOf('사용완료')).toBe(0)
    expect(countOf('만료·환불')).toBe(0)
  })

  it('status 가 비어 있으면(컬럼 DEFAULT = unused) 사용가능으로 센다', () => {
    vouchers.mockReturnValue([{ source: 'internal', id: 12, status: null, deal_only: 0 }])
    render(<OrderStatusBar />)
    expect(countOf('사용가능')).toBe(1)
  })
})

describe('③ 기존 분류는 그대로다 (회귀 방지)', () => {
  it('used / refunded / expired 는 각 칸으로 간다', () => {
    vouchers.mockReturnValue([
      { source: 'internal', id: 1, status: 'used', deal_only: 0 },
      { source: 'internal', id: 2, status: 'refunded', deal_only: 0 },
      { source: 'internal', id: 3, status: 'expired', deal_only: 0 },
      STORE_UNUSED,
    ])
    render(<OrderStatusBar />)
    expect(countOf('구매완료')).toBe(4)
    expect(countOf('사용완료')).toBe(1)
    expect(countOf('만료·환불')).toBe(2)
    expect(countOf('사용가능')).toBe(1)
  })

  it('기간이 지난 이용권은 status 가 unused 여도 만료로 센다 (ISO Z 형태)', () => {
    vouchers.mockReturnValue([
      { source: 'internal', id: 4, status: 'unused', expires_at: '2020-01-01T00:00:00.000Z', deal_only: 0 },
    ])
    render(<OrderStatusBar />)
    expect(countOf('만료·환불')).toBe(1)
    expect(countOf('사용가능')).toBe(0)
  })

  it('UTC-naive(`Z` 없음) 만료 문자열도 같은 답을 낸다 — parseUTCDate SSOT', () => {
    vouchers.mockReturnValue([
      { source: 'internal', id: 5, status: 'unused', expires_at: '2020-01-01 00:00:00', deal_only: 0 },
    ])
    render(<OrderStatusBar />)
    expect(countOf('만료·환불')).toBe(1)
  })
})
