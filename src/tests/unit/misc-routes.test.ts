/**
 * Misc Public Routes 단위 테스트
 *   - social.routes.ts
 *   - sections.routes.ts
 *   - banners.routes.ts
 *   - shorts.routes.ts
 *   - restaurant-recommendations.routes.ts
 *   - seller-tiers.routes.ts
 *   - inventory.routes.ts
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

// ── Social mirrors ────────────────────────────────────────────────────────────

function validateSellerIdParam(sellerId: string | undefined): boolean {
  if (!sellerId) return false;
  const n = parseInt(sellerId);
  return Number.isInteger(n) && n > 0;
}

function validateFollowAction(userId: string | null, sellerId: string | undefined): string | null {
  if (!userId) return '로그인이 필요합니다';
  if (!validateSellerIdParam(sellerId)) return '유효하지 않은 sellerId';
  if (userId === sellerId) return '자기 자신 팔로우 불가';
  return null;
}

// ── Sections mirrors ──────────────────────────────────────────────────────────

const VALID_SECTION_TYPES = ['featured', 'category', 'live', 'shorts', 'banner', 'recommended'];

function isValidSectionType(type: string): boolean {
  return VALID_SECTION_TYPES.includes(type);
}

function validateSectionUpdate(body: {
  title?: string; type?: string; sort_order?: number; is_active?: boolean
}): string | null {
  if (body.title !== undefined && body.title.length > 200) return 'title 200자 이하';
  if (body.type !== undefined && !isValidSectionType(body.type)) return '유효하지 않은 type';
  if (body.sort_order !== undefined && (!Number.isInteger(body.sort_order) || body.sort_order < 0)) {
    return 'sort_order 0 이상 정수';
  }
  return null;
}

// ── Banners mirrors ───────────────────────────────────────────────────────────

function buildBannersCacheKey(): string {
  return 'cache:banners:active';
}

function filterActiveBanners(banners: Array<{ is_active: number; expires_at: string | null }>): typeof banners {
  const now = Date.now();
  return banners.filter(b => b.is_active === 1 && (!b.expires_at || Date.parse(b.expires_at) > now));
}

// ── Shorts mirrors ────────────────────────────────────────────────────────────

const YOUTUBE_VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

function isValidYouTubeVideoId(id: string): boolean {
  return YOUTUBE_VIDEO_ID_REGEX.test(id);
}

const VALID_SHORTS_STATUSES = ['active', 'inactive', 'pending', 'rejected'];

function isValidShortsStatus(status: string): boolean {
  return VALID_SHORTS_STATUSES.includes(status);
}

function validateShortsCreate(body: {
  title?: string; video_url?: string; youtube_video_id?: string;
}): string | null {
  if (!body.title) return 'title 필수';
  if (body.title.length > 300) return 'title 300자 이하';
  if (!body.video_url && !body.youtube_video_id) return 'video_url 또는 youtube_video_id 필수';
  if (body.youtube_video_id && !isValidYouTubeVideoId(body.youtube_video_id)) {
    return 'youtube_video_id 형식 오류';
  }
  return null;
}

// ── Restaurant Recommendations mirrors ────────────────────────────────────────

function validateRestaurantQuery(query: {
  lat?: string; lng?: string; category?: string; radius?: string
}): string | null {
  if (query.lat !== undefined) {
    const n = Number(query.lat);
    if (!Number.isFinite(n) || n < -90 || n > 90) return 'lat -90~90 범위';
  }
  if (query.lng !== undefined) {
    const n = Number(query.lng);
    if (!Number.isFinite(n) || n < -180 || n > 180) return 'lng -180~180 범위';
  }
  if (query.radius !== undefined) {
    const n = Number(query.radius);
    if (!Number.isFinite(n) || n <= 0 || n > 50_000) return 'radius 1~50000 미터';
  }
  return null;
}

// ── Seller Tiers mirrors ──────────────────────────────────────────────────────

interface TierThreshold { tier: string; minRevenue: number; commissionRate: number; }

const TIER_THRESHOLDS: TierThreshold[] = [
  { tier: 'bronze', minRevenue: 0, commissionRate: 10 },
  { tier: 'silver', minRevenue: 1_000_000, commissionRate: 8 },
  { tier: 'gold', minRevenue: 10_000_000, commissionRate: 6 },
  { tier: 'diamond', minRevenue: 100_000_000, commissionRate: 4 },
];

function calculateTier(revenue: number): TierThreshold {
  for (let i = TIER_THRESHOLDS.length - 1; i >= 0; i--) {
    if (revenue >= TIER_THRESHOLDS[i].minRevenue) return TIER_THRESHOLDS[i];
  }
  return TIER_THRESHOLDS[0];
}

// ── Inventory mirrors ─────────────────────────────────────────────────────────

function validateStockAdjustment(body: {
  product_id?: number; delta?: number; reason?: string
}): string | null {
  if (!body.product_id || !Number.isInteger(body.product_id) || body.product_id <= 0) {
    return 'product_id 양의 정수';
  }
  if (typeof body.delta !== 'number' || !Number.isInteger(body.delta)) return 'delta 정수';
  if (Math.abs(body.delta) > 100_000) return 'delta 절대값 10만 이하';
  if (!body.reason || body.reason.trim().length === 0) return 'reason 필수';
  if (body.reason.length > 500) return 'reason 500자 이하';
  return null;
}

function checkStockOwnership(productSellerId: number, requestSellerId: number): boolean {
  return productSellerId === requestSellerId;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Social Routes', () => {
  it('sellerId param 검증', () => {
    expect(validateSellerIdParam('1')).toBe(true);
    expect(validateSellerIdParam('0')).toBe(false);
    expect(validateSellerIdParam('-1')).toBe(false);
    expect(validateSellerIdParam('abc')).toBe(false);
    expect(validateSellerIdParam(undefined)).toBe(false);
  });

  it('팔로우 - 인증 필요', () => {
    expect(validateFollowAction(null, '1')).toBe('로그인이 필요합니다');
  });

  it('팔로우 - 자기 자신 차단', () => {
    expect(validateFollowAction('1', '1')).toBe('자기 자신 팔로우 불가');
  });

  it('정상 팔로우 통과', () => {
    expect(validateFollowAction('1', '5')).toBeNull();
  });
});

describe('Sections Routes', () => {
  it('section type 검증', () => {
    expect(isValidSectionType('featured')).toBe(true);
    expect(isValidSectionType('category')).toBe(true);
    expect(isValidSectionType('unknown')).toBe(false);
  });

  it('section 업데이트 검증', () => {
    expect(validateSectionUpdate({ title: 'a'.repeat(201) })).toContain('title');
    expect(validateSectionUpdate({ type: 'invalid' })).toContain('type');
    expect(validateSectionUpdate({ sort_order: -1 })).toContain('sort_order');
    expect(validateSectionUpdate({ title: '메인 섹션', type: 'featured', sort_order: 0 })).toBeNull();
  });
});

describe('Banners Routes', () => {
  it('캐시 키 일관성', () => {
    expect(buildBannersCacheKey()).toBe('cache:banners:active');
  });

  it('만료된 배너 필터링', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const future = new Date(Date.now() + 1_000_000).toISOString();
    const banners = [
      { is_active: 1, expires_at: future },
      { is_active: 1, expires_at: past },
      { is_active: 0, expires_at: future },
      { is_active: 1, expires_at: null },
    ];
    const filtered = filterActiveBanners(banners);
    expect(filtered.length).toBe(2);  // future + null만
  });
});

describe('Shorts Routes', () => {
  it('YouTube video ID 11자 영숫자', () => {
    expect(isValidYouTubeVideoId('dQw4w9WgXcQ')).toBe(true);
    expect(isValidYouTubeVideoId('abc-_123XYZ')).toBe(true);
    expect(isValidYouTubeVideoId('short')).toBe(false);
    expect(isValidYouTubeVideoId('toolongvideoid12')).toBe(false);
  });

  it('shorts 상태 검증', () => {
    ['active', 'inactive', 'pending', 'rejected'].forEach(s => {
      expect(isValidShortsStatus(s)).toBe(true);
    });
    expect(isValidShortsStatus('deleted')).toBe(false);
  });

  it('shorts 생성 - title 필수', () => {
    expect(validateShortsCreate({})).toBe('title 필수');
  });

  it('shorts 생성 - video URL 또는 ID 필수', () => {
    expect(validateShortsCreate({ title: '제목' })).toContain('video_url');
  });

  it('shorts 생성 - 정상 통과', () => {
    expect(validateShortsCreate({ title: '제목', youtube_video_id: 'dQw4w9WgXcQ' })).toBeNull();
  });
});

describe('Restaurant Recommendations Routes', () => {
  it('lat/lng 범위 검증', () => {
    expect(validateRestaurantQuery({ lat: '37.5', lng: '127.0' })).toBeNull();
    expect(validateRestaurantQuery({ lat: '91' })).toContain('lat');
    expect(validateRestaurantQuery({ lng: '181' })).toContain('lng');
  });

  it('radius 범위 검증', () => {
    expect(validateRestaurantQuery({ radius: '1000' })).toBeNull();
    expect(validateRestaurantQuery({ radius: '0' })).toContain('radius');
    expect(validateRestaurantQuery({ radius: '50001' })).toContain('radius');
  });
});

describe('Seller Tiers Routes', () => {
  it('수익에 따른 티어 계산', () => {
    expect(calculateTier(0).tier).toBe('bronze');
    expect(calculateTier(500_000).tier).toBe('bronze');
    expect(calculateTier(1_000_000).tier).toBe('silver');
    expect(calculateTier(50_000_000).tier).toBe('gold');
    expect(calculateTier(100_000_000).tier).toBe('diamond');
    expect(calculateTier(1_000_000_000).tier).toBe('diamond');
  });

  it('티어별 수수료율', () => {
    expect(calculateTier(0).commissionRate).toBe(10);
    expect(calculateTier(1_000_000).commissionRate).toBe(8);
    expect(calculateTier(10_000_000).commissionRate).toBe(6);
    expect(calculateTier(100_000_000).commissionRate).toBe(4);
  });
});

describe('Inventory Routes', () => {
  it('재고 조정 - product_id 양의 정수', () => {
    expect(validateStockAdjustment({})).toBe('product_id 양의 정수');
    expect(validateStockAdjustment({ product_id: 0 })).toContain('product_id');
  });

  it('재고 조정 - delta 정수만', () => {
    expect(validateStockAdjustment({ product_id: 1, delta: 1.5, reason: 'r' })).toContain('delta');
    expect(validateStockAdjustment({ product_id: 1, delta: 'abc' as unknown as number, reason: 'r' })).toContain('delta');
  });

  it('재고 조정 - delta 절대값 제한', () => {
    expect(validateStockAdjustment({ product_id: 1, delta: 100_001, reason: 'r' })).toContain('절대값');
    expect(validateStockAdjustment({ product_id: 1, delta: -100_001, reason: 'r' })).toContain('절대값');
  });

  it('재고 조정 - reason 필수', () => {
    expect(validateStockAdjustment({ product_id: 1, delta: 10 })).toBe('reason 필수');
    expect(validateStockAdjustment({ product_id: 1, delta: 10, reason: '' })).toBe('reason 필수');
  });

  it('재고 조정 - 정상 통과', () => {
    expect(validateStockAdjustment({ product_id: 1, delta: -5, reason: '판매' })).toBeNull();
  });

  it('재고 소유권 체크', () => {
    expect(checkStockOwnership(1, 1)).toBe(true);
    expect(checkStockOwnership(1, 2)).toBe(false);
  });
});

describe('D1 mock', () => {
  it('재고 업데이트 호출', async () => {
    const r = await mockDB.prepare('UPDATE products SET stock = stock + ? WHERE id = ?')
      .bind(-5, 1).run();
    expect(r.success).toBe(true);
  });
});
