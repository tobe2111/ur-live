import { useState, useEffect } from 'react'
import { optimizeImage, getPlaceholder } from '@/utils/image-optimization'

export interface ProgressiveImageProps {
  src: string
  alt: string
  className?: string
  width?: number
  height?: number
  priority?: boolean // 우선순위 이미지 (즉시 로드)
  onLoad?: () => void
}

/**
 * Progressive Image Component
 * 
 * 1. Blur placeholder 먼저 표시
 * 2. 실제 이미지 백그라운드 로드
 * 3. 로드 완료 시 fade-in 트랜지션
 */
export function ProgressiveImage({
  src,
  alt,
  className = '',
  width,
  height,
  priority = false,
  onLoad
}: ProgressiveImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [imageSrc, setImageSrc] = useState<string>('')

  useEffect(() => {
    // Priority 이미지는 즉시 로드
    if (priority) {
      setImageSrc(optimizeImage(src, { width }))
      return
    }

    // Intersection Observer로 lazy loading
    const img = new Image()
    
    img.onload = () => {
      setImageSrc(optimizeImage(src, { width }))
      setIsLoaded(true)
      onLoad?.()
    }

    img.onerror = () => {
      if (import.meta.env.DEV) console.error(`[Image] Failed to load: ${src}`)
      setImageSrc(src) // Fallback to original
    }

    // 이미지 로드 시작
    img.src = optimizeImage(src, { width })
  }, [src, width, priority, onLoad])

  const placeholderSrc = getPlaceholder(src)

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Blur Placeholder */}
      {!isLoaded && (
        <img
          src={placeholderSrc}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover blur-lg scale-110 transition-opacity duration-300"
          style={{
            opacity: imageSrc ? 0 : 1
          }}
        />
      )}

      {/* 실제 이미지 */}
      {imageSrc && (
        <img
          src={imageSrc}
          alt={alt}
          width={width}
          height={height}
          className={`w-full h-full object-cover transition-opacity duration-500 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
        />
      )}

      {/* 로딩 스피너 (옵션) */}
      {!isLoaded && !imageSrc && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  )
}

/**
 * Simple Optimized Image (Blur-up 없이)
 */
export function OptimizedImage({
  src,
  alt,
  className = '',
  width,
  priority = false
}: Omit<ProgressiveImageProps, 'height' | 'onLoad'>) {
  const optimizedSrc = optimizeImage(src, { width })

  return (
    <img
      src={optimizedSrc}
      alt={alt}
      className={className}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
    />
  )
}
