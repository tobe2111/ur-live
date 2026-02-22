/**
 * 이미지 최적화 라이브러리
 * 
 * Cloudflare Image Resizing과 Polish를 활용한 이미지 최적화
 * - WebP/AVIF 자동 변환
 * - 반응형 크기 조정
 * - CDN 캐싱
 * 
 * 사용 예시:
 * - getOptimizedImageUrl(originalUrl, { width: 800, format: 'webp' })
 * - generateResponsiveSrcSet(originalUrl, [400, 800, 1200])
 */

export interface ImageOptimizationOptions {
  width?: number
  height?: number
  quality?: number // 1-100
  format?: 'webp' | 'avif' | 'jpeg' | 'png' | 'auto'
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad'
  gravity?: 'auto' | 'left' | 'right' | 'top' | 'bottom' | 'center'
  blur?: number // 1-250
  sharpen?: number // 0-10
}

export interface ResponsiveImageSet {
  src: string
  srcSet: string
  sizes: string
}

/**
 * Cloudflare Image Resizing URL 생성
 * 
 * 참고: https://developers.cloudflare.com/images/image-resizing/
 */
export function getOptimizedImageUrl(
  originalUrl: string, 
  options: ImageOptimizationOptions = {}
): string {
  // 상대 경로를 절대 경로로 변환
  let imageUrl = originalUrl
  if (originalUrl.startsWith('/')) {
    imageUrl = `https://live.ur-team.com${originalUrl}`
  }

  // 옵션 기본값
  const {
    width,
    height,
    quality = 85,
    format = 'auto',
    fit = 'scale-down',
    gravity = 'auto',
    blur,
    sharpen
  } = options

  // Cloudflare Image Resizing URL 파라미터 구성
  const params: string[] = []
  
  if (width) params.push(`width=${width}`)
  if (height) params.push(`height=${height}`)
  if (quality !== 85) params.push(`quality=${quality}`)
  if (format !== 'auto') params.push(`format=${format}`)
  if (fit !== 'scale-down') params.push(`fit=${fit}`)
  if (gravity !== 'auto') params.push(`gravity=${gravity}`)
  if (blur) params.push(`blur=${blur}`)
  if (sharpen) params.push(`sharpen=${sharpen}`)

  // Cloudflare Image Resizing 경로
  // 형식: /cdn-cgi/image/[options]/[image-url]
  const optionsStr = params.join(',')
  return `/cdn-cgi/image/${optionsStr}/${encodeURIComponent(imageUrl)}`
}

/**
 * 반응형 이미지 srcset 생성
 * 
 * 다양한 화면 크기에 최적화된 이미지 세트 제공
 */
export function generateResponsiveSrcSet(
  originalUrl: string,
  widths: number[] = [400, 800, 1200, 1600],
  options: Omit<ImageOptimizationOptions, 'width'> = {}
): ResponsiveImageSet {
  const srcSetParts = widths.map(width => {
    const url = getOptimizedImageUrl(originalUrl, { ...options, width })
    return `${url} ${width}w`
  })

  // 기본 src (중간 크기)
  const defaultWidth = widths[Math.floor(widths.length / 2)]
  const src = getOptimizedImageUrl(originalUrl, { ...options, width: defaultWidth })

  // sizes 속성 (반응형 로딩)
  const sizes = [
    '(max-width: 640px) 400px',
    '(max-width: 1024px) 800px',
    '(max-width: 1280px) 1200px',
    '1600px'
  ].join(', ')

  return {
    src,
    srcSet: srcSetParts.join(', '),
    sizes
  }
}

/**
 * 제품 이미지 최적화 프리셋
 */
export function getProductImageUrl(
  originalUrl: string,
  size: 'thumb' | 'medium' | 'large' | 'detail' = 'medium'
): string {
  const presets: Record<string, ImageOptimizationOptions> = {
    thumb: { width: 150, height: 150, fit: 'cover', quality: 80, format: 'webp' },
    medium: { width: 400, height: 400, fit: 'cover', quality: 85, format: 'webp' },
    large: { width: 800, height: 800, fit: 'contain', quality: 90, format: 'webp' },
    detail: { width: 1200, quality: 90, format: 'webp' }
  }

  return getOptimizedImageUrl(originalUrl, presets[size])
}

/**
 * 라이브 스트림 썸네일 최적화 프리셋
 */
export function getLiveStreamThumbnailUrl(
  originalUrl: string,
  size: 'small' | 'medium' | 'large' = 'medium'
): string {
  const presets: Record<string, ImageOptimizationOptions> = {
    small: { width: 320, height: 180, fit: 'cover', quality: 80, format: 'webp' },
    medium: { width: 640, height: 360, fit: 'cover', quality: 85, format: 'webp' },
    large: { width: 1280, height: 720, fit: 'cover', quality: 90, format: 'webp' }
  }

  return getOptimizedImageUrl(originalUrl, presets[size])
}

