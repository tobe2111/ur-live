import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SearchStates from '@/components/search/SearchStates'

/**
 * 🔀 2026-09-04: 인기 검색어가 **공유 훅**(`usePopularSearches`, react-query)으로 바뀌면서
 *   이 컴포넌트가 QueryClient 를 요구하게 됐다. 앱은 최상위에 provider 를 두므로 실제 동작은
 *   같고, **테스트 쪽 렌더 환경만** 실제와 맞춘다.
 *   `retry: false` — 네트워크가 없는 테스트에서 재시도로 시간을 끌지 않게.
 */
const renderWithQuery = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(<QueryClientProvider client={qc}><BrowserRouter>{ui}</BrowserRouter></QueryClientProvider>)
}

describe('SearchStates', () => {
  beforeEach(() => {
    // Clear any mocks between tests
    vi.clearAllMocks()
  })

  it('renders loading state', () => {
    renderWithQuery(
        <SearchStates loading={true} error="" query="test" hasResults={false} />
    )

    expect(screen.getAllByText('검색 중').length).toBeGreaterThan(0)
  })

  it('renders loading spinner in loading state', () => {
    const { container } = renderWithQuery(
        <SearchStates loading={true} error="" query="test" hasResults={false} />
    )

    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeDefined()
  })

  it('renders error state with error message', () => {
    renderWithQuery(
        <SearchStates loading={false} error="Network error" query="test" hasResults={false} />
    )

    expect(screen.getByText('오류가 발생했습니다')).toBeDefined()
    expect(screen.getByText('Network error')).toBeDefined()
  })

  it('renders error state with home button', () => {
    renderWithQuery(
        <SearchStates loading={false} error="Error" query="test" hasResults={false} />
    )

    const homeButton = screen.getByText('홈으로 돌아가기')
    expect(homeButton).toBeDefined()
  })

  it('renders no query state', () => {
    renderWithQuery(
        <SearchStates loading={false} error="" query="" hasResults={false} />
    )

    expect(screen.getByText('검색어를 입력해주세요')).toBeDefined()
    expect(screen.getByText('상품명 또는 판매자명으로 검색할 수 있습니다')).toBeDefined()
  })

  it('renders no results state', () => {
    // 🛡️ 2026-05-19: 새 디자인 — '검색 결과가 없습니다' → "'{query}' 검색 결과가 없어요"
    //   + 다른 검색어 시도 안내 + (실제 사용 시) 인기 검색어 / 오타 보정 제안.
    renderWithQuery(
        <SearchStates loading={false} error="" query="test query" hasResults={false} />
    )

    expect(screen.getByText(/검색 결과가 없어요/)).toBeDefined()
    expect(screen.getByText('다른 검색어를 시도해보세요')).toBeDefined()
  })

  it('renders no results state without redundant home button', () => {
    // 🛡️ 2026-05-19: '홈으로 돌아가기' 버튼 제거 (BottomNav 가 항상 보이므로 불필요).
    //   대신 인기 검색어 + 오타 보정 제안으로 사용자 액션 유도.
    renderWithQuery(
        <SearchStates loading={false} error="" query="test" hasResults={false} />
    )
    // 이전 '홈으로 돌아가기' 버튼 — 없어야 함 (BottomNav 와 중복).
    expect(screen.queryByText('홈으로 돌아가기')).toBeNull()
  })

  it('returns null when there are results', () => {
    const { container } = renderWithQuery(
        <SearchStates loading={false} error="" query="test" hasResults={true} />
    )

    expect(container.firstChild).toBeNull()
  })

  it('prioritizes loading state over other states', () => {
    renderWithQuery(
        <SearchStates loading={true} error="Error" query="test" hasResults={true} />
    )

    expect(screen.getAllByText('검색 중').length).toBeGreaterThan(0)
    expect(screen.queryByText('오류가 발생했습니다')).toBeNull()
  })

  it('prioritizes error state over no query state', () => {
    renderWithQuery(
        <SearchStates loading={false} error="Error occurred" query="" hasResults={false} />
    )

    expect(screen.getByText('오류가 발생했습니다')).toBeDefined()
    expect(screen.queryByText('검색어를 입력해주세요')).toBeNull()
  })

  it('has correct icon in no query state', () => {
    const { container } = renderWithQuery(
        <SearchStates loading={false} error="" query="" hasResults={false} />
    )

    const icon = container.querySelector('.w-16.h-16')
    expect(icon).toBeDefined()
  })

  it('has correct icon in no results state', () => {
    const { container } = renderWithQuery(
        <SearchStates loading={false} error="" query="test" hasResults={false} />
    )

    const icon = container.querySelector('.w-16.h-16')
    expect(icon).toBeDefined()
  })

  it('has correct icon in error state', () => {
    const { container } = renderWithQuery(
        <SearchStates loading={false} error="Error" query="test" hasResults={false} />
    )

    const iconContainer = container.querySelector('.bg-\\[\\#ff3b30\\]\\/10')
    expect(iconContainer).toBeDefined()
  })
})
