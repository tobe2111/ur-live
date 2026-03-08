import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import ProductCard from '@/components/search/ProductCard'

describe('ProductCard', () => {
  const baseProduct = {
    id: 1,
    name: 'Test Product',
    price: 10000,
    discount_rate: 0,
    image_url: 'https://example.com/image.jpg',
    stock: 50,
    seller_name: 'Test Seller',
    seller_username: 'testseller',
  }

  it('renders product name', () => {
    render(
      <BrowserRouter>
        <ProductCard product={baseProduct} />
      </BrowserRouter>
    )

    expect(screen.getByText('Test Product')).toBeDefined()
  })

  it('renders product image', () => {
    render(
      <BrowserRouter>
        <ProductCard product={baseProduct} />
      </BrowserRouter>
    )

    const image = screen.getByAltText('Test Product')
    expect(image.getAttribute('src')).toBe('https://example.com/image.jpg')
  })

  it('renders seller name', () => {
    render(
      <BrowserRouter>
        <ProductCard product={baseProduct} />
      </BrowserRouter>
    )

    expect(screen.getByText('Test Seller')).toBeDefined()
  })

  it('falls back to seller username when seller name is not available', () => {
    const product = { ...baseProduct, seller_name: '' }
    
    render(
      <BrowserRouter>
        <ProductCard product={product} />
      </BrowserRouter>
    )

    expect(screen.getByText('testseller')).toBeDefined()
  })

  it('renders price without discount', () => {
    render(
      <BrowserRouter>
        <ProductCard product={baseProduct} />
      </BrowserRouter>
    )

    expect(screen.getByText('10,000원')).toBeDefined()
  })

  it('renders discounted price when discount is available', () => {
    const product = { ...baseProduct, discount_rate: 20 }
    
    render(
      <BrowserRouter>
        <ProductCard product={product} />
      </BrowserRouter>
    )

    // Should show both discount rate and discounted price
    expect(screen.getAllByText('20%').length).toBeGreaterThan(0)
    expect(screen.getByText('8,000원')).toBeDefined() // 10000 * 0.8
  })

  it('shows original price with strikethrough when discounted', () => {
    const product = { ...baseProduct, discount_rate: 30 }
    
    const { container } = render(
      <BrowserRouter>
        <ProductCard product={product} />
      </BrowserRouter>
    )

    const strikethrough = container.querySelector('.line-through')
    expect(strikethrough?.textContent).toBe('10,000원')
  })

  it('displays discount badge when product has discount', () => {
    const product = { ...baseProduct, discount_rate: 15 }
    
    const { container } = render(
      <BrowserRouter>
        <ProductCard product={product} />
      </BrowserRouter>
    )

    const badge = container.querySelector('.bg-\\[\\#ff3b30\\]')
    expect(badge).toBeDefined()
  })

  it('shows out of stock overlay when stock is 0', () => {
    const product = { ...baseProduct, stock: 0 }
    
    render(
      <BrowserRouter>
        <ProductCard product={product} />
      </BrowserRouter>
    )

    expect(screen.getByText('품절')).toBeDefined()
  })

  it('does not show discount badge when stock is 0', () => {
    const product = { ...baseProduct, stock: 0, discount_rate: 20 }
    
    const { container } = render(
      <BrowserRouter>
        <ProductCard product={product} />
      </BrowserRouter>
    )

    // Should still show discount in price area but not the badge
    const badges = container.querySelectorAll('.bg-\\[\\#ff3b30\\]')
    expect(badges.length).toBe(0)
  })

  it('shows low stock warning when stock is 10 or less', () => {
    const product = { ...baseProduct, stock: 5 }
    
    render(
      <BrowserRouter>
        <ProductCard product={product} />
      </BrowserRouter>
    )

    expect(screen.getByText('재고 5개')).toBeDefined()
  })

  it('does not show low stock warning when stock is above 10', () => {
    const product = { ...baseProduct, stock: 15 }
    
    render(
      <BrowserRouter>
        <ProductCard product={product} />
      </BrowserRouter>
    )

    expect(screen.queryByText(/재고/)).toBeNull()
  })

  it('shows placeholder icon when image URL is missing', () => {
    const product = { ...baseProduct, image_url: '' }
    
    const { container } = render(
      <BrowserRouter>
        <ProductCard product={product} />
      </BrowserRouter>
    )

    const icon = container.querySelector('.w-12.h-12')
    expect(icon).toBeDefined()
  })

  it('links to correct product detail page', () => {
    render(
      <BrowserRouter>
        <ProductCard product={baseProduct} />
      </BrowserRouter>
    )

    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/product/1')
  })

  it('applies hover effects', () => {
    const { container } = render(
      <BrowserRouter>
        <ProductCard product={baseProduct} />
      </BrowserRouter>
    )

    const link = container.querySelector('.hover\\:shadow-md')
    expect(link).toBeDefined()
  })

  it('calculates discount correctly', () => {
    const product = { ...baseProduct, price: 15000, discount_rate: 25 }
    
    render(
      <BrowserRouter>
        <ProductCard product={product} />
      </BrowserRouter>
    )

    // 15000 * 0.75 = 11250
    expect(screen.getByText('11,250원')).toBeDefined()
  })

  it('handles zero price', () => {
    const product = { ...baseProduct, price: 0 }
    
    render(
      <BrowserRouter>
        <ProductCard product={product} />
      </BrowserRouter>
    )

    expect(screen.getByText('0원')).toBeDefined()
  })

  it('truncates long product names with line-clamp-2', () => {
    const product = {
      ...baseProduct,
      name: 'Very Long Product Name That Should Be Truncated To Two Lines Only',
    }
    
    const { container } = render(
      <BrowserRouter>
        <ProductCard product={product} />
      </BrowserRouter>
    )

    const nameElement = container.querySelector('.line-clamp-2')
    expect(nameElement).toBeDefined()
  })
})
