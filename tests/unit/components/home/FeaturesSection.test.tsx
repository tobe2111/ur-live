import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FeaturesSection } from '@/components/home/FeaturesSection'

describe('FeaturesSection', () => {
  it('renders section title', () => {
    render(<FeaturesSection />)

    expect(screen.getByText('유어 쇼핑을 선택하는 이유')).toBeDefined()
  })

  it('renders section subtitle', () => {
    render(<FeaturesSection />)

    expect(screen.getByText('플랫폼의 모든 것이 당신을 위해 준비되어 있습니다')).toBeDefined()
  })

  it('renders three feature cards', () => {
    const { container } = render(<FeaturesSection />)

    const featureCards = container.querySelectorAll('.group.relative')
    expect(featureCards.length).toBe(3)
  })

  it('renders feature titles', () => {
    render(<FeaturesSection />)

    expect(screen.getByText('멀티 플랫폼 지원')).toBeDefined()
    expect(screen.getByText('간편한 구매')).toBeDefined()
    expect(screen.getByText('특별한 혜택')).toBeDefined()
  })

  it('renders feature descriptions', () => {
    render(<FeaturesSection />)

    expect(screen.getByText('YouTube, TikTok 등 익숙한 플랫폼에서 실시간 쇼핑을 즐기세요')).toBeDefined()
    expect(screen.getByText('클릭 한 번으로 마음에 드는 상품을 바로 구매하세요')).toBeDefined()
    expect(screen.getByText('라이브 전용 할인과 깜짝 이벤트를 만나보세요')).toBeDefined()
  })

  it('renders feature icons', () => {
    const { container } = render(<FeaturesSection />)

    const iconContainers = container.querySelectorAll('.h-20.w-20')
    expect(iconContainers.length).toBe(3)
  })

  it('applies gradient backgrounds to cards', () => {
    const { container } = render(<FeaturesSection />)

    const cards = container.querySelectorAll('.bg-gradient-to-br')
    expect(cards.length).toBeGreaterThan(0)
  })

  it('uses grid layout for feature cards', () => {
    const { container } = render(<FeaturesSection />)

    const grid = container.querySelector('.grid')
    expect(grid?.classList.contains('md:grid-cols-3')).toBe(true)
  })

  it('applies hover effects to cards', () => {
    const { container } = render(<FeaturesSection />)

    const cards = container.querySelectorAll('.hover\\:shadow-2xl')
    expect(cards.length).toBe(3)
  })
})
