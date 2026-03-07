import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import CTASection from '@/components/home/CTASection'

describe('CTASection', () => {
  it('renders CTA section heading', () => {
    render(
      <BrowserRouter>
        <CTASection />
      </BrowserRouter>
    )

    expect(screen.getByText('지금 바로 시작하세요')).toBeDefined()
  })

  it('renders CTA subtitle', () => {
    render(
      <BrowserRouter>
        <CTASection />
      </BrowserRouter>
    )

    expect(screen.getByText(/무료로 라이브 커머스를 시작/)).toBeDefined()
  })

  it('renders primary CTA button', () => {
    render(
      <BrowserRouter>
        <CTASection />
      </BrowserRouter>
    )

    const button = screen.getByText('무료로 시작하기')
    expect(button).toBeDefined()
    expect(button.tagName).toBe('A') // Link component renders as 'a'
  })

  it('primary CTA links to seller login', () => {
    render(
      <BrowserRouter>
        <CTASection />
      </BrowserRouter>
    )

    const button = screen.getByText('무료로 시작하기')
    expect(button.getAttribute('href')).toBe('/seller/login')
  })

  it('renders secondary CTA button', () => {
    render(
      <BrowserRouter>
        <CTASection />
      </BrowserRouter>
    )

    const button = screen.getByText('자세히 알아보기')
    expect(button).toBeDefined()
  })

  it('secondary CTA links to seller login', () => {
    render(
      <BrowserRouter>
        <CTASection />
      </BrowserRouter>
    )

    const button = screen.getByText('자세히 알아보기')
    expect(button.getAttribute('href')).toBe('/seller/login')
  })

  it('renders star icon', () => {
    const { container } = render(
      <BrowserRouter>
        <CTASection />
      </BrowserRouter>
    )

    const starIcon = container.querySelector('svg')
    expect(starIcon).toBeDefined()
  })

  it('renders with gradient background', () => {
    const { container } = render(
      <BrowserRouter>
        <CTASection />
      </BrowserRouter>
    )

    const section = container.querySelector('section')
    expect(section?.classList.contains('bg-gradient-to-br')).toBe(true)
  })

  it('applies correct spacing classes', () => {
    const { container } = render(
      <BrowserRouter>
        <CTASection />
      </BrowserRouter>
    )

    const section = container.querySelector('section')
    expect(section?.classList.contains('py-16')).toBe(true)
  })
})
