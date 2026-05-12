import { create } from 'zustand'
import type { ChatMessage } from '@/types/live-stream'

interface StreamProduct {
  id: number
  name: string
  price: number
  originalPrice?: number
  original_price?: number
  image?: string
  image_url?: string
}

interface StreamStoreState {
  streamId: number | null
  title: string
  sellerName: string
  viewerCount: number
  currentProductId: number | null
  products: StreamProduct[]
  messages: ChatMessage[]
  isConnected: boolean
  sendMessage: ((msg: string, userId: number, userName: string, userType: 'viewer' | 'streamer' | 'system') => Promise<void>) | null

  // 스트림별 메시지 캐시 — 재입장(unmount→mount) 시 채팅 내역 복원
  messageCache: Map<number, ChatMessage[]>

  setStream: (data: { id: number; title: string; sellerName: string }) => void
  setViewerCount: (n: number) => void
  setCurrentProductId: (id: number | null) => void
  setProducts: (products: StreamProduct[]) => void
  setMessages: (messages: ChatMessage[]) => void
  setConnected: (b: boolean) => void
  setSendMessage: (fn: StreamStoreState['sendMessage']) => void
  getCachedMessages: (streamId: number) => ChatMessage[]
  reset: () => void
}

const initial = {
  streamId: null,
  title: '',
  sellerName: '',
  viewerCount: 0,
  currentProductId: null,
  products: [],
  messages: [],
  isConnected: false,
  sendMessage: null,
  messageCache: new Map<number, ChatMessage[]>(),
}

export const useStreamStore = create<StreamStoreState>((set, get) => ({
  ...initial,

  setStream: ({ id, title, sellerName }) =>
    set({ streamId: id, title, sellerName }),

  setViewerCount: (viewerCount) => set({ viewerCount }),

  setCurrentProductId: (currentProductId) => set({ currentProductId }),

  setProducts: (products) => set({ products }),

  setMessages: (messages) => {
    const streamId = get().streamId
    if (streamId && messages.length > 0) {
      const cache = get().messageCache
      cache.set(streamId, messages.slice(-200))
    }
    set({ messages })
  },

  setConnected: (isConnected) => set({ isConnected }),

  setSendMessage: (sendMessage) => set({ sendMessage }),

  getCachedMessages: (streamId: number) => {
    return get().messageCache.get(streamId) ?? []
  },

  reset: () => set({ ...initial, messageCache: get().messageCache }),
}))
