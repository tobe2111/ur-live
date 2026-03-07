import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { CTASection } from '@/components/home/CTASection'

describe('CTASection', () => {
  it('renders main heading', () => {
    render(
      <BrowserRouter>
        <CTASection />
      </BrowserRouter>
    )

    expect(screen.getByText('지금 바로 시작하세요')).toBeDefined()
  })

  it('renders subtitle text', () => {
    render(
      <BrowserRouter>
        <CTASection />
      </BrowserRouter>
    )

    expect(screen.getByText('무료로 시작하고, 성공적인 판매를 경험하세요')).toBeDefined()
  })

  it('renders start button', () => {
    render(
      <BrowserRouter>
        <CTASection />
      </BrowserRouter>
    )

    const startButton = screen.getByText('무료로 시작하기')
    expect(startButton).toBeDefined()
  })

  it('renders learn more link', () => {
    render(
      <BrowserRouter>
        <CTASection />
      </BrowserRouter>
    )

    const learnMoreLink = screen.getByText('자세히 알아보기')
    expect(learnMoreLink).toBeDefined()
  })

  it('start button links to seller login', () => {
    render(
      <BrowserRouter>
        <CTASection />
      </BrowserRouter>
    )

    const startButton = screen.getByRole('link', { name: /무료로 시작하기/i })
    expect(startButton.getAttribute('href')).toBe('/seller/login')
  })

  it('learn more link links to seller login', () => {
    render(
      <BrowserRouter>
        <CTASection />
      </BrowserRouter>
    )

    const links = screen.getAllByRole('link')
    const learnMoreLink = links.find(link => link.textContent?.includes('자세히 알아보기'))
    expect(learnMoreLink?.getAttribute('href')).toBe('/seller/login')
  })

  it('applies gradient background', () => {
    const { container } = render(
      <BrowserRouter>
        <CTASection />
      </BrowserRouter>
    )

    const section = container.querySelector('section')
    expect(section?.classList.contains('bg-gradient-to-r')).toBe(true)
  })

  it('renders star icon', () => {
    const { container } = render(
      <BrowserRouter>
        <CTASection />
      </BrowserRouter>
    )

    const iconContainer = container.querySelector('.h-20.w-20')
    expect(iconContainer).toBeDefined()
  })
})
