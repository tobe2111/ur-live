/**
 * 이미지 최적화 유틸리티
 * 
 * Cloudflare Images 또는 기본 이미지 최적화를 제공합니다.
 */

export interface ImageOptimizationOptions {
  width?: number
  height?: number
  quality?: number
  format?: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png'
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad'
}

/**
 * 이미지 URL 최적화
 */
export function optimizeImage(
  url: string,
  options: ImageOptimizationOptions = {}
): string {
  if (!url) return ''

  const {
    width = 800,
    quality = 80,
    format = 'auto',
    fit = 'scale-down'
  } = options

  // Cloudflare Images 사용
  if (url.includes('imagedelivery.net') || url.includes('cloudflareimages.com')) {
    // Cloudflare Images format: /cdn-cgi/imagedelivery/{account_hash}/{image_id}/{variant}
    return `${url}/w=${width},q=${quality},f=${format},fit=${fit}`
  }

  // 외부 URL (Cloudinary, Imgix 등)
  if (url.startsWith('http') && url.includes('cloudinary')) {
    return url.replace('/upload/', `/upload/w_${width},q_${quality},f_auto/`)
  }

  // 기본 URL 반환
  return url
}

/**
 * Responsive srcSet 생성
 */
export function generateSrcSet(
  url: string,
  widths: number[] = [400, 800, 1200, 1600]
): string {
  return widths
    .map(width => `${optimizeImage(url, { width })} ${width}w`)
    .join(', ')
}

/**
 * 이미지 placeholder (blur-up) 생성
 * 
 * 매우 작은 이미지로 빠른 로딩
 */
export function getPlaceholder(url: string): string {
  return optimizeImage(url, {
    width: 40,
    quality: 10,
    format: 'webp'
  })
}

/**
 * 이미지 preload
 */
export function preloadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = reject
    img.src = url
  })
}

/**
 * 다중 이미지 preload
 */
export async function preloadImages(urls: string[]): Promise<void> {
  try {
    await Promise.all(urls.map(url => preloadImage(url)))
  } catch (error) {
    console.error('[Image Preload] Failed:', error)
  }
}
