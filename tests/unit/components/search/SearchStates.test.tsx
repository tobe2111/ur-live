import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import SearchStates from '@/components/search/SearchStates'

describe('SearchStates', () => {
  beforeEach(() => {
    // Clear any mocks between tests
    vi.clearAllMocks()
  })

  it('renders loading state', () => {
    render(
      <BrowserRouter>
        <SearchStates loading={true} error="" query="test" hasResults={false} />
      </BrowserRouter>
    )

    expect(screen.getByText('검색 중...')).toBeDefined()
  })

  it('renders loading spinner in loading state', () => {
    const { container } = render(
      <BrowserRouter>
        <SearchStates loading={true} error="" query="test" hasResults={false} />
      </BrowserRouter>
    )

    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeDefined()
  })

  it('renders error state with error message', () => {
    render(
      <BrowserRouter>
        <SearchStates loading={false} error="Network error" query="test" hasResults={false} />
      </BrowserRouter>
    )

    expect(screen.getByText('오류가 발생했습니다')).toBeDefined()
    expect(screen.getByText('Network error')).toBeDefined()
  })

  it('renders error state with home button', () => {
    render(
      <BrowserRouter>
        <SearchStates loading={false} error="Error" query="test" hasResults={false} />
      </BrowserRouter>
    )

    const homeButton = screen.getByText('홈으로 돌아가기')
    expect(homeButton).toBeDefined()
  })

  it('renders no query state', () => {
    render(
      <BrowserRouter>
        <SearchStates loading={false} error="" query="" hasResults={false} />
      </BrowserRouter>
    )

    expect(screen.getByText('검색어를 입력해주세요')).toBeDefined()
    expect(screen.getByText('상품명 또는 판매자명으로 검색할 수 있습니다')).toBeDefined()
  })

  it('renders no results state', () => {
    render(
      <BrowserRouter>
        <SearchStates loading={false} error="" query="test query" hasResults={false} />
      </BrowserRouter>
    )

    expect(screen.getByText('검색 결과가 없습니다')).toBeDefined()
    expect(screen.getByText('다른 검색어를 시도해보세요')).toBeDefined()
  })

  it('renders no results state with home button', () => {
    render(
      <BrowserRouter>
        <SearchStates loading={false} error="" query="test" hasResults={false} />
      </BrowserRouter>
    )

    const homeButton = screen.getByText('홈으로 돌아가기')
    expect(homeButton).toBeDefined()
  })

  it('returns null when there are results', () => {
    const { container } = render(
      <BrowserRouter>
        <SearchStates loading={false} error="" query="test" hasResults={true} />
      </BrowserRouter>
    )

    expect(container.firstChild).toBeNull()
  })

  it('prioritizes loading state over other states', () => {
    render(
      <BrowserRouter>
        <SearchStates loading={true} error="Error" query="test" hasResults={true} />
      </BrowserRouter>
    )

    expect(screen.getByText('검색 중...')).toBeDefined()
    expect(screen.queryByText('오류가 발생했습니다')).toBeNull()
  })

  it('prioritizes error state over no query state', () => {
    render(
      <BrowserRouter>
        <SearchStates loading={false} error="Error occurred" query="" hasResults={false} />
      </BrowserRouter>
    )

    expect(screen.getByText('오류가 발생했습니다')).toBeDefined()
    expect(screen.queryByText('검색어를 입력해주세요')).toBeNull()
  })

  it('has correct icon in no query state', () => {
    const { container } = render(
      <BrowserRouter>
        <SearchStates loading={false} error="" query="" hasResults={false} />
      </BrowserRouter>
    )

    const icon = container.querySelector('.w-16.h-16')
    expect(icon).toBeDefined()
  })

  it('has correct icon in no results state', () => {
    const { container } = render(
      <BrowserRouter>
        <SearchStates loading={false} error="" query="test" hasResults={false} />
      </BrowserRouter>
    )

    const icon = container.querySelector('.w-16.h-16')
    expect(icon).toBeDefined()
  })

  it('has correct icon in error state', () => {
    const { container } = render(
      <BrowserRouter>
        <SearchStates loading={false} error="Error" query="test" hasResults={false} />
      </BrowserRouter>
    )

    const iconContainer = container.querySelector('.bg-\\[\\#ff3b30\\]\\/10')
    expect(iconContainer).toBeDefined()
  })
})
