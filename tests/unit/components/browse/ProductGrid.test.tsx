import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import ProductGrid from '@/components/browse/ProductGrid'

describe('ProductGrid', () => {
  const mockProducts = [
    {
      id: 1,
      name: 'Product 1',
      price: 10000,
      current_price: 10000,
      discount_rate: 0,
      image_url: 'https://example.com/1.jpg',
      stock: 10,
    },
    {
      id: 2,
      name: 'Product 2',
      price: 20000,
      current_price: 20000,
      discount_rate: 10,
      image_url: 'https://example.com/2.jpg',
      stock: 5,
    },
  ]

  it('renders loading state with skeleton placeholders', () => {
    const { container } = render(<ProductGrid products={[]} loading={true} />)

    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders 6 skeleton items when loading', () => {
    const { container } = render(<ProductGrid products={[]} loading={true} />)

    const skeletonItems = container.querySelectorAll('.space-y-2')
    expect(skeletonItems.length).toBe(6)
  })

  it('renders empty state when no products', () => {
    render(
      <BrowserRouter>
        <ProductGrid products={[]} loading={false} />
      </BrowserRouter>
    )

    expect(screen.getByText('해당 카테고리에 상품이 없습니다.')).toBeDefined()
  })

  it('displays shopping bag icon in empty state', () => {
    const { container } = render(
      <BrowserRouter>
        <ProductGrid products={[]} loading={false} />
      </BrowserRouter>
    )

    const icon = container.querySelector('.h-12.w-12')
    expect(icon).toBeDefined()
  })

  it('renders product grid with products', () => {
    render(
      <BrowserRouter>
        <ProductGrid products={mockProducts} loading={false} />
      </BrowserRouter>
    )

    expect(screen.getByText('Product 1')).toBeDefined()
    expect(screen.getByText('Product 2')).toBeDefined()
  })

  it('uses 2-column layout on mobile', () => {
    const { container } = render(
      <BrowserRouter>
        <ProductGrid products={mockProducts} loading={false} />
      </BrowserRouter>
    )

    const grid = container.querySelector('.grid')
    expect(grid?.classList.contains('grid-cols-2')).toBe(true)
  })

  it('uses 3-column layout on desktop', () => {
    const { container } = render(
      <BrowserRouter>
        <ProductGrid products={mockProducts} loading={false} />
      </BrowserRouter>
    )

    const grid = container.querySelector('.grid')
    expect(grid?.classList.contains('sm:grid-cols-3')).toBe(true)
  })

  it('applies correct gap spacing', () => {
    const { container } = render(
      <BrowserRouter>
        <ProductGrid products={mockProducts} loading={false} />
      </BrowserRouter>
    )

    const grid = container.querySelector('.grid')
    expect(grid?.classList.contains('gap-x-3')).toBe(true)
    expect(grid?.classList.contains('gap-y-6')).toBe(true)
  })

  it('renders correct number of products', () => {
    render(
      <BrowserRouter>
        <ProductGrid products={mockProducts} loading={false} />
      </BrowserRouter>
    )

    const product1 = screen.getByText('Product 1')
    const product2 = screen.getByText('Product 2')
    expect(product1).toBeDefined()
    expect(product2).toBeDefined()
  })

  it('does not show empty state when loading', () => {
    render(
      <BrowserRouter>
        <ProductGrid products={[]} loading={true} />
      </BrowserRouter>
    )

    expect(screen.queryByText('해당 카테고리에 상품이 없습니다.')).toBeNull()
  })

  it('does not show loading state when products exist', () => {
    const { container } = render(
      <BrowserRouter>
        <ProductGrid products={mockProducts} loading={false} />
      </BrowserRouter>
    )

    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBe(0)
  })

  it('handles single product', () => {
    render(
      <BrowserRouter>
        <ProductGrid products={[mockProducts[0]]} loading={false} />
      </BrowserRouter>
    )

    expect(screen.getByText('Product 1')).toBeDefined()
    expect(screen.queryByText('Product 2')).toBeNull()
  })

  it('handles many products', () => {
    const manyProducts = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      name: `Product ${i}`,
      price: 10000,
      current_price: 10000,
      discount_rate: 0,
      image_url: `https://example.com/${i}.jpg`,
      stock: 10,
    }))

    render(
      <BrowserRouter>
        <ProductGrid products={manyProducts} loading={false} />
      </BrowserRouter>
    )

    expect(screen.getByText('Product 0')).toBeDefined()
    expect(screen.getByText('Product 19')).toBeDefined()
  })
})
