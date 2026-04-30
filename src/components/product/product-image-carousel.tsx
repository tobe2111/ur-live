import { useState, useCallback, useEffect } from 'react'
import useEmblaCarousel from 'embla-carousel-react'

interface ProductImageCarouselProps {
  images: string[];
}

export function ProductImageCarousel({ images }: ProductImageCarouselProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false })

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    emblaApi.on('select', onSelect)
    return () => { emblaApi.off('select', onSelect) }
  }, [emblaApi, onSelect])

  if (!images || images.length === 0) {
    return (
      <div className="relative w-full bg-gray-50 aspect-square flex items-center justify-center">
        <span className="text-gray-400 text-sm">이미지 없음</span>
      </div>
    )
  }

  return (
    <div className="relative w-full" style={{ background: '#F5F5F5' }}>
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {images.map((src, index) => (
            <div key={src || `slide-${index}`} className="relative aspect-square w-full flex-none">
              <img
                src={src}
                alt={`Product image ${index + 1}`}
                className="w-full h-full object-cover"
                loading={index === 0 ? 'eager' : 'lazy'}
                decoding="async"
                fetchPriority={index === 0 ? 'high' : 'auto'}
              />
            </div>
          ))}
        </div>
      </div>

      {/* v4 Dot indicators */}
      {images.length > 1 && (
        <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-1">
          {images.map((src, index) => (
            <button
              key={`dot-${src || index}`}
              aria-label={`이미지 ${index + 1}`}
              className="rounded-full transition-all duration-300"
              style={{
                width: index === selectedIndex ? 18 : 5,
                height: 5,
                background: index === selectedIndex ? '#111827' : 'rgba(17,24,39,0.3)',
              }}
              onClick={() => emblaApi?.scrollTo(index)}
            />
          ))}
        </div>
      )}

      {/* v4 Image counter */}
      {images.length > 1 && (
        <div className="absolute bottom-3 right-3 rounded-full px-2 py-0.5"
          style={{ background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 10, fontWeight: 600 }}>
          {selectedIndex + 1} / {images.length}
        </div>
      )}
    </div>
  )
}
