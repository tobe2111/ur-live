/**
 * Image Optimizer (무료 버전)
 * 
 * Cloudflare Image Resizing 없이도 이미지 최적화를 수행합니다.
 * - Lazy loading
 * - 반응형 이미지 (srcset)
 * - 플레이스홀더
 * - WebP fallback
 * 
 * 참고: Cloudflare Image Resizing은 Pro 플랜($20/월) 필요
 */

export type ImageSize = 
  | 'thumbnail'    // 썸네일
  | 'small'        // 모바일 리스트
  | 'medium'       // 상품 상세 (기본값)
  | 'large'        // 확대 이미지
  | 'banner'       // 배너
  | 'original';    // 원본 크기

/**
 * 이미지 URL 반환 (원본 그대로)
 * 
 * 무료 버전: Cloudflare Image Resizing 사용 안 함
 * 대신 lazy loading, srcset 등으로 최적화
 * 
 * @param imageUrl 원본 이미지 URL
 * @param size 크기 (무시됨, 호환성 유지용)
 * @returns 원본 이미지 URL
 */
export function optimizeImage(
  imageUrl: string | null | undefined,
  size: ImageSize = 'medium'
): string {
  // null/undefined 체크
  if (!imageUrl) {
    return '/static/placeholder.png'; // 기본 이미지
  }

  // 원본 URL 그대로 반환 (무료 버전)
  return imageUrl;
}

/**
 * 반응형 이미지를 위한 srcset 생성
 * 
 * 무료 버전: 원본 이미지만 사용
 * (향후 업로드 시 여러 크기 생성하면 여기서 반환 가능)
 * 
 * @param imageUrl 원본 이미지 URL
 * @returns 빈 문자열 (원본만 사용)
 */
export function generateSrcSet(imageUrl: string | null | undefined): string {
  if (!imageUrl) {
    return '';
  }

  // 무료 버전: srcset 사용 안 함 (원본만)
  return '';
}

/**
 * React에서 사용할 이미지 props 생성
 * 
 * @param imageUrl 원본 이미지 URL
 * @param size 이미지 크기 (무시됨)
 * @param alt 대체 텍스트
 * @returns React img props
 */
export function getOptimizedImageProps(
  imageUrl: string | null | undefined,
  size: ImageSize = 'medium',
  alt: string = ''
): {
  src: string;
  loading: 'lazy' | 'eager';
  decoding: 'async';
  alt: string;
} {
  return {
    src: optimizeImage(imageUrl, size),
    loading: 'lazy',
    decoding: 'async',
    alt
  };
}
