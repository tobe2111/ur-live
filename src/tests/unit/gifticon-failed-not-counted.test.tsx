/**
 * 🩸 2026-09-04 대표 결정 — *"발송 실패한 교환권은 숫자에서 뺀다"* (재발송은 하지 않기로).
 *
 * `/api/vouchers/my` 의 KT 병합은 **발송 실패**를 이렇게 실어 보낸다(2026-06-17 — 카드가 실패 UI 를
 * 그려 *"결제됐는데 안 왔다"* 를 알리라고):
 *
 *     status: (vo.status === 'sent' || vo.status === 'failed') ? 'unused' : 'processing',
 *     kt_status: vo.status,
 *
 * 그래서 `status` 만 보는 곳은 전부 **문자조차 못 받은 것을 '사용 가능'으로** 셌다.
 * 대표 계정(`voucher_orders` id 1, 아메리카노, `sent_at` NULL)이 실제로 그 상태였고,
 * 마이의 "이용권 현황"(#1345)과 교환권 지갑의 "사용 가능 N장"·상단 딜 합계가 같이 틀렸다.
 *
 * ⇒ **세지는 않되 숨기지 않는다.** 카드는 '발송 실패' 그룹으로 계속 보이고 개수·금액에서만 빠진다.
 *
 * ⚠️ 이 파일이 못 잡는 것: 서버가 `kt_status` 를 **안 보내는** 경우. 그때는 실패분이 옛날처럼
 *   '사용 가능' 으로 돌아온다 — 판정 근거가 그 필드 하나뿐이라 클라에서는 방법이 없다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, renderHook, screen } from '@testing-library/react'
import { isFailedGifticon, isGifticonVoucher, isStoreVoucher } from '@/shared/voucher-wallet'
import MyGifticonsPage from '@/pages/MyGifticonsPage'
import { useMyCounts } from '@/pages/user-profile/useMyCounts'

/** 대표 계정의 실측 행 그대로 — 발송 실패한 KT 교환권. */
const FAILED = {
  source: 'kt_alpha', id: 'kt-1', status: 'unused', kt_status: 'failed',
  product_name: '아메리카노(Hot)(TAKE-OUT)', applied_price: 4500,
}
const SENT = {
  source: 'kt_alpha', id: 'kt-2', status: 'unused', kt_status: 'sent',
  product_name: '카페라떼', applied_price: 5000,
}

describe('① 판정 SSOT', () => {
  it('kt_status 가 failed 일 때만 실패다', () => {
    expect(isFailedGifticon(FAILED)).toBe(true)
    expect(isFailedGifticon(SENT)).toBe(false)
    expect(isFailedGifticon({ source: 'internal', deal_only: 0 })).toBe(false)
  })

  it('실패해도 여전히 교환권이다 — 이용권 지갑으로 넘어가지 않는다', () => {
    expect(isGifticonVoucher(FAILED)).toBe(true)
    expect(isStoreVoucher(FAILED)).toBe(false)
  })
})

const vouchers = vi.fn()
vi.mock('@/hooks/queries/useMyData', () => ({ useMyVouchers: () => ({ data: vouchers(), isLoading: false, isError: false, refetch: vi.fn() }) }))
vi.mock('@/hooks/queries', () => ({ useMyVouchers: () => ({ data: vouchers(), isLoading: false, isError: false, refetch: vi.fn() }) }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), Link: (p: Record<string, unknown>) => <a href={String(p.to)}>{p.children as never}</a> }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, o?: Record<string, unknown>) => String(o?.defaultValue ?? _k),
    i18n: { language: 'ko' },
  }),
}))
vi.mock('@/components/SEO', () => ({ default: () => null }))
// useMyCounts 는 effect 에서 `import('@/lib/api')` 로 위시/쿠폰을 센다 — 이 테스트와 무관하므로 죽인다.
vi.mock('@/lib/api', () => ({ default: { get: () => new Promise(() => {}) } }))

beforeEach(() => vouchers.mockReset())

/**
 * 그룹 헤더(`발송 실패 2` 처럼 라벨+개수)를 집어 온다.
 * ⚠️ `getByText` 로는 못 고른다 — 같은 문구가 히어로 통계와 카드 배지에도 있어 항상 중복 매치다
 *   (첫 판에서 실제로 그래서 빨간불이 났다). 그룹 헤더만의 클래스로 좁힌다.
 */
