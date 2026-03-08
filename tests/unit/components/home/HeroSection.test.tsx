import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { HeroSection } from '@/components/home/HeroSection'

describe('HeroSection', () => {
  const mockOnShopNowClick = vi.fn()

  beforeEach(() => {
    mockOnShopNowClick.mockClear()
  })

  it('renders hero section with headline', () => {
    render(
      <BrowserRouter>
        <HeroSection liveStreamCount={5} onShopNowClick={mockOnShopNowClick} />
      </BrowserRouter>
    )

    expect(screen.getByText('누구나 쉽고')).toBeDefined()
    expect(screen.getByText('간편하게')).toBeDefined()
    expect(screen.getByText('라이브 커머스 시작')).toBeDefined()
  })

  it('renders subheadline text', () => {
    render(
      <BrowserRouter>
        <HeroSection liveStreamCount={5} onShopNowClick={mockOnShopNowClick} />
      </BrowserRouter>
    )

    // Check for both parts of the subheadline - find the p element specifically
    const subheadline = screen.getAllByText((_, element) => {
      const text = element?.textContent || ''
      return element?.tagName === 'P' && 
             text.includes('YouTube & TikTok 영상으로') && 
             text.includes('보는 순간 바로 구매!')
    })
    expect(subheadline.length).toBeGreaterThan(0)
  })

  it('renders eyebrow badge', () => {
    render(
      <BrowserRouter>
        <HeroSection liveStreamCount={5} onShopNowClick={mockOnShopNowClick} />
      </BrowserRouter>
    )

    expect(screen.getByText('새로운 쇼핑 경험')).toBeDefined()
  })

  it('renders CTA button for shopping', () => {
    render(
      <BrowserRouter>
        <HeroSection liveStreamCount={5} onShopNowClick={mockOnShopNowClick} />
      </BrowserRouter>
    )

    const ctaButton = screen.getByText('영상 쇼핑 시작하기')
    expect(ctaButton).toBeDefined()
    expect(ctaButton.tagName).toBe('SPAN')
  })

  it('renders seller CTA link', () => {
    render(
      <BrowserRouter>
        <HeroSection liveStreamCount={5} onShopNowClick={mockOnShopNowClick} />
      </BrowserRouter>
    )

    const sellerLink = screen.getByText('판매자 시작하기')
    expect(sellerLink).toBeDefined()
  })

  it('displays live stream count stat', () => {
    render(
      <BrowserRouter>
        <HeroSection liveStreamCount={10} onShopNowClick={mockOnShopNowClick} />
      </BrowserRouter>
    )

    expect(screen.getByText('10')).toBeDefined()
    expect(screen.getByText('라이브 진행 중')).toBeDefined()
  })

  it('displays user count stat', () => {
    render(
      <BrowserRouter>
        <HeroSection liveStreamCount={5} onShopNowClick={mockOnShopNowClick} />
      </BrowserRouter>
    )

    expect(screen.getByText('1,000+')).toBeDefined()
    expect(screen.getByText('활성 사용자')).toBeDefined()
  })

  it('displays transaction count stat', () => {
    render(
      <BrowserRouter>
        <HeroSection liveStreamCount={5} onShopNowClick={mockOnShopNowClick} />
      </BrowserRouter>
    )

    expect(screen.getByText('5,000+')).toBeDefined()
    expect(screen.getByText('성공 거래')).toBeDefined()
  })

  it('calls onShopNowClick when CTA button is clicked', () => {
    render(
      <BrowserRouter>
        <HeroSection liveStreamCount={5} onShopNowClick={mockOnShopNowClick} />
      </BrowserRouter>
    )

    const ctaButton = screen.getByRole('button', { name: /영상 쇼핑 시작하기/i })
    fireEvent.click(ctaButton)

    expect(mockOnShopNowClick).toHaveBeenCalledTimes(1)
  })

  it('renders illustration section on large screens', () => {
    render(
      <BrowserRouter>
        <HeroSection liveStreamCount={5} onShopNowClick={mockOnShopNowClick} />
      </BrowserRouter>
    )

    expect(screen.getByText('영상 쇼핑')).toBeDefined()
    expect(screen.getByText('보는 순간 바로 구매')).toBeDefined()
  })

  it('handles zero stream count', () => {
    render(
      <BrowserRouter>
        <HeroSection liveStreamCount={0} onShopNowClick={mockOnShopNowClick} />
      </BrowserRouter>
    )

    expect(screen.getByText('0')).toBeDefined()
    expect(screen.getByText('라이브 진행 중')).toBeDefined()
  })

  it('seller CTA links to seller login', () => {
    render(
      <BrowserRouter>
        <HeroSection liveStreamCount={5} onShopNowClick={mockOnShopNowClick} />
      </BrowserRouter>
    )

    const sellerLink = screen.getByRole('link', { name: /판매자 시작하기/i })
    expect(sellerLink.getAttribute('href')).toBe('/seller/login')
  })

  it('applies correct gradient background', () => {
    const { container } = render(
      <BrowserRouter>
        <HeroSection liveStreamCount={5} onShopNowClick={mockOnShopNowClick} />
      </BrowserRouter>
    )

    const section = container.querySelector('section')
    expect(section?.classList.contains('bg-gradient-to-br')).toBe(true)
  })
})
