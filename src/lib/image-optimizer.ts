/**
 * Cloudflare Image Resizing Helper
 * 
 * Cloudflare Workers의 Image Resizing 기능을 활용하여
 * 이미지를 최적화된 크기와 포맷으로 변환합니다.
 * 
 * 참고: https://developers.cloudflare.com/images/image-resizing/
 */

export type ImageSize = 
  | 'thumbnail'    // 150x150 (썸네일)
  | 'small'        // 320x320 (모바일 리스트)
  | 'medium'       // 640x640 (상품 상세)
  | 'large'        // 1024x1024 (확대 이미지)
  | 'banner'       // 1920x600 (배너)
  | 'original';    // 원본 크기

export interface ImageResizeOptions {
  width?: number;
  height?: number;
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
  format?: 'auto' | 'webp' | 'avif' | 'json';
  quality?: number; // 1-100
  blur?: number;    // 1-250
  sharpen?: number; // 0-10
}

/**
 * 사전 정의된 이미지 크기 프리셋
 */
const IMAGE_PRESETS: Record<ImageSize, ImageResizeOptions> = {
  thumbnail: {
    width: 150,
    height: 150,
    fit: 'cover',
    format: 'auto',
    quality: 80
  },
  small: {
    width: 320,
    height: 320,
    fit: 'scale-down',
    format: 'auto',
    quality: 85
  },
  medium: {
    width: 640,
    height: 640,
    fit: 'scale-down',
    format: 'auto',
    quality: 85
  },
  large: {
    width: 1024,
    height: 1024,
    fit: 'scale-down',
    format: 'auto',
    quality: 90
  },
  banner: {
    width: 1920,
    height: 600,
    fit: 'cover',
    format: 'auto',
    quality: 85
  },
  original: {
    format: 'auto',
    quality: 95
  }
};

/**
 * 이미지 URL에 Cloudflare Image Resizing 파라미터 추가
 * 
 * @param imageUrl 원본 이미지 URL
 * @param size 사전 정의된 크기 (thumbnail, small, medium, large, banner, original)
 * @param customOptions 커스텀 옵션 (프리셋 덮어쓰기)
 * @returns 최적화된 이미지 URL
 */
export function optimizeImage(
  imageUrl: string | null | undefined,
  size: ImageSize = 'medium',
  customOptions?: Partial<ImageResizeOptions>
): string {
  // null/undefined 체크
  if (!imageUrl) {
    return '/static/placeholder.png'; // 기본 이미지
  }

  // 이미 최적화된 URL인지 확인
  if (imageUrl.includes('/cdn-cgi/image/')) {
    return imageUrl;
  }

  // 외부 URL인 경우 그대로 반환 (Cloudflare 도메인이 아닌 경우)
  // 프로덕션 환경에서는 Cloudflare를 통해 프록시해야 함
  if (imageUrl.startsWith('http') && !imageUrl.includes('ur-team.com') && !imageUrl.includes('pages.dev')) {
    return imageUrl;
  }

  // 프리셋 옵션 가져오기
  const preset = IMAGE_PRESETS[size];
  const options = { ...preset, ...customOptions };

  // 옵션을 쿼리 스트링으로 변환
  const params: string[] = [];
  
  if (options.width) params.push(`width=${options.width}`);
  if (options.height) params.push(`height=${options.height}`);
  if (options.fit) params.push(`fit=${options.fit}`);
  if (options.format) params.push(`format=${options.format}`);
  if (options.quality) params.push(`quality=${options.quality}`);
  if (options.blur) params.push(`blur=${options.blur}`);
  if (options.sharpen) params.push(`sharpen=${options.sharpen}`);

  // Cloudflare Image Resizing URL 생성
  const optionsString = params.join(',');
  
  // 상대 경로인 경우
  if (imageUrl.startsWith('/')) {
    return `/cdn-cgi/image/${optionsString}${imageUrl}`;
  }
  
  // 절대 URL인 경우
  return `/cdn-cgi/image/${optionsString}/${imageUrl}`;
}

/**
 * 반응형 이미지를 위한 srcset 생성
 * 
 * @param imageUrl 원본 이미지 URL
 * @returns srcset 문자열
 */
export function generateSrcSet(imageUrl: string | null | undefined): string {
  if (!imageUrl) {
    return '';
  }

  const sizes: Array<{ size: ImageSize; descriptor: string }> = [
    { size: 'small', descriptor: '320w' },
    { size: 'medium', descriptor: '640w' },
    { size: 'large', descriptor: '1024w' }
  ];

  return sizes
    .map(({ size, descriptor }) => 
      `${optimizeImage(imageUrl, size)} ${descriptor}`
    )
    .join(', ');
}

/**
 * picture 태그용 소스 생성 (WebP + fallback)
 * 
 * @param imageUrl 원본 이미지 URL
 * @param size 이미지 크기
 * @returns { webp: string, fallback: string }
 */
export function generatePictureSources(
  imageUrl: string | null | undefined,
  size: ImageSize = 'medium'
): { webp: string; fallback: string } {
  if (!imageUrl) {
    return {
      webp: '/static/placeholder.png',
      fallback: '/static/placeholder.png'
    };
  }

  return {
    webp: optimizeImage(imageUrl, size, { format: 'webp' }),
    fallback: optimizeImage(imageUrl, size, { format: 'auto' })
  };
}

/**
 * React에서 사용할 이미지 props 생성
 * 
 * @param imageUrl 원본 이미지 URL
 * @param size 이미지 크기
 * @param alt 대체 텍스트
 * @returns React img props
 */
export function getOptimizedImageProps(
  imageUrl: string | null | undefined,
  size: ImageSize = 'medium',
  alt: string = ''
): {
  src: string;
  srcSet: string;
  loading: 'lazy' | 'eager';
  decoding: 'async';
  alt: string;
} {
  return {
    src: optimizeImage(imageUrl, size),
    srcSet: generateSrcSet(imageUrl),
    loading: 'lazy',
    decoding: 'async',
    alt
  };
}
