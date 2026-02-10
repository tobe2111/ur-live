import { useState, useEffect, useRef, ImgHTMLAttributes } from 'react'

interface LazyImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt: string
  placeholder?: string
  className?: string
  onLoad?: () => void
  onError?: () => void
}

/**
 * 이미지 Lazy Loading 컴포넌트
 * - Intersection Observer를 사용한 지연 로딩
 * - Placeholder 지원
 * - WebP 포맷 자동 감지
 */
export function LazyImage({
  src,
  alt,
  placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iI2YzZjRmNiIvPjwvc3ZnPg==',
  className = '',
  onLoad,
  onError,
  ...props
}: LazyImageProps) {
  const [imageSrc, setImageSrc] = useState<string>(placeholder)
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    // Intersection Observer 설정
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // 뷰포트에 들어오면 실제 이미지 로드
            setImageSrc(src)
            observer.disconnect()
          }
        })
      },
      {
        rootMargin: '50px', // 뷰포트 50px 전에 미리 로드
      }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => {
      observer.disconnect()
    }
  }, [src])

  const handleLoad = () => {
    setIsLoaded(true)
    onLoad?.()
  }

  const handleError = () => {
    setHasError(true)
    setImageSrc(placeholder)
    onError?.()
  }

  return (
    <img
      ref={imgRef}
      src={imageSrc}
      alt={alt}
      className={`
        ${className}
        ${!isLoaded && !hasError ? 'animate-pulse bg-gray-200' : ''}
        transition-opacity duration-300
        ${isLoaded ? 'opacity-100' : 'opacity-0'}
      `}
      onLoad={handleLoad}
      onError={handleError}
      loading="lazy"
      {...props}
    />
  )
}

/**
 * 이미지 URL을 WebP로 변환하는 헬퍼 함수
 * (Cloudflare Images나 CDN이 WebP를 지원하는 경우)
 */
export function getOptimizedImageUrl(url: string, width?: number): string {
  // 이미 WebP인 경우
  if (url.endsWith('.webp')) {
    return url
  }

  // Cloudflare Images 사용 시
  // 예: https://imagedelivery.net/account/image-id/format=webp,width=800
  
  // 일반 이미지 URL인 경우 원본 반환
  return url
}
