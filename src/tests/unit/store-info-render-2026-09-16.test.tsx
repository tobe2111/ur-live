/**
 * 🖥️ **업체 정보 화면을 실제로 렌더해서 본다** (2026-09-16).
 *
 * 앞의 `store-info-one-page-2026-09-16.test.ts` 는 **소스 문자열**을 본다 — 흩어짐이 돌아오는 것을
 * 막지만, *화면이 실제로 그려지는지* 는 못 본다. 이 레포가 반복해 당한 사고가 정확히 그 틈이다
 * (칸은 있는데 렌더가 던져서 아무도 못 쓰는 화면).
 *
 * ## 여기서만 볼 수 있는 것
 *   ① 두 API 를 엮어 폼이 채워진다(서버 응답 모양이 바뀌면 여기가 빨간불).
 *   ② **미리보기가 타이핑을 따라온다** — 이게 당근 시안의 핵심이고, 정적 검사로는 증명이 안 된다.
 *   ③ 안 바뀌었으면 [저장]이 꺼져 있다.
 *   ④ 한쪽 저장이 실패하면 **그쪽만** 말한다.
 *
 * ⚠️ 못 보는 것: 실제 픽셀·PC 2열 배치(jsdom 은 레이아웃을 계산하지 않는다) · 지도 · 이미지 업로드.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const get = vi.fn()
const patch = vi.fn()
const put = vi.fn()
const toastError = vi.fn()
const toastSuccess = vi.fn()

vi.mock('@/lib/api', () => ({
  default: {
    get: (...a: unknown[]) => get(...a),
    patch: (...a: unknown[]) => patch(...a),
    put: (...a: unknown[]) => put(...a),
    post: vi.fn(),
  },
}))
vi.mock('@/hooks/useToast', () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a), info: vi.fn() },
}))
// 셸·지도·로더는 이 시험의 대상이 아니다 — 무겁고 외부 SDK 를 끌어온다.
vi.mock('@/components/SellerLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
vi.mock('@/components/SEO', () => ({ default: () => null }))
vi.mock('@/components/brand/BrandLoader', () => ({ default: () => <div>로딩</div> }))
vi.mock('@/components/KakaoMapPicker', () => ({ default: () => <div>지도</div> }))
vi.mock('@/components/seller-layout/SellerBottomBar', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="phone-bar">{children}</div>,
  SELLER_BOTTOM_BAR_H: 64,
}))

import SellerStoreInfoPage from '@/pages/SellerStoreInfoPage'

const STORE = {
  success: true,
  data: {
    store: {
      name: '홍대돈까스', address: '전북특별자치도 전주시 덕진구 가리내10길 10', phone: '063-251-6785',
      lat: '35.84244', lng: '127.11102', verify_pin: '3585',
      kakao_place_url: 'https://place.map.kakao.com/26322749', category: '음식점 > 일식 > 돈까스,우동',
    },
    manager_phone: '01012345678',
    product_count: 3,
  },
}
const SHOP = {
  success: true,
  data: {
    bio: '전주에서 20년 한자리.', profile_image: '', banner_url: '', brand_color: '#1C69EF',
    sns_instagram: 'https://instagram.com/x', sns_youtube: '', sns_facebook: '', sns_twitter: '',
    website_url: 'https://example.com', kakao_chat_link: '',
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.setItem('seller_id', '14')
  get.mockImplementation((url: string) =>
    Promise.resolve({ data: url.includes('/stores/') ? STORE : SHOP }))
  patch.mockResolvedValue({ data: { success: true, data: { propagated: 3 } } })
  put.mockResolvedValue({ data: { success: true } })
})

const draw = () => render(<MemoryRouter><SellerStoreInfoPage /></MemoryRouter>)

describe('업체 정보 화면 — 실제 렌더', () => {
  it('① 두 API 값이 한 폼에 함께 채워진다', async () => {
    const r = draw()
    await waitFor(() => expect(r.getByDisplayValue('홍대돈까스')).toBeTruthy())
    expect(r.getByDisplayValue('063-251-6785'), '매장 전화(옛 모달)').toBeTruthy()
    expect(r.getByDisplayValue('3585'), '확인 PIN(옛 모달)').toBeTruthy()
    expect(r.getByDisplayValue('전주에서 20년 한자리.'), '소개글(옛 셀러 프로필)').toBeTruthy()
    expect(r.getByDisplayValue('https://instagram.com/x'), 'SNS(옛 셀러 프로필)').toBeTruthy()
    expect(r.getByDisplayValue('#1C69EF'), '브랜드 컬러(옛 유어샵 설정)').toBeTruthy()
  })

  it('② 🔴 미리보기가 타이핑을 따라온다 — 당근 시안의 핵심', async () => {
    const r = draw()
    await waitFor(() => expect(r.getByDisplayValue('홍대돈까스')).toBeTruthy())
    // 부제는 주소의 동/구 + 업종 끝 조각으로 만들어진다.
    expect(r.getByText(/덕진구 · 돈까스,우동/)).toBeTruthy()
    fireEvent.change(r.getByDisplayValue('홍대돈까스'), { target: { value: '전주돈까스' } })
    // 저장 전인데도 카드가 바뀌어야 '미리보기' 다.
    await waitFor(() => expect(r.getAllByText('전주돈까스').length).toBeGreaterThan(0))
  })

  it('③ 🔒 비공개 칸은 미리보기에 안 나온다', async () => {
    const r = draw()
    await waitFor(() => expect(r.getByDisplayValue('홍대돈까스')).toBeTruthy())
    // PIN 은 입력칸(value)에만 있고, 카드의 **텍스트**로는 어디에도 없어야 한다.
    expect(r.queryByText('3585'), 'PIN 이 카드에 보이면 사장님이 공개된 줄 안다').toBeNull()
  })

  it('④ 안 바뀌었으면 저장이 꺼져 있고, 고치면 켜진다', async () => {
    const r = draw()
    await waitFor(() => expect(r.getByDisplayValue('홍대돈까스')).toBeTruthy())
    const saves = r.getAllByRole('button', { name: /저장/ })
    expect(saves.length, 'PC 열 + 폰 고정 바 둘 다 있어야 한다').toBeGreaterThanOrEqual(2)
    expect(saves.every((b) => (b as HTMLButtonElement).disabled), '바뀐 게 없으면 꺼져 있다').toBe(true)
    fireEvent.change(r.getByDisplayValue('홍대돈까스'), { target: { value: '전주돈까스' } })
    await waitFor(() => expect((r.getAllByRole('button', { name: /저장/ })[0] as HTMLButtonElement).disabled).toBe(false))
  })

  it('⑤ 매장 칸만 고치면 유어샵 PUT 은 아예 안 나간다', async () => {
    const r = draw()
    await waitFor(() => expect(r.getByDisplayValue('홍대돈까스')).toBeTruthy())
    fireEvent.change(r.getByDisplayValue('홍대돈까스'), { target: { value: '전주돈까스' } })
    fireEvent.click(r.getAllByRole('button', { name: /저장/ })[0])
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1))
    expect(put, '안 바뀐 쪽까지 보내면 서버의 "빈 값 무시" 규칙에 기대게 된다').not.toHaveBeenCalled()
    expect(patch.mock.calls[0][1]).toEqual({ name: '전주돈까스' })
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining('이용권 3개')))
  })

  it('⑥ 🔴 한쪽만 실패하면 그쪽만 말한다', async () => {
    patch.mockRejectedValue({ response: { data: { error: '매장 저장 실패(가짜)' } } })
    const r = draw()
    await waitFor(() => expect(r.getByDisplayValue('홍대돈까스')).toBeTruthy())
    fireEvent.change(r.getByDisplayValue('홍대돈까스'), { target: { value: '전주돈까스' } })
    fireEvent.change(r.getByDisplayValue('전주에서 20년 한자리.'), { target: { value: '새 소개' } })
    fireEvent.click(r.getAllByRole('button', { name: /저장/ })[0])
    await waitFor(() => expect(toastError).toHaveBeenCalled())
    expect(String(toastError.mock.calls[0][0])).toContain('매장 저장 실패(가짜)')
    expect(put, '성공한 쪽은 실제로 나갔다').toHaveBeenCalled()
    // 실패한 쪽은 여전히 '바뀜' 이라 다시 저장할 수 있어야 한다.
    await waitFor(() => expect((r.getAllByRole('button', { name: /저장/ })[0] as HTMLButtonElement).disabled).toBe(false))
  })
})
