import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Eye, ShoppingBag, MessageCircle, Share2, X, Star, Check, Minus, Plus, Send } from 'lucide-react'
import axios from 'axios'
import { getUserId } from '@/utils/auth'
import api from '@/lib/api'
import { useModal } from '@/components/CustomModal'
import { useLiveChat } from '@/hooks/useLiveChat'

// ============================================
// Suppress YouTube Console Errors
// ============================================
if (typeof window !== 'undefined') {
  const originalError = console.error
  const originalWarn = console.warn
  
  console.error = (...args: any[]) => {
    const message = args[0]?.toString() || ''
    // Filter out YouTube-related errors
    if (
      message.includes('postMessage') ||
      message.includes('touchstart') ||
      message.includes('touchmove') ||
      message.includes('www-embed-player') ||
      message.includes('www-widgetapi') ||
      message.includes('youtube.com') ||
      message.includes('DOMWindow')
    ) {
      return // Suppress these errors
    }
    originalError.apply(console, args)
  }
  
  console.warn = (...args: any[]) => {
    const message = args[0]?.toString() || ''
    // Filter out YouTube-related warnings
    if (
      message.includes('passive event listener') ||
      message.includes('touchstart') ||
      message.includes('touchmove') ||
      message.includes('[Violation]')
    ) {
      return // Suppress these warnings
    }
    originalWarn.apply(console, args)
  }
}

// ============================================
// TypeScript Interfaces
// ============================================
interface Stream {
  id: number
  title: string
  streamerName: string
  streamerAvatar?: string
  videoUrl?: string
  youtube_video_id?: string
  status: 'live' | 'ended' | 'scheduled'
  viewerCount: number
  products?: Product[]
  seller_youtube?: string
  seller_instagram?: string
  seller_kakao?: string
  current_product_id?: number | null
  seller_id?: number
}

interface Product {
  id: number
  name: string
  price: number
  originalPrice: number
  image: string
  description: string
  rating: number
  sold: number
  colors?: { name: string; hex: string }[]
  sizes?: string[]
}

interface ChatMessage {
  id: string
  username: string
  message: string
}

interface ReelData {
  stream: Stream
  product: Product
}

// ============================================
// Demo Data (for fallback)
// ============================================
const demoStreams: Stream[] = [
  {
    id: 1,
    title: '프리미엄 헤드폰 라이브',
    streamerName: 'Marcus Chen',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    youtube_video_id: 'dQw4w9WgXcQ',
    status: 'live',
    viewerCount: 12400,
    products: []
  },
  {
    id: 2,
    title: '골드 주얼리 특가',
    streamerName: 'Sofia Laurent',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    youtube_video_id: 'dQw4w9WgXcQ',
    status: 'live',
    viewerCount: 34200,
    products: []
  },
  {
    id: 3,
    title: '스니커즈 신상품',
    streamerName: 'Jake Morrison',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    youtube_video_id: 'dQw4w9WgXcQ',
    status: 'live',
    viewerCount: 52000,
    products: []
  }
]

const demoProducts: Product[] = [
  {
    id: 1,
    name: 'Nova Pro Wireless Headphones',
    price: 89.99,
    originalPrice: 149.99,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800',
    description: 'Premium noise-cancelling headphones with 30-hour battery life and studio-quality sound.',
    rating: 4.8,
    sold: 2340,
    colors: [
      { name: 'Midnight Black', hex: '#1a1a1a' },
      { name: 'Space Gray', hex: '#6b6b6b' },
      { name: 'Rose Gold', hex: '#b76e79' }
    ]
  },
  {
    id: 2,
    name: 'Luna Gold Jewelry Set',
    price: 45.00,
    originalPrice: 78.00,
    image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800',
    description: 'Elegant 18K gold-plated necklace and earring set, perfect for special occasions.',
    rating: 4.9,
    sold: 8720,
    colors: [
      { name: 'Gold', hex: '#ffd700' },
      { name: 'Silver', hex: '#c0c0c0' },
      { name: 'Rose Gold', hex: '#b76e79' }
    ]
  },
  {
    id: 3,
    name: 'StreetX Cloud Sneakers',
    price: 62.00,
    originalPrice: 120.00,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800',
    description: 'Ultra-comfortable running shoes with cloud-like cushioning and breathable mesh.',
    rating: 4.7,
    sold: 15600,
    sizes: ['US 7', 'US 8', 'US 9', 'US 10', 'US 11', 'US 12'],
    colors: [
      { name: 'Triple White', hex: '#ffffff' },
      { name: 'Core Black', hex: '#000000' },
      { name: 'Navy Blue', hex: '#000080' }
    ]
  },
  {
    id: 4,
    name: 'Glow Elixir Vitamin C Serum',
    price: 24.99,
    originalPrice: 55.00,
    image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800',
    description: 'Brightening serum with 20% vitamin C for radiant, youthful skin.',
    rating: 4.9,
    sold: 42100
  },
  {
    id: 5,
    name: 'Pulse Ultra Smartwatch',
    price: 129.00,
    originalPrice: 249.00,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800',
    description: 'Advanced fitness tracking, heart rate monitoring, and 7-day battery life.',
    rating: 4.6,
    sold: 6890,
    colors: [
      { name: 'Black', hex: '#000000' },
      { name: 'Silver', hex: '#c0c0c0' },
      { name: 'Gold', hex: '#ffd700' }
    ]
  },
  {
    id: 6,
    name: 'Premium Leather Wallet',
    price: 35.00,
    originalPrice: 65.00,
    image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=800',
    description: 'Genuine leather bifold wallet with RFID protection and card slots.',
    rating: 4.7,
    sold: 12300,
    colors: [
      { name: 'Black', hex: '#000000' },
      { name: 'Brown', hex: '#8b4513' },
      { name: 'Tan', hex: '#d2b48c' }
    ]
  },
  {
    id: 7,
    name: 'Wireless Charging Pad',
    price: 19.99,
    originalPrice: 39.99,
    image: 'https://images.unsplash.com/photo-1591290619762-0c0a6b5c2e7a?w=800',
    description: 'Fast wireless charger compatible with all Qi-enabled devices.',
    rating: 4.5,
    sold: 18900
  },
  {
    id: 8,
    name: 'Eco-Friendly Water Bottle',
    price: 12.99,
    originalPrice: 24.99,
    image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800',
    description: 'Stainless steel insulated bottle keeps drinks cold for 24 hours.',
    rating: 4.8,
    sold: 31200,
    colors: [
      { name: 'Black', hex: '#000000' },
      { name: 'Blue', hex: '#0000ff' },
      { name: 'Pink', hex: '#ff69b4' }
    ]
  },
  {
    id: 9,
    name: 'Minimalist Backpack',
    price: 49.00,
    originalPrice: 89.00,
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800',
    description: 'Sleek design with laptop compartment and water-resistant material.',
    rating: 4.6,
    sold: 9800,
    colors: [
      { name: 'Black', hex: '#000000' },
      { name: 'Gray', hex: '#808080' },
      { name: 'Navy', hex: '#000080' }
    ]
  },
  {
    id: 10,
    name: 'Bluetooth Speaker',
    price: 39.99,
    originalPrice: 79.99,
    image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800',
    description: 'Portable speaker with 360° sound and 12-hour playtime.',
    rating: 4.7,
    sold: 22500,
    colors: [
      { name: 'Black', hex: '#000000' },
      { name: 'Red', hex: '#ff0000' },
      { name: 'Blue', hex: '#0000ff' }
    ]
  }
]

