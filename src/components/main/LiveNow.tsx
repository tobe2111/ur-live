import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react'
import api from '@/lib/api'
import { formatNumber } from '@/utils/format'

interface LiveStream {
  id: number
  title: string
  youtube_video_id?: string
  viewer_count?: number
  seller_name?: string
  image_url?: string
  thumbnail_url?: string
  current_product?: {
    id: number
    name: string
    price: number
  }
}

export default function LiveNow() {
  const navigate = useNavigate()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLiveStreams()
  }, [])

  const loadLiveStreams = async () => {
    try {
      const response = await api.get('/api/streams?status=live')
      if (response.data.success && response.data.data.length > 0) {
        setLiveStreams(response.data.data.slice(0, 4))
      } else {
        // Fallback demo data
        setLiveStreams([
          {
            id: 1,
            title: 'Sneaker Drop Unboxing',
            viewer_count: 1500,
            seller_name: 'sneakerhead_92',
            current_product: {
              id: 1,
              name: 'Air Jordan 1',
              price: 189000,
            },
          },
          {
            id: 2,
            title: 'Streetwear Haul',
            viewer_count: 892,
            seller_name: 'style_guru',
            current_product: {
              id: 2,
              name: 'Supreme Hoodie',
              price: 245000,
            },
          },
          {
            id: 3,
            title: 'Luxury Accessories',
            viewer_count: 2100,
            seller_name: 'luxe_finds',
            current_product: {
              id: 3,
              name: 'Designer Bag',
              price: 380000,
            },
          },
        ])
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to load live streams:', error)
      // Use demo data on error
      setLiveStreams([
        {
          id: 1,
          title: 'Sneaker Drop Unboxing',
          viewer_count: 1500,
          seller_name: 'sneakerhead_92',
          current_product: {
            id: 1,
            name: 'Air Jordan 1',
            price: 189000,
          },
        },
        {
          id: 2,
          title: 'Streetwear Haul',
          viewer_count: 892,
          seller_name: 'style_guru',
          current_product: {
            id: 2,
            name: 'Supreme Hoodie',
            price: 245000,
          },
        },
        {
          id: 3,
          title: 'Luxury Accessories',
          viewer_count: 2100,
          seller_name: 'luxe_finds',
          current_product: {
            id: 3,
            name: 'Designer Bag',
            price: 380000,
          },
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 220
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      })
    }
  }

  const formatViewers = (count: number = 0): string => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`
    }
    return count.toString()
  }

  const handleLiveClick = (streamId: number) => {
    navigate(`/live/${streamId}`)
  }

  if (loading) {
    return (
      <section className="bg-background py-6">
        <div className="px-4 mb-4">
          <div className="h-6 w-32 bg-gray-200 animate-pulse rounded"></div>
        </div>
        <div className="flex gap-3 overflow-x-auto px-4 pb-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[160px] sm:w-[200px]">
              <div className="aspect-[3/4] bg-gray-200 animate-pulse rounded-sm"></div>
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (liveStreams.length === 0) {
    return (
      <section className="bg-background py-6">
        <div className="px-4">
          <h3 className="text-base font-extrabold text-foreground uppercase tracking-tight mb-4">
            Live Now
          </h3>
          <p className="text-sm text-gray-500">현재 진행 중인 라이브 방송이 없습니다.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-background py-6">
      <div className="flex items-center justify-between px-4 mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-extrabold text-foreground uppercase tracking-tight">
            Live Now
          </h3>
          <span className="flex items-center gap-1 bg-red-500 px-2 py-0.5 rounded-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-[10px] font-bold text-white uppercase">
              Live
            </span>
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-1">
          <button
            onClick={() => scroll('left')}
            aria-label="Scroll left"
            className="p-1 text-gray-600 hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => scroll('right')}
            aria-label="Scroll right"
            className="p-1 text-gray-600 hover:text-foreground transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {liveStreams.map((stream) => (
          <button
            key={stream.id}
            onClick={() => handleLiveClick(stream.id)}
            className="flex-shrink-0 w-[160px] sm:w-[200px] group text-left"
          >
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-sm bg-gray-200">
              {(stream.thumbnail_url || stream.image_url || stream.youtube_video_id) ? (
                <img
                  src={stream.thumbnail_url || stream.image_url || `https://img.youtube.com/vi/${stream.youtube_video_id}/hqdefault.jpg`}
                  alt={stream.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" decoding="async" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-gray-300 to-gray-400" />
              )}
              
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

              {/* LIVE badge */}
              <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-500 px-2 py-0.5 rounded-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-[10px] font-bold text-white uppercase">
                  Live
                </span>
              </div>

              {/* Viewers */}
              <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 px-1.5 py-0.5 rounded-sm">
                <Eye className="h-3 w-3 text-white" strokeWidth={2} />
                <span className="text-[10px] font-semibold text-white">
                  {formatViewers(stream.viewer_count)}
                </span>
              </div>

              {/* Bottom info */}
              <div className="absolute bottom-0 left-0 right-0 p-2.5">
                <p className="text-xs font-bold text-white leading-tight line-clamp-1">
                  {stream.title}
                </p>
                <p className="text-[10px] text-white/70 mt-0.5">
                  @{stream.seller_name || 'seller'}
                </p>
                {stream.current_product && (
                  <p className="text-sm font-extrabold text-white mt-1">
                    ₩{formatNumber(stream.current_product.price)}
                  </p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </section>
  )
}
