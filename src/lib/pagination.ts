/**
 * Pagination and Infinite Scroll Utilities
 * 
 * 효율적인 데이터 로딩을 위한 페이지네이션 및 무한 스크롤 유틸리티
 */

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: PaginationMeta;
}

/**
 * 페이지네이션 파라미터 파싱
 */
export function parsePaginationParams(searchParams: URLSearchParams): {
  page: number;
  limit: number;
  offset: number;
} {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * 페이지네이션 메타데이터 생성
 */
export function generatePaginationMeta(
  totalItems: number,
  page: number,
  limit: number
): PaginationMeta {
  const totalPages = Math.ceil(totalItems / limit);
  
  return {
    currentPage: page,
    totalPages,
    totalItems,
    itemsPerPage: limit,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1
  };
}

/**
 * SQL LIMIT/OFFSET 쿼리 생성
 */
export function buildPaginationQuery(limit: number, offset: number): string {
  return `LIMIT ${limit} OFFSET ${offset}`;
}

/**
 * React Hook: 무한 스크롤
 */
export function useInfiniteScroll<T>(
  fetchFn: (page: number) => Promise<{ data: T[]; hasMore: boolean }>,
  options?: {
    initialPage?: number;
    pageSize?: number;
  }
) {
  // 이 함수는 프론트엔드에서 사용
  // 실제 구현은 React Hook으로 별도 파일에 작성 필요
  return {
    data: [] as T[],
    isLoading: false,
    hasMore: true,
    loadMore: async () => {},
    reset: () => {}
  };
}

/**
 * 커서 기반 페이지네이션 (무한 스크롤 최적화)
 */
export interface CursorPaginationParams {
  cursor?: string; // 마지막 항목의 ID 또는 timestamp
  limit?: number;
}

export interface CursorPaginatedResponse<T> {
  success: boolean;
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * 커서 기반 페이지네이션 파라미터 파싱
 */
export function parseCursorParams(searchParams: URLSearchParams): {
  cursor: string | null;
  limit: number;
} {
  const cursor = searchParams.get('cursor');
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

  return { cursor, limit };
}

/**
 * 다음 커서 생성 (ID 기반)
 */
export function generateNextCursor<T extends { id: number | string }>(
  items: T[]
): string | null {
  if (items.length === 0) {
    return null;
  }
  
  const lastItem = items[items.length - 1];
  return String(lastItem.id);
}

/**
 * 다음 커서 생성 (Timestamp 기반)
 */
export function generateNextCursorByTimestamp<T extends { created_at: string }>(
  items: T[]
): string | null {
  if (items.length === 0) {
    return null;
  }
  
  const lastItem = items[items.length - 1];
  return lastItem.created_at;
}
