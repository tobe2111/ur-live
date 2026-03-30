import { useEffect, useCallback, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { LazyImage } from '@/components/LazyImage'

interface Banner {
  id: number
  title: string
  image_url: string
  link_url?: string
  description?: string
}

interface BannerSectionProps {
  banners: Banner[]
}

export function BannerSection({ banners }: BannerSectionProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, duration: 30 })
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
    setCanScrollPrev(emblaApi.canScrollPrev())
    setCanScrollNext(emblaApi.canScrollNext())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    onSelect()
    emblaApi.on('select', onSelect)
    emblaApi.on('reInit', onSelect)
    return () => { emblaApi.off('select', onSelect); emblaApi.off('reInit', onSelect) }
  }, [emblaApi, onSelect])

  // 5초 자동 슬라이드
  useEffect(() => {
    if (!emblaApi || banners.length <= 1) return
    const interval = setInterval(() => emblaApi.scrollNext(), 5000)
    return () => clearInterval(interval)
  }, [emblaApi, banners.length])

  if (banners.length === 0) return null

  return (
    <section className="relative w-full bg-black">
      {/* Carousel viewport */}
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {banners.map((banner) => (
            <div key={banner.id} className="relative flex-none w-full">
              <a
                href={banner.link_url || '#'}
                onClick={(e) => {
                  if (banner.link_url?.startsWith('#')) {
                    e.preventDefault()
                    document.querySelector(banner.link_url)?.scrollIntoView({ behavior: 'smooth' })
                  }
                }}
                className="block"
              >
                {/* 데스크톱: 21:9, 모바일: 16:9 */}
                <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] overflow-hidden">
                  <LazyImage
                    src={banner.image_url}
                    alt={banner.title}
                    className="w-full h-full object-cover"
                  />
                  {/* 하단 그라데이션 */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  {banner.description && (
                    <div className="absolute bottom-8 left-6 right-6 sm:bottom-10 sm:left-10">
                      <p className="text-white text-base sm:text-xl font-bold drop-shadow-lg line-clamp-2">
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

      {/* 좌우 화살표 (배너 2개 이상일 때만) */}
      {banners.length > 1 && (
        <>
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
                    ? 'w-5 h-1.5 bg-white'
                    : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/80'
                }`}
                aria-label={`배너 ${idx + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
