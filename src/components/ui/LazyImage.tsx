import { ImgHTMLAttributes, useState, useEffect, useRef } from 'react'

interface LazyImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt: string
  fallback?: string
  webpSrc?: string
  blurhash?: string
  threshold?: number
  rootMargin?: string
}

/**
 * Optimized Image Component with:
 * - Lazy loading (Intersection Observer)
 * - WebP support with fallback
 * - Blur placeholder
 * - Error handling
 * - Loading state
 */
export function LazyImage({
  src,
  alt,
  fallback = '/placeholder.png',
  webpSrc,
  blurhash,
  threshold = 0.1,
  rootMargin = '50px',
  className = '',
  ...props
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const [hasError, setHasError] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!imgRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true)
            observer.unobserve(entry.target)
          }
        })
      },
      {
        threshold,
        rootMargin,
      }
    )

    observer.observe(imgRef.current)

    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current)
      }
    }
  }, [threshold, rootMargin])

  const handleLoad = () => {
    setIsLoaded(true)
  }

  const handleError = () => {
    setHasError(true)
    setIsLoaded(true)
  }

  // Determine which src to use
  const imageSrc = hasError ? fallback : isInView ? src : ''

  return (
    <picture className={`lazy-image-wrapper ${className}`}>
      {/* WebP source with lazy loading */}
      {webpSrc && isInView && (
        <source srcSet={webpSrc} type="image/webp" />
      )}
      
      {/* Fallback image */}
      <img
        ref={imgRef}
        src={imageSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        className={`
          lazy-image
          ${isLoaded ? 'loaded' : 'loading'}
          ${hasError ? 'error' : ''}
        `}
        style={{
          opacity: isLoaded ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out',
          backgroundColor: blurhash || '#f0f0f0',
        }}
        {...props}
      />
    </picture>
  )
}

/**
 * Helper function to generate WebP URL from original image URL
 * Example: /images/product.jpg → /images/product.webp
 */
export function getWebPUrl(url: string): string {
  if (!url) return url
  
  // Check if already WebP
  if (url.endsWith('.webp')) return url
  
  // Replace extension with .webp
  return url.replace(/\.(jpg|jpeg|png)$/i, '.webp')
}

/**
 * Helper function to check if browser supports WebP
 */
export function supportsWebP(): Promise<boolean> {
  return new Promise((resolve) => {
    const webP = new Image()
    webP.onload = webP.onerror = () => {
      resolve(webP.height === 2)
    }
    webP.src =
      'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA'
  })
}

/**
 * React Hook to detect WebP support
 */
export function useWebPSupport() {
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    supportsWebP().then(setIsSupported)
  }, [])

  return isSupported
}
