import { useState, useEffect } from 'react'

interface ImageOptimizationConfig {
  quality?: number
  format?: 'webp' | 'avif' | 'jpeg' | 'png'
  width?: number
  height?: number
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
}

/**
 * Image optimization utility for Cloudflare Images or similar CDN
 * Generates optimized image URLs with query parameters
 */
export class ImageOptimizer {
  private baseUrl: string
  private defaultQuality: number

  constructor(baseUrl: string = '', defaultQuality: number = 80) {
    this.baseUrl = baseUrl
    this.defaultQuality = defaultQuality
  }

  /**
   * Generate optimized image URL
   * @param url Original image URL
   * @param config Optimization configuration
   * @returns Optimized image URL
   */
  optimize(url: string, config: ImageOptimizationConfig = {}): string {
    if (!url) return url

    // If already optimized or external URL, return as-is
    if (url.includes('?') || url.startsWith('http') || url.startsWith('data:')) {
      return url
    }

    const {
      quality = this.defaultQuality,
      format = 'webp',
      width,
      height,
      fit = 'cover',
    } = config

    const params = new URLSearchParams()

    if (quality) params.append('quality', quality.toString())
    if (format) params.append('format', format)
    if (width) params.append('width', width.toString())
    if (height) params.append('height', height.toString())
    if (fit) params.append('fit', fit)

    const queryString = params.toString()
    return queryString ? `${url}?${queryString}` : url
  }

  /**
   * Generate responsive srcset for different screen sizes
   * @param url Original image URL
   * @param sizes Array of widths
   * @returns srcset string
   */
  generateSrcSet(url: string, sizes: number[] = [640, 768, 1024, 1280, 1536]): string {
    return sizes
      .map((size) => {
        const optimizedUrl = this.optimize(url, { width: size, format: 'webp' })
        return `${optimizedUrl} ${size}w`
      })
      .join(', ')
  }

  /**
   * Get thumbnail URL (small size, optimized)
   * @param url Original image URL
   * @returns Thumbnail URL
   */
  getThumbnail(url: string, size: number = 200): string {
    return this.optimize(url, {
      width: size,
      height: size,
      fit: 'cover',
      format: 'webp',
      quality: 70,
    })
  }

  /**
   * Preload critical images
   * @param urls Array of image URLs to preload
   */
  preload(urls: string[]): void {
    if (typeof document === 'undefined') return

    urls.forEach((url) => {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'image'
      link.href = url
      document.head.appendChild(link)
    })
  }
}

// Export singleton instance
export const imageOptimizer = new ImageOptimizer()

/**
 * React Hook for image optimization
 */
export function useImageOptimization(
  url: string,
  config: ImageOptimizationConfig = {}
) {
  const [optimizedUrl, setOptimizedUrl] = useState<string>(url)

  useEffect(() => {
    setOptimizedUrl(imageOptimizer.optimize(url, config))
  }, [url, config])

  return optimizedUrl
}

/**
 * Utility to convert image to WebP format
 * Can be used in build scripts or image processing pipeline
 */
export async function convertToWebP(
  imageBlob: Blob,
  quality: number = 80
): Promise<Blob> {
  // Create canvas
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context not available')

  // Load image
  const img = await createImageBitmap(imageBlob)
  canvas.width = img.width
  canvas.height = img.height

  // Draw image
  ctx.drawImage(img, 0, 0)

  // Convert to WebP
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to convert image to WebP'))
        }
      },
      'image/webp',
      quality / 100
    )
  })
}

/**
 * Get optimized image dimensions based on container size
 * @param containerWidth Container width in pixels
 * @param containerHeight Container height in pixels
 * @param aspectRatio Image aspect ratio (width / height)
 * @returns Optimized dimensions
 */
export function getOptimizedDimensions(
  containerWidth: number,
  containerHeight: number,
  aspectRatio: number
): { width: number; height: number } {
  const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1

  // Calculate dimensions accounting for device pixel ratio
  let width = containerWidth * devicePixelRatio
  let height = containerHeight * devicePixelRatio

  // Maintain aspect ratio
  if (width / height > aspectRatio) {
    width = height * aspectRatio
  } else {
    height = width / aspectRatio
  }

  // Round to nearest even number (better for compression)
  width = Math.round(width / 2) * 2
  height = Math.round(height / 2) * 2

  // Cap at reasonable maximum
  const MAX_DIMENSION = 2048
  if (width > MAX_DIMENSION) {
    width = MAX_DIMENSION
    height = Math.round((width / aspectRatio) / 2) * 2
  }
  if (height > MAX_DIMENSION) {
    height = MAX_DIMENSION
    width = Math.round((height * aspectRatio) / 2) * 2
  }

  return { width, height }
}
