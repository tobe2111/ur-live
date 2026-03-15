import { desc, asc } from 'drizzle-orm';
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
export class BaseRepository {
    db;
    tableName;
    constructor(db, tableName) {
        this.db = db;
        this.tableName = tableName;
    }
}
// ============================================
// 유틸리티 함수
// ============================================
/**
 * 페이지네이션 계산
 */
export function calculatePagination(page, pageSize) {
    const limit = pageSize;
    const offset = (page - 1) * pageSize;
    return { limit, offset };
}
/**
 * 정렬 옵션 생성
 */
export function createOrderBy(column, order = 'desc') {
    return order === 'asc' ? asc(column) : desc(column);
}
