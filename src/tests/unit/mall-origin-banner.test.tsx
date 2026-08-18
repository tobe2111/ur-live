/**
 * 🏪 **가게 간판 배너 — 실제 렌더 동작** (2026-08-12)
 *
 * 배선 테스트(`mall-surface-boundary`)는 "호출이 있는가"만 본다. 그것만으로는
 * **본진 손님 화면 byte-불변**이라는 이 변경의 핵심 약속을 증명하지 못한다
 * (오늘 같은 클래스로 세 번 헛돌았다: 주석에만 남아도 통과 · 파일 절반만 읽음 · import 만 남아도 통과).
 *
 * ⚠️ **왜 브라우저 E2E 가 아닌가**: 로컬에 워커가 없어 `/checkout` 이 로그인·장바구니 데이터를
 *   못 받고 **결제 본문에 도달조차 못 한다**(홈 셸이 렌더된다). 그 상태로 "간판 없음"을 확인하면
 *   *측정 대상이 0* 인 통과 — 이 레포의 단골 오검증이다. 그래서 컴포넌트를 직접 렌더한다.
 *
 * ⚠️ **이 테스트가 못 막는 것**: 배너가 페이지의 *올바른 자리*에 붙었는지(그건 배선 테스트가 본다),
 *   그리고 실제 결제 화면에서의 시각 회귀(그건 배포 후 사람이 본다).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MallOriginBanner from '@/components/mall/MallOriginBanner'

/**
 * 🔴 **`waitFor(() => expect(innerHTML).toBe(''))` 를 쓰지 말 것.**
 *   그 단언은 **처음부터 비어 있으면 첫 시도에 즉시 통과**한다 — 조회가 끝난 뒤 간판이
 *   채워져도 못 잡는다. 되돌려-검증에서 "실패 시 슬러그로 이름을 추측" 주입이 **초록**으로
 *   빠져나간 것이 정확히 이 이유였다.
 *   ⇒ **조회가 끝날 때까지 기다린 뒤** 비어 있음을 단언한다.
 */
async function settle(fetchSpy: ReturnType<typeof vi.fn>) {
  await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}

const MALL_OK = {
  success: true,
  mall: { id: 3, slug: 'test', name: '테스트매장', logoUrl: null, initial: '테', colorLight: '#1F2937' },
}

