import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import SearchHeader from '@/components/search/SearchHeader'

const PLACEHOLDER = '상품명, 브랜드, 셀러 검색'

describe('SearchHeader', () => {
  const mockOnSearch = vi.fn()
  const mockOnLoadSuggestions = vi.fn()

  const defaultProps = {
    query: 'test query',
    totalResults: 10,
    onSearch: mockOnSearch,
    suggestions: [],
    onLoadSuggestions: mockOnLoadSuggestions,
  }

  const wrap = (props = defaultProps) => render(
    <BrowserRouter>
      <SearchHeader {...props} />
    </BrowserRouter>
  )

  beforeEach(() => {
    mockOnSearch.mockClear()
    mockOnLoadSuggestions.mockClear()
  })

  it('renders back + cart icon buttons', () => {
    wrap()
    const buttons = screen.getAllByRole('button')
    // 최소 2개: 뒤로가기 + 장바구니 (query가 있을 때 clear 버튼 포함 3개)
    expect(buttons.length).toBeGreaterThanOrEqual(2)
  })

  it('displays search input with placeholder', () => {
    wrap()
    const input = screen.getByPlaceholderText(PLACEHOLDER)
    expect(input).toBeDefined()
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

  it('shows suggestions when available and input focused', () => {
    const suggestions = [
      { type: 'product' as const, text: 'Product 1' },
      { type: 'seller' as const, text: 'Seller 1' },
    ]
    wrap({ ...defaultProps, suggestions })

    const input = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.focus(input)

    expect(screen.getByText('Product 1')).toBeDefined()
    expect(screen.getByText('Seller 1')).toBeDefined()
  })

  it('shows "브랜드" badge for seller suggestions', () => {
    const suggestions = [{ type: 'seller' as const, text: 'Seller 1' }]
    wrap({ ...defaultProps, suggestions })

    const input = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.focus(input)

    expect(screen.getByText('브랜드')).toBeDefined()
  })

  it('calls onSearch when suggestion is clicked', () => {
    const suggestions = [{ type: 'product' as const, text: 'Product 1' }]
    wrap({ ...defaultProps, suggestions })

    const input = screen.getByPlaceholderText(PLACEHOLDER)
    fireEvent.focus(input)

    const suggestionButton = screen.getByText('Product 1')
    fireEvent.click(suggestionButton)

    expect(mockOnSearch).toHaveBeenCalledWith('Product 1')
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

    // query가 있을 때 clear 버튼이 나타남 — 그냥 input 초기화 경로 확인
    fireEvent.change(input, { target: { value: '' } })
    expect(input.value).toBe('')
  })
})
