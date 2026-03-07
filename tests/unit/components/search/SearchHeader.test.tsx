import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import SearchHeader from '@/components/search/SearchHeader'

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

  beforeEach(() => {
    mockOnSearch.mockClear()
    mockOnLoadSuggestions.mockClear()
  })

  it('renders search header with back button', () => {
    render(
      <BrowserRouter>
        <SearchHeader {...defaultProps} />
      </BrowserRouter>
    )

    const backButton = screen.getByRole('button', { name: '' })
    expect(backButton).toBeDefined()
  })

  it('displays search input with placeholder', () => {
    render(
      <BrowserRouter>
        <SearchHeader {...defaultProps} />
      </BrowserRouter>
    )

    const input = screen.getByPlaceholderText('상품명 또는 판매자명 검색')
    expect(input).toBeDefined()
  })

  it('displays current query and results count', () => {
    render(
      <BrowserRouter>
        <SearchHeader {...defaultProps} />
      </BrowserRouter>
    )

    expect(screen.getByText('"test query"', { exact: false })).toBeDefined()
    expect(screen.getByText(/10개 상품/)).toBeDefined()
  })

  it('calls onSearch when form is submitted', () => {
    render(
      <BrowserRouter>
        <SearchHeader {...defaultProps} />
      </BrowserRouter>
    )

    const input = screen.getByPlaceholderText('상품명 또는 판매자명 검색')
    fireEvent.change(input, { target: { value: 'new search' } })
    fireEvent.submit(input.closest('form')!)

    expect(mockOnSearch).toHaveBeenCalledWith('new search')
  })

  it('updates input value on change', () => {
    render(
      <BrowserRouter>
        <SearchHeader {...defaultProps} />
      </BrowserRouter>
    )

    const input = screen.getByPlaceholderText('상품명 또는 판매자명 검색') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'updated query' } })

    expect(input.value).toBe('updated query')
  })

  it('shows suggestions when available', () => {
    const suggestions = [
      { type: 'product' as const, text: 'Product 1' },
      { type: 'seller' as const, text: 'Seller 1' },
    ]

    render(
      <BrowserRouter>
        <SearchHeader {...defaultProps} suggestions={suggestions} />
      </BrowserRouter>
    )

    const input = screen.getByPlaceholderText('상품명 또는 판매자명 검색')
    fireEvent.focus(input)

    expect(screen.getByText('Product 1')).toBeDefined()
    expect(screen.getByText('Seller 1')).toBeDefined()
  })

  it('displays seller badge for seller suggestions', () => {
    const suggestions = [
      { type: 'seller' as const, text: 'Seller 1' },
    ]

    render(
      <BrowserRouter>
        <SearchHeader {...defaultProps} suggestions={suggestions} />
      </BrowserRouter>
    )

    const input = screen.getByPlaceholderText('상품명 또는 판매자명 검색')
    fireEvent.focus(input)

    expect(screen.getByText('판매자')).toBeDefined()
  })

  it('calls onSearch when suggestion is clicked', () => {
    const suggestions = [
      { type: 'product' as const, text: 'Product 1' },
    ]

    render(
      <BrowserRouter>
        <SearchHeader {...defaultProps} suggestions={suggestions} />
      </BrowserRouter>
    )

    const input = screen.getByPlaceholderText('상품명 또는 판매자명 검색')
    fireEvent.focus(input)

    const suggestionButton = screen.getByText('Product 1')
    fireEvent.click(suggestionButton)

    expect(mockOnSearch).toHaveBeenCalledWith('Product 1')
  })

  it('does not call onSearch with empty query', () => {
    render(
      <BrowserRouter>
        <SearchHeader {...defaultProps} query="" />
      </BrowserRouter>
    )

    const input = screen.getByPlaceholderText('상품명 또는 판매자명 검색')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.submit(input.closest('form')!)

    expect(mockOnSearch).not.toHaveBeenCalled()
  })

  it('hides result count when totalResults is undefined', () => {
    render(
      <BrowserRouter>
        <SearchHeader {...defaultProps} totalResults={undefined} />
      </BrowserRouter>
    )

    expect(screen.queryByText(/개 상품/)).toBeNull()
  })

  it('applies focus ring on input focus', () => {
    render(
      <BrowserRouter>
        <SearchHeader {...defaultProps} />
      </BrowserRouter>
    )

    const input = screen.getByPlaceholderText('상품명 또는 판매자명 검색')
    expect(input.className).toContain('focus:ring-2')
  })
})
