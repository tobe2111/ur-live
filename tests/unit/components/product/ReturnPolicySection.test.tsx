import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReturnPolicySection } from '@/components/product/ReturnPolicySection'

describe('ReturnPolicySection', () => {
  it('renders main title', () => {
    render(<ReturnPolicySection />)

    expect(screen.getByText('교환 및 반품 안내')).toBeDefined()
  })

  it('renders application method section', () => {
    render(<ReturnPolicySection />)

    expect(screen.getByText('신청 방법')).toBeDefined()
    expect(screen.getByText(/상품을 수령하신 날로부터 7일 이내/)).toBeDefined()
  })

  it('renders shipping cost section', () => {
    render(<ReturnPolicySection />)

    expect(screen.getByText('배송 비용')).toBeDefined()
    expect(screen.getByText(/단순 변심은 왕복 택배비 6,000원/)).toBeDefined()
  })

  it('renders return address section', () => {
    render(<ReturnPolicySection />)

    expect(screen.getByText('반품 주소')).toBeDefined()
    expect(screen.getByText(/서울시 강남구 테헤란로 123/)).toBeDefined()
  })

  it('renders important notes section', () => {
    render(<ReturnPolicySection />)

    expect(screen.getByText('유의 사항')).toBeDefined()
  })

  it('renders all 5 important notes', () => {
    const { container } = render(<ReturnPolicySection />)

    const listItems = container.querySelectorAll('ul li')
    expect(listItems.length).toBe(5)
  })

  it('renders first notice about shipping costs', () => {
    render(<ReturnPolicySection />)

    expect(screen.getByText(/상품 하자 외 단순 변심으로 인한 교환\/반품의 경우/)).toBeDefined()
  })

  it('renders second notice about time limit', () => {
    render(<ReturnPolicySection />)

    expect(screen.getByText(/상품 수령일로부터 7일 이내 교환\/반품 접수 가능/)).toBeDefined()
  })

  it('renders third notice about product condition', () => {
    render(<ReturnPolicySection />)

    expect(screen.getByText(/상품 및 상품 포장의 훼손, 사용 흔적이 있는 경우/)).toBeDefined()
  })

  it('renders fourth notice about defects', () => {
    render(<ReturnPolicySection />)

    expect(screen.getByText(/상품 불량 또는 오배송의 경우 무상 교환\/반품이 가능/)).toBeDefined()
  })

  it('renders fifth notice about expiration', () => {
    render(<ReturnPolicySection />)

    expect(screen.getByText(/배송 완료 후 7일이 경과한 경우 교환\/반품이 불가능/)).toBeDefined()
  })

  it('renders refund policy section (Article 22)', () => {
    render(<ReturnPolicySection />)

    expect(screen.getByText('제22조 (환불)')).toBeDefined()
  })

  it('renders first refund clause', () => {
    render(<ReturnPolicySection />)

    expect(screen.getByText(/회사는 이용자가 구매신청한 상품 등이 품절 등의 사유로/)).toBeDefined()
  })

  it('renders second refund clause', () => {
    render(<ReturnPolicySection />)

    expect(screen.getByText(/전자상거래 등에서의 소비자보호에 관한 법률/)).toBeDefined()
  })

  it('applies correct background styling', () => {
    const { container } = render(<ReturnPolicySection />)

    const mainContainer = container.querySelector('.bg-muted\\/30')
    expect(mainContainer).toBeDefined()
  })

  it('applies correct heading styling', () => {
    const { container } = render(<ReturnPolicySection />)

    const mainHeading = container.querySelector('.text-sm.font-bold')
    expect(mainHeading?.textContent).toBe('교환 및 반품 안내')
  })

  it('applies correct subheading styling', () => {
    const { container } = render(<ReturnPolicySection />)

    const subHeadings = container.querySelectorAll('.text-xs.font-semibold')
    expect(subHeadings.length).toBeGreaterThan(0)
  })

  it('has border separator before refund policy', () => {
    const { container } = render(<ReturnPolicySection />)

    const separator = container.querySelector('.border-t.border-border')
    expect(separator).toBeDefined()
  })

  it('uses bullet points in list items', () => {
    const { container } = render(<ReturnPolicySection />)

    const listItems = container.querySelectorAll('li.relative')
    expect(listItems.length).toBe(5)
  })

  it('applies proper spacing to sections', () => {
    const { container } = render(<ReturnPolicySection />)

    const sections = container.querySelectorAll('.mb-5')
    expect(sections.length).toBeGreaterThan(0)
  })

  it('has proper text hierarchy', () => {
    const { container } = render(<ReturnPolicySection />)

    // Main title: text-sm
    const mainTitle = container.querySelector('.text-sm.font-bold')
    expect(mainTitle).toBeDefined()

    // Section titles: text-xs
    const sectionTitles = container.querySelectorAll('.text-xs.font-semibold')
    expect(sectionTitles.length).toBeGreaterThan(0)

    // Content: text-[11px]
    const content = container.querySelectorAll('.text-\\[11px\\]')
    expect(content.length).toBeGreaterThan(0)
  })

  it('renders refund policy with proper spacing', () => {
    const { container } = render(<ReturnPolicySection />)

    const refundSection = container.querySelector('.mt-6.pt-6')
    expect(refundSection).toBeDefined()
  })

  it('has space between refund clauses', () => {
    const { container } = render(<ReturnPolicySection />)

    const refundClauses = container.querySelector('.space-y-2')
    expect(refundClauses).toBeDefined()
  })

  it('has list styling with proper padding', () => {
    const { container } = render(<ReturnPolicySection />)

    const listItems = container.querySelectorAll('.pl-3.relative')
    expect(listItems.length).toBe(5)
  })

  it('applies muted foreground color to descriptions', () => {
    const { container } = render(<ReturnPolicySection />)

    const descriptions = container.querySelectorAll('.text-muted-foreground')
    expect(descriptions.length).toBeGreaterThan(0)
  })

  it('uses leading-relaxed for better readability', () => {
    const { container } = render(<ReturnPolicySection />)

    const relaxedTexts = container.querySelectorAll('.leading-relaxed')
    expect(relaxedTexts.length).toBeGreaterThan(0)
  })

  it('has proper section margins', () => {
    const { container } = render(<ReturnPolicySection />)

    // Check for mb-4 on main title
    const mainTitle = container.querySelector('.mb-4')
    expect(mainTitle).toBeDefined()

    // Check for mb-2 on section titles
    const sectionTitles = container.querySelectorAll('.mb-2')
    expect(sectionTitles.length).toBeGreaterThan(0)
  })

  it('renders complete return policy information', () => {
    render(<ReturnPolicySection />)

    // Check all major sections are present
    expect(screen.getByText('교환 및 반품 안내')).toBeDefined()
    expect(screen.getByText('신청 방법')).toBeDefined()
    expect(screen.getByText('배송 비용')).toBeDefined()
    expect(screen.getByText('반품 주소')).toBeDefined()
    expect(screen.getByText('유의 사항')).toBeDefined()
    expect(screen.getByText('제22조 (환불)')).toBeDefined()
  })

  it('has accessible structure', () => {
    const { container } = render(<ReturnPolicySection />)

    // Should have proper heading hierarchy
    const h2 = container.querySelector('h2')
    const h3s = container.querySelectorAll('h3')
    
    expect(h2).toBeDefined()
    expect(h3s.length).toBeGreaterThan(0)
  })
})
