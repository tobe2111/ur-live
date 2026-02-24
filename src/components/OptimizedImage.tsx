/**
 * OptimizedImage Component (무료 버전)
 * 
 * 무료 플랜에서 사용 가능한 이미지 최적화 컴포넌트
 * - Lazy loading (화면에 보일 때만 로드)
 * - 로딩 플레이스홀더
 * - 에러 처리
 * 
 * 참고: Cloudflare Image Resizing은 사용하지 않음 (Pro 플랜 필요)
 */

import React, { useState } from 'react';
import { optimizeImage, type ImageSize } from '../lib/image-optimizer';

interface OptimizedImageProps {
  src: string | null | undefined;
  alt: string;
  size?: ImageSize; // 호환성 유지용 (실제로는 사용 안 함)
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  size = 'medium', // 호환성 유지용
  className = '',
  width,
  height,
  priority = false,
  onLoad,
  onError
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  };

  if (hasError) {
    return (
      <div 
        className={`bg-gray-200 flex items-center justify-center ${className}`}
        style={{ width, height }}
      >
        <svg 
          className="w-12 h-12 text-gray-400" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
          />
        </svg>
      </div>
    );
  }

  const imageSrc = optimizeImage(src, size);

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div 
          className="absolute inset-0 bg-gray-200 animate-pulse"
          style={{ width, height }}
        />
      )}
      
      <img
        src={imageSrc}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        className={`transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
      />
    </div>
  );
};

export const ProductImage: React.FC<{
  src: string | null | undefined;
  alt: string;
  size?: ImageSize;
  className?: string;
}> = ({ src, alt, size = 'medium', className = '' }) => {
  return (
    <div className={`aspect-square overflow-hidden ${className}`}>
      <OptimizedImage
        src={src}
        alt={alt}
        size={size}
        className="w-full h-full object-cover"
      />
    </div>
  );
};
