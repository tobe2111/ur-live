import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LiveProductList } from '@/components/live/LiveProductList';

describe('LiveProductList', () => {
  const mockProducts = [
    {
      id: 1,
      name: 'Product 1',
      price: 10000,
      image: '/image1.jpg',
      stock: 10,
    },
    {
      id: 2,
      name: 'Product 2',
      price: 20000,
      image: '/image2.jpg',
      stock: 5,
    },
  ];

  const mockOnAddToCart = vi.fn();
  const mockOnSelectProduct = vi.fn();

  beforeEach(() => {
    mockOnAddToCart.mockClear();
    mockOnSelectProduct.mockClear();
  });

  it('renders empty state when no products', () => {
    render(
      <LiveProductList products={[]} onAddToCart={mockOnAddToCart} />
    );
    
    expect(screen.getByText('판매 중인 상품이 없습니다')).toBeInTheDocument();
  });

  it('renders product count in header', () => {
    render(
      <LiveProductList products={mockProducts} onAddToCart={mockOnAddToCart} />
    );
    
    expect(screen.getByText('판매 상품 (2)')).toBeInTheDocument();
  });

  it('renders all products', () => {
    render(
      <LiveProductList products={mockProducts} onAddToCart={mockOnAddToCart} />
    );
    
    expect(screen.getByText('Product 1')).toBeInTheDocument();
    expect(screen.getByText('Product 2')).toBeInTheDocument();
  });

  it('highlights current product', () => {
    const { container } = render(
      <LiveProductList
        products={mockProducts}
        currentProductId={1}
        onAddToCart={mockOnAddToCart}
      />
    );
    
    expect(screen.getByText('판매 중')).toBeInTheDocument();
    expect(container.querySelector('.ring-2.ring-blue-500')).toBeInTheDocument();
  });

  it('calls onSelectProduct when product is clicked', () => {
    const { container } = render(
      <LiveProductList
        products={mockProducts}
        onAddToCart={mockOnAddToCart}
        onSelectProduct={mockOnSelectProduct}
      />
    );
    
    const productCards = container.querySelectorAll('[class*="cursor-pointer"]');
    fireEvent.click(productCards[0]);
    
    expect(mockOnSelectProduct).toHaveBeenCalledWith(1);
  });

  it('applies custom className', () => {
    const { container } = render(
      <LiveProductList
        products={mockProducts}
        onAddToCart={mockOnAddToCart}
        className="custom-class"
      />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('renders grid layout', () => {
    const { container } = render(
      <LiveProductList products={mockProducts} onAddToCart={mockOnAddToCart} />
    );
    
    expect(container.querySelector('.grid')).toBeInTheDocument();
  });
});
