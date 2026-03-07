import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProductNoticeSection } from '@/components/product/ProductNoticeSection'

describe('ProductNoticeSection', () => {
  it('renders all three notices', () => {
    render(<ProductNoticeSection />)

    expect(screen.getByText('검수 포함')).toBeDefined()
    expect(screen.getByText('배송 기간 5-7 영업일')).toBeDefined()
    expect(screen.getByText('교환/반품 안내')).toBeDefined()
  })

  it('renders notice descriptions', () => {
    render(<ProductNoticeSection />)

    expect(screen.getByText('모든 상품은 철저한 검수 과정을 거칩니다')).toBeDefined()
    expect(screen.getByText('판매자 발송 및 검수 완료 후 배송됩니다')).toBeDefined()
    expect(screen.getByText('상품 수령 후 7일 이내 교환/반품 가능합니다')).toBeDefined()
  })

  it('renders bullet points for each notice', () => {
    const { container } = render(<ProductNoticeSection />)

    const bullets = container.querySelectorAll('.h-1\\.5.w-1\\.5.rounded-full')
    expect(bullets.length).toBe(3)
  })

  it('applies correct styling to notice titles', () => {
    const { container } = render(<ProductNoticeSection />)

    const titles = container.querySelectorAll('.text-xs.font-medium.text-foreground')
    expect(titles.length).toBe(3)
  })

  it('applies correct styling to notice descriptions', () => {
    const { container } = render(<ProductNoticeSection />)

    const descriptions = container.querySelectorAll('.text-\\[10px\\].text-muted-foreground')
    expect(descriptions.length).toBe(3)
  })

  it('uses flex layout for notices', () => {
    const { container } = render(<ProductNoticeSection />)

    const noticeItems = container.querySelectorAll('.flex.items-start.gap-3')
    expect(noticeItems.length).toBe(3)
  })

  it('applies spacing between notices', () => {
    const { container } = render(<ProductNoticeSection />)

    const wrapper = container.querySelector('.space-y-3')
    expect(wrapper).toBeDefined()
  })

  it('renders notices in correct order', () => {
    const { container } = render(<ProductNoticeSection />)

    const titles = container.querySelectorAll('.text-xs.font-medium.text-foreground')
    expect(titles[0].textContent).toBe('검수 포함')
    expect(titles[1].textContent).toBe('배송 기간 5-7 영업일')
    expect(titles[2].textContent).toBe('교환/반품 안내')
  })

  it('has flex-shrink-0 on bullet points', () => {
    const { container } = render(<ProductNoticeSection />)

    const bullets = container.querySelectorAll('.flex-shrink-0')
    expect(bullets.length).toBe(3)
  })

  it('applies margin-top to bullets', () => {
    const { container } = render(<ProductNoticeSection />)

    const bullets = container.querySelectorAll('.mt-0\\.5')
    expect(bullets.length).toBeGreaterThan(0)
  })

  it('renders with bg-muted-foreground for bullets', () => {
    const { container } = render(<ProductNoticeSection />)

    const bullets = container.querySelectorAll('.bg-muted-foreground')
    expect(bullets.length).toBe(3)
  })

  it('has correct text size hierarchy', () => {
    const { container } = render(<ProductNoticeSection />)

    // Titles should be text-xs
    const titles = container.querySelectorAll('.text-xs')
    expect(titles.length).toBeGreaterThan(0)

    // Descriptions should be text-[10px]
    const descriptions = container.querySelectorAll('.text-\\[10px\\]')
    expect(descriptions.length).toBe(3)
  })

  it('renders inspection notice correctly', () => {
    render(<ProductNoticeSection />)

    const title = screen.getByText('검수 포함')
    const description = screen.getByText('모든 상품은 철저한 검수 과정을 거칩니다')
    
    expect(title).toBeDefined()
    expect(description).toBeDefined()
  })

  it('renders shipping notice correctly', () => {
    render(<ProductNoticeSection />)

    const title = screen.getByText('배송 기간 5-7 영업일')
    const description = screen.getByText('판매자 발송 및 검수 완료 후 배송됩니다')
    
    expect(title).toBeDefined()
    expect(description).toBeDefined()
  })

  it('renders return policy notice correctly', () => {
    render(<ProductNoticeSection />)

    const title = screen.getByText('교환/반품 안내')
    const description = screen.getByText('상품 수령 후 7일 이내 교환/반품 가능합니다')
    
    expect(title).toBeDefined()
    expect(description).toBeDefined()
  })

  it('has proper semantic structure', () => {
    const { container } = render(<ProductNoticeSection />)

    // Should have a main container
    const mainContainer = container.querySelector('.space-y-3')
    expect(mainContainer).toBeDefined()

    // Should have three notice items
    const noticeItems = mainContainer?.querySelectorAll('.flex.items-start.gap-3')
    expect(noticeItems?.length).toBe(3)
  })
})
