import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LiveChatPanel } from '@/components/live/LiveChatPanel';

describe('LiveChatPanel', () => {
  const mockMessages = [
    { id: '1', username: 'User1', message: 'Hello!', timestamp: Date.now() },
    { id: '2', username: 'User2', message: 'Hi there!', timestamp: Date.now() },
  ];

  const defaultProps = {
    streamId: 'stream-123',
    messages: [],
    onSendMessage: vi.fn(),
    isVisible: true,
    onToggle: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders chat panel when visible', () => {
    render(<LiveChatPanel {...defaultProps} />);
    
    expect(screen.getByText('실시간 채팅')).toBeInTheDocument();
    expect(screen.getByText('LIVE')).toBeInTheDocument();
  });

  it('renders floating button when not visible', () => {
    render(<LiveChatPanel {...defaultProps} isVisible={false} />);
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('shows message count badge when hidden', () => {
    render(
      <LiveChatPanel {...defaultProps} isVisible={false} messages={mockMessages} />
    );
    
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows 99+ for large message counts', () => {
    const manyMessages = Array.from({ length: 150 }, (_, i) => ({
      id: `${i}`,
      username: `User${i}`,
      message: 'Test',
    }));

    render(
      <LiveChatPanel {...defaultProps} isVisible={false} messages={manyMessages} />
    );
    
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('renders empty state when no messages', () => {
    render(<LiveChatPanel {...defaultProps} />);
    
    expect(screen.getByText('첫 번째 메시지를 남겨보세요!')).toBeInTheDocument();
  });

  it('renders messages correctly', () => {
    render(<LiveChatPanel {...defaultProps} messages={mockMessages} />);

    // Usernames are masked by maskUserName(): 'User1' → 'U***1', 'User2' → 'U***2'
    expect(screen.getByText('U***1')).toBeInTheDocument();
    expect(screen.getByText('Hello!')).toBeInTheDocument();
    expect(screen.getByText('U***2')).toBeInTheDocument();
    expect(screen.getByText('Hi there!')).toBeInTheDocument();
  });

  it('calls onToggle when close button clicked', () => {
    render(<LiveChatPanel {...defaultProps} />);
    
    const closeButton = screen.getAllByRole('button').find(
      btn => btn.querySelector('svg')?.classList.contains('lucide-x')
    );
    fireEvent.click(closeButton!);
    
    expect(defaultProps.onToggle).toHaveBeenCalledTimes(1);
  });

  it('calls onSendMessage when send button clicked', () => {
    render(<LiveChatPanel {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('메시지를 입력하세요...');
    fireEvent.change(input, { target: { value: 'Test message' } });
    
    const sendButton = screen.getAllByRole('button').find(
      btn => btn.querySelector('svg')?.classList.contains('lucide-send')
    );
    fireEvent.click(sendButton!);
    
    expect(defaultProps.onSendMessage).toHaveBeenCalledWith('Test message');
  });

  it('clears input after sending message', () => {
    render(<LiveChatPanel {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('메시지를 입력하세요...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Test' } });
    
    const sendButton = screen.getAllByRole('button').find(
      btn => btn.querySelector('svg')?.classList.contains('lucide-send')
    );
    fireEvent.click(sendButton!);
    
    expect(input.value).toBe('');
  });

  it('disables send button when input is empty', () => {
    render(<LiveChatPanel {...defaultProps} />);
    
    const sendButton = screen.getAllByRole('button').find(
      btn => btn.querySelector('svg')?.classList.contains('lucide-send')
    );
    
    expect(sendButton).toBeDisabled();
  });

  it('displays current username', () => {
    render(<LiveChatPanel {...defaultProps} currentUsername="TestUser" />);
    
    expect(screen.getByText(/TestUser\(으\)로 참여 중/)).toBeInTheDocument();
  });

  it('displays character count', () => {
    render(<LiveChatPanel {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('메시지를 입력하세요...');
    fireEvent.change(input, { target: { value: 'Hello' } });
    
    expect(screen.getByText(/5\/200/)).toBeInTheDocument();
  });

  it('handles Enter key to send message', () => {
    render(<LiveChatPanel {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('메시지를 입력하세요...');
    fireEvent.change(input, { target: { value: 'Test' } });
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });
    
    expect(defaultProps.onSendMessage).toHaveBeenCalledWith('Test');
  });
});
