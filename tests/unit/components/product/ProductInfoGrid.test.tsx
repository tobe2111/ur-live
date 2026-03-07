import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProductInfoGrid } from '@/components/product/ProductInfoGrid'

describe('ProductInfoGrid', () => {
  const mockItems = [
    { label: '판매자', value: 'Test Seller' },
    { label: '재고', value: 50 },
    { label: '판매량', value: 100 },
    { label: '카테고리', value: '패션' },
  ]

  it('renders all items', () => {
    render(<ProductInfoGrid items={mockItems} />)

    expect(screen.getByText('판매자')).toBeDefined()
    expect(screen.getByText('Test Seller')).toBeDefined()
    expect(screen.getByText('재고')).toBeDefined()
    expect(screen.getByText('50')).toBeDefined()
    expect(screen.getByText('판매량')).toBeDefined()
    expect(screen.getByText('100')).toBeDefined()
    expect(screen.getByText('카테고리')).toBeDefined()
    expect(screen.getByText('패션')).toBeDefined()
  })

  it('renders with empty items array', () => {
    const { container } = render(<ProductInfoGrid items={[]} />)

    const items = container.querySelectorAll('.flex.items-center.justify-between')
    expect(items.length).toBe(0)
  })

  it('renders single item', () => {
    const singleItem = [{ label: '판매자', value: 'Single Seller' }]
    
    render(<ProductInfoGrid items={singleItem} />)

    expect(screen.getByText('판매자')).toBeDefined()
    expect(screen.getByText('Single Seller')).toBeDefined()
  })

  it('handles numeric values', () => {
    const numericItems = [
      { label: '가격', value: 50000 },
      { label: '재고', value: 0 },
    ]
    
    render(<ProductInfoGrid items={numericItems} />)

    expect(screen.getByText('50000')).toBeDefined()
    expect(screen.getByText('0')).toBeDefined()
  })

  it('handles string values', () => {
    const stringItems = [
      { label: 'Brand', value: 'Nike' },
      { label: 'Size', value: 'Large' },
    ]
    
    render(<ProductInfoGrid items={stringItems} />)

    expect(screen.getByText('Nike')).toBeDefined()
    expect(screen.getByText('Large')).toBeDefined()
  })

  it('applies correct styling to labels', () => {
    const { container } = render(<ProductInfoGrid items={mockItems} />)

    const labels = container.querySelectorAll('.text-xs.text-muted-foreground')
    expect(labels.length).toBeGreaterThan(0)
  })

  it('applies correct styling to values', () => {
    const { container } = render(<ProductInfoGrid items={mockItems} />)

    const values = container.querySelectorAll('.text-xs.font-medium.text-foreground')
    expect(values.length).toBeGreaterThan(0)
  })

  it('uses flexbox layout for items', () => {
    const { container } = render(<ProductInfoGrid items={mockItems} />)

    const items = container.querySelectorAll('.flex.items-center.justify-between')
    expect(items.length).toBe(mockItems.length)
  })

  it('applies spacing between items', () => {
    const { container } = render(<ProductInfoGrid items={mockItems} />)

    const wrapper = container.querySelector('.space-y-2\\.5')
    expect(wrapper).toBeDefined()
  })

  it('renders items in correct order', () => {
    const { container } = render(<ProductInfoGrid items={mockItems} />)

    const items = container.querySelectorAll('.flex.items-center.justify-between')
    const firstItemLabel = items[0].querySelector('.text-muted-foreground')
    const lastItemLabel = items[items.length - 1].querySelector('.text-muted-foreground')

    expect(firstItemLabel?.textContent).toBe('판매자')
    expect(lastItemLabel?.textContent).toBe('카테고리')
  })

  it('handles long text values', () => {
    const longTextItems = [
      { 
        label: '설명', 
        value: 'This is a very long description that should be displayed properly without breaking the layout' 
      },
    ]
    
    render(<ProductInfoGrid items={longTextItems} />)

    expect(screen.getByText(/This is a very long description/)).toBeDefined()
  })

  it('handles special characters in values', () => {
    const specialItems = [
      { label: '가격', value: '₩50,000' },
      { label: '할인율', value: '20%' },
      { label: '평점', value: '★★★★☆' },
    ]
    
    render(<ProductInfoGrid items={specialItems} />)

    expect(screen.getByText('₩50,000')).toBeDefined()
    expect(screen.getByText('20%')).toBeDefined()
    expect(screen.getByText('★★★★☆')).toBeDefined()
  })

  it('renders many items correctly', () => {
    const manyItems = Array.from({ length: 10 }, (_, i) => ({
      label: `Label ${i}`,
      value: `Value ${i}`,
    }))
    
    render(<ProductInfoGrid items={manyItems} />)

    expect(screen.getByText('Label 0')).toBeDefined()
    expect(screen.getByText('Value 9')).toBeDefined()
  })

  it('handles mixed numeric and string values', () => {
    const mixedItems = [
      { label: 'Name', value: 'Product' },
      { label: 'Price', value: 1000 },
      { label: 'Category', value: 'Electronics' },
      { label: 'Stock', value: 5 },
    ]
    
    render(<ProductInfoGrid items={mixedItems} />)

    expect(screen.getByText('Product')).toBeDefined()
    expect(screen.getByText('1000')).toBeDefined()
    expect(screen.getByText('Electronics')).toBeDefined()
    expect(screen.getByText('5')).toBeDefined()
  })
})
