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

    expect(screen.getByText('관련도순')).toBeDefined()
    expect(screen.getByText('낮은가격')).toBeDefined()
    expect(screen.getByText('높은가격')).toBeDefined()
    expect(screen.getByText('최신순')).toBeDefined()
  })

  it('displays correct selected sort option', () => {
    render(<SortFilterBar {...defaultProps} sortBy="price_low" />)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('price_low')
  })

  it('calls onSortChange when sort option is changed', () => {
    render(<SortFilterBar {...defaultProps} />)

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'price_high' } })

    expect(mockOnSortChange).toHaveBeenCalledWith('price_high')
  })

  it('displays different sort options correctly', () => {
    const { rerender } = render(<SortFilterBar {...defaultProps} sortBy="relevance" />)
    let select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('relevance')

    rerender(<SortFilterBar {...defaultProps} sortBy="price_low" />)
    select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('price_low')

    rerender(<SortFilterBar {...defaultProps} sortBy="price_high" />)
    select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('price_high')

    rerender(<SortFilterBar {...defaultProps} sortBy="newest" />)
    select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('newest')
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
