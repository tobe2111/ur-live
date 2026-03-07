import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveStreamPlayer } from '@/components/live/LiveStreamPlayer';

// Mock YouTube API
global.window = global.window || {};
(global.window as any).YT = {
  Player: vi.fn(),
};

describe('LiveStreamPlayer', () => {
  it('renders loading state when no video ID provided', () => {
    render(<LiveStreamPlayer />);
    
    expect(screen.getByText('스트림을 불러오는 중...')).toBeInTheDocument();
  });

  it('renders with youtube video ID', () => {
    const { container } = render(<LiveStreamPlayer youtubeVideoId="test-video-id" />);
    
    // Should render player container (div with ref)
    expect(container.querySelector('.w-full.h-full')).toBeInTheDocument();
  });

  it('shows LIVE badge in fullscreen mode', () => {
    render(<LiveStreamPlayer youtubeVideoId="test-video" isFullscreen={true} />);
    
    expect(screen.getByText('LIVE')).toBeInTheDocument();
  });

  it('does not show LIVE badge when not fullscreen', () => {
    render(<LiveStreamPlayer youtubeVideoId="test-video" isFullscreen={false} />);
    
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <LiveStreamPlayer youtubeVideoId="test" className="custom-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('renders loading emoji', () => {
    render(<LiveStreamPlayer />);
    
    expect(screen.getByText('📹')).toBeInTheDocument();
  });
});