function groupCount(root: HTMLElement, label: string): number | null {
  const headers = Array.from(root.querySelectorAll('span.font-semibold'))
    .filter(el => el.className.includes('text-[13px]') && (el.textContent || '').startsWith(label))
  if (headers.length !== 1) return null
  const m = (headers[0].textContent || '').match(/(\d+)/)
  return m ? Number(m[1]) : null
}

describe('② 교환권 지갑 — 실패는 보이되 안 센다', () => {
  it("실패분은 '사용 가능' 에 안 들어가고 '발송 실패' 그룹에 보인다", () => {
    vouchers.mockReturnValue([FAILED, SENT])
    const { container } = render(<MyGifticonsPage />)
    expect(groupCount(container, '사용 가능')).toBe(1)   // 🔑 실패분을 세면 2 가 된다
    expect(groupCount(container, '발송 실패')).toBe(1)
    // 숨기지 않는다 — 실패 카드의 상품명이 화면에 있어야 한다
    expect(screen.getByText('아메리카노(Hot)(TAKE-OUT)')).toBeTruthy()
  })

  it('상단 합계(딜)에 실패분 금액이 안 들어간다', () => {
    vouchers.mockReturnValue([FAILED, SENT])
    const { container } = render(<MyGifticonsPage />)
    const txt = container.textContent || ''
    expect(txt).toContain('5,000')      // 받은 것만
    expect(txt).not.toContain('9,500')  // 🔑 실패분까지 더하면 이 값이 된다
  })

  it('실패분만 가진 계정은 히어로 통계를 아예 안 그린다', () => {
    vouchers.mockReturnValue([FAILED])
    const { container } = render(<MyGifticonsPage />)
    expect(groupCount(container, '발송 실패')).toBe(1)
    expect(groupCount(container, '사용 가능')).toBe(0)
    // 🔑 소유분 0 → stats 자체가 빈 배열이라 '전체 N장' 줄이 없다.
    expect(container.textContent).not.toContain('전체')
    // ⚠️ 카드 안 가격(4,500딜)은 남는다 — 실제로 결제한 금액이고, 그게 있어야 문의가 된다.
    //    이 테스트가 막는 것은 **합계·통계**에 섞이는 것이지 카드 표시가 아니다.
    //    (첫 판에서 이걸 헷갈려 카드 가격까지 없어야 한다고 단정했다가 빨간불이 났다.)
    expect(screen.getByText('아메리카노(Hot)(TAKE-OUT)')).toBeTruthy()
  })
})

describe("③ 마이의 '내 교환권' 숫자 — 실패분을 안 센다", () => {
  // 🩸 이 블록은 **되돌려-검증에서 구멍이 드러나 뒤늦게 추가**했다. ②(지갑 페이지)만 있을 때
  //   `useMyCounts` 의 필터를 옛날로 되돌려도 5건이 전부 초록이었다 — 대표가 실제로 지목한
  //   "내 교환권 1" 이 바로 그 값인데도. **가드는 깨뜨려 봐야 가드인지 안다.**
  it('실패 1 + 정상 1 이면 1 이다', () => {
    vouchers.mockReturnValue([FAILED, SENT])
    const { result } = renderHook(() => useMyCounts())
    expect(result.current.gifticon).toBe(1)   // 🔑 옛 필터면 2
    expect(result.current.voucher).toBe(0)    // 둘 다 교환권 — 이용권 지갑으로 새지 않는다
  })

  it('실패분만 있으면 0 이다 (대표 계정의 실제 상태)', () => {
    vouchers.mockReturnValue([FAILED])
    const { result } = renderHook(() => useMyCounts())
    expect(result.current.gifticon).toBe(0)
  })

  it('데이터를 못 받았으면 0 이 아니라 null 이다 — 실패를 "0장"으로 위장하지 않는다', () => {
    vouchers.mockReturnValue(undefined)
    const { result } = renderHook(() => useMyCounts())
    expect(result.current.gifticon).toBeNull()
  })
})
