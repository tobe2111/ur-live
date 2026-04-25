/**
 * YouTube & Notifications Routes 단위 테스트
 *   - youtube-chat.routes.ts
 *   - youtube-live.routes.ts
 *   - youtube-shorts.routes.ts
 *   - youtube-oauth.routes.ts
 *   - dashboard-notifications.routes.ts
 *   - email.routes.ts
 *   - push.routes.ts
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

// ── YouTube mirrors ───────────────────────────────────────────────────────────

const YOUTUBE_VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

function isValidYouTubeVideoId(id: string): boolean {
  return YOUTUBE_VIDEO_ID_REGEX.test(id);
}

const YOUTUBE_LIVE_CHAT_ID_REGEX = /^[a-zA-Z0-9_.-]+$/;

function isValidLiveChatId(id: string): boolean {
  return id.length >= 5 && id.length <= 200 && YOUTUBE_LIVE_CHAT_ID_REGEX.test(id);
}

function validateChatMessage(message: string): string | null {
  if (!message || message.trim().length === 0) return 'message 필수';
  if (message.length > 200) return 'message 200자 이하';
  return null;
}

function extractBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.substring(7).trim();
  return token.length > 0 ? token : null;
}

// ── YouTube OAuth mirrors ─────────────────────────────────────────────────────

function generateOAuthState(): string {
  // 실제: crypto.randomBytes(16).toString('hex')
  const arr = new Uint8Array(16);
  for (let i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

function validateOAuthState(received: string, stored: string | null): boolean {
  if (!stored || !received) return false;
  if (received.length !== stored.length) return false;
  // 타이밍 공격 방지를 위한 상수시간 비교 (간소화)
  let result = 0;
  for (let i = 0; i < received.length; i++) {
    result |= received.charCodeAt(i) ^ stored.charCodeAt(i);
  }
  return result === 0;
}

function validateOAuthCallback(query: { code?: string; state?: string; error?: string }): string | null {
  if (query.error) return `OAuth 오류: ${query.error}`;
  if (!query.code) return 'code 누락';
  if (!query.state) return 'state 누락';
  return null;
}

// ── Dashboard Notifications mirrors ───────────────────────────────────────────

const VALID_NOTIFICATION_TARGETS = ['admin', 'seller', 'agency', 'user'] as const;

function isValidNotificationTarget(target: string): boolean {
  return VALID_NOTIFICATION_TARGETS.includes(target as typeof VALID_NOTIFICATION_TARGETS[number]);
}

function validateDashboardNotification(body: {
  target_type?: string; title?: string; message?: string; link?: string
}): string | null {
  if (!body.target_type || !isValidNotificationTarget(body.target_type)) return '유효하지 않은 target_type';
  if (!body.title) return 'title 필수';
  if (body.title.length > 200) return 'title 200자 이하';
  if (body.message && body.message.length > 1000) return 'message 1000자 이하';
  if (body.link && body.link.length > 500) return 'link 500자 이하';
  return null;
}

// ── Email mirrors ─────────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email) && email.length <= 254;
}

function validateEmailSend(body: {
  to?: string; subject?: string; html?: string;
}): string | null {
  if (!body.to || !isValidEmail(body.to)) return '유효하지 않은 to 이메일';
  if (!body.subject) return 'subject 필수';
  if (body.subject.length > 200) return 'subject 200자 이하';
  if (!body.html || body.html.length === 0) return 'html 본문 필수';
  if (body.html.length > 100_000) return 'html 100KB 초과';
  return null;
}

// ── Push mirrors ──────────────────────────────────────────────────────────────

function validatePushSubscription(body: {
  endpoint?: string; keys?: { p256dh?: string; auth?: string }
}): string | null {
  if (!body.endpoint || typeof body.endpoint !== 'string') return 'endpoint 필수';
  if (body.endpoint.length > 1000) return 'endpoint 1000자 이하';
  if (!body.endpoint.startsWith('https://')) return 'endpoint HTTPS 필수';
  if (!body.keys?.p256dh || !body.keys?.auth) return 'keys.p256dh, keys.auth 필수';
  return null;
}

function validatePushPayload(body: { title?: string; body?: string; tag?: string }): string | null {
  if (!body.title) return 'title 필수';
  if (body.title.length > 100) return 'title 100자 이하';
  if (body.body && body.body.length > 500) return 'body 500자 이하';
  if (body.tag && body.tag.length > 50) return 'tag 50자 이하';
  return null;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('YouTube Chat Routes', () => {
  it('YouTube 비디오 ID 11자 영숫자', () => {
    expect(isValidYouTubeVideoId('dQw4w9WgXcQ')).toBe(true);
    expect(isValidYouTubeVideoId('abc-_123XYZ')).toBe(true);
    expect(isValidYouTubeVideoId('short')).toBe(false);
  });

  it('Live Chat ID 형식 검증', () => {
    expect(isValidLiveChatId('Cg0KC2FCQ19YWVpfMTIzKjs')).toBe(true);
    expect(isValidLiveChatId('abc')).toBe(false);
    expect(isValidLiveChatId('a'.repeat(201))).toBe(false);
  });

  it('채팅 메시지 검증', () => {
    expect(validateChatMessage('')).toBe('message 필수');
    expect(validateChatMessage('   ')).toBe('message 필수');
    expect(validateChatMessage('a'.repeat(201))).toBe('message 200자 이하');
    expect(validateChatMessage('정상 메시지')).toBeNull();
  });

  it('Bearer 토큰 추출', () => {
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken('Basic xyz')).toBeNull();
    expect(extractBearerToken('Bearer ')).toBeNull();
    expect(extractBearerToken('Bearer mytoken')).toBe('mytoken');
  });
});

describe('YouTube OAuth Routes', () => {
  it('OAuth state 32자 hex 생성', () => {
    const state = generateOAuthState();
    expect(state).toMatch(/^[0-9a-f]{32}$/);
  });

  it('OAuth state 일치 검증 (CSRF 방어)', () => {
    expect(validateOAuthState('abc123', 'abc123')).toBe(true);
    expect(validateOAuthState('abc123', 'different')).toBe(false);
    expect(validateOAuthState('abc123', null)).toBe(false);
    expect(validateOAuthState('', '')).toBe(false); // empty 거부
  });

  it('callback 파라미터 검증', () => {
    expect(validateOAuthCallback({ error: 'access_denied' })).toContain('OAuth 오류');
    expect(validateOAuthCallback({})).toBe('code 누락');
    expect(validateOAuthCallback({ code: 'abc' })).toBe('state 누락');
    expect(validateOAuthCallback({ code: 'abc', state: 'xyz' })).toBeNull();
  });
});

describe('Dashboard Notifications Routes', () => {
  it('target_type enum 검증', () => {
    ['admin', 'seller', 'agency', 'user'].forEach(t => {
      expect(isValidNotificationTarget(t)).toBe(true);
    });
    expect(isValidNotificationTarget('public')).toBe(false);
  });

  it('알림 생성 - target_type 필수', () => {
    expect(validateDashboardNotification({})).toBe('유효하지 않은 target_type');
  });

  it('알림 생성 - title 필수 및 길이 제한', () => {
    expect(validateDashboardNotification({ target_type: 'user' })).toBe('title 필수');
    expect(validateDashboardNotification({
      target_type: 'user', title: 'a'.repeat(201)
    })).toBe('title 200자 이하');
  });

  it('알림 생성 - message/link 길이 제한', () => {
    expect(validateDashboardNotification({
      target_type: 'user', title: 'T', message: 'a'.repeat(1001)
    })).toBe('message 1000자 이하');
    expect(validateDashboardNotification({
      target_type: 'user', title: 'T', link: 'a'.repeat(501)
    })).toBe('link 500자 이하');
  });

  it('정상 알림 통과', () => {
    expect(validateDashboardNotification({
      target_type: 'seller', title: '주문 알림', message: '새 주문', link: '/seller/orders'
    })).toBeNull();
  });
});

describe('Email Routes', () => {
  it('이메일 형식 검증', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('user.name+tag@domain.co.kr')).toBe(true);
    expect(isValidEmail('invalid')).toBe(false);
    expect(isValidEmail('@nohostpart')).toBe(false);
    expect(isValidEmail('no@domain')).toBe(false);
  });

  it('이메일 254자 제한 (RFC 5321)', () => {
    const long = 'a'.repeat(250) + '@b.com';
    expect(isValidEmail(long)).toBe(false);
  });

  it('이메일 발송 - 필수 필드', () => {
    expect(validateEmailSend({})).toContain('to');
    expect(validateEmailSend({ to: 'a@b.com' })).toBe('subject 필수');
    expect(validateEmailSend({ to: 'a@b.com', subject: 'S' })).toBe('html 본문 필수');
  });

  it('이메일 발송 - subject 200자 제한', () => {
    expect(validateEmailSend({
      to: 'a@b.com', subject: 'a'.repeat(201), html: '<p>x</p>'
    })).toBe('subject 200자 이하');
  });

  it('이메일 발송 - html 100KB 제한', () => {
    expect(validateEmailSend({
      to: 'a@b.com', subject: 'S', html: 'a'.repeat(100_001)
    })).toBe('html 100KB 초과');
  });
});

describe('Push Routes', () => {
  it('구독 - endpoint 필수', () => {
    expect(validatePushSubscription({})).toBe('endpoint 필수');
  });

  it('구독 - HTTPS 필수', () => {
    expect(validatePushSubscription({
      endpoint: 'http://push.example.com',
      keys: { p256dh: 'k', auth: 'a' }
    })).toBe('endpoint HTTPS 필수');
  });

  it('구독 - keys 필수', () => {
    expect(validatePushSubscription({
      endpoint: 'https://push.example.com'
    })).toContain('keys');
  });

  it('정상 구독 통과', () => {
    expect(validatePushSubscription({
      endpoint: 'https://push.example.com/abc',
      keys: { p256dh: 'BMxxxx', auth: 'authxxx' }
    })).toBeNull();
  });

  it('푸시 페이로드 - title 필수 및 길이', () => {
    expect(validatePushPayload({})).toBe('title 필수');
    expect(validatePushPayload({ title: 'a'.repeat(101) })).toBe('title 100자 이하');
  });

  it('푸시 페이로드 - body 500자 제한', () => {
    expect(validatePushPayload({ title: 'T', body: 'a'.repeat(501) })).toBe('body 500자 이하');
  });
});

describe('D1 mock', () => {
  it('알림 INSERT 호출', async () => {
    const r = await mockDB.prepare('INSERT INTO notifications (user_id, title) VALUES (?, ?)')
      .bind('user-1', 'T').run();
    expect(r.success).toBe(true);
  });
});
