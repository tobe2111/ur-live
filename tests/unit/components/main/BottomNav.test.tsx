import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import BottomNav from '@/components/main/BottomNav';

// Mock useNavigate and useLocation
const mockNavigate = vi.fn();
const mockLocation = { pathname: '/' };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
  };
});

describe('BottomNav', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders all navigation items', () => {
    render(
      <BrowserRouter>
        <BottomNav />
      </BrowserRouter>
    );

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('Shop')).toBeInTheDocument();
    expect(screen.getByText('Cart')).toBeInTheDocument();
    expect(screen.getByText('My')).toBeInTheDocument();
  });

  it('renders all nav icons', () => {
    render(
      <BrowserRouter>
        <BottomNav />
      </BrowserRouter>
    );

    // Check for aria-labels
    expect(screen.getByLabelText('Home')).toBeInTheDocument();
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
    expect(screen.getByLabelText('Shop')).toBeInTheDocument();
    expect(screen.getByLabelText('Cart')).toBeInTheDocument();
    expect(screen.getByLabelText('My')).toBeInTheDocument();
  });

  it('navigates to home when Home button is clicked', () => {
    render(
      <BrowserRouter>
        <BottomNav />
      </BrowserRouter>
    );

    const homeButton = screen.getByLabelText('Home');
    fireEvent.click(homeButton);

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('navigates to search when Search button is clicked', () => {
    render(
      <BrowserRouter>
        <BottomNav />
      </BrowserRouter>
    );

    const searchButton = screen.getByLabelText('Search');
    fireEvent.click(searchButton);

    expect(mockNavigate).toHaveBeenCalledWith('/search');
  });

  it('navigates to browse when Shop button is clicked', () => {
    render(
      <BrowserRouter>
        <BottomNav />
      </BrowserRouter>
    );

    const shopButton = screen.getByLabelText('Shop');
    fireEvent.click(shopButton);

    expect(mockNavigate).toHaveBeenCalledWith('/browse');
  });

  it('navigates to cart when Cart button is clicked', () => {
    render(
      <BrowserRouter>
        <BottomNav />
      </BrowserRouter>
    );

    const cartButton = screen.getByLabelText('Cart');
    fireEvent.click(cartButton);

    expect(mockNavigate).toHaveBeenCalledWith('/cart');
  });

  it('navigates to profile when My button is clicked', () => {
    render(
      <BrowserRouter>
        <BottomNav />
      </BrowserRouter>
    );

    const myButton = screen.getByLabelText('My');
    fireEvent.click(myButton);

    expect(mockNavigate).toHaveBeenCalledWith('/user/profile');
  });

  it('renders with fixed positioning', () => {
    const { container } = render(
      <BrowserRouter>
        <BottomNav />
      </BrowserRouter>
    );

    const nav = container.querySelector('nav');
    expect(nav).toHaveClass('fixed', 'bottom-0');
  });

  it('has proper styling for safe area insets', () => {
    const { container } = render(
      <BrowserRouter>
        <BottomNav />
      </BrowserRouter>
    );

    const nav = container.querySelector('nav');
    expect(nav).toHaveStyle({ width: '100vw' });
  });

  it('renders with border and shadow', () => {
    const { container } = render(
      <BrowserRouter>
        <BottomNav />
      </BrowserRouter>
    );

    const nav = container.querySelector('nav');
    expect(nav).toHaveClass('border-t', 'border-gray-200');
  });

  it('all buttons are accessible', () => {
    render(
      <BrowserRouter>
        <BottomNav />
      </BrowserRouter>
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(5);
    
    buttons.forEach(button => {
      expect(button).toHaveAttribute('aria-label');
    });
  });

  it('renders correct icon and label pairs', () => {
    render(
      <BrowserRouter>
        <BottomNav />
      </BrowserRouter>
    );

    // Each nav item should have both icon (svg) and label (text)
    const homeButton = screen.getByLabelText('Home');
    expect(homeButton.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();

    const searchButton = screen.getByLabelText('Search');
    expect(searchButton.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
  });

  it('buttons have proper flex layout', () => {
    const { container } = render(
      <BrowserRouter>
        <BottomNav />
      </BrowserRouter>
    );

    const buttons = container.querySelectorAll('button');
    buttons.forEach(button => {
      expect(button).toHaveClass('flex', 'flex-col', 'items-center');
    });
  });
});
