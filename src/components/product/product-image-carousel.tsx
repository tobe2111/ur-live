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
    return () => {
      emblaApi.off('select', onSelect)
    }
  }, [emblaApi, onSelect])

  if (!images || images.length === 0) {
    return (
      <div className="relative w-full bg-background aspect-square flex items-center justify-center">
        <span className="text-muted-foreground">No images available</span>
      </div>
    )
  }

  return (
    <div className="relative w-full bg-background">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {images.map((src, index) => (
            <div
              key={index}
              className="relative aspect-square w-full flex-none"
            >
              <img
                src={src}
                alt={`Product image ${index + 1}`}
                className="w-full h-full object-contain"
                loading={index === 0 ? 'eager' : 'lazy'}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Dot indicators */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-1.5">
          {images.map((_, index) => (
            <button
              key={index}
              aria-label={`Go to image ${index + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === selectedIndex
                  ? 'w-5 bg-foreground'
                  : 'w-1.5 bg-foreground/25'
              }`}
              onClick={() => emblaApi?.scrollTo(index)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
