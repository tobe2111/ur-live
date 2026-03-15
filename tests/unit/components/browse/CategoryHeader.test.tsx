import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CategoryHeader from '@/components/browse/CategoryHeader'

describe('CategoryHeader', () => {
  it('renders category name and product count', () => {
    render(<CategoryHeader category="fashion" productCount={25} />)

    expect(screen.getByText('패션 상품')).toBeDefined()
    expect(screen.getByText('25개의 상품')).toBeDefined()
  })

  it('displays all categories label', () => {
    render(<CategoryHeader category="all" productCount={100} />)

    expect(screen.getByText('전체 상품')).toBeDefined()
  })

  it('displays fashion category', () => {
    render(<CategoryHeader category="fashion" productCount={20} />)

    expect(screen.getByText('패션 상품')).toBeDefined()
  })

  it('displays beauty category', () => {
    render(<CategoryHeader category="beauty" productCount={15} />)

    expect(screen.getByText('뷰티 상품')).toBeDefined()
  })

  it('displays food category', () => {
    render(<CategoryHeader category="food" productCount={30} />)

    expect(screen.getByText('식품 상품')).toBeDefined()
  })

  it('displays electronics category', () => {
    render(<CategoryHeader category="electronics" productCount={12} />)

    expect(screen.getByText('전자제품 상품')).toBeDefined()
  })

  it('displays lifestyle category', () => {
    render(<CategoryHeader category="lifestyle" productCount={18} />)

    expect(screen.getByText('라이프스타일 상품')).toBeDefined()
  })

  it('displays home category', () => {
    render(<CategoryHeader category="home" productCount={22} />)

    expect(screen.getByText('홈/리빙 상품')).toBeDefined()
  })

  it('displays sports category', () => {
    render(<CategoryHeader category="sports" productCount={14} />)

    expect(screen.getByText('스포츠 상품')).toBeDefined()
  })

  it('falls back to "기타" for unknown category', () => {
    render(<CategoryHeader category="unknown" productCount={5} />)

    // getCategoryLabel returns '기타' for unmapped categories (not '전체')
    expect(screen.getByText('기타 상품')).toBeDefined()
  })

  it('handles zero product count', () => {
    render(<CategoryHeader category="fashion" productCount={0} />)

    expect(screen.getByText('0개의 상품')).toBeDefined()
  })

  it('handles large product count', () => {
    render(<CategoryHeader category="all" productCount={1500} />)

    expect(screen.getByText('1500개의 상품')).toBeDefined()
  })

  it('applies correct styling classes', () => {
    const { container } = render(<CategoryHeader category="fashion" productCount={10} />)

    const heading = container.querySelector('h1')
    expect(heading?.classList.contains('text-2xl')).toBe(true)
    expect(heading?.classList.contains('font-bold')).toBe(true)
  })

  it('displays product count with correct styling', () => {
    const { container } = render(<CategoryHeader category="fashion" productCount={10} />)

    const count = container.querySelector('p')
    expect(count?.classList.contains('text-sm')).toBe(true)
  })
})
