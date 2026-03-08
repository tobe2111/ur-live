import { useState, useCallback } from 'react'

export interface LiveStreamUIState {
  isFullscreen: boolean
  setIsFullscreen: (value: boolean) => void
  toggleFullscreen: () => void
  
  showChat: boolean
  setShowChat: (value: boolean) => void
  toggleChat: () => void
  
  selectedProduct: string | null
  setSelectedProduct: (productId: string | null) => void
  
  showProductModal: boolean
  setShowProductModal: (value: boolean) => void
  
  isMuted: boolean
  setIsMuted: (value: boolean) => void
  toggleMute: () => void
}

// 🎯 라이브 스트림 UI 상태 관리 Hook
export function useLiveStreamUI(): LiveStreamUIState {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showChat, setShowChat] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null)
  const [showProductModal, setShowProductModal] = useState(false)
  const [isMuted, setIsMuted] = useState(false)

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev)
  }, [])

  const toggleChat = useCallback(() => {
    setShowChat((prev) => !prev)
  }, [])

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev)
  }, [])

  return {
    isFullscreen,
    setIsFullscreen,
    toggleFullscreen,
    
    showChat,
    setShowChat,
    toggleChat,
    
    selectedProduct,
    setSelectedProduct,
    
    showProductModal,
    setShowProductModal,
    
    isMuted,
    setIsMuted,
    toggleMute,
  }
}
