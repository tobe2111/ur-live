import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SortFilterBar from '@/components/search/SortFilterBar'

describe('SortFilterBar', () => {
  const mockOnSortChange = vi.fn()

  const defaultProps = {
    totalResults: 25,
    sortBy: 'relevance' as const,
    onSortChange: mockOnSortChange,
  }

  beforeEach(() => {
    mockOnSortChange.mockClear()
  })

  it('renders total results count', () => {
    render(<SortFilterBar {...defaultProps} />)

    expect(screen.getByText('25')).toBeDefined()
    expect(screen.getByText('총')).toBeDefined()
    expect(screen.getByText('개')).toBeDefined()
  })

  it('renders sort select with all options', () => {
    render(<SortFilterBar {...defaultProps} />)

    const select = screen.getByRole('combobox')
    expect(select).toBeDefined()

    fireEvent.click(select)
    expect(screen.getAllByText('관련도순').length).toBeGreaterThan(0)
    expect(screen.getByText('낮은가격')).toBeDefined()
    expect(screen.getByText('높은가격')).toBeDefined()
    expect(screen.getByText('최신순')).toBeDefined()
  })

  // 🪟 2026-11-04: 기본 <select> → 유어딜 <Select>(버튼 + 유리 목록). 값은 버튼 글로 보이고, 고르기는 목록을 눌러서.
  it('displays correct selected sort option', () => {
    render(<SortFilterBar {...defaultProps} sortBy="price_low" />)

    expect(screen.getByRole('combobox').textContent).toContain('낮은가격')
  })

  it('calls onSortChange when sort option is changed', () => {
    render(<SortFilterBar {...defaultProps} />)

    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: '높은가격' }).querySelector('button')!)

    expect(mockOnSortChange).toHaveBeenCalledWith('price_high')
  })

  it('displays different sort options correctly', () => {
    const { rerender } = render(<SortFilterBar {...defaultProps} sortBy="relevance" />)
    expect(screen.getByRole('combobox').textContent).toContain('관련도순')

    rerender(<SortFilterBar {...defaultProps} sortBy="price_high" />)
    expect(screen.getByRole('combobox').textContent).toContain('높은가격')

    rerender(<SortFilterBar {...defaultProps} sortBy="newest" />)
    expect(screen.getByRole('combobox').textContent).toContain('최신순')
  })

  it('handles zero results', () => {
    render(<SortFilterBar {...defaultProps} totalResults={0} />)

    expect(screen.getByText('0')).toBeDefined()
    expect(screen.getByText('개')).toBeDefined()
  })

  it('handles large result counts', () => {
    render(<SortFilterBar {...defaultProps} totalResults={1500} />)

    expect(screen.getByText('1500')).toBeDefined()
  })

  it('select has appearance-none and focus outline removed (custom chevron)', () => {
    render(<SortFilterBar {...defaultProps} />)

    const select = screen.getByRole('combobox')
    expect(select.className).toContain('appearance-none')
    expect(select.className).toContain('focus:outline-none')
  })

  it('has correct layout structure', () => {
    const { container } = render(<SortFilterBar {...defaultProps} />)

    const wrapper = container.querySelector('.flex.items-center.justify-between')
    expect(wrapper).toBeDefined()
  })

  it('renders filter chips row', () => {
    const { container } = render(<SortFilterBar {...defaultProps} />)

    const chipsRow = container.querySelector('.overflow-x-auto')
    expect(chipsRow).toBeDefined()
  })
})
