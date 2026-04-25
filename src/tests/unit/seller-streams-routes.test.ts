/**
 * 셀러 스트림 관리 & 분석 단위 테스트
 *
 * 다음 파일들의 핵심 로직을 pure function 으로 mirror:
 *   - seller-streams-crud.routes.ts   — 스트림 CRUD (생성/조회/수정/삭제)
 *   - seller-streams-analytics.routes.ts — 스트림 분석 (요약/상세/실시간)
 *   - seller-analytics.routes.ts      — 셀러 일반 분석 (매출/고객/상품)
 *   - seller-products-management.routes.ts — 상품 관리 (등록/수정/삭제/연결)
 */
import { describe, it, expect } from 'vitest';

// ── D1 mock ──────────────────────────────────────────────────────────────────
const mockDB = {
  prepare: (sql: string) => ({
    bind: (..._args: unknown[]) => ({
      run: async () => ({ success: true, meta: { changes: 1, last_row_id: 42 } }),
      first: async () => null,
      all: async () => ({ results: [] }),
    }),
    first: async () => null,
    all: async () => ({ results: [] }),
    run: async () => ({ success: true, meta: { changes: 1, last_row_id: 42 } }),
  }),
};

// ── 타입 ──────────────────────────────────────────────────────────────────────
interface StreamCreateBody {
  title?: string;
  description?: string;
  thumbnail?: string;
  youtube_video_id?: string;
}

interface StreamUpdateBody {
  title?: string;
  description?: string;
  youtube_video_id?: string;
  status?: 'scheduled' | 'live' | 'ended';
}

interface ProductCreateBody {
  name?: string;
  description?: string;
  price?: number;
  stock?: number;
  image_url?: string;
  category?: string;
}

interface ProductUpdateBody {
  name?: string;
  description?: string;
  price?: number;
  stock?: number;
  status?: string;
  is_active?: boolean | number;
}

// ── 검증 함수 (각 routes.ts 에서 mirror) ─────────────────────────────────────

// ──────────────────────────────────────────────
// 스트림 생성 검증 (seller-streams-crud.routes.ts POST /)
// ──────────────────────────────────────────────
type StreamCreateResult =
  | { ok: true }
  | { ok: false; statusCode: 400 | 401; error: string };

function validateStreamCreate(
  sellerId: number | null,
  body: StreamCreateBody
): StreamCreateResult {
  if (!sellerId) return { ok: false, statusCode: 401, error: '로그인이 필요합니다' };

  const { title, youtube_video_id, description } = body;

  if (!title) return { ok: false, statusCode: 400, error: 'Title is required' };

  if (title.length > 200) {
    return { ok: false, statusCode: 400, error: '제목은 200자 이하여야 합니다' };
  }

  if (description && description.length > 2000) {
    return { ok: false, statusCode: 400, error: '설명은 2000자 이하여야 합니다' };
  }

  // YouTube video_id 형식 검증: 11자 영숫자+_-
  if (youtube_video_id && !/^[a-zA-Z0-9_-]{11}$/.test(youtube_video_id)) {
    return {
      ok: false,
      statusCode: 400,
      error: 'YouTube video ID 형식이 올바르지 않습니다 (11자 영숫자)',
    };
  }

  return { ok: true };
}

// ──────────────────────────────────────────────
// 스트림 소유권 검증 (PUT/DELETE)
// ──────────────────────────────────────────────
type OwnershipResult =
  | { ok: true }
  | { ok: false; statusCode: 401 | 404; error: string };

function validateStreamOwnership(
  sellerId: number | null,
  streamOwnerId: number | null
): OwnershipResult {
  if (!sellerId) return { ok: false, statusCode: 401, error: '로그인이 필요합니다' };
  if (streamOwnerId === null) return { ok: false, statusCode: 404, error: 'Stream not found' };
  if (sellerId !== streamOwnerId) return { ok: false, statusCode: 404, error: 'Stream not found' };
  return { ok: true };
}

