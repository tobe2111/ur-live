import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LiveProductCard } from '@/components/live/LiveProductCard';

describe('LiveProductCard', () => {
  const mockProduct = {
    id: 1,
    name: 'Test Product',
    price: 10000,
    originalPrice: 15000,
    image: '/test-image.jpg',
    description: 'Test description',
    rating: 4.5,
    sold: 100,
    stock: 50,
  };

  const mockOnAddToCart = vi.fn();

  beforeEach(() => {
    mockOnAddToCart.mockClear();
  });

  it('renders product information correctly', () => {
    render(<LiveProductCard product={mockProduct} onAddToCart={mockOnAddToCart} />);
    
    expect(screen.getByText('Test Product')).toBeInTheDocument();
    expect(screen.getByText('10,000원')).toBeInTheDocument();
    expect(screen.getByText('15,000원')).toBeInTheDocument();
  });

  it('displays discount badge when originalPrice is higher', () => {
    render(<LiveProductCard product={mockProduct} onAddToCart={mockOnAddToCart} />);
    
    expect(screen.getByText('33% OFF')).toBeInTheDocument();
  });

  it('displays rating correctly', () => {
    render(<LiveProductCard product={mockProduct} onAddToCart={mockOnAddToCart} />);
    
    expect(screen.getByText('4.5')).toBeInTheDocument();
  });

  it('displays sold count', () => {
    render(<LiveProductCard product={mockProduct} onAddToCart={mockOnAddToCart} />);
    
    expect(screen.getByText('100개 판매')).toBeInTheDocument();
  });

  it('displays stock information', () => {
    render(<LiveProductCard product={mockProduct} onAddToCart={mockOnAddToCart} />);
    
    expect(screen.getByText('재고: 50개')).toBeInTheDocument();
  });

  it('shows out of stock overlay when stock is 0', () => {
    const outOfStockProduct = { ...mockProduct, stock: 0 };
    const { container } = render(<LiveProductCard product={outOfStockProduct} onAddToCart={mockOnAddToCart} />);
    
    // Check for out of stock overlay
    const overlay = container.querySelector('.bg-black.bg-opacity-50');
    expect(overlay).toBeInTheDocument();
  });

  it('disables button when out of stock', () => {
    const outOfStockProduct = { ...mockProduct, stock: 0 };
    render(<LiveProductCard product={outOfStockProduct} onAddToCart={mockOnAddToCart} />);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('calls onAddToCart when button is clicked', () => {
    render(<LiveProductCard product={mockProduct} onAddToCart={mockOnAddToCart} />);
    
    const button = screen.getByText('장바구니 담기');
    fireEvent.click(button);
    
    expect(mockOnAddToCart).toHaveBeenCalledWith(1);
  });

  it('shows loading state when adding to cart', () => {
    render(
      <LiveProductCard
        product={mockProduct}
        onAddToCart={mockOnAddToCart}
        isAddingToCart={true}
      />
    );
    
    expect(screen.getByText('추가 중...')).toBeInTheDocument();
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('applies custom className', () => {
    const { container } = render(
      <LiveProductCard
        product={mockProduct}
        onAddToCart={mockOnAddToCart}
        className="custom-class"
      />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('does not show discount badge when no originalPrice', () => {
    const noDiscountProduct = { ...mockProduct, originalPrice: undefined };
    render(<LiveProductCard product={noDiscountProduct} onAddToCart={mockOnAddToCart} />);
    
    expect(screen.queryByText(/% OFF/)).not.toBeInTheDocument();
  });

  it('renders product image with correct alt text', () => {
    render(<LiveProductCard product={mockProduct} onAddToCart={mockOnAddToCart} />);
    
    const image = screen.getByAltText('Test Product');
    expect(image).toHaveAttribute('src', '/test-image.jpg');
  });
});
