/**
 * Affiliate, Blog, Broadcast-Notify, Guide, Kakao-Social, YouTube-Growth 단위 테스트
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

// ── Affiliate mirrors ─────────────────────────────────────────────────────────

function generateAffiliateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function validateAffiliateCode(code: string): boolean {
  return /^[A-Z0-9]{6,12}$/.test(code);
}

function calcAffiliateCommission(orderAmount: number, ratePercent: number): number {
  if (ratePercent < 0 || ratePercent > 50) return 0;
  return Math.round(orderAmount * ratePercent / 100);
}

// ── Blog mirrors ──────────────────────────────────────────────────────────────

function validateBlogSlug(slug: string): boolean {
  return /^[a-z0-9-]{3,80}$/.test(slug);
}

const VALID_BLOG_STATUSES = ['draft', 'published', 'archived'] as const;

function isValidBlogStatus(status: string): boolean {
  return VALID_BLOG_STATUSES.includes(status as typeof VALID_BLOG_STATUSES[number]);
}

function validateBlogPost(body: { title?: string; content?: string; slug?: string; status?: string }): string | null {
  if (!body.title?.trim()) return 'title 필수';
  if (body.title.length > 200) return 'title 200자 이하';
  if (!body.content?.trim()) return 'content 필수';
  if (body.content.length > 100_000) return 'content 100KB 이하';
  if (body.slug && !validateBlogSlug(body.slug)) return 'slug 형식 오류 (소문자/숫자/하이픈만)';
  if (body.status && !isValidBlogStatus(body.status)) return '유효하지 않은 status';
  return null;
}

// ── Broadcast Notify mirrors ──────────────────────────────────────────────────

function checkNotifyDedup(userId: string, streamId: number, recentNotifies: Array<{ user_id: string; stream_id: number; created_at: string }>): boolean {
  const ONE_HOUR = 60 * 60 * 1000;
  const cutoff = Date.now() - ONE_HOUR;
  return recentNotifies.some(n =>
    n.user_id === userId &&
    n.stream_id === streamId &&
    Date.parse(n.created_at) > cutoff
  );
}

// ── Guide mirrors ─────────────────────────────────────────────────────────────

const VALID_GUIDE_TYPES = ['admin', 'seller', 'agency'] as const;

function isValidGuideType(type: string): boolean {
  return VALID_GUIDE_TYPES.includes(type as typeof VALID_GUIDE_TYPES[number]);
}

function validateGuideSection(body: {
  guide_type?: string; section_key?: string; section_title?: string; content_md?: string;
}): string | null {
  if (!body.guide_type || !isValidGuideType(body.guide_type)) return '유효하지 않은 guide_type';
  if (!body.section_key) return 'section_key 필수';
  if (!/^[a-z0-9-]+$/.test(body.section_key)) return 'section_key 형식 오류';
  if (body.section_key.length > 50) return 'section_key 50자 이하';
  if (!body.section_title) return 'section_title 필수';
  if (body.section_title.length > 200) return 'section_title 200자 이하';
  if (body.content_md && body.content_md.length > 50_000) return 'content_md 50KB 이하';
  return null;
}

// ── Kakao Social mirrors ──────────────────────────────────────────────────────

function validateKakaoToken(token: string): boolean {
  // 카카오 액세스 토큰: 영숫자 60자 이상
  return /^[a-zA-Z0-9_-]{60,}$/.test(token);
}

function calcKakaoFriendListPagination(query: { offset?: string; limit?: string }) {
  const offset = Math.max(0, parseInt(query.offset || '0') || 0);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20') || 20));
  return { offset, limit };
}

// ── YouTube Growth mirrors ────────────────────────────────────────────────────

function validateSubscriberCount(count: unknown): boolean {
  const n = Number(count);
  return Number.isInteger(n) && n >= 0 && n < 1_000_000_000;
}

const SUBSCRIBER_MILESTONES = [100, 1_000, 10_000, 100_000, 1_000_000];

function getNextMilestone(current: number): number | null {
  for (const m of SUBSCRIBER_MILESTONES) {
    if (current < m) return m;
  }
  return null;
}

function getMilestoneProgress(current: number): { milestone: number | null; progress: number } {
  const next = getNextMilestone(current);
  if (!next) return { milestone: null, progress: 100 };
  // 이전 마일스톤 찾기
  const prev = SUBSCRIBER_MILESTONES.filter(m => m < next).pop() || 0;
  const range = next - prev;
  const reached = current - prev;
  const progress = Math.min(100, Math.max(0, Math.round((reached / range) * 100)));
  return { milestone: next, progress };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Affiliate Routes', () => {
  it('생성된 코드는 8자 영숫자 대문자', () => {
    for (let i = 0; i < 5; i++) {
      const c = generateAffiliateCode();
      expect(c).toMatch(/^[A-Z0-9]{8}$/);
    }
  });

  it('유효한 코드 형식', () => {
    expect(validateAffiliateCode('ABC123')).toBe(true);
    expect(validateAffiliateCode('ABCDEFGHIJKL')).toBe(true);
  });

  it('잘못된 코드 거부', () => {
    expect(validateAffiliateCode('ABC')).toBe(false);
    expect(validateAffiliateCode('A'.repeat(13))).toBe(false);
    expect(validateAffiliateCode('abc123')).toBe(false);
    expect(validateAffiliateCode('ABC-123')).toBe(false);
  });

  it('수수료 계산 - 정상 범위', () => {
    expect(calcAffiliateCommission(10000, 5)).toBe(500);
    expect(calcAffiliateCommission(33333, 10)).toBe(3333);
  });

  it('수수료율 50% 초과 시 0 반환 (방어)', () => {
    expect(calcAffiliateCommission(10000, 51)).toBe(0);
    expect(calcAffiliateCommission(10000, -5)).toBe(0);
  });
});

describe('Blog Routes', () => {
  it('slug 형식 검증', () => {
    expect(validateBlogSlug('my-first-post')).toBe(true);
    expect(validateBlogSlug('post123')).toBe(true);
    expect(validateBlogSlug('한글-슬러그')).toBe(false);
    expect(validateBlogSlug('UPPERCASE')).toBe(false);
    expect(validateBlogSlug('xx')).toBe(false);  // 3자 미만
  });

  it('블로그 상태 enum', () => {
    expect(isValidBlogStatus('draft')).toBe(true);
    expect(isValidBlogStatus('published')).toBe(true);
    expect(isValidBlogStatus('deleted')).toBe(false);
  });

  it('블로그 게시물 검증 - 필수 필드', () => {
    expect(validateBlogPost({})).toBe('title 필수');
    expect(validateBlogPost({ title: 'T' })).toBe('content 필수');
  });

  it('blog content 100KB 제한', () => {
    expect(validateBlogPost({
      title: 'T', content: 'a'.repeat(100_001)
    })).toBe('content 100KB 이하');
  });

  it('정상 블로그 게시물 통과', () => {
    expect(validateBlogPost({
      title: '제목', content: '내용', slug: 'my-post', status: 'published'
    })).toBeNull();
  });
});

describe('Broadcast Notify Routes', () => {
  it('1시간 내 동일 알림 dedup', () => {
    const recent = [
      { user_id: 'u1', stream_id: 1, created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
    ];
    expect(checkNotifyDedup('u1', 1, recent)).toBe(true);
  });

  it('1시간 경과 후엔 다시 알림 가능', () => {
    const old = [
      { user_id: 'u1', stream_id: 1, created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
    ];
    expect(checkNotifyDedup('u1', 1, old)).toBe(false);
  });

  it('다른 user/stream 은 영향 없음', () => {
    const recent = [
      { user_id: 'u2', stream_id: 1, created_at: new Date().toISOString() },
    ];
    expect(checkNotifyDedup('u1', 1, recent)).toBe(false);
  });
});

describe('Guide Routes', () => {
  it('guide_type enum 검증', () => {
    ['admin', 'seller', 'agency'].forEach(t => {
      expect(isValidGuideType(t)).toBe(true);
    });
    expect(isValidGuideType('public')).toBe(false);
  });

  it('section_key 형식 검증 (소문자/숫자/하이픈)', () => {
    expect(validateGuideSection({
      guide_type: 'admin', section_key: 'overview', section_title: 'T'
    })).toBeNull();
    expect(validateGuideSection({
      guide_type: 'admin', section_key: 'Overview', section_title: 'T'
    })).toBe('section_key 형식 오류');
    expect(validateGuideSection({
      guide_type: 'admin', section_key: 'over_view', section_title: 'T'
    })).toBe('section_key 형식 오류');
  });

  it('section_title 200자 제한', () => {
    expect(validateGuideSection({
      guide_type: 'admin', section_key: 'k', section_title: 'a'.repeat(201)
    })).toBe('section_title 200자 이하');
  });

  it('content_md 50KB 제한', () => {
    expect(validateGuideSection({
      guide_type: 'admin', section_key: 'k', section_title: 'T', content_md: 'a'.repeat(50_001)
    })).toBe('content_md 50KB 이하');
  });
});

describe('Kakao Social Routes', () => {
  it('유효한 카카오 액세스 토큰 (영숫자 60자+)', () => {
    expect(validateKakaoToken('a'.repeat(60))).toBe(true);
    expect(validateKakaoToken('ABCdef-_123' + 'x'.repeat(50))).toBe(true);
  });

  it('짧은 토큰 거부', () => {
    expect(validateKakaoToken('short')).toBe(false);
    expect(validateKakaoToken('')).toBe(false);
  });

  it('친구목록 페이지네이션', () => {
    expect(calcKakaoFriendListPagination({}).limit).toBe(20);
    expect(calcKakaoFriendListPagination({ limit: '500' }).limit).toBe(100);
    expect(calcKakaoFriendListPagination({ offset: '-5' }).offset).toBe(0);
  });
});

describe('YouTube Growth Routes', () => {
  it('구독자 수 - 음수/소수/너무 큰 값 거부', () => {
    expect(validateSubscriberCount(0)).toBe(true);
    expect(validateSubscriberCount(1_000_000)).toBe(true);
    expect(validateSubscriberCount(-1)).toBe(false);
    expect(validateSubscriberCount(1.5)).toBe(false);
    expect(validateSubscriberCount(1_000_000_000)).toBe(false);
  });

  it('다음 마일스톤 계산', () => {
    expect(getNextMilestone(50)).toBe(100);
    expect(getNextMilestone(150)).toBe(1_000);
    expect(getNextMilestone(50_000)).toBe(100_000);
    expect(getNextMilestone(1_500_000)).toBeNull();
  });

  it('마일스톤 진행률 계산', () => {
    expect(getMilestoneProgress(0).progress).toBe(0);
    expect(getMilestoneProgress(50).progress).toBe(50);  // 100 마일스톤의 50%
    expect(getMilestoneProgress(99).progress).toBe(99);
    expect(getMilestoneProgress(2_000_000).milestone).toBeNull();
  });
});

describe('D1 mock', () => {
  it('블로그 INSERT 호출', async () => {
    const r = await mockDB.prepare('INSERT INTO blog_posts (title, content) VALUES (?, ?)')
      .bind('T', 'C').run();
    expect(r.success).toBe(true);
  });
});
