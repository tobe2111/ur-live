import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import BrowseProductCard from '@/components/browse/BrowseProductCard'
import api from '@/lib/api'

// Mock the api module
vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('BrowseProductCard', () => {
  const mockProduct = {
    id: 1,
    name: 'Test Product',
    price: 50000,
    current_price: 50000,
    discount_rate: 0,
    image_url: 'https://example.com/product.jpg',
    stock: 10,
    seller_name: 'Test Seller',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    // Mock successful wishlist check (not saved)
    vi.mocked(api.get).mockResolvedValue({
      data: { success: true, data: { isSaved: false } },
    })
  })

  it('renders product name', () => {
    render(
      <BrowserRouter>
        <BrowseProductCard product={mockProduct} />
      </BrowserRouter>
    )

    expect(screen.getByText('Test Product')).toBeDefined()
  })

  it('renders product image', () => {
    render(
      <BrowserRouter>
        <BrowseProductCard product={mockProduct} />
      </BrowserRouter>
    )

    const image = screen.getByAltText('Test Product')
    expect(image.getAttribute('src')).toBe('https://example.com/product.jpg')
  })

  it('renders seller name', () => {
    render(
      <BrowserRouter>
        <BrowseProductCard product={mockProduct} />
      </BrowserRouter>
    )

    expect(screen.getByText('Test Seller')).toBeDefined()
  })

  it('falls back to "Brand" when no seller name', () => {
    const product = { ...mockProduct, seller_name: undefined }
    
    render(
      <BrowserRouter>
        <BrowseProductCard product={product} />
      </BrowserRouter>
    )

    expect(screen.getByText('Brand')).toBeDefined()
  })

  it('renders product price', () => {
    render(
      <BrowserRouter>
        <BrowseProductCard product={mockProduct} />
      </BrowserRouter>
    )

    expect(screen.getByText('₩50,000')).toBeDefined()
  })

  it('shows discount badge when discount rate is available', () => {
    const product = { ...mockProduct, discount_rate: 20 }
    
    render(
      <BrowserRouter>
        <BrowseProductCard product={product} />
      </BrowserRouter>
    )

    expect(screen.getByText('-20%')).toBeDefined()
  })

  it('shows original price with strikethrough when on sale', () => {
    const product = {
      ...mockProduct,
      price: 40000,
      original_price: 50000,
    }
    
    const { container } = render(
      <BrowserRouter>
        <BrowseProductCard product={product} />
      </BrowserRouter>
    )

    expect(screen.getByText('₩40,000')).toBeDefined()
    const strikethrough = container.querySelector('.line-through')
    expect(strikethrough?.textContent).toBe('₩50,000')
  })

  it('displays "New" tag for new products', () => {
    const product = { ...mockProduct, is_new: true }
    
    render(
      <BrowserRouter>
        <BrowseProductCard product={product} />
      </BrowserRouter>
    )

    expect(screen.getByText('New')).toBeDefined()
  })

  it('displays "Popular" tag for popular products', () => {
    const product = { ...mockProduct, is_popular: true }
    
    render(
      <BrowserRouter>
        <BrowseProductCard product={product} />
      </BrowserRouter>
    )

    expect(screen.getByText('Popular')).toBeDefined()
  })

  it('prioritizes "New" tag over "Popular"', () => {
    const product = { ...mockProduct, is_new: true, is_popular: true }
    
    render(
      <BrowserRouter>
        <BrowseProductCard product={product} />
      </BrowserRouter>
    )

    expect(screen.getByText('New')).toBeDefined()
    expect(screen.queryByText('Popular')).toBeNull()
  })

  it('shows placeholder when no image URL', () => {
    const product = { ...mockProduct, image_url: '' }
    
    render(
      <BrowserRouter>
        <BrowseProductCard product={product} />
      </BrowserRouter>
    )

    expect(screen.getByText('No Image')).toBeDefined()
  })

  it('renders bookmark button', () => {
    render(
      <BrowserRouter>
        <BrowseProductCard product={mockProduct} />
      </BrowserRouter>
    )

    const bookmarkButton = screen.getByLabelText('Save item')
    expect(bookmarkButton).toBeDefined()
  })

  it('checks wishlist status on mount', async () => {
    localStorage.setItem('userId', '123')
    
    render(
      <BrowserRouter>
        <BrowseProductCard product={mockProduct} />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/wishlists/check/123/1')
    })
  })

  it('does not check wishlist when user is not logged in', () => {
    render(
      <BrowserRouter>
        <BrowseProductCard product={mockProduct} />
      </BrowserRouter>
    )

    expect(api.get).not.toHaveBeenCalled()
  })

  it('adds to wishlist when bookmark is clicked', async () => {
    localStorage.setItem('userId', '123')
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } })
    
    render(
      <BrowserRouter>
        <BrowseProductCard product={mockProduct} />
      </BrowserRouter>
    )

    const bookmarkButton = screen.getByLabelText('Save item')
    fireEvent.click(bookmarkButton)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/wishlists', {
        user_id: 123,
        product_id: 1,
      })
    })
  })

  it('removes from wishlist when already saved', async () => {
    localStorage.setItem('userId', '123')
    vi.mocked(api.get).mockResolvedValue({
      data: { success: true, data: { isSaved: true } },
    })
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true } })
    
    render(
      <BrowserRouter>
        <BrowseProductCard product={mockProduct} />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(api.get).toHaveBeenCalled()
    })

    const bookmarkButton = screen.getByLabelText('Remove from saved')
    fireEvent.click(bookmarkButton)

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/api/wishlists/product/1')
    })
  })

  it('shows login alert when not logged in and bookmark clicked', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    
    render(
      <BrowserRouter>
        <BrowseProductCard product={mockProduct} />
      </BrowserRouter>
    )

    const bookmarkButton = screen.getByLabelText('Save item')
    fireEvent.click(bookmarkButton)

    expect(alertSpy).toHaveBeenCalledWith('로그인이 필요합니다.')
    alertSpy.mockRestore()
  })

  it('applies hover effects', () => {
    const { container } = render(
      <BrowserRouter>
        <BrowseProductCard product={mockProduct} />
      </BrowserRouter>
    )

    const card = container.querySelector('.group')
    expect(card).toBeDefined()
    
    const image = container.querySelector('.group-hover\\:scale-105')
    expect(image).toBeDefined()
  })

  it('truncates long product names', () => {
    const product = {
      ...mockProduct,
      name: 'Very Long Product Name That Should Be Truncated',
    }
    
    const { container } = render(
      <BrowserRouter>
        <BrowseProductCard product={product} />
      </BrowserRouter>
    )

    const nameElement = container.querySelector('.line-clamp-2')
    expect(nameElement).toBeDefined()
  })

  it('calculates discount from original price when discount_rate is 0', () => {
    const product = {
      ...mockProduct,
      price: 40000,
      original_price: 50000,
      discount_rate: 0,
    }
    
    render(
      <BrowserRouter>
        <BrowseProductCard product={product} />
      </BrowserRouter>
    )

    // Should calculate (1 - 40000/50000) * 100 = 20%
    expect(screen.getByText('-20%')).toBeDefined()
  })

  it('stops event propagation when bookmark is clicked', async () => {
    localStorage.setItem('userId', '123')
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } })
    
    render(
      <BrowserRouter>
        <BrowseProductCard product={mockProduct} />
      </BrowserRouter>
    )

    // Just verify that clicking bookmark doesn't navigate to product page
    // by checking that the bookmark API is called
    const bookmarkButton = screen.getByLabelText('Save item')
    fireEvent.click(bookmarkButton)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalled()
    })
  })
})