/**
 * 사용자 프로필 이미지 최적화
 */
export function getUserProfileImageUrl(
  originalUrl: string,
  size: 'small' | 'medium' | 'large' = 'medium'
): string {
  const presets: Record<string, ImageOptimizationOptions> = {
    small: { width: 40, height: 40, fit: 'cover', quality: 85, format: 'webp' },
    medium: { width: 80, height: 80, fit: 'cover', quality: 85, format: 'webp' },
    large: { width: 200, height: 200, fit: 'cover', quality: 90, format: 'webp' }
  }

  return getOptimizedImageUrl(originalUrl, presets[size])
}

/**
 * 블러 플레이스홀더 이미지 생성
 * 
 * 지연 로딩(lazy loading) 시 사용할 블러 처리된 저품질 이미지
 */
export function getBlurPlaceholder(originalUrl: string): string {
  return getOptimizedImageUrl(originalUrl, {
    width: 40,
    quality: 20,
    blur: 20,
    format: 'webp'
  })
}

/**
 * 이미지 URL이 최적화가 필요한지 확인
 */
export function needsOptimization(url: string): boolean {
  // 이미 최적화된 URL인지 확인
  if (url.includes('/cdn-cgi/image/')) {
    return false
  }

  // 외부 CDN URL인 경우 (이미 최적화되었을 가능성)
  const externalCdns = [
    'cloudinary.com',
    'imgix.net',
    'imagekit.io',
    'cloudfront.net'
  ]
  if (externalCdns.some(cdn => url.includes(cdn))) {
    return false
  }

  return true
}

/**
 * 이미지 포맷 감지
 */
export function detectImageFormat(url: string): string | null {
  const match = url.match(/\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/i)
  return match ? match[1].toLowerCase() : null
}

/**
 * 이미지 크기 검증
 */
export function validateImageDimensions(width?: number, height?: number): boolean {
  if (width && (width < 1 || width > 10000)) return false
  if (height && (height < 1 || height > 10000)) return false
  return true
}

/**
 * React/JSX용 이미지 속성 생성
 */
export function getImageProps(
  originalUrl: string,
  options: ImageOptimizationOptions & { alt?: string; className?: string } = {}
) {
  const { alt = '', className = '', ...imageOptions } = options

  const responsiveSet = generateResponsiveSrcSet(originalUrl, undefined, imageOptions)
  const blurDataUrl = getBlurPlaceholder(originalUrl)

  return {
    src: responsiveSet.src,
    srcSet: responsiveSet.srcSet,
    sizes: responsiveSet.sizes,
    alt,
    className,
    loading: 'lazy' as const,
    decoding: 'async' as const,
    // 블러 플레이스홀더는 별도 처리 필요 (CSS background 또는 별도 img 태그)
    'data-blur': blurDataUrl
  }
}

/**
 * 업로드된 이미지 자동 최적화
 * 
 * 제품 이미지 업로드 시 자동으로 여러 크기 생성
 */
export function generateImageVariants(originalUrl: string) {
  return {
    original: originalUrl,
    thumb: getProductImageUrl(originalUrl, 'thumb'),
    medium: getProductImageUrl(originalUrl, 'medium'),
    large: getProductImageUrl(originalUrl, 'large'),
    detail: getProductImageUrl(originalUrl, 'detail'),
    placeholder: getBlurPlaceholder(originalUrl)
  }
}

/**
 * 이미지 최적화 통계
 */
export interface ImageOptimizationStats {
  originalSize: number
  optimizedSize: number
  savingPercent: number
  format: string
  dimensions: { width: number; height: number }
}

/**
 * 이미지 최적화 효과 추정
 * 
 * 실제 최적화 전에 예상 결과 제공
 */
export function estimateOptimization(
  originalFormat: string,
  originalSize: number,
  targetFormat: 'webp' | 'avif' | 'jpeg',
  quality: number = 85
): ImageOptimizationStats {
  // 포맷별 압축률 (근사값)
  const compressionRates: Record<string, number> = {
    'png-webp': 0.7,
    'png-avif': 0.5,
    'jpeg-webp': 0.8,
    'jpeg-avif': 0.6,
    'webp-avif': 0.75
  }

  const key = `${originalFormat}-${targetFormat}`
  const rate = compressionRates[key] || 0.9

  // 품질에 따른 추가 압축
  const qualityFactor = quality / 100

  const optimizedSize = Math.round(originalSize * rate * qualityFactor)
  const savingPercent = Math.round((1 - optimizedSize / originalSize) * 100)

  return {
    originalSize,
    optimizedSize,
    savingPercent,
    format: targetFormat,
    dimensions: { width: 0, height: 0 } // 실제 크기는 서버에서 측정
  }
}
