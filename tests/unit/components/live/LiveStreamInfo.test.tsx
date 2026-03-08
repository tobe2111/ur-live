import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LiveStreamInfo } from '@/components/live/LiveStreamInfo';

describe('LiveStreamInfo', () => {
  const defaultProps = {
    title: 'Test Live Stream',
    streamerName: 'TestStreamer',
    viewerCount: 1234,
  };

  it('renders stream title', () => {
    render(<LiveStreamInfo {...defaultProps} />);
    
    expect(screen.getByText('Test Live Stream')).toBeInTheDocument();
  });

  it('renders streamer name', () => {
    render(<LiveStreamInfo {...defaultProps} />);
    
    expect(screen.getByText('TestStreamer')).toBeInTheDocument();
  });

  it('renders viewer count correctly', () => {
    render(<LiveStreamInfo {...defaultProps} />);
    
    expect(screen.getByText(/1.2K 시청 중/)).toBeInTheDocument();
  });

  it('formats large viewer counts with M suffix', () => {
    render(<LiveStreamInfo {...defaultProps} viewerCount={1500000} />);
    
    expect(screen.getByText(/1.5M 시청 중/)).toBeInTheDocument();
  });

  it('formats medium viewer counts with K suffix', () => {
    render(<LiveStreamInfo {...defaultProps} viewerCount={5000} />);
    
    expect(screen.getByText(/5.0K 시청 중/)).toBeInTheDocument();
  });

  it('shows exact count for small numbers', () => {
    render(<LiveStreamInfo {...defaultProps} viewerCount={50} />);
    
    expect(screen.getByText(/50 시청 중/)).toBeInTheDocument();
  });

  it('renders streamer avatar when provided', () => {
    render(
      <LiveStreamInfo {...defaultProps} streamerAvatar="/avatar.jpg" />
    );
    
    const avatar = screen.getByAltText('TestStreamer');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute('src', '/avatar.jpg');
  });

  it('renders default avatar when no avatar provided', () => {
    const { container } = render(<LiveStreamInfo {...defaultProps} />);
    
    // Should show first letter of streamer name
    expect(screen.getByText('T')).toBeInTheDocument();
    expect(container.querySelector('.bg-gray-200.rounded-full')).toBeInTheDocument();
  });

  it('renders share button when onShare is provided', () => {
    const mockOnShare = vi.fn();
    render(<LiveStreamInfo {...defaultProps} onShare={mockOnShare} />);
    
    const shareButton = screen.getByLabelText('공유하기');
    expect(shareButton).toBeInTheDocument();
  });

  it('does not render share button when onShare is not provided', () => {
    render(<LiveStreamInfo {...defaultProps} />);
    
    expect(screen.queryByLabelText('공유하기')).not.toBeInTheDocument();
  });

  it('calls onShare when share button clicked', () => {
    const mockOnShare = vi.fn();
    render(<LiveStreamInfo {...defaultProps} onShare={mockOnShare} />);
    
    const shareButton = screen.getByLabelText('공유하기');
    fireEvent.click(shareButton);
    
    expect(mockOnShare).toHaveBeenCalledTimes(1);
  });

  it('applies custom className', () => {
    const { container } = render(
      <LiveStreamInfo {...defaultProps} className="custom-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('renders Eye icon', () => {
    const { container } = render(<LiveStreamInfo {...defaultProps} />);
    
    const eyeIcon = container.querySelector('svg.lucide-eye');
    expect(eyeIcon).toBeInTheDocument();
  });
});
