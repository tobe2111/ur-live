/**
 * 🔎 SearchHeader — **제안을 그리지 않는다**(2026-09-30 대표 *"연관검색? 처럼 나오는거 별로야"*)
 *
 * 이 파일은 종전에 헤더 안 **떠 있는 드롭다운**을 검증했다(제안 렌더 · '브랜드' 배지 · 항목 클릭).
 * 그 드롭다운이 결과를 가리는 것이 대표 신고의 절반이었고, 제안은 결과 **자리**에 들어서는
 * `SearchSuggestPanel` 로 옮겨갔다. ⇒ 헤더의 계약은 이제 *"언제 열지/닫을지를 위로 알린다"* 다.
 *
 * ⚠️ 옛 시험을 **지우지 않고 옮겨 적었다** — 지키던 것(포커스해야 뜬다 · 제출하면 검색된다 ·
 *   공백만이면 검색 안 한다)은 그대로 살아 있고, 판정 대상만 "무엇을 그렸나" → "무엇을 알렸나" 로
 *   바뀌었다. 패널 쪽 계약은 `src/tests/unit/search-suggest-panel-2026-09-30.test.tsx`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import SearchHeader from '@/components/search/SearchHeader'

const PLACEHOLDER = '상품명, 브랜드, 셀러 검색'

describe('SearchHeader', () => {
  const mockOnSearch = vi.fn()
  const mockOnLoadSuggestions = vi.fn()
  const mockOnPanelChange = vi.fn()

  const defaultProps = {
    query: 'test query',
    totalResults: 10,
    onSearch: mockOnSearch,
    onLoadSuggestions: mockOnLoadSuggestions,
    onPanelChange: mockOnPanelChange,
  }

  const wrap = (props = defaultProps) => render(
    <BrowserRouter>
      <SearchHeader {...props} />
    </BrowserRouter>
  )

  beforeEach(() => {
    mockOnSearch.mockClear()
    mockOnLoadSuggestions.mockClear()
    mockOnPanelChange.mockClear()
  })

  it('renders back + cart icon buttons', () => {
    wrap()
    const buttons = screen.getAllByRole('button')
    // 최소 2개: 뒤로가기 + 장바구니 (query가 있을 때 clear 버튼 포함 3개)
    expect(buttons.length).toBeGreaterThanOrEqual(2)
  })

  it('displays search input with placeholder', () => {
    wrap()
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeDefined()
  })

  it('initializes input value from query prop', () => {
    wrap()
    const input = screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement
    expect(input.value).toBe('test query')
  })

  it('calls onSearch when form is submitted', () => {
    wrap()
    const input = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(input, { target: { value: 'new search' } })
    fireEvent.submit(input.closest('form')!)
    expect(mockOnSearch).toHaveBeenCalledWith('new search')
  })

  it('updates input value on change', () => {
    wrap()
    const input = screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'updated query' } })
    expect(input.value).toBe('updated query')
  })

  it('does not call onSearch with whitespace-only query', () => {
    wrap({ ...defaultProps, query: '' })
    const input = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.submit(input.closest('form')!)
    expect(mockOnSearch).not.toHaveBeenCalled()
  })

  it('clear button (X) resets input when query is present', () => {
    wrap()
    const input = screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement
    expect(input.value).toBe('test query')
    fireEvent.change(input, { target: { value: '' } })
    expect(input.value).toBe('')
  })
})

describe('SearchHeader — 제안은 헤더가 그리지 않는다', () => {
  const props = {
    query: '',
    onSearch: vi.fn(),
    onLoadSuggestions: vi.fn(),
    onPanelChange: vi.fn(),
  }
  const wrap = (p = props) => render(<BrowserRouter><SearchHeader {...p} /></BrowserRouter>)

  it('🔴 헤더 안에 떠 있는 제안 목록이 없다 (결과를 가리던 그 카드)', () => {
    const { container } = wrap()
    const input = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '돈가스' } })
    expect(container.querySelector('.absolute.top-full')).toBeNull()
    expect(screen.queryByText('브랜드')).toBeNull()  // 종전 배지 — 패널엔 없다
  })

  it('🔴 포커스 + 2글자 이상이면 "열어라" 를 위로 알린다', () => {
    const onPanelChange = vi.fn()
    wrap({ ...props, onPanelChange })
    const input = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '돈가스' } })
    expect(onPanelChange).toHaveBeenLastCalledWith(true, '돈가스')
  })

  it('🔴 한 글자면 열지 않는다', () => {
    const onPanelChange = vi.fn()
    wrap({ ...props, onPanelChange })
    const input = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '돈' } })
    expect(onPanelChange).toHaveBeenLastCalledWith(false, '돈')
  })

  it('🔴 제출하면 닫는다 (결과를 봐야 한다)', () => {
    const onPanelChange = vi.fn()
    wrap({ ...props, onPanelChange })
    const input = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '돈가스' } })
    fireEvent.submit(input.closest('form')!)
    expect(onPanelChange).toHaveBeenLastCalledWith(false, '돈가스')
  })
})

describe('SearchHeader — 키 입력마다 요청하지 않는다', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('🔴 제안 요청은 디바운스된다 (한 번이 D1 쿼리 셋이다)', () => {
    const onLoadSuggestions = vi.fn()
    const onPanelChange = vi.fn()
    render(
      <BrowserRouter>
        <SearchHeader query="" onSearch={vi.fn()} onLoadSuggestions={onLoadSuggestions} onPanelChange={onPanelChange} />
      </BrowserRouter>,
    )
    const input = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.focus(input)
    // 한글 IME 가 자모마다 내는 입력을 흉내낸다.
    for (const v of ['ㄷ', '도', '돈', '돈ㄱ', '돈가', '돈가스']) fireEvent.change(input, { target: { value: v } })
    expect(onLoadSuggestions).not.toHaveBeenCalled()      // 아직 한 번도 안 나갔다
    act(() => { vi.advanceTimersByTime(300) })
    expect(onLoadSuggestions).toHaveBeenCalledTimes(1)     // 마지막 값으로 한 번만
    expect(onLoadSuggestions).toHaveBeenCalledWith('돈가스')
  })

  it('🔴 패널 열림/닫힘은 디바운스에 걸리지 않는다 (지웠는데 목록이 남으면 안 된다)', () => {
    const onPanelChange = vi.fn()
    render(
      <BrowserRouter>
        <SearchHeader query="" onSearch={vi.fn()} onLoadSuggestions={vi.fn()} onPanelChange={onPanelChange} />
      </BrowserRouter>,
    )
    const input = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '돈가스' } })
    expect(onPanelChange).toHaveBeenLastCalledWith(true, '돈가스')   // 타이머 전진 없이
    fireEvent.change(input, { target: { value: '' } })
    expect(onPanelChange).toHaveBeenLastCalledWith(false, '')
  })
})
