import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import FeaturesSection from '@/components/home/FeaturesSection'

describe('FeaturesSection', () => {
  it('renders features section title', () => {
    render(<FeaturesSection />)

    expect(screen.getByText('왜 유어 쇼핑인가?')).toBeDefined()
  })

  it('renders all three feature cards', () => {
    const { container } = render(<FeaturesSection />)

    // Should have 3 feature cards
    const featureCards = container.querySelectorAll('.apple-card')
    expect(featureCards.length).toBe(3)
  })

  it('renders feature 1: 실시간 라이브 커머스', () => {
    render(<FeaturesSection />)

    expect(screen.getByText('실시간 라이브 커머스')).toBeDefined()
    expect(screen.getByText(/YouTube, TikTok과 연동/)).toBeDefined()
  })

  it('renders feature 2: 빠른 구매 프로세스', () => {
    render(<FeaturesSection />)

    expect(screen.getByText('빠른 구매 프로세스')).toBeDefined()
    expect(screen.getByText(/클릭 몇 번으로 즉시 구매/)).toBeDefined()
  })

  it('renders feature 3: 안전한 결제', () => {
    render(<FeaturesSection />)

    expect(screen.getByText('안전한 결제')).toBeDefined()
    expect(screen.getByText(/다양한 결제 수단 지원/)).toBeDefined()
  })

  it('renders feature icons', () => {
    const { container } = render(<FeaturesSection />)

    // Should have 3 icons (Video, Zap, ShieldCheck)
    const icons = container.querySelectorAll('svg')
    expect(icons.length).toBeGreaterThanOrEqual(3)
  })

  it('applies correct styling classes', () => {
    const { container } = render(<FeaturesSection />)

    const section = container.querySelector('section')
    expect(section?.classList.contains('py-16')).toBe(true)
    expect(section?.classList.contains('bg-white')).toBe(true)
  })

  it('renders feature cards in grid layout', () => {
    const { container } = render(<FeaturesSection />)

    const grid = container.querySelector('.grid')
    expect(grid).toBeDefined()
    expect(grid?.classList.contains('md:grid-cols-3')).toBe(true)
  })
})