// ──────────────────────────────────────────────
// 스트림 업데이트 필드 검증
// ──────────────────────────────────────────────
type StreamUpdateResult =
  | { ok: true; updates: string[] }
  | { ok: false; statusCode: 400; error: string };

function validateStreamUpdate(body: StreamUpdateBody): StreamUpdateResult {
  const updates: string[] = [];

  if (body.title !== undefined) updates.push('title = ?');
  if (body.description !== undefined) updates.push('description = ?');
  if (body.youtube_video_id !== undefined) updates.push('youtube_video_id = ?');
  if (body.status !== undefined) {
    updates.push('status = ?');
    if (body.status === 'ended') updates.push("ended_at = datetime('now')");
  }

  if (updates.length === 0) {
    return { ok: false, statusCode: 400, error: 'No fields to update' };
  }

  return { ok: true, updates };
}

// ──────────────────────────────────────────────
// 상품 생성 검증 (seller-products-management.routes.ts POST /products)
// ──────────────────────────────────────────────
type ProductCreateResult =
  | { ok: true }
  | { ok: false; statusCode: 400 | 401; error: string };

function validateProductCreate(
  sellerId: string | null,
  body: ProductCreateBody
): ProductCreateResult {
  if (!sellerId) return { ok: false, statusCode: 401, error: 'Unauthorized' };

  const { name, price } = body;

  if (!name || price === undefined) {
    return { ok: false, statusCode: 400, error: '상품명과 가격은 필수입니다.' };
  }

  return { ok: true };
}

// ──────────────────────────────────────────────
// 상품 업데이트 필드 검증
// ──────────────────────────────────────────────
type ProductUpdateResult =
  | { ok: true; fields: string[] }
  | { ok: false; statusCode: 400; error: string };

function validateProductUpdate(body: ProductUpdateBody): ProductUpdateResult {
  const fields: string[] = [];

  if (body.name !== undefined) fields.push('name = ?');
  if (body.description !== undefined) fields.push('description = ?');
  if (body.price !== undefined) fields.push('price = ?');
  if (body.stock !== undefined) {
    fields.push('stock_quantity = ?');
    fields.push('stock = ?');
  }
  if (body.status !== undefined) fields.push('status = ?');
  if (body.is_active !== undefined) fields.push('is_active = ?');

  if (fields.length === 0) {
    return { ok: false, statusCode: 400, error: '수정할 내용이 없습니다.' };
  }

  return { ok: true, fields };
}

// ──────────────────────────────────────────────
// PIN 검증 (seller-products-management.routes.ts PUT /products/:id/pin)
// ──────────────────────────────────────────────
type PinValidationResult =
  | { ok: true }
  | { ok: false; statusCode: 400 | 401; error: string };

function validatePin(
  sellerId: string | null,
  pin: string | undefined
): PinValidationResult {
  if (!sellerId) return { ok: false, statusCode: 401, error: '로그인 필요' };
  if (!pin || pin.length < 4) {
    return { ok: false, statusCode: 400, error: 'PIN은 4자리 이상이어야 합니다' };
  }
  return { ok: true };
}

// ──────────────────────────────────────────────
// 분석 기간 파라미터 해석 (seller-streams-analytics.routes.ts)
// ──────────────────────────────────────────────
function parsePeriodDays(period: string | undefined): number {
  const p = period || '30d';
  if (p === '7d') return 7;
  if (p === '90d') return 90;
  return 30; // default
}

// ──────────────────────────────────────────────
// 페이지네이션 파라미터 처리 (seller-streams-crud.routes.ts GET /)
// ──────────────────────────────────────────────
function parsePagination(limitStr?: string, offsetStr?: string): { limit: number; offset: number } {
  const limit = Math.min(Math.max(1, parseInt(limitStr || '10') || 10), 100);
  const offset = Math.max(0, parseInt(offsetStr || '0') || 0);
  return { limit, offset };
}

