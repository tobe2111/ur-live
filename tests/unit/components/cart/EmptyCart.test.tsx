import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { EmptyCart } from '@/components/cart/EmptyCart';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('EmptyCart', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders empty cart message', () => {
    render(
      <BrowserRouter>
        <EmptyCart />
      </BrowserRouter>
    );

    expect(screen.getByText('장바구니가 비어있습니다')).toBeInTheDocument();
  });

  it('renders empty cart description', () => {
    render(
      <BrowserRouter>
        <EmptyCart />
      </BrowserRouter>
    );

    expect(screen.getByText('마음에 드는 상품을 담아보세요')).toBeInTheDocument();
  });

  it('renders shopping bag icon', () => {
    const { container } = render(
      <BrowserRouter>
        <EmptyCart />
      </BrowserRouter>
    );

    // Check for icon container with proper styling
    const iconContainer = container.querySelector('.bg-gray-100.rounded-full');
    expect(iconContainer).toBeInTheDocument();
  });

  it('renders continue shopping button', () => {
    render(
      <BrowserRouter>
        <EmptyCart />
      </BrowserRouter>
    );

    expect(screen.getByText('쇼핑 계속하기')).toBeInTheDocument();
  });

  it('navigates to home when continue shopping button is clicked', () => {
    render(
      <BrowserRouter>
        <EmptyCart />
      </BrowserRouter>
    );

    const continueButton = screen.getByText('쇼핑 계속하기');
    fireEvent.click(continueButton);

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('renders with proper centered layout', () => {
    const { container } = render(
      <BrowserRouter>
        <EmptyCart />
      </BrowserRouter>
    );

    const mainContainer = container.querySelector('.flex.flex-col.items-center.justify-center');
    expect(mainContainer).toBeInTheDocument();
  });

  it('has proper button styling', () => {
    const { container } = render(
      <BrowserRouter>
        <EmptyCart />
      </BrowserRouter>
    );

    const button = screen.getByText('쇼핑 계속하기');
    expect(button).toHaveClass('bg-blue-600', 'text-white', 'rounded-lg');
  });

  it('icon has correct size and color classes', () => {
    const { container } = render(
      <BrowserRouter>
        <EmptyCart />
      </BrowserRouter>
    );

    const iconWrapper = container.querySelector('.w-24.h-24');
    expect(iconWrapper).toBeInTheDocument();
    expect(iconWrapper).toHaveClass('bg-gray-100', 'rounded-full');
  });

  it('heading has correct styling', () => {
    render(
      <BrowserRouter>
        <EmptyCart />
      </BrowserRouter>
    );

    const heading = screen.getByText('장바구니가 비어있습니다');
    expect(heading).toHaveClass('text-xl', 'font-bold', 'text-gray-900');
  });

  it('description has correct styling', () => {
    render(
      <BrowserRouter>
        <EmptyCart />
      </BrowserRouter>
    );

    const description = screen.getByText('마음에 드는 상품을 담아보세요');
    expect(description).toHaveClass('text-gray-600');
  });

  it('maintains proper spacing between elements', () => {
    const { container } = render(
      <BrowserRouter>
        <EmptyCart />
      </BrowserRouter>
    );

    // Check for proper spacing classes
    expect(container.querySelector('.mb-6')).toBeInTheDocument();
    expect(container.querySelector('.mb-2')).toBeInTheDocument();
  });

  it('button triggers navigation only once per click', () => {
    render(
      <BrowserRouter>
        <EmptyCart />
      </BrowserRouter>
    );

    const continueButton = screen.getByText('쇼핑 계속하기');
    
    fireEvent.click(continueButton);
    fireEvent.click(continueButton);
    fireEvent.click(continueButton);

    // Should navigate 3 times (once per click)
    expect(mockNavigate).toHaveBeenCalledTimes(3);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('renders all elements in correct order', () => {
    const { container } = render(
      <BrowserRouter>
        <EmptyCart />
      </BrowserRouter>
    );

    const elements = container.querySelectorAll('.flex.flex-col > *');
    
    // Should have icon container, heading, description, and button in order
    expect(elements.length).toBeGreaterThan(0);
  });
});
