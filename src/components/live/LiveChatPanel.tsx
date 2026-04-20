import React, { useState, useRef, useEffect } from 'react'
import { Send, X, MessageCircle } from 'lucide-react'
import { maskUserName } from './LiveUtils'

interface ChatMessage {
  id: string
  username: string
  message: string
  timestamp?: number
}

interface LiveChatPanelProps {
  streamId: string
  messages: ChatMessage[]
  onSendMessage: (message: string) => void
  isVisible: boolean
  onToggle: () => void
  currentUsername?: string
  className?: string
}

export const LiveChatPanel = React.memo(function LiveChatPanel({
  streamId,
  messages,
  onSendMessage,
  isVisible,
  onToggle,
  currentUsername = '익명',
  className = ''
}: LiveChatPanelProps) {
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 자동 스크롤
  useEffect(() => {
    if (messagesEndRef.current && isVisible) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isVisible])

  const handleSendMessage = () => {
    const trimmedMessage = inputValue.trim()
    if (!trimmedMessage) return

    onSendMessage(trimmedMessage)
    setInputValue('')
    inputRef.current?.focus()
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  if (!isVisible) {
    return (
      <button
        onClick={onToggle}
        className={`fixed bottom-20 right-4 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-colors ${className}`}
      >
        <MessageCircle size={24} />
        {messages.length > 0 && (
          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
            {messages.length > 99 ? '99+' : messages.length}
          </div>
        )}
      </button>
    )
  }

  return (
    <div className={`flex flex-col bg-white rounded-lg shadow-xl ${className}`}>
      {/* 헤더 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <MessageCircle size={20} className="text-blue-600" />
          <h3 className="font-bold text-gray-900">실시간 채팅</h3>
          <div className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
            LIVE
          </div>
        </div>
        <button
          onClick={onToggle}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[500px]">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <MessageCircle size={48} className="mx-auto mb-2 opacity-50" />
              <p>첫 번째 메시지를 남겨보세요!</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div key={msg.id} className="flex gap-2">
                <div className="flex-shrink-0 w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-bold text-gray-600">
                  {msg.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-sm text-gray-900">
                      {maskUserName(msg.username)}
                    </span>
                    {msg.timestamp && (
                      <span className="text-xs text-gray-400">
                        {new Date(msg.timestamp).toLocaleTimeString('ko-KR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 mt-1 break-words">
                    {msg.message}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 입력창 */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="메시지를 입력하세요..."
            maxLength={200}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Send size={18} />
          </button>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          {currentUsername}(으)로 참여 중 • {inputValue.length}/200
        </div>
      </div>
    </div>
  )
})
