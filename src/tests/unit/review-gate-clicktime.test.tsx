/**
 * 🩸 2026-09-03 대표 신고 — *"10자 이상 썼는데도 리뷰 등록 버튼이 흐릿한 비활성"* +
 *   *"이용권 사용해야 리뷰 쓸 수 있게 해야지"*
 *
 * ## 왜 hard-disable 을 걷어냈나
 *
 * 실제 컴포넌트를 렌더해 12자를 넣으면 버튼은 **활성됐다**(아래 첫 테스트가 그걸 고정한다).
 * 배포된 청크의 조건도 소스와 같았다(`disabled: p.length<10||h`). 즉 로직은 맞는데
 * 대표님 환경에서만 잠겼다 — 모바일 한글 IME 조합 중 state 지연, 인앱 브라우저, 캐시된 옛 청크가
 * 후보였지만 어느 것도 원격에서 재현할 수 없었다(이 컨테이너는 프록시가 브라우저를 막는다).
 *
 * ⇒ 원인을 좁히는 대신 **잠길 수 있는 구조를 없앴다.** 같은 교훈이 이 레포에 이미 있다:
 *   2026-06-26 `TossPaymentWidget` 이 약관 동의를 state 로 미러링해 결제 버튼에 묶었다가
 *   desync 로 버튼이 잠기는 사고를 냈고 **클릭-시점 검증**으로 전환했다(대표 "대형 서비스처럼").
 *   리뷰 버튼만 그 옛 패러다임에 남아 있었다.
 *
 * ⚠️ 이 파일이 못 잡는 것: 실제 모바일 IME 동작. jsdom 은 조합 이벤트를 흉내내지 않는다.
 *   그래서 "IME 를 고쳤다" 고 주장하지 않는다 — **버튼이 구조적으로 잠길 수 없게** 만든 것만 고정한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ProductReviews from '@/pages/product-detail/ProductReviews'

const get = vi.fn()
const post = vi.fn()
vi.mock('@/lib/api', () => ({ default: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) } }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, o?: Record<string, unknown>) => {
      const dv = String(o?.defaultValue ?? _k)
      return dv.replace(/\{\{n\}\}/g, String(o?.n ?? ''))
    },
  }),
}))
vi.mock('@/hooks/useToast', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } })

beforeEach(() => {
  get.mockReset(); post.mockReset()
  get.mockImplementation((url: string) => {
    if (String(url).includes('/eligibility')) return ok({ ok: true })
    if (String(url).includes('/summary')) return ok({ avg: 0, count: 0 })
    if (String(url).includes('reward-config')) return ok({ text: 100, image: 300, video: 500 })
    return ok({ reviews: [] })
  })
  post.mockResolvedValue({ data: { success: true } })
})

async function openForm() {
  render(<ProductReviews productId={2888} />)
  fireEvent.click(await screen.findByRole('button', { name: /리뷰 작성하기/ }))
  return await screen.findByLabelText('리뷰 내용')
}

describe('① 버튼은 구조적으로 잠길 수 없다', () => {
  it('10자 이상이면 활성된다 (대표 신고의 반증 — 이 값이 곧 회귀 기준)', async () => {
    const ta = await openForm()
    fireEvent.change(ta, { target: { value: '맛있게 잘 먹었습니다 정말로' } })
    const btn = await screen.findByRole('button', { name: /리뷰 등록/ }) as HTMLButtonElement
    expect((ta as HTMLTextAreaElement).value.length).toBeGreaterThanOrEqual(10)
    expect(btn.disabled).toBe(false)
  })

  it('**글자 수가 모자라도** 버튼은 눌릴 수 있다 (hard-disable 제거의 핵심)', async () => {
    const ta = await openForm()
    fireEvent.change(ta, { target: { value: '짧음' } })
    const btn = await screen.findByRole('button', { name: /리뷰 등록/ }) as HTMLButtonElement
    expect(btn.disabled).toBe(false)
  })

  it('비어 있어도 잠기지 않는다 — 잠기는 조건은 "제출 중" 하나뿐', async () => {
    await openForm()
    const btn = await screen.findByRole('button', { name: /리뷰 등록/ }) as HTMLButtonElement
    expect(btn.disabled).toBe(false)
  })
})

describe('② 짧으면 서버를 부르지 않고 이유를 그 자리에 쓴다', () => {
  it('모자란 글자 수를 화면에 쓰고 POST 하지 않는다', async () => {
    const ta = await openForm()
    fireEvent.change(ta, { target: { value: '맛있어요' } })   // 4자
    fireEvent.click(await screen.findByRole('button', { name: /리뷰 등록/ }))
    await waitFor(() => expect(screen.getByText(/6자 더 쓰면/)).toBeTruthy())
    expect(post).not.toHaveBeenCalled()
  })

  it('공백만으로는 채울 수 없다 (trim 후 판정)', async () => {
    const ta = await openForm()
    fireEvent.change(ta, { target: { value: '  짧음   ' } })
    fireEvent.click(await screen.findByRole('button', { name: /리뷰 등록/ }))
    await waitFor(() => expect(screen.getByText(/자 더 쓰면/)).toBeTruthy())
    expect(post).not.toHaveBeenCalled()
  })
})

describe('③ 자격은 쓰기 전에 알려 준다 (대표 — "이용권 사용해야 리뷰")', () => {
  it('자격이 없으면 폼을 열지 않고 서버 문구를 보여준다', async () => {
    get.mockImplementation((url: string) => {
      if (String(url).includes('/eligibility')) {
        return ok({ ok: false, reason: '이용권을 사용한 뒤에 리뷰를 쓸 수 있어요', code: 'VOUCHER_NOT_USED' })
      }
      if (String(url).includes('/summary')) return ok({ avg: 0, count: 0 })
      return ok({ reviews: [] })
    })
    render(<ProductReviews productId={2888} />)
    fireEvent.click(await screen.findByRole('button', { name: /리뷰 작성하기/ }))
    await waitFor(() => expect(screen.getByText('이용권을 사용한 뒤에 리뷰를 쓸 수 있어요')).toBeTruthy())
    // 폼이 열리지 않았다 — 헛수고를 시키지 않는 것이 이 변경의 목적이다.
    expect(screen.queryByLabelText('리뷰 내용')).toBeNull()
  })

  it('자격 조회가 **실패하면 막지 않는다** — 안내용이고 최종 권위는 POST 다', async () => {
    get.mockImplementation((url: string) => {
      if (String(url).includes('/eligibility')) return Promise.reject({ response: { status: 500 } })
      if (String(url).includes('/summary')) return ok({ avg: 0, count: 0 })
      return ok({ reviews: [] })
    })
    render(<ProductReviews productId={2888} />)
    fireEvent.click(await screen.findByRole('button', { name: /리뷰 작성하기/ }))
    // 조회 한 번 삐끗에 정당한 사용자가 리뷰를 못 쓰면 안 된다.
    await waitFor(() => expect(screen.getByLabelText('리뷰 내용')).toBeTruthy())
  })

  it('비로그인은 로그인 안내', async () => {
    get.mockImplementation((url: string) => {
      if (String(url).includes('/eligibility')) return Promise.reject({ response: { status: 401 } })
      if (String(url).includes('/summary')) return ok({ avg: 0, count: 0 })
      return ok({ reviews: [] })
    })
    render(<ProductReviews productId={2888} />)
    fireEvent.click(await screen.findByRole('button', { name: /리뷰 작성하기/ }))
    await waitFor(() => expect(screen.getByText(/로그인 후 리뷰를/)).toBeTruthy())
  })
})

describe('④ 서버가 거절하면 인라인으로도 남는다', () => {
  it('403 사유가 토스트뿐 아니라 폼 안에 쓰인다', async () => {
    // 🩸 토스트는 `fixed top-4`(화면 맨 위)에 뜨는데 리뷰 폼은 페이지 맨 아래고 모바일은 키보드까지
    //   올라와 있다 — 토스트로만 알리면 사용자에겐 "아무 일도 안 일어났다" 로 보인다.
    post.mockRejectedValue({ response: { status: 403, data: { error: '이용권을 사용한 뒤에 리뷰를 쓸 수 있어요', error_code: 'VOUCHER_NOT_USED' } } })
    const ta = await openForm()
    fireEvent.change(ta, { target: { value: '맛있게 잘 먹었습니다 정말로' } })
    fireEvent.click(await screen.findByRole('button', { name: /리뷰 등록/ }))
    await waitFor(() => expect(screen.getByText('이용권을 사용한 뒤에 리뷰를 쓸 수 있어요')).toBeTruthy())
  })
})
