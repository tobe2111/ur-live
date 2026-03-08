import { eq, and, or, desc, asc, SQL, sql } from 'drizzle-orm';
import type { DB } from '../db/client';

/**
 * ✅ Base Repository
 * 
 * Week 5 Day 3 - DB 타입 안전성 & N+1 쿼리 해결
 * 
 * 목적:
 * - 공통 CRUD 로직 재사용
 * - 타입 안전한 쿼리
 * - N+1 방지 (relations 활용)
 */

export abstract class BaseRepository<T extends { id: number }> {
  constructor(
    protected db: DB,
    protected tableName: string
  ) {}

  /**
   * ID로 단일 레코드 조회
   */
  abstract findById(id: number): Promise<T | null>;

  /**
   * 모든 레코드 조회 (페이지네이션)
   */
  abstract findAll(options?: {
    limit?: number;
    offset?: number;
    orderBy?: 'asc' | 'desc';
  }): Promise<T[]>;

  /**
   * 조건으로 레코드 조회
   */
  abstract findByCondition(condition: SQL): Promise<T[]>;

  /**
   * 레코드 생성
   */
  abstract create(data: Omit<T, 'id'>): Promise<T>;

  /**
   * 레코드 업데이트
   */
  abstract update(id: number, data: Partial<Omit<T, 'id'>>): Promise<T | null>;

  /**
   * 레코드 삭제
   */
  abstract delete(id: number): Promise<boolean>;

  /**
   * 개수 조회
   */
  abstract count(condition?: SQL): Promise<number>;
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 페이지네이션 계산
 */
export function calculatePagination(page: number, pageSize: number) {
  const limit = pageSize;
  const offset = (page - 1) * pageSize;
  return { limit, offset };
}

/**
 * 정렬 옵션 생성
 */
export function createOrderBy<T>(
  column: any,
  order: 'asc' | 'desc' = 'desc'
): SQL {
  return order === 'asc' ? asc(column) : desc(column);
}
