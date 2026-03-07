import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { CartHeader } from '@/components/cart/CartHeader';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('CartHeader', () => {
  const defaultProps = {
    itemCount: 5,
    allSelected: false,
    selectedCount: 2,
    onToggleSelectAll: vi.fn(),
    onDeleteSelected: vi.fn(),
  };

  beforeEach(() => {
    mockNavigate.mockClear();
    defaultProps.onToggleSelectAll.mockClear();
    defaultProps.onDeleteSelected.mockClear();
  });

  it('renders cart header with item count', () => {
    render(
      <BrowserRouter>
        <CartHeader {...defaultProps} />
      </BrowserRouter>
    );

    expect(screen.getByText('장바구니 (5)')).toBeInTheDocument();
  });

  it('renders cart header without item count when empty', () => {
    render(
      <BrowserRouter>
        <CartHeader {...defaultProps} itemCount={0} />
      </BrowserRouter>
    );

    expect(screen.getByText('장바구니')).toBeInTheDocument();
    expect(screen.queryByText(/\(\d+\)/)).not.toBeInTheDocument();
  });

  it('renders back button and navigates back on click', () => {
    render(
      <BrowserRouter>
        <CartHeader {...defaultProps} />
      </BrowserRouter>
    );

    const buttons = screen.getAllByRole('button');
    const backButton = buttons.find(btn => btn.querySelector('svg')?.classList.contains('lucide-chevron-left'));
    fireEvent.click(backButton!);

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('renders select all checkbox when items exist', () => {
    render(
      <BrowserRouter>
        <CartHeader {...defaultProps} />
      </BrowserRouter>
    );

    expect(screen.getByText('전체 선택 (2/5)')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('does not render select controls when cart is empty', () => {
    render(
      <BrowserRouter>
        <CartHeader {...defaultProps} itemCount={0} />
      </BrowserRouter>
    );

    expect(screen.queryByText(/전체 선택/)).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('calls onToggleSelectAll when checkbox is clicked', () => {
    render(
      <BrowserRouter>
        <CartHeader {...defaultProps} />
      </BrowserRouter>
    );

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(defaultProps.onToggleSelectAll).toHaveBeenCalledTimes(1);
  });

  it('renders delete button when items are selected', () => {
    render(
      <BrowserRouter>
        <CartHeader {...defaultProps} selectedCount={3} />
      </BrowserRouter>
    );

    expect(screen.getByText('선택 삭제')).toBeInTheDocument();
  });

  it('does not render delete button when no items are selected', () => {
    render(
      <BrowserRouter>
        <CartHeader {...defaultProps} selectedCount={0} />
      </BrowserRouter>
    );

    expect(screen.queryByText('선택 삭제')).not.toBeInTheDocument();
  });

  it('calls onDeleteSelected when delete button is clicked', () => {
    render(
      <BrowserRouter>
        <CartHeader {...defaultProps} selectedCount={3} />
      </BrowserRouter>
    );

    const deleteButton = screen.getByText('선택 삭제');
    fireEvent.click(deleteButton);

    expect(defaultProps.onDeleteSelected).toHaveBeenCalledTimes(1);
  });

  it('shows all items selected state', () => {
    render(
      <BrowserRouter>
        <CartHeader {...defaultProps} allSelected={true} selectedCount={5} />
      </BrowserRouter>
    );

    expect(screen.getByText('전체 선택 (5/5)')).toBeInTheDocument();
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('updates selected count correctly', () => {
    const { rerender } = render(
      <BrowserRouter>
        <CartHeader {...defaultProps} selectedCount={1} />
      </BrowserRouter>
    );

    expect(screen.getByText('전체 선택 (1/5)')).toBeInTheDocument();

    rerender(
      <BrowserRouter>
        <CartHeader {...defaultProps} selectedCount={4} />
      </BrowserRouter>
    );

    expect(screen.getByText('전체 선택 (4/5)')).toBeInTheDocument();
  });

  it('renders with large item count', () => {
    render(
      <BrowserRouter>
        <CartHeader {...defaultProps} itemCount={999} selectedCount={500} />
      </BrowserRouter>
    );

    expect(screen.getByText('장바구니 (999)')).toBeInTheDocument();
    expect(screen.getByText('전체 선택 (500/999)')).toBeInTheDocument();
  });

  it('maintains proper layout structure', () => {
    const { container } = render(
      <BrowserRouter>
        <CartHeader {...defaultProps} />
      </BrowserRouter>
    );

    // Check for sticky header
    const stickyHeader = container.querySelector('.sticky');
    expect(stickyHeader).toBeInTheDocument();

    // Check for border styling
    const borderElements = container.querySelectorAll('.border-gray-200');
    expect(borderElements.length).toBeGreaterThan(0);
  });
});