// ============================================
// Utility Functions
// ============================================
const usernames = [
  'minjae_92', 'yuna_shop', 'hyejin.k', 'joonho_lee', 'soyeon_99',
  'dohyun_park', 'seulgi.m', 'taehyung_fan', 'nayeon_j', 'woojin.c',
]

const chatTexts = [
  '와 대박', '이거 진짜 좋아요', '가격 너무 착하다',
  '색상 이쁘다', '사이즈 추천해주세요!', '라이브 할인 최고',
  '지금 사야되나요?', '품절되기 전에 빨리!', '배송 얼마나 걸려요?',
  '후기 좋던데', '이거 선물용으로도 괜찮나요?', '재입고 언제 해요?',
]

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function formatViewers(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toString()
}

// ============================================
// Sub Components
// ============================================

// YouTube/Instagram/KakaoTalk Icons
function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  )
}

function KakaoTalkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 3c-5.523 0-10 3.694-10 8.25 0 2.904 1.887 5.46 4.726 6.924-.157.564-.57 2.044-.652 2.362-.101.395.145.39.305.284.125-.083 1.994-1.355 2.808-1.907A11.59 11.59 0 0 0 12 19.5c5.523 0 10-3.694 10-8.25S17.523 3 12 3z" />
    </svg>
  )
}

