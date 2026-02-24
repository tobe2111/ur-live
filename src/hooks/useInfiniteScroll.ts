/**
 * useInfiniteScroll Hook
 * 
 * 무한 스크롤 기능을 위한 React Hook
 * Intersection Observer API를 활용하여 자동 로딩
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseInfiniteScrollOptions<T> {
  initialPage?: number;
  pageSize?: number;
  threshold?: number; // Intersection Observer threshold (0.0 ~ 1.0)
  rootMargin?: string; // Intersection Observer rootMargin
  enabled?: boolean; // 무한 스크롤 활성화 여부
  mobileOptimized?: boolean; // 모바일 최적화 모드 (기본: true)
}

export interface UseInfiniteScrollReturn<T> {
  data: T[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: Error | null;
  loadMore: () => void;
  reset: () => void;
  lastElementRef: (node: HTMLElement | null) => void;
}

export function useInfiniteScroll<T>(
  fetchFn: (page: number, pageSize: number) => Promise<{ data: T[]; hasMore: boolean }>,
  options: UseInfiniteScrollOptions<T> = {}
): UseInfiniteScrollReturn<T> {
  const {
    initialPage = 1,
    pageSize = 20,
    threshold = 0.5,
    rootMargin = '100px',
    enabled = true,
    mobileOptimized = true  // 기본: 모바일 최적화 활성화
  } = options;

  const [data, setData] = useState<T[]>([]);
  const [page, setPage] = useState(initialPage);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const isFirstLoad = useRef(true);
  
  // 🔥 모바일 최적화: 디바운스를 위한 타이머
  const loadMoreTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 데이터 로드 함수
  const loadData = useCallback(
    async (pageNum: number, isInitial = false) => {
      if (!enabled) return;
      
      try {
        if (isInitial) {
          setIsLoading(true);
        } else {
          setIsLoadingMore(true);
        }
        setError(null);

        const result = await fetchFn(pageNum, pageSize);

        if (isInitial) {
          setData(result.data);
        } else {
          setData(prev => [...prev, ...result.data]);
        }

        setHasMore(result.hasMore);

        if (result.hasMore) {
          setPage(pageNum + 1);
        }
      } catch (err) {
        setError(err as Error);
        console.error('[useInfiniteScroll] Error:', err);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [fetchFn, pageSize, enabled]
  );

  // 초기 데이터 로드
  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      loadData(initialPage, true);
    }
  }, [loadData, initialPage]);

  // Intersection Observer 콜백
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && hasMore && !isLoadingMore && !isLoading && enabled) {
        // 🔥 모바일 최적화: 디바운스 적용 (저사양 기기에서 중복 호출 방지)
        if (mobileOptimized) {
          if (loadMoreTimerRef.current) {
            clearTimeout(loadMoreTimerRef.current);
          }
          loadMoreTimerRef.current = setTimeout(() => {
            loadData(page);
          }, 300); // 300ms 디바운스
        } else {
          loadData(page);
        }
      }
    },
    [hasMore, isLoadingMore, isLoading, page, loadData, enabled, mobileOptimized]
  );

  // Intersection Observer 설정
  const lastElementRef = useCallback(
    (node: HTMLElement | null) => {
      if (isLoading || isLoadingMore) return;

      // 기존 observer 정리
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      // 새로운 observer 생성
      if (node) {
        observerRef.current = new IntersectionObserver(handleObserver, {
          root: null,
          rootMargin,
          threshold
        });
        observerRef.current.observe(node);
      }
    },
    [isLoading, isLoadingMore, handleObserver, rootMargin, threshold]
  );

  // 수동 로드 더보기
  const loadMore = useCallback(() => {
    if (hasMore && !isLoadingMore && !isLoading) {
      loadData(page);
    }
  }, [hasMore, isLoadingMore, isLoading, page, loadData]);

  // 리셋
  const reset = useCallback(() => {
    setData([]);
    setPage(initialPage);
    setHasMore(true);
    setError(null);
    isFirstLoad.current = true;
  }, [initialPage]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      // 🔥 모바일 최적화: 타이머 정리
      if (loadMoreTimerRef.current) {
        clearTimeout(loadMoreTimerRef.current);
      }
    };
  }, []);

  return {
    data,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    reset,
    lastElementRef
  };
}

/**
 * 사용 예제:
 * 
 * const ProductList = () => {
 *   const {
 *     data: products,
 *     isLoading,
 *     isLoadingMore,
 *     hasMore,
 *     lastElementRef
 *   } = useInfiniteScroll(
 *     async (page, pageSize) => {
 *       const response = await fetch(`/api/products?page=${page}&limit=${pageSize}`);
 *       const json = await response.json();
 *       return {
 *         data: json.data,
 *         hasMore: json.pagination.hasNextPage
 *       };
 *     },
 *     { pageSize: 20 }
 *   );
 * 
 *   if (isLoading) return <div>로딩 중...</div>;
 * 
 *   return (
 *     <div>
 *       {products.map((product, index) => (
 *         <div
 *           key={product.id}
 *           ref={index === products.length - 1 ? lastElementRef : null}
 *         >
 *           {product.name}
 *         </div>
 *       ))}
 *       {isLoadingMore && <div>더 불러오는 중...</div>}
 *       {!hasMore && <div>모든 상품을 불러왔습니다.</div>}
 *     </div>
 *   );
 * };
 */
