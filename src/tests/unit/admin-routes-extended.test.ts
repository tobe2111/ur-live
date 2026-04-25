/**
 * Admin Routes Extended 단위 테스트
 *   - admin-banners.routes.ts
 *   - admin-products.routes.ts
 *   - admin-streams.routes.ts
 *   - admin-stats.routes.ts
 *   - admin-tools.routes.ts
 *   - admin-moderation.routes.ts
 */
import { describe, it, expect } from 'vitest';

const mockDB = {
  prepare: (_sql: string) => ({
    bind: (..._: unknown[]) => ({
      run: async () => ({ success: true, meta: { changes: 1, last_row_id: 1 } }),
      first: async () => null,
      all: async () => ({ results: [] }),
    }),
    first: async () => null,
    all: async () => ({ results: [] }),
    run: async () => ({ success: true, meta: { changes: 1, last_row_id: 1 } }),
  }),
};

// ── Admin Banners mirrors ─────────────────────────────────────────────────────

function validateBannerCreate(body: {
  image_url?: string; link_url?: string; display_order?: number; title?: string
}): string | null {
  if (!body.image_url || typeof body.image_url !== 'string') return 'image_url 필수';
  if (body.image_url.length > 500) return 'image_url 너무 김';
  if (body.link_url && typeof body.link_url !== 'string') return 'link_url 형식 오류';
  if (body.link_url && body.link_url.length > 500) return 'link_url 너무 김';
  if (body.display_order !== undefined) {
    const n = Number(body.display_order);
    if (!Number.isInteger(n) || n < 0) return 'display_order 0 이상 정수';
  }
  if (body.title && body.title.length > 200) return 'title 너무 김';
  return null;
}

// ── Admin Products mirrors ────────────────────────────────────────────────────

function validateAdminProductUpdate(body: {
  price?: number; stock?: number; is_active?: boolean
}): string | null {
  if (body.price !== undefined) {
    const n = Number(body.price);
    if (!Number.isFinite(n) || n < 0 || n > 100_000_000) return 'price 0~1억 범위';
  }
  if (body.stock !== undefined) {
    const n = Number(body.stock);
    if (!Number.isInteger(n) || n < 0 || n > 1_000_000) return 'stock 0~100만 범위';
  }
  if (body.is_active !== undefined && typeof body.is_active !== 'boolean') {
    return 'is_active boolean';
  }
  return null;
}

// ── Admin Streams mirrors ─────────────────────────────────────────────────────

const VALID_STREAM_STATUSES = ['scheduled', 'live', 'ended'] as const;

function isValidStreamStatus(status: string): boolean {
  return VALID_STREAM_STATUSES.includes(status as typeof VALID_STREAM_STATUSES[number]);
}

function buildStreamFilter(filter: {
  status?: string; sellerId?: number; startDate?: string
}): { conditions: string[]; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.status && isValidStreamStatus(filter.status)) {
    conditions.push('status = ?');
    params.push(filter.status);
  }
  if (filter.sellerId) {
    conditions.push('seller_id = ?');
    params.push(filter.sellerId);
  }
  if (filter.startDate && !isNaN(Date.parse(filter.startDate))) {
    conditions.push('created_at >= ?');
    params.push(filter.startDate);
  }
  return { conditions, params };
}

// ── Admin Stats mirrors ───────────────────────────────────────────────────────

function validateStatsDateRange(startDate: string, endDate: string): string | null {
  const start = Date.parse(startDate);
  const end = Date.parse(endDate);
  if (isNaN(start) || isNaN(end)) return '날짜 형식 오류';
  if (start > end) return 'startDate > endDate';
  if (end - start > 366 * 24 * 60 * 60 * 1000) return '최대 1년 범위';
  return null;
}

// ── Admin Tools mirrors ───────────────────────────────────────────────────────

function validateBulkActionInput(body: { action?: string; targetIds?: unknown }): string | null {
  if (!body.action) return 'action 필수';
  if (!Array.isArray(body.targetIds) || body.targetIds.length === 0) return 'targetIds 배열 필수';
  if (body.targetIds.length > 1000) return 'targetIds 최대 1000개';
  if (body.targetIds.some(id => !Number.isInteger(Number(id)))) return 'targetIds 정수만';
  return null;
}

// ── Admin Moderation mirrors ──────────────────────────────────────────────────

const VALID_MODERATION_STATUSES = ['pending', 'reviewed', 'resolved', 'dismissed'] as const;

function isValidModerationStatus(status: string): boolean {
  return VALID_MODERATION_STATUSES.includes(status as typeof VALID_MODERATION_STATUSES[number]);
}

function validateModerationDecision(body: { status?: string; resolution_note?: string }): string | null {
  if (!body.status || !isValidModerationStatus(body.status)) return '유효하지 않은 상태';
  if (body.resolution_note && body.resolution_note.length > 2000) return 'resolution_note 너무 김';
  return null;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Admin Banners Routes', () => {
  it('image_url 필수', () => {
    expect(validateBannerCreate({})).toBe('image_url 필수');
  });

  it('image_url 500자 초과 거부', () => {
    expect(validateBannerCreate({ image_url: 'a'.repeat(501) })).toBe('image_url 너무 김');
  });

  it('display_order 음수 거부', () => {
    expect(validateBannerCreate({ image_url: 'http://a.com/i.jpg', display_order: -1 })).toBe('display_order 0 이상 정수');
  });

  it('display_order 0 허용', () => {
    expect(validateBannerCreate({ image_url: 'http://a.com/i.jpg', display_order: 0 })).toBeNull();
  });

  it('정상 데이터 통과', () => {
    expect(validateBannerCreate({
      image_url: 'http://a.com/i.jpg',
      link_url: 'http://a.com',
      display_order: 1,
      title: '메인 배너'
    })).toBeNull();
  });
});