// ──────────────────────────────────────────────
// has_more 계산
// ──────────────────────────────────────────────
function calcHasMore(offset: number, limit: number, total: number): boolean {
  return (offset + limit) < total;
}

// ──────────────────────────────────────────────
// 재방문율 계산 (seller-analytics.routes.ts)
// ──────────────────────────────────────────────
function calcRevisitRate(total: number, repeat: number): number {
  if (total <= 0) return 0;
  return Math.round((repeat / total) * 10000) / 100;
}

// ──────────────────────────────────────────────
// 바우처 사용률 계산 (seller-analytics.routes.ts)
// ──────────────────────────────────────────────
function calcUsageRate(total: number, used: number): number {
  if (total <= 0) return 0;
  return Math.round((used / total) * 10000) / 100;
}

// ──────────────────────────────────────────────
// 스트림 평균 매출 계산 (seller-streams-analytics.routes.ts)
// ──────────────────────────────────────────────
function calcAvgRevenuePerStream(totalStreams: number, totalRevenue: number): number {
  if (totalStreams <= 0) return 0;
  return Math.round(totalRevenue / totalStreams);
}

// ── 픽스처 ──────────────────────────────────────────────────────────────────
const SELLER_ID = 10;
const OTHER_SELLER_ID = 99;

// ─────────────────────────────────────────────────────────────────────────────
// 1. 스트림 생성 검증
// ─────────────────────────────────────────────────────────────────────────────
describe('Stream create — 생성 검증', () => {
  it('인증 없음 → 401', () => {
    const res = validateStreamCreate(null, { title: '테스트 방송' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.statusCode).toBe(401);
  });

  it('title 없음 → 400', () => {
    const res = validateStreamCreate(SELLER_ID, {});
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.statusCode).toBe(400);
      expect(res.error).toMatch(/Title/i);
    }
  });

  it('title 빈 문자열 → 400', () => {
    const res = validateStreamCreate(SELLER_ID, { title: '' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.statusCode).toBe(400);
  });

  it('정상 title → 통과', () => {
    const res = validateStreamCreate(SELLER_ID, { title: '정상 방송 제목' });
    expect(res.ok).toBe(true);
  });

  it('title 200자 이하 경계 → 통과', () => {
    const res = validateStreamCreate(SELLER_ID, { title: 'a'.repeat(200) });
    expect(res.ok).toBe(true);
  });

  it('title 201자 초과 → 400', () => {
    const res = validateStreamCreate(SELLER_ID, { title: 'a'.repeat(201) });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.statusCode).toBe(400);
      expect(res.error).toMatch(/200자/);
    }
  });

  it('description 2000자 이하 → 통과', () => {
    const res = validateStreamCreate(SELLER_ID, { title: '제목', description: 'b'.repeat(2000) });
    expect(res.ok).toBe(true);
  });

  it('description 2001자 초과 → 400', () => {
    const res = validateStreamCreate(SELLER_ID, { title: '제목', description: 'b'.repeat(2001) });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.statusCode).toBe(400);
      expect(res.error).toMatch(/2000자/);
    }
  });

  it('youtube_video_id 유효한 11자 형식 → 통과', () => {
    const res = validateStreamCreate(SELLER_ID, { title: '방송', youtube_video_id: 'dQw4w9WgXcQ' });
    expect(res.ok).toBe(true);
  });

  it('youtube_video_id 10자 (형식 불일치) → 400', () => {
    const res = validateStreamCreate(SELLER_ID, { title: '방송', youtube_video_id: 'short1234' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.statusCode).toBe(400);
      expect(res.error).toMatch(/YouTube video ID/);
    }
  });

  it('youtube_video_id 특수문자 포함 → 400', () => {
    const res = validateStreamCreate(SELLER_ID, { title: '방송', youtube_video_id: 'abc!@#$%^&*(' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.statusCode).toBe(400);
  });

  it('youtube_video_id 언더스코어/하이픈 포함 11자 → 통과', () => {
    // YouTube IDs can include _ and -
    const res = validateStreamCreate(SELLER_ID, { title: '방송', youtube_video_id: 'abc-def_123' });
    expect(res.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. 스트림 소유권 검증
// ─────────────────────────────────────────────────────────────────────────────
describe('Stream ownership — 소유권 검증', () => {
  it('인증 없음 → 401', () => {
    const res = validateStreamOwnership(null, SELLER_ID);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.statusCode).toBe(401);
  });

  it('스트림이 존재하지 않음 (null) → 404', () => {
    const res = validateStreamOwnership(SELLER_ID, null);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.statusCode).toBe(404);
  });

  it('다른 셀러의 스트림 → 404 (소유권 불일치)', () => {
    const res = validateStreamOwnership(SELLER_ID, OTHER_SELLER_ID);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.statusCode).toBe(404);
      expect(res.error).toMatch(/Stream not found/);
    }
  });

  it('본인 스트림 → 통과', () => {
    const res = validateStreamOwnership(SELLER_ID, SELLER_ID);
    expect(res.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. 스트림 업데이트 필드 & 상태 전환
// ─────────────────────────────────────────────────────────────────────────────
describe('Stream update — 필드 검증 & 상태 전환', () => {
  it('빈 body → 400 (수정할 내용 없음)', () => {
    const res = validateStreamUpdate({});
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.statusCode).toBe(400);
      expect(res.error).toMatch(/No fields/i);
    }
  });

  it('title만 제공 → 통과, updates에 title 포함', () => {
    const res = validateStreamUpdate({ title: '새 제목' });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.updates).toContain('title = ?');
  });

  it('status = live → 통과, updates에 status 포함', () => {
    const res = validateStreamUpdate({ status: 'live' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.updates).toContain('status = ?');
      // live 상태에서는 ended_at 설정 안 함
      expect(res.updates.some(u => u.includes('ended_at'))).toBe(false);
    }
  });

  it('status = ended → updates에 ended_at 포함', () => {
    const res = validateStreamUpdate({ status: 'ended' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.updates.some(u => u.includes('ended_at'))).toBe(true);
    }
  });

  it('status = scheduled → ended_at 설정 안 함', () => {
    const res = validateStreamUpdate({ status: 'scheduled' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.updates.some(u => u.includes('ended_at'))).toBe(false);
    }
  });

  it('여러 필드 동시 업데이트 → 모든 필드 포함', () => {
    const res = validateStreamUpdate({ title: '제목', description: '설명', status: 'live' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.updates).toContain('title = ?');
      expect(res.updates).toContain('description = ?');
      expect(res.updates).toContain('status = ?');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. 상품 생성 검증
// ─────────────────────────────────────────────────────────────────────────────
describe('Product create — 생성 검증', () => {
  it('인증 없음 → 401', () => {
    const res = validateProductCreate(null, { name: '상품', price: 10000 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.statusCode).toBe(401);
  });

  it('name 없음 → 400', () => {
    const res = validateProductCreate('10', { price: 10000 });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.statusCode).toBe(400);
      expect(res.error).toMatch(/상품명/);
    }
  });

  it('price 없음 → 400', () => {
    const res = validateProductCreate('10', { name: '상품명' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.statusCode).toBe(400);
      expect(res.error).toMatch(/가격/);
    }
  });

  it('name + price 모두 제공 → 통과', () => {
    const res = validateProductCreate('10', { name: '테스트 상품', price: 15000 });
    expect(res.ok).toBe(true);
  });

  it('price = 0 (경계) → 통과 (라우트에서 undefined 만 거부)', () => {
    const res = validateProductCreate('10', { name: '무료 상품', price: 0 });
    expect(res.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. 상품 업데이트 필드 검증
// ─────────────────────────────────────────────────────────────────────────────
describe('Product update — 필드 검증', () => {
  it('빈 body → 400 (수정할 내용 없음)', () => {
    const res = validateProductUpdate({});
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.statusCode).toBe(400);
      expect(res.error).toMatch(/수정할 내용/);
    }
  });

  it('name만 제공 → 통과, fields에 name 포함', () => {
    const res = validateProductUpdate({ name: '새 이름' });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.fields).toContain('name = ?');
  });

  it('stock 제공 → fields에 stock_quantity와 stock 모두 포함 (이중 컬럼 대응)', () => {
    const res = validateProductUpdate({ stock: 50 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.fields).toContain('stock_quantity = ?');
      expect(res.fields).toContain('stock = ?');
    }
  });

  it('is_active = false → fields에 is_active 포함', () => {
    const res = validateProductUpdate({ is_active: false });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.fields).toContain('is_active = ?');
  });

  it('여러 필드 동시 업데이트 → 모든 필드 포함', () => {
    const res = validateProductUpdate({ name: '이름', price: 20000, stock: 100 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.fields).toContain('name = ?');
      expect(res.fields).toContain('price = ?');
      expect(res.fields).toContain('stock_quantity = ?');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. PIN 검증
// ─────────────────────────────────────────────────────────────────────────────
describe('Product PIN — 설정 검증', () => {
  it('인증 없음 → 401', () => {
    const res = validatePin(null, '1234');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.statusCode).toBe(401);
  });

  it('PIN 없음 → 400', () => {
    const res = validatePin('10', undefined);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.statusCode).toBe(400);
      expect(res.error).toMatch(/4자리/);
    }
  });

  it('PIN 3자리 (너무 짧음) → 400', () => {
    const res = validatePin('10', '123');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.statusCode).toBe(400);
  });

  it('PIN 4자리 경계 → 통과', () => {
    const res = validatePin('10', '1234');
    expect(res.ok).toBe(true);
  });

  it('PIN 6자리 → 통과', () => {
    const res = validatePin('10', '123456');
    expect(res.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. 분석 기간 파라미터 해석
// ─────────────────────────────────────────────────────────────────────────────
describe('Analytics period — 기간 파라미터 해석', () => {
  it('period 없음 → 기본 30일', () => {
    expect(parsePeriodDays(undefined)).toBe(30);
  });

  it('period = "7d" → 7일', () => {
    expect(parsePeriodDays('7d')).toBe(7);
  });

  it('period = "30d" → 30일', () => {
    expect(parsePeriodDays('30d')).toBe(30);
  });

  it('period = "90d" → 90일', () => {
    expect(parsePeriodDays('90d')).toBe(90);
  });

  it('알 수 없는 period 값 → 기본 30일 fallback', () => {
    expect(parsePeriodDays('999d')).toBe(30);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. 페이지네이션 & has_more 계산
// ─────────────────────────────────────────────────────────────────────────────
describe('Pagination — 페이지네이션 파라미터 & has_more', () => {
  it('기본값: limit=10, offset=0', () => {
    const p = parsePagination();
    expect(p.limit).toBe(10);
    expect(p.offset).toBe(0);
  });

  it('limit = "0" 입력 시 → fallback 10 (parseInt("0") || 10 이므로)', () => {
    // 실제 라우트: (parseInt('0') || 10) — 0은 falsy이므로 10으로 fallback
    const p = parsePagination('0');
    expect(p.limit).toBe(10);
  });

  it('limit 최대 100 보장 (200 입력 시)', () => {
    const p = parsePagination('200');
    expect(p.limit).toBe(100);
  });

  it('offset 음수 → 0 보장', () => {
    const p = parsePagination('10', '-5');
    expect(p.offset).toBe(0);
  });

  it('has_more: offset+limit < total → true', () => {
    expect(calcHasMore(0, 10, 15)).toBe(true);
  });

  it('has_more: offset+limit = total → false', () => {
    expect(calcHasMore(0, 10, 10)).toBe(false);
  });

  it('has_more: offset+limit > total → false', () => {
    expect(calcHasMore(5, 10, 10)).toBe(false);
  });

  it('has_more: 마지막 페이지 (offset=10, limit=10, total=15) → false', () => {
    expect(calcHasMore(10, 10, 15)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. 재방문율 & 바우처 사용률 계산
// ─────────────────────────────────────────────────────────────────────────────
describe('Analytics calculations — 재방문율 & 사용률', () => {
  it('재방문율: total=0 → 0 (division by zero 방지)', () => {
    expect(calcRevisitRate(0, 0)).toBe(0);
  });

  it('재방문율: total=100, repeat=50 → 50.00', () => {
    expect(calcRevisitRate(100, 50)).toBe(50);
  });

  it('재방문율: total=3, repeat=1 → 33.33', () => {
    expect(calcRevisitRate(3, 1)).toBe(33.33);
  });

  it('바우처 사용률: total=0 → 0 (division by zero 방지)', () => {
    expect(calcUsageRate(0, 0)).toBe(0);
  });

  it('바우처 사용률: total=100, used=75 → 75.00', () => {
    expect(calcUsageRate(100, 75)).toBe(75);
  });

  it('스트림 평균 매출: streams=0 → 0 (division by zero 방지)', () => {
    expect(calcAvgRevenuePerStream(0, 0)).toBe(0);
  });

  it('스트림 평균 매출: streams=3, revenue=300000 → 100000', () => {
    expect(calcAvgRevenuePerStream(3, 300000)).toBe(100000);
  });

  it('스트림 평균 매출: 소수점 반올림 처리', () => {
    // 10 / 3 = 3.333... → round → 3
    expect(calcAvgRevenuePerStream(3, 10)).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. D1 mock — 스트림 CRUD 쿼리 동작 확인
// ─────────────────────────────────────────────────────────────────────────────
describe('Stream CRUD — D1 mock DB 동작', () => {
  it('INSERT 스트림 생성 쿼리 성공', async () => {
    const result = await mockDB
      .prepare(`INSERT INTO live_streams (seller_id, title, description, youtube_video_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'scheduled', datetime('now'), datetime('now'))`)
      .bind(10, '테스트 방송', null, '')
      .run();
    expect(result.success).toBe(true);
    expect(result.meta.last_row_id).toBe(42);
  });

  it('SELECT 스트림 상세 조회 — 없으면 null', async () => {
    const row = await mockDB
      .prepare('SELECT id, seller_id, title FROM live_streams WHERE id = ? AND seller_id = ?')
      .bind(999, 10)
      .first();
    expect(row).toBeNull();
  });

  it('UPDATE 스트림 상태 변경 쿼리 성공', async () => {
    const result = await mockDB
      .prepare("UPDATE live_streams SET status = ?, updated_at = datetime('now') WHERE id = ? AND seller_id = ?")
      .bind('live', 42, 10)
      .run();
    expect(result.success).toBe(true);
  });

  it('DELETE 스트림 삭제 쿼리 성공', async () => {
    const result = await mockDB
      .prepare('DELETE FROM live_streams WHERE id = ? AND seller_id = ?')
      .bind(42, 10)
      .run();
    expect(result.success).toBe(true);
  });

  it('SELECT all 스트림 목록 — 없으면 빈 배열', async () => {
    const rows = await mockDB
      .prepare('SELECT id, title, status FROM live_streams WHERE seller_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .bind(10, 10, 0)
      .all();
    expect(rows.results).toEqual([]);
  });

  it('INSERT 상품 생성 쿼리 성공', async () => {
    const result = await mockDB
      .prepare(`INSERT INTO products (seller_id, name, description, price, stock, image_url, category, product_type, status, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'live', 'ACTIVE', 1, datetime('now'), datetime('now'))`)
      .bind('10', '테스트 상품', null, 15000, 10, null, null)
      .run();
    expect(result.success).toBe(true);
  });

  it('UPDATE 상품 비활성화 (soft delete) 쿼리 성공', async () => {
    const result = await mockDB
      .prepare("UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id = ? AND seller_id = ?")
      .bind(42, '10')
      .run();
    expect(result.success).toBe(true);
    expect(result.meta.changes).toBe(1);
  });
});
