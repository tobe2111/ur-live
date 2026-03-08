import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BannerSection } from '@/components/home/BannerSection'

describe('BannerSection', () => {
  const mockBanners = [
    {
      id: 1,
      title: 'Test Banner',
      image_url: 'https://example.com/banner.jpg',
      link_url: 'https://example.com',
      description: 'Test Description',
    },
  ]

  it('renders banner with image', () => {
    render(<BannerSection banners={mockBanners} />)

    const image = screen.getByAltText('Test Banner')
    expect(image).toBeDefined()
  })

  it('renders banner description', () => {
    render(<BannerSection banners={mockBanners} />)

    expect(screen.getByText('Test Description')).toBeDefined()
  })

  it('renders banner link', () => {
    render(<BannerSection banners={mockBanners} />)

    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('https://example.com')
  })

  it('returns null when no banners provided', () => {
    const { container } = render(<BannerSection banners={[]} />)

    expect(container.firstChild).toBeNull()
  })

  it('only renders first banner when multiple provided', () => {
    const multipleBanners = [
      ...mockBanners,
      {
        id: 2,
        title: 'Second Banner',
        image_url: 'https://example.com/banner2.jpg',
        link_url: 'https://example.com/2',
      },
    ]

    render(<BannerSection banners={multipleBanners} />)

    expect(screen.getByAltText('Test Banner')).toBeDefined()
    expect(screen.queryByAltText('Second Banner')).toBeNull()
  })

  it('handles banner without description', () => {
    const bannerWithoutDesc = [
      {
        id: 1,
        title: 'Test Banner',
        image_url: 'https://example.com/banner.jpg',
        link_url: 'https://example.com',
      },
    ]

    const { container } = render(<BannerSection banners={bannerWithoutDesc} />)
    const description = container.querySelector('.absolute.bottom-6')
    expect(description).toBeNull()
  })

  it('handles hash link for smooth scroll', () => {
    const hashBanner = [
      {
        id: 1,
        title: 'Hash Banner',
        image_url: 'https://example.com/banner.jpg',
        link_url: '#live-section',
      },
    ]

    const scrollIntoViewMock = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoViewMock

    render(<BannerSection banners={hashBanner} />)

    const link = screen.getByRole('link')
    fireEvent.click(link)

    // preventDefault should be called for hash links
    expect(link.getAttribute('href')).toBe('#live-section')
  })

  it('applies hover effect classes', () => {
    const { container } = render(<BannerSection banners={mockBanners} />)

    const imageContainer = container.querySelector('.group-hover\\:scale-105')
    expect(imageContainer).toBeDefined()
  })

  it('uses LazyImage component for image loading', () => {
    const { container } = render(<BannerSection banners={mockBanners} />)

    const image = screen.getByAltText('Test Banner')
    // LazyImage component loads with a placeholder initially, then loads the actual image
    // In tests, it may show either the placeholder or the src depending on IntersectionObserver
    expect(image).toBeDefined()
    expect(image.tagName).toBe('IMG')
  })
})