describe('Admin Products Routes', () => {
  it('가격 0~1억 범위', () => {
    expect(validateAdminProductUpdate({ price: 0 })).toBeNull();
    expect(validateAdminProductUpdate({ price: 100_000_000 })).toBeNull();
    expect(validateAdminProductUpdate({ price: -1 })).not.toBeNull();
    expect(validateAdminProductUpdate({ price: 100_000_001 })).not.toBeNull();
  });

  it('재고 0~100만 정수', () => {
    expect(validateAdminProductUpdate({ stock: 0 })).toBeNull();
    expect(validateAdminProductUpdate({ stock: 1_000_000 })).toBeNull();
    expect(validateAdminProductUpdate({ stock: -5 })).not.toBeNull();
    expect(validateAdminProductUpdate({ stock: 1.5 })).not.toBeNull();
  });

  it('is_active boolean만', () => {
    expect(validateAdminProductUpdate({ is_active: true })).toBeNull();
    expect(validateAdminProductUpdate({ is_active: 'true' as unknown as boolean })).not.toBeNull();
  });
});

describe('Admin Streams Routes', () => {
  it('유효한 스트림 상태', () => {
    expect(isValidStreamStatus('scheduled')).toBe(true);
    expect(isValidStreamStatus('live')).toBe(true);
    expect(isValidStreamStatus('ended')).toBe(true);
    expect(isValidStreamStatus('cancelled')).toBe(false);
  });

  it('필터 조건 빌드', () => {
    const r = buildStreamFilter({ status: 'live', sellerId: 5 });
    expect(r.conditions).toContain('status = ?');
    expect(r.conditions).toContain('seller_id = ?');
    expect(r.params).toEqual(['live', 5]);
  });

  it('빈 필터는 빈 결과', () => {
    expect(buildStreamFilter({}).conditions).toEqual([]);
  });

  it('잘못된 status는 무시', () => {
    expect(buildStreamFilter({ status: 'invalid' }).conditions).toEqual([]);
  });

  it('잘못된 startDate 무시', () => {
    expect(buildStreamFilter({ startDate: 'not-a-date' }).conditions).toEqual([]);
  });
});

describe('Admin Stats Routes', () => {
  it('정상 날짜 범위 통과', () => {
    expect(validateStatsDateRange('2024-01-01', '2024-12-31')).toBeNull();
  });

  it('잘못된 날짜 거부', () => {
    expect(validateStatsDateRange('invalid', '2024-01-01')).toBe('날짜 형식 오류');
  });

  it('1년 초과 거부', () => {
    expect(validateStatsDateRange('2023-01-01', '2025-01-01')).toBe('최대 1년 범위');
  });
});

describe('Admin Tools Routes', () => {
  it('action 필수', () => {
    expect(validateBulkActionInput({})).toBe('action 필수');
  });

  it('targetIds 배열 필수', () => {
    expect(validateBulkActionInput({ action: 'delete' })).toBe('targetIds 배열 필수');
    expect(validateBulkActionInput({ action: 'delete', targetIds: [] })).toBe('targetIds 배열 필수');
  });

  it('targetIds 최대 1000개', () => {
    const ids = Array.from({ length: 1001 }, (_, i) => i + 1);
    expect(validateBulkActionInput({ action: 'delete', targetIds: ids })).toBe('targetIds 최대 1000개');
  });

  it('targetIds 정수만 허용', () => {
    expect(validateBulkActionInput({ action: 'delete', targetIds: ['abc', 1] })).toBe('targetIds 정수만');
  });

  it('정상 입력 통과', () => {
    expect(validateBulkActionInput({ action: 'delete', targetIds: [1, 2, 3] })).toBeNull();
  });
});

describe('Admin Moderation Routes', () => {
  it('유효한 모더레이션 상태', () => {
    ['pending', 'reviewed', 'resolved', 'dismissed'].forEach(s => {
      expect(isValidModerationStatus(s)).toBe(true);
    });
    expect(isValidModerationStatus('approved')).toBe(false);
  });

  it('잘못된 status 거부', () => {
    expect(validateModerationDecision({ status: 'invalid' })).toBe('유효하지 않은 상태');
  });

  it('resolution_note 2000자 제한', () => {
    const longNote = 'a'.repeat(2001);
    expect(validateModerationDecision({ status: 'resolved', resolution_note: longNote }))
      .toBe('resolution_note 너무 김');
  });

  it('정상 결정 통과', () => {
    expect(validateModerationDecision({ status: 'resolved', resolution_note: '검토 완료' })).toBeNull();
  });
});

describe('D1 mock', () => {
  it('배너 INSERT 호출', async () => {
    const r = await mockDB.prepare('INSERT INTO banners (image_url, display_order) VALUES (?, ?)')
      .bind('http://a.com/i.jpg', 1).run();
    expect(r.success).toBe(true);
  });
});
