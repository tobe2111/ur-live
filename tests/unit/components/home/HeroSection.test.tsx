import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import HeroSection from '@/components/home/HeroSection'

describe('HeroSection', () => {
  const mockStreams = [
    { id: 1, title: 'Live Stream 1', youtube_video_id: 'abc123' },
    { id: 2, title: 'Live Stream 2', youtube_video_id: 'def456' },
  ]

  it('renders hero section with headline', () => {
    render(
      <BrowserRouter>
        <HeroSection streams={mockStreams} />
      </BrowserRouter>
    )

    expect(screen.getByText('누구나 쉽고 간편하게 라이브 커머스 시작')).toBeDefined()
  })

  it('renders subheadline text', () => {
    render(
      <BrowserRouter>
        <HeroSection streams={mockStreams} />
      </BrowserRouter>
    )

    expect(screen.getByText(/YouTube, TikTok에서 보고 바로 구매/)).toBeDefined()
  })

  it('renders CTA button for shopping', () => {
    render(
      <BrowserRouter>
        <HeroSection streams={mockStreams} />
      </BrowserRouter>
    )

    const ctaButton = screen.getByText('영상 쇼핑 시작하기')
    expect(ctaButton).toBeDefined()
    expect(ctaButton.tagName).toBe('BUTTON')
  })

  it('renders seller CTA link', () => {
    render(
      <BrowserRouter>
        <HeroSection streams={mockStreams} />
      </BrowserRouter>
    )

    const sellerLink = screen.getByText('판매자 시작하기')
    expect(sellerLink).toBeDefined()
  })

  it('displays stream count stat', () => {
    render(
      <BrowserRouter>
        <HeroSection streams={mockStreams} />
      </BrowserRouter>
    )

    expect(screen.getByText(`${mockStreams.length}+ 라이브 방송`)).toBeDefined()
  })

  it('displays user count stat', () => {
    render(
      <BrowserRouter>
        <HeroSection streams={mockStreams} />
      </BrowserRouter>
    )

    expect(screen.getByText('1,000+ 활성 사용자')).toBeDefined()
  })

  it('displays transaction count stat', () => {
    render(
      <BrowserRouter>
        <HeroSection streams={mockStreams} />
      </BrowserRouter>
    )

    expect(screen.getByText('5,000+ 성공 거래')).toBeDefined()
  })

  it('scrolls to live section when CTA button is clicked', () => {
    // Mock scrollIntoView
    const scrollIntoViewMock = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoViewMock

    render(
      <BrowserRouter>
        <HeroSection streams={mockStreams} />
      </BrowserRouter>
    )

    const ctaButton = screen.getByText('영상 쇼핑 시작하기')
    fireEvent.click(ctaButton)

    expect(scrollIntoViewMock).toHaveBeenCalled()
  })

  it('renders illustration section on large screens', () => {
    render(
      <BrowserRouter>
        <HeroSection streams={mockStreams} />
      </BrowserRouter>
    )

    expect(screen.getByText('영상 쇼핑 – 보는 순간 바로 구매')).toBeDefined()
  })

  it('handles empty streams array', () => {
    render(
      <BrowserRouter>
        <HeroSection streams={[]} />
      </BrowserRouter>
    )

    expect(screen.getByText('0+ 라이브 방송')).toBeDefined()
  })
})
