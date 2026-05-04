import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import useEmblaCarousel from 'embla-carousel-react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import api from '@/lib/api'
import { LazyImage } from '@/components/LazyImage'

interface Banner {
  id: number
  title: string
  image_url: string
  link_url?: string
  description?: string
}

export default function HeroBanner() {
  const navigate = useNavigate()
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, duration: 30 })
  const [selectedIndex, setSelectedIndex] = useState(0)

  // 배너 데이터 가져오기
  useEffect(() => {
    api.get('/api/banners')
      .then(res => {
        const data = res.data?.data ?? res.data
        if (Array.isArray(data) && data.length > 0) {
          setBanners(data)
        }
      })
      .catch(err => { if (import.meta.env.DEV) console.warn('[HeroBanner] Failed to load banners:', err) })
      .finally(() => setLoading(false))
  }, [])

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    onSelect()
    emblaApi.on('select', onSelect)
    return () => { emblaApi.off('select', onSelect) }
  }, [emblaApi, onSelect])

  // 5초 자동 슬라이드
  useEffect(() => {
    if (!emblaApi || banners.length <= 1) return
    const interval = setInterval(() => emblaApi.scrollNext(), 5000)
    return () => clearInterval(interval)
  }, [emblaApi, banners.length])

  // 로딩 중 또는 배너 없음 → 그라데이션 fallback
  if (loading) {
    return (
      <section className="relative w-full">
        <div className="w-full aspect-[2/1] bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 animate-pulse" />
      </section>
    )
  }

  if (banners.length === 0) {
    return (
      <section className="relative w-full overflow-hidden">
        <div
          className="relative w-full cursor-pointer hover:opacity-95 transition-opacity"
          style={{ aspectRatio: '16/9' }}
          onClick={() => navigate('/browse')}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 flex items-center justify-center">
            <div className="text-center text-gray-900 dark:text-white px-6">
              <h2 className="text-2xl sm:text-4xl font-bold mb-2">UR LIVE</h2>
              <p className="text-sm sm:text-lg opacity-80">라이브 쇼핑의 새로운 경험</p>
            </div>
          </div>
        </div>
      </section>
    )
  }

  // 배너 1개일 때는 캐러셀 불필요
  if (banners.length === 1) {
    const banner = banners[0]
    return (
      <section className="relative w-full">
        <a
          href={banner.link_url || '/browse'}
          onClick={(e) => {
            if (!banner.link_url || banner.link_url === '#') {
              e.preventDefault()
              navigate('/browse')
            }
          }}
          className="block"
        >
          <div className="relative w-full aspect-[2/1] overflow-hidden">
            <LazyImage
              src={banner.image_url}
              alt={banner.title}
              className="w-full h-full object-contain"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            {banner.description && (
              <div className="absolute bottom-8 left-6 right-6 sm:bottom-10 sm:left-10">
                <p className="text-gray-900 dark:text-white text-base sm:text-xl font-bold drop-shadow-lg line-clamp-2">
                  {banner.description}
                </p>
              </div>
            )}
          </div>
        </a>
      </section>
    )
  }

  // 여러 배너 → Embla 캐러셀
  return (
    <section className="relative w-full bg-black">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {banners.map((banner) => (
            <div key={banner.id} className="relative flex-none w-full">
              <a
                href={banner.link_url || '/browse'}
                onClick={(e) => {
                  if (!banner.link_url || banner.link_url === '#') {
                    e.preventDefault()
                    navigate('/browse')
                  }
                }}
                className="block"
              >
                <div className="relative w-full aspect-[2/1] overflow-hidden">
                  <LazyImage
                    src={banner.image_url}
                    alt={banner.title}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                  {banner.description && (
                    <div className="absolute bottom-8 left-6 right-6 sm:bottom-10 sm:left-10">
                      <p className="text-gray-900 dark:text-white text-base sm:text-xl font-bold drop-shadow-lg line-clamp-2">
                        {banner.description}
                      </p>
                    </div>
                  )}
                </div>
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* 좌우 화살표 */}
      <button
        onClick={() => emblaApi?.scrollPrev()}
        className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center transition-colors z-10"
        aria-label="이전 배너"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={() => emblaApi?.scrollNext()}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center transition-colors z-10"
        aria-label="다음 배너"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* 하단 도트 인디케이터 */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
        {banners.map((_, idx) => (
          <button
            key={idx}
            onClick={() => emblaApi?.scrollTo(idx)}
            className={`rounded-full transition-all duration-300 ${
              idx === selectedIndex
                ? 'w-5 h-1.5 bg-gray-50 dark:bg-[#121212]'
                : 'w-1.5 h-1.5 bg-[#121212]/50 hover:bg-[#121212]/80'
            }`}
            aria-label={`배너 ${idx + 1}`}
          />
        ))}
      </div>
    </section>
  )
}
