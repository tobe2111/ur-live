import { cn } from '@/lib/utils'

export interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded'
  width?: string | number
  height?: string | number
  animation?: 'pulse' | 'wave' | 'none'
}

/**
 * Skeleton Loader Component
 * 
 * 로딩 중 placeholder를 표시합니다.
 */
export function Skeleton({
  className,
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse'
}: SkeletonProps) {
  const baseClass = 'bg-gray-200'
  
  const variantClass = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-lg'
  }[variant]

  const animationClass = {
    pulse: 'animate-pulse',
    wave: 'animate-wave',
    none: ''
  }[animation]

  const style: React.CSSProperties = {}
  if (width) style.width = typeof width === 'number' ? `${width}px` : width
  if (height) style.height = typeof height === 'number' ? `${height}px` : height

  return (
    <div
      className={cn(baseClass, variantClass, animationClass, className)}
      style={style}
    />
  )
}

/**
 * Product Detail Skeleton
 */
export function ProductDetailSkeleton() {
  return (
    <div className="min-h-screen bg-background animate-pulse">
      {/* Header Skeleton */}
      <div className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="flex items-center justify-between px-5 py-4">
          <Skeleton className="w-6 h-6" variant="circular" />
          <Skeleton className="w-6 h-6" variant="circular" />
        </div>
      </div>

      {/* Image Carousel Skeleton */}
      <div className="relative w-full" style={{ aspectRatio: '1/1' }}>
        <Skeleton className="w-full h-full" />
        
        {/* Dots */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="w-1.5 h-1.5" variant="circular" />
          ))}
        </div>
      </div>

      {/* Product Info Skeleton */}
      <div className="px-5 py-6 space-y-4">
        {/* Brand/Name */}
        <div className="space-y-2">
          <Skeleton className="w-32 h-4" />
          <Skeleton className="w-full h-6" />
        </div>

        {/* Price */}
        <div className="flex items-center gap-2">
          <Skeleton className="w-24 h-8" />
          <Skeleton className="w-16 h-5" />
        </div>

        {/* Separator */}
        <div className="border-t border-border my-6" />

        {/* Description */}
        <div className="space-y-2">
          <Skeleton className="w-20 h-4" />
          <Skeleton className="w-full h-4" />
          <Skeleton className="w-full h-4" />
          <Skeleton className="w-3/4 h-4" />
        </div>

        {/* Info Section */}
        <div className="space-y-3 mt-6">
          <Skeleton className="w-24 h-4" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="w-16 h-4" />
              <Skeleton className="w-24 h-4" />
            </div>
          ))}
        </div>
      </div>

      {/* Floating Action Bar Skeleton */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-screen-sm bg-background border-t border-border p-4">
        <div className="flex gap-2">
          <Skeleton className="w-12 h-12" variant="rounded" />
          <Skeleton className="flex-1 h-12" variant="rounded" />
        </div>
      </div>
    </div>
  )
}

/**
 * Card Skeleton
 */
export function CardSkeleton() {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <Skeleton className="w-full h-48" />
      <div className="p-4 space-y-3">
        <Skeleton className="w-3/4 h-5" />
        <Skeleton className="w-1/2 h-4" />
        <div className="flex items-center gap-2">
          <Skeleton className="w-16 h-6" />
          <Skeleton className="w-12 h-4" />
        </div>
      </div>
    </div>
  )
}

/**
 * List Skeleton
 */
export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="flex gap-4 p-4 border border-border rounded-lg">
          <Skeleton className="w-20 h-20 flex-shrink-0" variant="rounded" />
          <div className="flex-1 space-y-2">
            <Skeleton className="w-3/4 h-5" />
            <Skeleton className="w-1/2 h-4" />
            <Skeleton className="w-1/3 h-4" />
          </div>
        </div>
      ))}
    </div>
  )
}
