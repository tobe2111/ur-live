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

  setStream: (data: { id: number; title: string; sellerName: string }) => void
  setViewerCount: (n: number) => void
  setCurrentProductId: (id: number | null) => void
  setProducts: (products: StreamProduct[]) => void
  setMessages: (messages: ChatMessage[]) => void
  setConnected: (b: boolean) => void
  setSendMessage: (fn: StreamStoreState['sendMessage']) => void
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
}

export const useStreamStore = create<StreamStoreState>(set => ({
  ...initial,

  setStream: ({ id, title, sellerName }) =>
    set({ streamId: id, title, sellerName }),

  setViewerCount: (viewerCount) => set({ viewerCount }),

  setCurrentProductId: (currentProductId) => set({ currentProductId }),

  setProducts: (products) => set({ products }),

  setMessages: (messages) => set({ messages }),

  setConnected: (isConnected) => set({ isConnected }),

  setSendMessage: (sendMessage) => set({ sendMessage }),

  reset: () => set(initial),
}))
