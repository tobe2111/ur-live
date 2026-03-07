import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import QuickAccess from '@/components/main/QuickAccess';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('QuickAccess', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders all category buttons', () => {
    render(
      <BrowserRouter>
        <QuickAccess />
      </BrowserRouter>
    );

    expect(screen.getByText('식품')).toBeInTheDocument();
    expect(screen.getByText('패션')).toBeInTheDocument();
    expect(screen.getByText('뷰티')).toBeInTheDocument();
    expect(screen.getByText('유아동')).toBeInTheDocument();
    expect(screen.getByText('잡화')).toBeInTheDocument();
  });

  it('renders exactly 5 category buttons', () => {
    render(
      <BrowserRouter>
        <QuickAccess />
      </BrowserRouter>
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(5);
  });

  it('navigates to food category when 식품 is clicked', () => {
    render(
      <BrowserRouter>
        <QuickAccess />
      </BrowserRouter>
    );

    const foodButton = screen.getByText('식품');
    fireEvent.click(foodButton);

    expect(mockNavigate).toHaveBeenCalledWith('/browse?category=food');
  });

  it('navigates to fashion category when 패션 is clicked', () => {
    render(
      <BrowserRouter>
        <QuickAccess />
      </BrowserRouter>
    );

    const fashionButton = screen.getByText('패션');
    fireEvent.click(fashionButton);

    expect(mockNavigate).toHaveBeenCalledWith('/browse?category=fashion');
  });

  it('navigates to beauty category when 뷰티 is clicked', () => {
    render(
      <BrowserRouter>
        <QuickAccess />
      </BrowserRouter>
    );

    const beautyButton = screen.getByText('뷰티');
    fireEvent.click(beautyButton);

    expect(mockNavigate).toHaveBeenCalledWith('/browse?category=beauty');
  });

  it('navigates to kids category when 유아동 is clicked', () => {
    render(
      <BrowserRouter>
        <QuickAccess />
      </BrowserRouter>
    );

    const kidsButton = screen.getByText('유아동');
    fireEvent.click(kidsButton);

    expect(mockNavigate).toHaveBeenCalledWith('/browse?category=kids');
  });

  it('navigates to goods category when 잡화 is clicked', () => {
    render(
      <BrowserRouter>
        <QuickAccess />
      </BrowserRouter>
    );

    const goodsButton = screen.getByText('잡화');
    fireEvent.click(goodsButton);

    expect(mockNavigate).toHaveBeenCalledWith('/browse?category=goods');
  });

  it('has 5-column grid layout', () => {
    const { container } = render(
      <BrowserRouter>
        <QuickAccess />
      </BrowserRouter>
    );

    const grid = container.querySelector('.grid-cols-5');
    expect(grid).toBeInTheDocument();
  });

  it('each button has an icon', () => {
    const { container } = render(
      <BrowserRouter>
        <QuickAccess />
      </BrowserRouter>
    );

    const icons = container.querySelectorAll('svg');
    expect(icons.length).toBe(5);
  });

  it('category icons have proper styling', () => {
    const { container } = render(
      <BrowserRouter>
        <QuickAccess />
      </BrowserRouter>
    );

    const iconContainers = container.querySelectorAll('.rounded-full.bg-gray-100');
    expect(iconContainers.length).toBe(5);
  });

  it('buttons have flex-col layout', () => {
    const { container } = render(
      <BrowserRouter>
        <QuickAccess />
      </BrowserRouter>
    );

    const buttons = container.querySelectorAll('button');
    buttons.forEach(button => {
      expect(button).toHaveClass('flex', 'flex-col', 'items-center');
    });
  });

  it('section has proper padding', () => {
    const { container } = render(
      <BrowserRouter>
        <QuickAccess />
      </BrowserRouter>
    );

    const section = container.querySelector('section');
    expect(section).toHaveClass('px-4', 'py-6');
  });

  it('icon containers have hover effect', () => {
    const { container } = render(
      <BrowserRouter>
        <QuickAccess />
      </BrowserRouter>
    );

    const iconContainers = container.querySelectorAll('.group-hover\\:bg-gray-200');
    expect(iconContainers.length).toBeGreaterThan(0);
  });

  it('labels have correct font size', () => {
    const { container } = render(
      <BrowserRouter>
        <QuickAccess />
      </BrowserRouter>
    );

    const labels = container.querySelectorAll('.text-\\[11px\\]');
    expect(labels.length).toBe(5);
  });
});