// TopNav Component
function TopNav({ viewers, sellerLinks }: { viewers: number; sellerLinks?: { youtube?: string; instagram?: string; kakao?: string } }) {
  return (
    <header className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-4 pt-safe pb-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-lg bg-red-500/90 backdrop-blur-sm px-2.5 py-1.5 shadow-lg shadow-red-500/30">
          <span className="h-2 w-2 rounded-full bg-white animate-blink-live" />
          <span className="text-xs font-extrabold tracking-wider text-white">LIVE</span>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-black/40 backdrop-blur-md px-2.5 py-1.5">
          <Eye className="h-3.5 w-3.5 text-white/80" />
          <span className="text-xs font-semibold text-white/90">
            {formatViewers(viewers)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 h-[34px]">
        {sellerLinks?.youtube && (
          <a
            href={sellerLinks.youtube}
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-50 hover:opacity-80 transition-opacity flex items-center justify-center"
            aria-label="YouTube"
          >
            <YouTubeIcon className="h-[18px] w-[18px] text-white" />
          </a>
        )}
        {sellerLinks?.instagram && (
          <a
            href={sellerLinks.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-50 hover:opacity-80 transition-opacity flex items-center justify-center"
            aria-label="Instagram"
          >
            <InstagramIcon className="h-[18px] w-[18px] text-white" />
          </a>
        )}
        {sellerLinks?.kakao && (
          <a
            href={sellerLinks.kakao}
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-50 hover:opacity-80 transition-opacity flex items-center justify-center"
            aria-label="KakaoTalk"
          >
            <KakaoTalkIcon className="h-[18px] w-[18px] text-white" />
          </a>
        )}
      </div>
    </header>
  )
}

// LiveChat Component with SSE
function LiveChat({ streamId, onChatClick }: { streamId: number; onChatClick: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  
  // 🔥 SSE 기반 실시간 채팅
  const { messages, isConnected, error, sendMessage } = useLiveChat(streamId, !!streamId)

  // 자동 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div
      ref={scrollRef}
      className="flex flex-col overflow-hidden cursor-pointer"
      style={{ gap: '2px' }}
      onClick={onChatClick}
    >
      {/* 연결 상태 표시 - 사용자에게 보이지 않음 (백그라운드 자동 재연결) */}
      {/* SSE 연결이 끊어져도 자동으로 재연결되므로 알림 표시 안 함 */}
      
      {/* SSE 메시지 렌더링 */}
      {messages.map((msg) => (
        <p
          key={msg.id}
          className="text-[11px] leading-[1.3] animate-fade-in"
          style={{
            textShadow: '0 1px 4px rgba(0,0,0,0.8), 0 0 12px rgba(0,0,0,0.5)',
          }}
        >
          <span className="font-bold text-white/90">{msg.userName}</span>
          <span className="text-white/70">{' '}{msg.message}</span>
        </p>
      ))}
    </div>
  )
}

// ProductSheet Component
function ProductSheet({
  product,
  onClose,
}: {
  product: Product
  onClose: () => void
}) {
  const [selectedColor, setSelectedColor] = useState(0)
  const [selectedSize, setSelectedSize] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [addedToCart, setAddedToCart] = useState(false)

  const originalPrice = product.originalPrice || product.original_price || product.price
  const currentPrice = product.price || 0

  const discount = originalPrice > currentPrice
    ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
    : 0

  function handleAddToCart() {
    setAddedToCart(true)
    setTimeout(() => {
      setAddedToCart(false)
      onClose()
    }, 1500)
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm animate-overlay-in"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-[70] max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-white backdrop-blur-xl border-t border-gray-200 animate-sheet-up no-scrollbar">
        {/* Handle */}
        <div className="sticky top-0 z-10 flex items-center justify-center py-3 bg-white/60 backdrop-blur-md">
          <div className="h-1 w-10 rounded-full bg-gray-300" />
          <button
            onClick={onClose}
            className="absolute right-4 flex h-8 w-8 items-center justify-center rounded-full bg-gray-200"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-gray-800" />
          </button>
        </div>

        <div className="px-5 pb-8">
          {/* Product header */}
          <div className="flex items-start gap-4 mb-6">
            <div className="h-20 w-20 shrink-0 rounded-2xl overflow-hidden bg-gray-100">
              <img
                src={product.image || product.image_url || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-gray-900 leading-tight mb-1">
                {product.name}
              </h3>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex items-center gap-0.5">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  <span className="text-sm font-semibold text-gray-900">{product.rating || 4.5}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {(product.sold || product.sold_count || 0).toLocaleString()} sold
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-red-500">
                  ${(product.price || 0).toFixed(2)}
                </span>
                {(product.originalPrice || product.original_price) && (
                  <>
                    <span className="text-sm text-gray-400 line-through">
                      ${(product.originalPrice || product.original_price || 0).toFixed(2)}
                    </span>
                    <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-xs font-bold text-red-500">
                      -{discount}%
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <p className="text-sm text-gray-600 leading-relaxed mb-5">
              {product.description}
            </p>
          )}

          {/* Colors */}
          {product.colors && (
            <div className="mb-5">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">
                {'Color: '}
                <span className="font-normal text-gray-500">
                  {product.colors[selectedColor].name}
                </span>
              </h4>
              <div className="flex items-center gap-3">
                {product.colors.map((color, i) => (
                  <button
                    key={color.name}
                    onClick={() => setSelectedColor(i)}
                    className={`relative h-9 w-9 rounded-full transition-all duration-200 ${
                      selectedColor === i
                        ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-white scale-110'
                        : 'ring-1 ring-gray-300'
                    }`}
                    style={{ backgroundColor: color.hex }}
                    aria-label={color.name}
                  >
                    {selectedColor === i && (
                      <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow-md" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sizes */}
          {product.sizes && (
            <div className="mb-5">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Size</h4>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((size, i) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(i)}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                      selectedSize === i
                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Quantity</h4>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-700 transition-colors hover:bg-gray-200"
                aria-label="Decrease quantity"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="text-lg font-bold text-gray-900 w-8 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-700 transition-colors hover:bg-gray-200"
                aria-label="Increase quantity"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Add to cart button */}
          <button
            onClick={handleAddToCart}
            className={`w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold transition-all duration-300 ${
              addedToCart
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                : 'bg-red-500 text-white shadow-lg shadow-red-500/40 active:scale-[0.97]'
            }`}
          >
            {addedToCart ? (
              <>
                <Check className="h-5 w-5" />
                Added to Cart
              </>
            ) : (
              <>
                <ShoppingBag className="h-5 w-5" />
                {'Add to Cart - $'}{(product.price * quantity).toFixed(2)}
              </>
            )}
          </button>
        </div>
      </div>
    </>
  )
}

// ReelCard Component
function ReelCard({ 
  reel, 
  isActive, 
  isCurrentProduct = false 
}: { 
  reel: ReelData
  isActive: boolean
  isCurrentProduct?: boolean 
}) {
  const navigate = useNavigate()
  const { showAlert } = useModal()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [chatModalOpen, setChatModalOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<any>(null)
  const [playerReady, setPlayerReady] = useState(false)
  const [showPlayButton, setShowPlayButton] = useState(true)
  
  // Cart & Purchase state
  const [addingToCart, setAddingToCart] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [showNotification, setShowNotification] = useState(false)
  const [notificationText, setNotificationText] = useState('')
  const [currentProduct, setCurrentProduct] = useState(reel.product)
  const [isLoggedIn, setIsLoggedIn] = useState(!!getUserId())
  
  // Chat input
  const [chatMessage, setChatMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)

  const { product, stream } = reel
  
  // 🔥 SSE 기반 실시간 채팅 (메시지 전송용)
  const { sendMessage: sendChatMessage } = useLiveChat(stream.id, true)

  // YouTube Player Integration
  useEffect(() => {
    // Initialize player for all reels (not just active one)
    // isActive check removed - this fixes YouTube video not playing issue
    if (!stream.youtube_video_id) return

    let player: any = null
    let isMounted = true

    const initializePlayer = () => {
      try {
        console.log(`[ReelCard] Initializing player for stream ${stream.id}:`, stream.youtube_video_id)
        // @ts-ignore
        if (!window.YT || !window.YT.Player) {
          console.log(`[ReelCard] YouTube API not ready for stream ${stream.id}`)
          return
        }
        if (!isMounted) {
          console.log(`[ReelCard] Component unmounted for stream ${stream.id}`)
          return
        }

        const playerElement = document.getElementById(`youtube-player-${stream.id}`)
        if (!playerElement) {
          console.log(`[ReelCard] Player element not found for stream ${stream.id}`)
          return
        }

        console.log(`[ReelCard] Creating YouTube player for stream ${stream.id}`)
        playerElement.innerHTML = ''

        // @ts-ignore
        player = new window.YT.Player(`youtube-player-${stream.id}`, {
          height: '100%',
          width: '100%',
          videoId: stream.youtube_video_id,
          playerVars: {
            autoplay: 0, // Don't autoplay (user must click)
            mute: 1,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
            iv_load_policy: 3,
            playsinline: 1,
            enablejsapi: 1,
            // origin and widget_referrer removed to fix postMessage errors
            loop: 1,
            playlist: stream.youtube_video_id,
            fs: 0,
            cc_load_policy: 0,
          },
          events: {
            onReady: (event: any) => {
              if (!isMounted) return
              console.log(`[ReelCard] YouTube Player ready for stream ${stream.id}:`, stream.youtube_video_id)
              playerRef.current = event.target
              setPlayerReady(true)
              setShowPlayButton(true) // Show play button overlay
            },
            onStateChange: (event: any) => {
              if (!isMounted) return
              try {
                // @ts-ignore
                if (event.data === window.YT.PlayerState.PLAYING) {
                  setShowPlayButton(false)
                } else if (event.data === window.YT.PlayerState.PAUSED) {
                  setShowPlayButton(true)
                }
              } catch (e) {
                // Suppress postMessage errors
              }
            },
            onError: (event: any) => {
              if (!isMounted) return
              console.error(`[ReelCard] YouTube player error for video ${stream.youtube_video_id}:`, event.data)
              // Error codes: 2=invalid ID, 5=HTML5 error, 100=not found, 101/150=embedding disabled
              setShowPlayButton(true)
            },
          },
        })
      } catch (error) {
        // Only log critical errors, suppress postMessage
        if (error instanceof Error && !error.message.includes('postMessage')) {
          console.error('[ReelCard] YouTube player error:', error.message)
        }
      }
    }

    // @ts-ignore
    if (window.YT && window.YT.Player) {
      console.log(`[ReelCard] YouTube API already loaded, initializing stream ${stream.id}`)
      initializePlayer()
    } else {
      console.log(`[ReelCard] YouTube API not loaded, queueing callback for stream ${stream.id}`)
      const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]')
      if (!existingScript) {
        console.log('[ReelCard] Loading YouTube IFrame API script')
        const tag = document.createElement('script')
        tag.src = 'https://www.youtube.com/iframe_api'
        tag.async = true
        const firstScriptTag = document.getElementsByTagName('script')[0]
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag)
      }

      // Store callback in array to support multiple reels
      // @ts-ignore
      if (!window.youtubeCallbacks) {
        console.log('[ReelCard] Creating YouTube callbacks array')
        // @ts-ignore
        window.youtubeCallbacks = []
        // @ts-ignore
        window.onYouTubeIframeAPIReady = () => {
          console.log('[ReelCard] YouTube IFrame API ready, executing callbacks:', window.youtubeCallbacks.length)
          // @ts-ignore
          window.youtubeCallbacks.forEach(cb => cb())
          // @ts-ignore
          window.youtubeCallbacks = []
        }
      }
      // @ts-ignore
      window.youtubeCallbacks.push(() => {
        console.log(`[ReelCard] Executing queued callback for stream ${stream.id}`)
        if (isMounted) initializePlayer()
      })
    }

    return () => {
      isMounted = false
      if (player && typeof player.destroy === 'function') {
        try {
          player.destroy()
        } catch (error) {
          // Suppress cleanup errors
        }
      }
    }
  }, [stream.youtube_video_id, stream.id])  // isActive removed from dependencies

  const handleVideoClick = () => {
    if (playerRef.current && playerReady) {
      playerRef.current.playVideo()
      setShowPlayButton(false)
    }
  }

  // ============================================
  // Real-time Product Updates (Long Polling - 비용 99% 절감! 🎉)
  // ============================================
  useEffect(() => {
    if (!stream.id) return

    let abortController: AbortController | null = null
    let lastTimestamp = '0' // 마지막 상품 변경 타임스탬프

    const loadCurrentProduct = async () => {
      try {
        const response = await axios.get(`/api/streams/${stream.id}/current-product`)
        if (response.data.success && response.data.data) {
          setCurrentProduct(response.data.data.product)
        } else {
          setCurrentProduct(null)
        }
      } catch (error) {
        console.error('[CurrentProduct] Error loading:', error)
      }
    }

    const waitForProductChange = async () => {
      while (true) {
        try {
          // ✅ Long Polling: 상품이 변경될 때까지 대기 (최대 25초)
          abortController = new AbortController()
          const response = await axios.get(
            `/api/streams/${stream.id}/product-wait?lastTimestamp=${lastTimestamp}`,
            { signal: abortController.signal }
          )
          
          const result = response.data

          if (result.success) {
            if (result.changed && result.data) {
              // 상품 변경됨 - 즉시 UI 업데이트 ⚡
              setCurrentProduct(result.data.product)
              lastTimestamp = result.timestamp
            }
            // 변경 없어도 계속 대기 (재연결)
          }
        } catch (err: any) {
          if (axios.isCancel(err) || err.name === 'AbortError') {
            // Cleanup에서 호출된 중단
            break
          }
          console.error('[LongPolling] Error:', err)
          // 에러 발생 시 3초 대기 후 재연결
          await new Promise(resolve => setTimeout(resolve, 3000))
        }
      }
    }

    // 초기 로드 후 Long Polling 시작
    loadCurrentProduct()
    waitForProductChange()

    return () => {
      // Cleanup: Long Polling 중단
      if (abortController) {
        abortController.abort()
      }
    }
  }, [stream.id])

  // ============================================
  // Mask Username Helper
  // ============================================
  function maskUserName(name: string): string {
    if (!name || name.length === 0) return '익명'
    if (name === '익명' || name === 'Anonymous') return name
    
    if (name.length === 1) {
      return name + '*'
    } else if (name.length === 2) {
      return name[0] + '*'
    } else if (name.length === 3) {
      return name[0] + '*' + name[2]
    } else {
      return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1]
    }
  }

  // ============================================
  // Kakao Login Handler
  // ============================================
  async function handleKakaoLogin() {
    try {
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      navigate('/login?returnUrl=' + encodeURIComponent(window.location.pathname))
    } catch (error) {
      console.error('[Login] Exception:', error)
      showAlert('로그인 페이지로 이동 중 오류가 발생했습니다.', 'error', '오류 발생')
    }
  }

  // ============================================
  // Add to Cart Handler
  // ============================================
  async function handleAddToCart() {
    if (!currentProduct) return
    if (addingToCart) return // Prevent double-click
    
    // Check stock
    if ((currentProduct as any).stock === 0) {
      setNotificationText('품절된 상품입니다')
      setShowNotification(true)
      setTimeout(() => setShowNotification(false), 2000)
      return
    }

    // Check login first
    if (!isLoggedIn) {
      // Save temp cart item
      const tempCart = {
        productId: currentProduct.id,
        quantity: 1,
        priceSnapshot: currentProduct.price,
        liveStreamId: stream.id,
        productName: currentProduct.name,
        timestamp: Date.now()
      }
      localStorage.setItem('tempCartItem', JSON.stringify(tempCart))
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      
      showAlert('로그인이 필요합니다!', 'warning', '로그인 필요')
      handleKakaoLogin()
      return
    }

    setAddingToCart(true)
    try {
      const userId = getUserId()
      
      if (!userId) {
        localStorage.setItem('loginReturnUrl', window.location.pathname)
        
        const tempCartData = {
          productId: currentProduct.id,
          productName: currentProduct.name,
          quantity: 1,
          priceSnapshot: currentProduct.price,
          liveStreamId: stream.id
        }
        localStorage.setItem('tempCartItem', JSON.stringify(tempCartData))
        
        showAlert('로그인이 필요합니다. 로그인 후 자동으로 장바구니에 담아드립니다.', 'info', '로그인 필요')
        setTimeout(() => {
          window.location.href = '/login'
        }, 1500)
        return
      }
      
      // POST to server
      await axios.post('/api/cart', {
        userId: userId,
        productId: currentProduct.id,
        quantity: 1,
        priceSnapshot: currentProduct.price,
        liveStreamId: stream.id
      })
      
      // Set flag
      localStorage.setItem('hasCartItems', 'true')

      // Show notification
      setNotificationText(`${currentProduct.name}을(를) 담았습니다!`)
      setShowNotification(true)
      setTimeout(() => setShowNotification(false), 2000)

      // 🔥 SSE 기반 시스템 메시지 전송
      try {
        const userName = localStorage.getItem('user_name') || '익명'
        const maskedName = maskUserName(userName)
        
        await sendChatMessage(
          `${maskedName}님이 ${currentProduct.name}을(를) 담았습니다!`,
          0, // System user ID
          '🎉 시스템',
          'viewer'
        )
      } catch (error) {
        console.error('시스템 메시지 전송 실패:', error)
      }
    } catch (error: any) {
      console.error('Failed to add to cart:', error)
      const errorMessage = error.response?.data?.error || error.message || '장바구니 추가에 실패했습니다.'
      
      if (errorMessage.includes('Insufficient stock') || errorMessage.includes('재고가 부족')) {
        setNotificationText('재고가 부족합니다')
        setShowNotification(true)
        setTimeout(() => setShowNotification(false), 2500)
      } else {
        showAlert(errorMessage, 'error', '장바구니 추가 실패')
      }
    } finally {
      setAddingToCart(false)
    }
  }

  // ============================================
  // Checkout Handler
  // ============================================
  async function handleCheckout() {
    if (checkingOut) return // Prevent double-click
    
    // Check login FIRST
    if (!isLoggedIn) {
      showAlert('로그인이 필요합니다!', 'warning', '로그인 필요')
      handleKakaoLogin()
      return
    }
    
    // Check if cart has items
    const hasCartItems = localStorage.getItem('hasCartItems')
    
    if (!hasCartItems || hasCartItems !== 'true') {
      showAlert('상품을 먼저 담아주세요!', 'info', '상품 담기')
      return
    }
    
    setCheckingOut(true)
    try {
      const userId = getUserId()
      
      if (!userId) {
        localStorage.setItem('loginReturnUrl', window.location.pathname)
        showAlert('로그인이 필요합니다.', 'warning', '로그인 필요')
        setCheckingOut(false)
        setTimeout(() => {
          window.location.href = '/login'
        }, 1500)
        return
      }
      
      const response = await api.get('/api/cart')
      console.log('[Checkout] Server cart response:', response.data)
      
      const cartData = response.data?.data || response.data
      if (!cartData || !Array.isArray(cartData) || cartData.length === 0) {
        showAlert('장바구니가 비어있습니다. 상품을 먼저 담아주세요!', 'info', '장바구니 비어있음')
        localStorage.removeItem('hasCartItems')
        setCheckingOut(false)
        return
      }
      
      console.log('[Checkout] Navigating to cart with', cartData.length, 'items')
      navigate('/cart')
      
    } catch (error: any) {
      console.error('Failed to check cart:', error)
      const errorMessage = error.response?.data?.error || error.message || '장바구니 확인에 실패했습니다.'
      showAlert(errorMessage, 'error', '결제 실패')
    } finally {
      setCheckingOut(false)
    }
  }

  // ============================================
  // Send Chat Message
  // ============================================
  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!chatMessage.trim() || sendingMessage) return

    setSendingMessage(true)
    try {
      const userId = getUserId()
      if (!userId) {
        showAlert('로그인이 필요합니다.', 'warning', '로그인 필요')
        setSendingMessage(false)
        return
      }

      const userName = localStorage.getItem('user_name') || '익명'

      // 🔥 SSE 기반 메시지 전송
      await sendChatMessage(
        chatMessage.trim(),
        Number(userId),
        userName,
        'viewer'
      )

      setChatMessage('')
      setChatModalOpen(false)
    } catch (error) {
      console.error('Failed to send message:', error)
      showAlert('메시지 전송에 실패했습니다.', 'error', '전송 실패')
    } finally {
      setSendingMessage(false)
    }
  }

  return (
    <div className="relative h-full w-full snap-start snap-always overflow-hidden bg-black">
      {/* Background image */}
      <img
        src={product.image || product.image_url || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'}
        alt={product.name}
        className={`absolute inset-0 h-full w-full object-cover transition-transform duration-700 ${
          isActive ? 'scale-100' : 'scale-110'
        }`}
      />

      {/* YouTube Player Container */}
      <div
        id={`youtube-player-${stream.id}`}
        className="absolute inset-0 w-full h-full z-[5]"
      />

      {/* Play Button Overlay */}
      {showPlayButton && playerReady && (
        <button
          onClick={handleVideoClick}
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 backdrop-blur-[1px] transition-opacity hover:bg-black/30"
          aria-label="Play video"
        >
          <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center transition-transform hover:scale-110">
            <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </button>
      )}

      {/* Subtle top vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent pointer-events-none" />

      {/* Product overlay */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col">
        {/* Bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        {/* Spacer pushes content to bottom */}
        <div className="flex-1" />

        {/* Content area */}
        <div className="pointer-events-auto relative flex flex-col px-4 pb-3">
          {/* Chat + action icons row */}
          <div className="flex items-end gap-3 mb-2.5">
            {/* Live chat feed - left side, wide */}
            <div className="min-w-0 flex-1">
              <LiveChat streamId={stream.id} onChatClick={() => setChatModalOpen(true)} />
            </div>

            {/* Chat + Share buttons - right side */}
            <div className="flex flex-col items-center gap-2.5 shrink-0 pb-1 mr-1">
              <button
                onClick={() => setChatModalOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm transition-all active:scale-90"
                aria-label="Chat"
              >
                <MessageCircle className="h-5 w-5 text-white/90" />
              </button>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm transition-all active:scale-90"
                aria-label="Share"
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: product.name, url: window.location.href })
                  } else {
                    navigator.clipboard?.writeText(window.location.href)
                    setNotificationText('링크가 복사되었습니다!')
                    setShowNotification(true)
                    setTimeout(() => setShowNotification(false), 2000)
                  }
                }}
              >
                <Share2 className="h-5 w-5 text-white/90" />
              </button>
            </div>
          </div>

          {/* Unified bottom bar: product info + basket + buy */}
          <div className="flex items-center gap-1.5 w-full rounded-2xl bg-black/40 backdrop-blur-xl px-3 py-2 border border-white/[0.08]">
            
            {/* Product info - left side */}
            <button
              onClick={() => setSheetOpen(true)}
              className="flex flex-col items-start min-w-0 flex-1 text-left"
            >
              <h3 className="text-[13px] font-bold text-white leading-tight truncate w-full drop-shadow-lg">
                {product.name}
              </h3>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-[14px] font-extrabold text-red-400 drop-shadow-md">
                  ${(product.price || 0).toFixed(2)}
                </span>
                {(product.originalPrice || product.original_price) && (
                  <span className="text-[10px] text-white/40 line-through">
                    ${(product.originalPrice || product.original_price || 0).toFixed(2)}
                  </span>
                )}
              </div>
            </button>

            {/* Basket button */}
            <button
              onClick={handleAddToCart}
              disabled={addingToCart}
              className={`flex items-center gap-1 shrink-0 rounded-lg bg-white/10 px-2 py-1.5 transition-all active:scale-95 ${
                addingToCart ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              aria-label="Add to basket"
            >
              <ShoppingBag className="h-3.5 w-3.5 text-white/80" />
              <span className="text-[11px] font-bold text-white/90">
                {addingToCart ? '담는 중...' : '담기'}
              </span>
            </button>

            {/* Buy button */}
            <button
              onClick={handleCheckout}
              disabled={checkingOut}
              className={`shrink-0 rounded-lg bg-red-500 px-3.5 py-1.5 text-[12px] font-extrabold text-white shadow-lg shadow-red-500/30 transition-all active:scale-95 ${
                checkingOut ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {checkingOut ? '확인 중...' : '구매하기'}
            </button>
          </div>
        </div>
      </div>

      {/* Product sheet */}
      {sheetOpen && (
        <div className="pointer-events-auto">
          <ProductSheet product={product} onClose={() => setSheetOpen(false)} />
        </div>
      )}

      {/* Toast Notification */}
      {showNotification && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-fade-in">
          <div className="rounded-xl bg-black/90 backdrop-blur-md px-5 py-3 text-sm font-bold text-white shadow-2xl border border-white/10">
            {notificationText}
          </div>
        </div>
      )}

      {/* Chat Modal */}
      {chatModalOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm animate-overlay-in"
            onClick={() => setChatModalOpen(false)}
          />
          
          {/* Chat Input Sheet */}
          <div className="fixed inset-x-0 bottom-0 z-[90] bg-white rounded-t-3xl animate-sheet-up">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">메시지 보내기</h3>
                <button
                  onClick={() => setChatModalOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200"
                >
                  <X className="h-4 w-4 text-gray-800" />
                </button>
              </div>
              
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder="메시지를 입력하세요..."
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-red-500 focus:outline-none"
                  disabled={sendingMessage}
                />
                <button
                  type="submit"
                  disabled={!chatMessage.trim() || sendingMessage}
                  className="flex items-center justify-center rounded-xl bg-red-500 px-6 py-3 text-white font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="h-5 w-5" />
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ============================================
// Main LivePageV2 Component
// ============================================
export default function LivePageV2() {
  const { streamId } = useParams<{ streamId: string }>()
  const navigate = useNavigate()
  const [activeIndex, setActiveIndex] = useState(0)
  const [reels, setReels] = useState<ReelData[]>([])
  const [loading, setLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  
  // 스트리머 상품 선택 UI 상태
  const [isStreamer, setIsStreamer] = useState(false)
  const [showProductSelector, setShowProductSelector] = useState(false)
  const [currentStream, setCurrentStream] = useState<Stream | null>(null)
  const [changingProduct, setChangingProduct] = useState(false)

  // URL 파라미터에서 로그인 세션 정보 체크 및 localStorage 저장
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const loginSuccess = urlParams.get('login')
    const session = urlParams.get('session')
    const userId = urlParams.get('userId')
    const userName = urlParams.get('userName')

    if (loginSuccess === 'success' && session && userId) {
      console.log('[LivePageV2] 💾 로그인 성공 - localStorage 저장:', {
        session: session ? '있음' : '없음',
        userId,
        userName: userName ? decodeURIComponent(userName) : null
      })

      // CRITICAL: API 클라이언트가 읽을 수 있도록 올바른 키로 저장
      localStorage.setItem('user_session_token', session)  // ✅ 올바른 키
      localStorage.setItem('user_id', userId)
      
      // user_type은 seller/admin이 아닌 경우에만 user로 설정
      const existingUserType = localStorage.getItem('user_type')
      if (existingUserType !== 'seller' && existingUserType !== 'admin') {
        localStorage.setItem('user_type', 'user')  // ✅ 사용자 타입 저장
      }
      
      if (userName) {
        localStorage.setItem('user_name', decodeURIComponent(userName))
      }

      // 이전 키 제거 (호환성 정리)
      localStorage.removeItem('session')

      // URL 파라미터 제거 (깔끔한 URL 유지)
      urlParams.delete('login')
      urlParams.delete('session')
      urlParams.delete('userId')
      urlParams.delete('userName')
      
      const newSearch = urlParams.toString()
      const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '')
      window.history.replaceState({}, '', newUrl)

      console.log('[LivePageV2] ✅ localStorage 저장 완료:', {
        user_session_token: localStorage.getItem('user_session_token') ? '있음' : '없음',
        user_type: localStorage.getItem('user_type'),
        user_id: localStorage.getItem('user_id'),
        user_name: localStorage.getItem('user_name')
      })
    }
  }, [])

  const reelRefs = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    if (observerRef.current) observerRef.current.observe(node)
  }, [])

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-index'))
            setActiveIndex(index)
          }
        })
      },
      {
        root: containerRef.current,
        threshold: 0.6,
      }
    )

    return () => observerRef.current?.disconnect()
  }, [])

  // Load reels data - MODIFIED: Load ALL streams, not just one
  useEffect(() => {
    const loadReels = async () => {
      try {
        setLoading(true)

        // Load ALL active streams
        let streams: Stream[] = []
        
        try {
          const streamsResponse = await axios.get('/api/streams')
          if (streamsResponse.data.success && streamsResponse.data.data?.length > 0) {
            streams = streamsResponse.data.data
            console.log('[LivePageV2] Loaded all streams:', streams.length)
            
            // Set current stream from URL parameter
            if (streamId) {
              const currentStreamData = streams.find(s => s.id === parseInt(streamId))
              if (currentStreamData) {
                setCurrentStream(currentStreamData)
                
                // Check streamer permission
                const userType = localStorage.getItem('user_type')
                const userId = getUserId()
                if (userType === 'seller' && userId && currentStreamData.seller_id === parseInt(userId)) {
                  setIsStreamer(true)
                  console.log('[LivePageV2] 스트리머 권한 확인됨')
                }
              }
            }
          }
        } catch (error) {
          console.log('[LivePageV2] Streams API failed, using demo data')
        }

        // Fallback to demo streams if API fails
        if (streams.length === 0) {
          streams = demoStreams
          console.log('[LivePageV2] Using demo streams:', streams.length)
          
          // Set current stream from demo
          if (streamId) {
            const demoStreamIndex = parseInt(streamId) - 1
            const currentStreamData = streams[demoStreamIndex] || streams[0]
            setCurrentStream(currentStreamData)
          }
        }

        // Create reels: ONE reel per stream (not per product)
        // Products will be shown in bottom sheet
        const reelsData: ReelData[] = []
        
        for (const stream of streams) {
          // Get first product for this stream (for display)
          let products: Product[] = []
          
          try {
            const productsResponse = await axios.get(`/api/streams/${stream.id}/products`)
            if (productsResponse.data.success && productsResponse.data.data?.length > 0) {
              products = productsResponse.data.data
            }
          } catch (error) {
            console.log(`[LivePageV2] Products API failed for stream ${stream.id}`)
          }

          // Fallback to demo products
          if (products.length === 0) {
            const streamIndex = stream.id - 1
            const productsPerStream = Math.ceil(demoProducts.length / demoStreams.length)
            const startIdx = streamIndex * productsPerStream
            const endIdx = Math.min(startIdx + productsPerStream, demoProducts.length)
            products = demoProducts.slice(startIdx, endIdx)
          }

          // Create ONE reel per stream with its first product
          if (products.length > 0) {
            reelsData.push({
              stream: stream,
              product: products[0], // Show first product
            })
          }
        }

        console.log('[LivePageV2] Created reels:', reelsData.length)
        
        // Set initial active index based on streamId BEFORE setReels
        let initialIndex = 0
        if (streamId) {
          const foundIndex = reelsData.findIndex(r => r.stream.id === parseInt(streamId))
          if (foundIndex !== -1) {
            initialIndex = foundIndex
            console.log('[LivePageV2] Initial index for stream', streamId, ':', initialIndex)
          }
        }
        
        setActiveIndex(initialIndex)
        setReels(reelsData)
        
        setLoading(false)
      } catch (error) {
        console.error('[LivePageV2] Failed to load reels:', error)
        
        // Complete fallback to demo data
        const reelsData: ReelData[] = demoStreams.map((stream, idx) => {
          const streamIndex = stream.id - 1
          const productsPerStream = Math.ceil(demoProducts.length / demoStreams.length)
          const startIdx = streamIndex * productsPerStream
          const endIdx = Math.min(startIdx + productsPerStream, demoProducts.length)
          const products = demoProducts.slice(startIdx, endIdx)

          return {
            stream: stream,
            product: products[0] || demoProducts[0],
          }
        })

        setReels(reelsData)
        setLoading(false)
      }
    }

    loadReels()
  }, [streamId])

  // Update URL and currentStream when activeIndex changes (user scrolls)
  useEffect(() => {
    if (reels.length === 0 || activeIndex < 0 || activeIndex >= reels.length) return
    
    const activeReel = reels[activeIndex]
    const activeStreamId = activeReel.stream.id
    
    // Update URL without reload
    if (window.location.pathname !== `/live/${activeStreamId}`) {
      window.history.replaceState(null, '', `/live/${activeStreamId}`)
      console.log('[LivePageV2] URL updated to:', `/live/${activeStreamId}`)
    }
    
    // Update currentStream
    if (currentStream?.id !== activeStreamId) {
      setCurrentStream(activeReel.stream)
      
      // Check streamer permission for new stream
      const userType = localStorage.getItem('user_type')
      const userId = getUserId()
      if (userType === 'seller' && userId && activeReel.stream.seller_id === parseInt(userId)) {
        setIsStreamer(true)
      } else {
        setIsStreamer(false)
      }
    }
  }, [activeIndex, reels])

  // Scroll to initial activeIndex after reels are loaded
  useEffect(() => {
    if (reels.length === 0 || !containerRef.current) return
    if (activeIndex === 0) return // Already at top, no need to scroll
    
    // Scroll to the active reel
    const targetElement = containerRef.current.children[activeIndex] as HTMLElement
    if (targetElement) {
      console.log('[LivePageV2] Scrolling to index:', activeIndex)
      targetElement.scrollIntoView({ behavior: 'instant' as any })
    }
  }, [reels])

  // 스트리머 전용: 상품 변경 함수
  const handleChangeProduct = async (productId: number) => {
    if (!currentStream || !streamId) return

    try {
      setChangingProduct(true)
      const sessionToken = localStorage.getItem('seller_session_token') || localStorage.getItem('session')
      
      if (!sessionToken) {
        alert('로그인이 필요합니다.')
        return
      }

      const response = await api.post(
        `/api/seller/streams/${streamId}/change-product`,
        { productId },
        {
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        }
      )

      if (response.data.success) {
        // 현재 스트림 정보 업데이트
        setCurrentStream({
          ...currentStream,
          current_product_id: productId
        })
        alert('상품이 변경되었습니다!')
        setShowProductSelector(false)
      } else {
        alert('상품 변경에 실패했습니다: ' + (response.data.error || '알 수 없는 오류'))
      }
    } catch (error) {
      console.error('[LivePageV2] Change product error:', error)
      alert('상품 변경 중 오류가 발생했습니다.')
    } finally {
      setChangingProduct(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  if (reels.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white text-xl">No reels available</div>
      </div>
    )
  }

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-black">
      <TopNav 
        viewers={reels[activeIndex]?.stream.viewerCount || 0}
        sellerLinks={{
          youtube: (reels[activeIndex]?.stream as any)?.seller_youtube || undefined,
          instagram: (reels[activeIndex]?.stream as any)?.seller_instagram || undefined,
          kakao: (reels[activeIndex]?.stream as any)?.seller_kakao || undefined,
        }}
      />
      
      {/* 스트리머 전용: 상품 변경 버튼 */}
      {isStreamer && (
        <div className="fixed top-20 right-4 z-50">
          <button
            onClick={() => setShowProductSelector(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full shadow-lg hover:shadow-xl transition-all"
          >
            <ShoppingBag size={18} />
            <span className="font-medium">상품 변경</span>
          </button>
        </div>
      )}
      
      {/* 스트리머 전용: 상품 선택 모달 */}
      {showProductSelector && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white">상품 선택</h2>
              <button
                onClick={() => setShowProductSelector(false)}
                className="p-2 hover:bg-gray-700 rounded-full transition-colors"
              >
                <X size={24} className="text-gray-400" />
              </button>
            </div>
            
            {/* 상품 목록 */}
            <div className="overflow-y-auto max-h-[calc(80vh-140px)] p-6">
              {reels.length === 0 ? (
                <div className="text-center text-gray-400 py-12">
                  <ShoppingBag size={48} className="mx-auto mb-4 opacity-50" />
                  <p>등록된 상품이 없습니다</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {reels.map((reel) => {
                    const isCurrentProduct = currentStream?.current_product_id === reel.product.id
                    
                    return (
                      <button
                        key={reel.product.id}
                        onClick={() => handleChangeProduct(reel.product.id)}
                        disabled={changingProduct || isCurrentProduct}
                        className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                          isCurrentProduct
                            ? 'border-purple-500 bg-purple-500/10'
                            : 'border-gray-700 hover:border-purple-400 bg-gray-800/50'
                        } ${
                          changingProduct ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {/* 현재 상품 배지 */}
                        {isCurrentProduct && (
                          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-purple-500 text-white text-xs font-bold rounded-full">
                            <Check size={12} />
                            <span>현재 상품</span>
                          </div>
                        )}
                        
                        {/* 상품 정보 */}
                        <div className="flex gap-3">
                          <img
                            src={reel.product.image}
                            alt={reel.product.name}
                            className="w-20 h-20 object-cover rounded-lg"
                          />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-white text-sm mb-1 truncate">
                              {reel.product.name}
                            </h3>
                            <div className="flex items-baseline gap-2 mb-1">
                              <span className="text-lg font-bold text-purple-400">
                                ${reel.product.price.toFixed(2)}
                              </span>
                              {reel.product.originalPrice > reel.product.price && (
                                <span className="text-xs text-gray-400 line-through">
                                  ${reel.product.originalPrice.toFixed(2)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <div className="flex items-center gap-1">
                                <Star size={12} className="fill-yellow-400 text-yellow-400" />
                                <span>{reel.product.rating}</span>
                              </div>
                              <span>•</span>
                              <span>{reel.product.sold.toLocaleString()} sold</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            
            {/* 푸터 */}
            <div className="p-6 border-t border-gray-700 bg-gray-900/50">
              <p className="text-sm text-gray-400 text-center">
                선택한 상품이 시청자들에게 강조 표시됩니다
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div
        ref={containerRef}
        className="h-dvh w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
      >
        {reels.map((reel, index) => (
          <div
            key={`${reel.stream.id}-${reel.product.id}`}
            ref={reelRefs}
            data-index={index}
            className="h-dvh w-full snap-start snap-always"
          >
            <ReelCard 
              reel={reel} 
              isActive={activeIndex === index}
              isCurrentProduct={currentStream?.current_product_id === reel.product.id}
            />
          </div>
        ))}
      </div>
    </main>
  )
}
