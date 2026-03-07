import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BannerSection } from '@/components/home/BannerSection'

describe('BannerSection', () => {
  const mockBanners = [
    {
      id: 1,
      image_url: 'https://example.com/banner.jpg',
      link_url: '/products/1',
      title: 'Test Banner',
      description: 'Test Description'
    }
  ]

  it('renders banner with image', () => {
    render(<BannerSection banners={mockBanners} />)

    const image = screen.getByRole('img')
    expect(image).toBeDefined()
    expect(image.getAttribute('alt')).toBe(mockBanners[0].title)
  })

  it('renders banner description when provided', () => {
    render(<BannerSection banners={mockBanners} />)

    expect(screen.getByText(mockBanners[0].description as string)).toBeDefined()
  })

  it('handles link correctly', () => {
    render(<BannerSection banners={mockBanners} />)

    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe(mockBanners[0].link_url)
  })

  it('does not render when banners array is empty', () => {
    const { container } = render(<BannerSection banners={[]} />)

    expect(container.firstChild).toBeNull()
  })

  it('renders only the first banner when multiple provided', () => {
    const multipleBanners = [
      ...mockBanners,
      {
        id: 2,
        image_url: 'https://example.com/banner2.jpg',
        link_url: '/products/2',
        title: 'Test Banner 2',
        description: 'Test Description 2'
      }
    ]

    render(<BannerSection banners={multipleBanners} />)

    // Should only show first banner's description
    expect(screen.getByText(mockBanners[0].description as string)).toBeDefined()
    expect(screen.queryByText('Test Description 2')).toBeNull()
  })

  it('handles banner without description', () => {
    const bannerWithoutDesc = [
      {
        ...mockBanners[0],
        description: undefined
      }
    ]

    render(<BannerSection banners={bannerWithoutDesc} />)

    const image = screen.getByRole('img')
    expect(image).toBeDefined()
  })

  it('applies correct styling classes', () => {
    const { container } = render(<BannerSection banners={mockBanners} />)

    const section = container.querySelector('section')
    expect(section?.classList.contains('relative')).toBe(true)
    expect(section?.classList.contains('w-full')).toBe(true)
    expect(section?.classList.contains('bg-white')).toBe(true)
  })
})