function renderBanner(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/payment/success${search}`]}><MallOriginBanner /></MemoryRouter>,
  )
}

/** 주문 조회 → 브랜딩 조회 순서로 답하는 fetch 스텁. `orderMall: null` = 서버가 "본진 주문"이라고 답함. */
function stubOrderThenBrand(orderMall: { slug: string; name: string } | null, ok = true) {
  return vi.fn(async (url: string) => {
    if (String(url).includes('/of-order/')) {
      return ok
        ? { ok: true, json: async () => ({ success: true, mall: orderMall }) }
        : { ok: false, json: async () => ({ success: false }) }
    }
    return { ok: true, json: async () => MALL_OK }
  })
}

describe('MallOriginBanner — 흔적이 있을 때만 간판을 건다', () => {
  beforeEach(() => { sessionStorage.clear() })
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('🔴 본진 손님(흔적 없음) — 아무것도 안 그리고 **조회조차 안 한다**', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { container } = renderBanner()
    await waitFor(() => expect(fetchSpy).not.toHaveBeenCalled())
    // 빈 자리·placeholder 도 남기지 않는다 — 본진 화면은 이전과 완전히 같아야 한다.
    expect(container.innerHTML).toBe('')
  })

  it('몰 손님 — 가게 이름과 되돌아갈 문이 뜬다', async () => {
    sessionStorage.setItem('ur_mall_origin', 'test')
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => MALL_OK })))
    renderBanner()
    expect(await screen.findByText('테스트매장')).toBeTruthy()
    expect(screen.getByRole('button', { name: /가게로/ })).toBeTruthy()
  })

  it('조회 실패 — 가게 이름을 **추측하지 않는다**(간판 없음)', async () => {
    sessionStorage.setItem('ur_mall_origin', 'test')
    const f = vi.fn(async () => { throw new Error('network') })
    vi.stubGlobal('fetch', f)
    const { container } = renderBanner()
    await settle(f)
    expect(container.innerHTML).toBe('')
  })

  it('404(몰 없음) — 간판 없음', async () => {
    sessionStorage.setItem('ur_mall_origin', 'gone')
    const f = vi.fn(async () => ({ ok: false, json: async () => ({ success: false }) }))
    vi.stubGlobal('fetch', f)
    const { container } = renderBanner()
    await settle(f)
    expect(container.innerHTML).toBe('')
  })

  it('이름이 빈 응답 — 간판 없음(빈 간판을 걸지 않는다)', async () => {
    sessionStorage.setItem('ur_mall_origin', 'test')
    const f = vi.fn(async () => ({ ok: true, json: async () => ({ success: true, mall: { slug: 'test' } }) }))
    vi.stubGlobal('fetch', f)
    const { container } = renderBanner()
    await settle(f)
    // 이름이 없으면 "undefined" 같은 문자열을 간판에 걸어선 안 된다.
    expect(container.innerHTML).toBe('')
  })

  it('흔적이 오염돼도 조회하지 않는다 — 값이 경로에 그대로 들어가므로 문법을 다시 본다', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    sessionStorage.setItem('ur_mall_origin', '../admin')
    renderBanner()
    await waitFor(() => expect(fetchSpy).not.toHaveBeenCalled())
  })
})

/**
 * 🔴 **서버 신호가 흔적을 이긴다** (2026-08-12 후속)
 *
 * 흔적은 양방향으로 틀린다 — 새 탭이면 몰 손님인데 없고, 구경만 한 손님에겐 남는다.
 * 결제 완료 화면은 `?orderId=` 를 갖고 있으므로 **주문 자체**를 물어 두 방향 모두 바로잡는다.
 *
 * ⚠️ 이 테스트가 못 막는 것: 서버가 실제로 그 주문의 몰을 맞게 고르는지(그건 `mallByOrderId`
 *   의 결정 규칙이고 DB 가 있어야 검증된다 — 여기서는 응답을 스텁한다).
 */
describe('MallOriginBanner — 주문번호가 있으면 서버 신호가 이긴다', () => {
  beforeEach(() => { sessionStorage.clear() })
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('🔴 흔적은 있는데 **서버가 본진 주문이라고 답하면** 간판을 안 건다', async () => {
    sessionStorage.setItem('ur_mall_origin', 'test')     // 구경만 하고 본진 상품을 산 손님
    const f = stubOrderThenBrand(null)
    vi.stubGlobal('fetch', f)
    const { container } = renderBanner('?orderId=ORD-1')
    await settle(f)
    expect(container.innerHTML).toBe('')
    // 브랜딩 조회까지 가지 않는다 — 서버가 이미 "아니다" 라고 답했다.
    expect(f.mock.calls.some((c) => String(c[0]).includes('/api/mall/test'))).toBe(false)
  })

  it('🔴 흔적이 **없어도** 서버가 가게를 지목하면 간판을 건다 (새 탭·복귀)', async () => {
    const f = stubOrderThenBrand({ slug: 'test', name: '테스트매장' })
    vi.stubGlobal('fetch', f)
    renderBanner('?orderId=ORD-2')
    expect(await screen.findByText('테스트매장')).toBeTruthy()
  })

  it('서버가 모르면(비로그인·실패) 흔적으로 폴백한다 — 종전 동작', async () => {
    sessionStorage.setItem('ur_mall_origin', 'test')
    const f = stubOrderThenBrand(null, false)            // of-order 가 non-200
    vi.stubGlobal('fetch', f)
    renderBanner('?orderId=ORD-3')
    expect(await screen.findByText('테스트매장')).toBeTruthy()
  })

  it('주문번호가 없으면(체크아웃) 주문 조회를 아예 안 한다', async () => {
    sessionStorage.setItem('ur_mall_origin', 'test')
    const f = stubOrderThenBrand(null)
    vi.stubGlobal('fetch', f)
    renderBanner()
    await settle(f)
    expect(f.mock.calls.some((c) => String(c[0]).includes('/of-order/'))).toBe(false)
  })
})
