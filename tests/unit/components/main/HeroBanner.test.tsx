import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import HeroBanner from '@/components/main/HeroBanner';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('HeroBanner', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders hero banner image', () => {
    render(
      <BrowserRouter>
        <HeroBanner />
      </BrowserRouter>
    );

    const image = screen.getByAltText('Hero Banner');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', '/images/hero-banner.jpg');
  });

  it('navigates to browse page when clicked', () => {
    render(
      <BrowserRouter>
        <HeroBanner />
      </BrowserRouter>
    );

    const banner = screen.getByAltText('Hero Banner').parentElement;
    fireEvent.click(banner!);

    expect(mockNavigate).toHaveBeenCalledWith('/browse');
  });

  it('has proper aspect ratio styling', () => {
    const { container } = render(
      <BrowserRouter>
        <HeroBanner />
      </BrowserRouter>
    );

    const clickableArea = screen.getByAltText('Hero Banner').parentElement;
    expect(clickableArea).toBeInTheDocument();
    // Check for inline style instead
    expect(clickableArea).toHaveStyle({ aspectRatio: '16/9' });
  });

  it('has cursor pointer on hover', () => {
    const { container } = render(
      <BrowserRouter>
        <HeroBanner />
      </BrowserRouter>
    );

    const clickableArea = screen.getByAltText('Hero Banner').parentElement;
    expect(clickableArea).toHaveClass('cursor-pointer');
  });

  it('has hover opacity transition', () => {
    const { container } = render(
      <BrowserRouter>
        <HeroBanner />
      </BrowserRouter>
    );

    const clickableArea = screen.getByAltText('Hero Banner').parentElement;
    expect(clickableArea).toHaveClass('hover:opacity-95', 'transition-opacity');
  });

  it('image has proper object-cover class', () => {
    render(
      <BrowserRouter>
        <HeroBanner />
      </BrowserRouter>
    );

    const image = screen.getByAltText('Hero Banner');
    expect(image).toHaveClass('object-cover', 'w-full', 'h-full');
  });

  it('section has overflow-hidden class', () => {
    const { container } = render(
      <BrowserRouter>
        <HeroBanner />
      </BrowserRouter>
    );

    const section = container.querySelector('section');
    expect(section).toHaveClass('overflow-hidden', 'relative', 'w-full');
  });

  it('handles image load error with fallback', () => {
    render(
      <BrowserRouter>
        <HeroBanner />
      </BrowserRouter>
    );

    const image = screen.getByAltText('Hero Banner') as HTMLImageElement;
    
    // Simulate image error
    fireEvent.error(image);

    // Image should have display:none after error
    expect(image.style.display).toBe('none');
  });

  it('banner is clickable as a whole', () => {
    render(
      <BrowserRouter>
        <HeroBanner />
      </BrowserRouter>
    );

    const clickableArea = screen.getByAltText('Hero Banner').parentElement;
    expect(clickableArea).toBeInTheDocument();
    
    // Should be clickable
    fireEvent.click(clickableArea!);
    expect(mockNavigate).toHaveBeenCalled();
  });

  it('renders without errors when image is missing', () => {
    render(
      <BrowserRouter>
        <HeroBanner />
      </BrowserRouter>
    );

    // Component should render even if image fails
    const section = screen.getByAltText('Hero Banner').closest('section');
    expect(section).toBeInTheDocument();
  });
});
