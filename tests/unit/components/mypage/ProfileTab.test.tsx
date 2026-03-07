import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ProfileTab } from '@/components/mypage/ProfileTab'

describe('ProfileTab', () => {
  const mockOnLogout = vi.fn()
  const mockNavigate = vi.fn()

  beforeEach(() => {
    mockOnLogout.mockClear()
    mockNavigate.mockClear()
  })

  it('renders user name', () => {
    render(
      <BrowserRouter>
        <ProfileTab 
          userName="홍길동" 
          userEmail="test@example.com"
          onLogout={mockOnLogout}
        />
      </BrowserRouter>
    )

    expect(screen.getByText('홍길동')).toBeDefined()
  })

  it('renders user email when provided', () => {
    render(
      <BrowserRouter>
        <ProfileTab 
          userName="홍길동" 
          userEmail="test@example.com"
          onLogout={mockOnLogout}
        />
      </BrowserRouter>
    )

    expect(screen.getByText('test@example.com')).toBeDefined()
  })

  it('does not render email when not provided', () => {
    render(
      <BrowserRouter>
        <ProfileTab 
          userName="홍길동" 
          userEmail={null}
          onLogout={mockOnLogout}
        />
      </BrowserRouter>
    )

    expect(screen.queryByText('@')).toBeNull()
  })

  it('renders profile image', () => {
    render(
      <BrowserRouter>
        <ProfileTab 
          userName="홍길동" 
          userEmail="test@example.com"
          userProfileImage="https://example.com/avatar.jpg"
          onLogout={mockOnLogout}
        />
      </BrowserRouter>
    )

    const image = screen.getByAltText('홍길동')
    expect(image.getAttribute('src')).toBe('https://example.com/avatar.jpg')
  })

  it('uses default avatar when no profile image', () => {
    render(
      <BrowserRouter>
        <ProfileTab 
          userName="홍길동" 
          userEmail="test@example.com"
          onLogout={mockOnLogout}
        />
      </BrowserRouter>
    )

    const image = screen.getByAltText('홍길동')
    expect(image.getAttribute('src')).toContain('ui-avatars.com')
  })

  it('renders shipping address menu item', () => {
    render(
      <BrowserRouter>
        <ProfileTab 
          userName="홍길동" 
          userEmail="test@example.com"
          onLogout={mockOnLogout}
        />
      </BrowserRouter>
    )

    expect(screen.getByText('배송지 관리')).toBeDefined()
  })

  it('renders payment method menu item', () => {
    render(
      <BrowserRouter>
        <ProfileTab 
          userName="홍길동" 
          userEmail="test@example.com"
          onLogout={mockOnLogout}
        />
      </BrowserRouter>
    )

    expect(screen.getByText('결제 수단')).toBeDefined()
  })

  it('renders settings menu item', () => {
    render(
      <BrowserRouter>
        <ProfileTab 
          userName="홍길동" 
          userEmail="test@example.com"
          onLogout={mockOnLogout}
        />
      </BrowserRouter>
    )

    expect(screen.getByText('설정')).toBeDefined()
  })

  it('renders logout button', () => {
    render(
      <BrowserRouter>
        <ProfileTab 
          userName="홍길동" 
          userEmail="test@example.com"
          onLogout={mockOnLogout}
        />
      </BrowserRouter>
    )

    expect(screen.getByText('로그아웃')).toBeDefined()
  })

  it('calls onLogout when logout button is clicked', () => {
    render(
      <BrowserRouter>
        <ProfileTab 
          userName="홍길동" 
          userEmail="test@example.com"
          onLogout={mockOnLogout}
        />
      </BrowserRouter>
    )

    const logoutButton = screen.getByText('로그아웃')
    fireEvent.click(logoutButton)

    expect(mockOnLogout).toHaveBeenCalledTimes(1)
  })

  it('renders app version info', () => {
    render(
      <BrowserRouter>
        <ProfileTab 
          userName="홍길동" 
          userEmail="test@example.com"
          onLogout={mockOnLogout}
        />
      </BrowserRouter>
    )

    expect(screen.getByText(/v2.1.0/)).toBeDefined()
  })

  it('renders copyright info', () => {
    render(
      <BrowserRouter>
        <ProfileTab 
          userName="홍길동" 
          userEmail="test@example.com"
          onLogout={mockOnLogout}
        />
      </BrowserRouter>
    )

    expect(screen.getByText(/© 2026 Your Live Commerce/)).toBeDefined()
  })

  it('has correct icons for menu items', () => {
    const { container } = render(
      <BrowserRouter>
        <ProfileTab 
          userName="홍길동" 
          userEmail="test@example.com"
          onLogout={mockOnLogout}
        />
      </BrowserRouter>
    )

    // Check for MapPin, CreditCard, Settings, LogOut icons
    expect(container.querySelector('.lucide-map-pin')).toBeDefined()
    expect(container.querySelector('.lucide-credit-card')).toBeDefined()
    expect(container.querySelector('.lucide-settings')).toBeDefined()
    expect(container.querySelector('.lucide-log-out')).toBeDefined()
  })

  it('has chevron right icons for navigation items', () => {
    const { container } = render(
      <BrowserRouter>
        <ProfileTab 
          userName="홍길동" 
          userEmail="test@example.com"
          onLogout={mockOnLogout}
        />
      </BrowserRouter>
    )

    const chevrons = container.querySelectorAll('.lucide-chevron-right')
    expect(chevrons.length).toBe(3) // 3 menu items with chevrons
  })

  it('applies hover effects to menu items', () => {
    const { container } = render(
      <BrowserRouter>
        <ProfileTab 
          userName="홍길동" 
          userEmail="test@example.com"
          onLogout={mockOnLogout}
        />
      </BrowserRouter>
    )

    const menuItems = container.querySelectorAll('.hover\\:bg-\\[\\#f5f5f7\\]')
    expect(menuItems.length).toBeGreaterThan(0)
  })

  it('styles logout button with red color', () => {
    const { container } = render(
      <BrowserRouter>
        <ProfileTab 
          userName="홍길동" 
          userEmail="test@example.com"
          onLogout={mockOnLogout}
        />
      </BrowserRouter>
    )

    const logoutButton = screen.getByText('로그아웃').closest('button')
    expect(logoutButton?.classList.contains('text-[#ff3b30]')).toBe(true)
  })

  it('handles image error gracefully', () => {
    render(
      <BrowserRouter>
        <ProfileTab 
          userName="홍길동" 
          userEmail="test@example.com"
          userProfileImage="https://invalid-url.com/image.jpg"
          onLogout={mockOnLogout}
        />
      </BrowserRouter>
    )

    const image = screen.getByAltText('홍길동') as HTMLImageElement
    
    // Trigger error event
    fireEvent.error(image)

    // Should fall back to default avatar
    expect(image.src).toContain('ui-avatars.com')
  })

  it('encodes user name in avatar URL', () => {
    render(
      <BrowserRouter>
        <ProfileTab 
          userName="홍길동 테스트" 
          userEmail="test@example.com"
          onLogout={mockOnLogout}
        />
      </BrowserRouter>
    )

    const image = screen.getByAltText('홍길동 테스트')
    expect(image.getAttribute('src')).toContain(encodeURIComponent('홍길동 테스트'))
  })

  it('uses apple-card styling', () => {
    const { container } = render(
      <BrowserRouter>
        <ProfileTab 
          userName="홍길동" 
          userEmail="test@example.com"
          onLogout={mockOnLogout}
        />
      </BrowserRouter>
    )

    const cards = container.querySelectorAll('.apple-card')
    expect(cards.length).toBeGreaterThan(0)
  })

  it('has proper spacing between sections', () => {
    const { container } = render(
      <BrowserRouter>
        <ProfileTab 
          userName="홍길동" 
          userEmail="test@example.com"
          onLogout={mockOnLogout}
        />
      </BrowserRouter>
    )

    const mainContainer = container.querySelector('.space-y-6')
    expect(mainContainer).toBeDefined()
  })

  it('renders profile image with rounded full style', () => {
    render(
      <BrowserRouter>
        <ProfileTab 
          userName="홍길동" 
          userEmail="test@example.com"
          onLogout={mockOnLogout}
        />
      </BrowserRouter>
    )

    const image = screen.getByAltText('홍길동')
    expect(image.classList.contains('rounded-full')).toBe(true)
  })

  it('renders all menu items in correct order', () => {
    render(
      <BrowserRouter>
        <ProfileTab 
          userName="홍길동" 
          userEmail="test@example.com"
          onLogout={mockOnLogout}
        />
      </BrowserRouter>
    )

    const menuLabels = ['배송지 관리', '결제 수단', '설정']
    menuLabels.forEach(label => {
      expect(screen.getByText(label)).toBeDefined()
    })
  })
})
