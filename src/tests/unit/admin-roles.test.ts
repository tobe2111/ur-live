import { describe, it, expect } from 'vitest';
import {
  normalizeAdminRole,
  isSuperOnlyAdminPath,
  isSelfServiceAdminPath,
  canAdminRoleMutate,
  adminPathSegment,
  isRetiredAdminRole,
  ADMIN_ROLES,
  ADMIN_ROLE_LABEL,
} from '@/shared/admin-roles';

describe('admin-roles RBAC SSOT', () => {
  it('normalizeAdminRole: super_admin/super → super, 빈값 → super(레거시), 미지 → viewer(fail-closed)', () => {
    expect(normalizeAdminRole('super_admin')).toBe('super');
    expect(normalizeAdminRole('super')).toBe('super');
    expect(normalizeAdminRole('VIEWER')).toBe('viewer');
    expect(normalizeAdminRole('finance')).toBe('finance');
    expect(normalizeAdminRole(null)).toBe('super');      // 레거시 계정 보호
    // 🔐 2026-07-12 RBAC 감사 G: 미지/오타 non-empty role 은 최소권한 viewer (fail-closed) — 손상·미지 문자열의 전권 획득 차단.
    expect(normalizeAdminRole('zzz')).toBe('viewer');
  });

  it('adminPathSegment: /api/admin/<seg> 및 하이픈 변형', () => {
    expect(adminPathSegment('/api/admin/orders/123/refund')).toBe('orders');
    expect(adminPathSegment('/api/admin/settlements')).toBe('settlements');
    expect(adminPathSegment('/api/admin-payouts/approve')).toBe('payouts');
    expect(adminPathSegment('/api/admin/distributor/auto-grade/settings')).toBe('distributor');
  });

  it('isSuperOnlyAdminPath: 계정/감사만 슈퍼 전용 (2FA 는 본인 self-service 라 제외)', () => {
    expect(isSuperOnlyAdminPath('/api/admin/admins')).toBe(true);
    expect(isSuperOnlyAdminPath('/api/admin/audit-logs?page=1')).toBe(true);
    expect(isSuperOnlyAdminPath('/api/admin/2fa/setup')).toBe(false);
    expect(isSuperOnlyAdminPath('/api/admin/orders')).toBe(false);
  });

  it('isSelfServiceAdminPath: 본인 보안(로그인 PIN/2FA)은 역할 무관 허용 — 강제 게이트 데드락 방지', () => {
    // 강제 PIN 설정/2FA 는 도매(scoped) 역할이라도 본인 계정엔 가능해야 함.
    expect(isSelfServiceAdminPath('/api/admin/set-login-pin')).toBe(true);
    expect(isSelfServiceAdminPath('/api/admin/2fa/setup')).toBe(true);
    expect(isSelfServiceAdminPath('/api/admin/2fa/verify')).toBe(true);
    // 그 외 경로는 self-service 아님(일반 RBAC 적용).
    expect(isSelfServiceAdminPath('/api/admin/orders')).toBe(false);
    expect(isSelfServiceAdminPath('/api/admin/admins')).toBe(false);
  });

  it('viewer: 어떤 경로도 변경 불가', () => {
    expect(canAdminRoleMutate('viewer', '/api/admin/orders/1')).toBe(false);
    expect(canAdminRoleMutate('viewer', '/api/admin/settlements/approve')).toBe(false);
  });

  it('super/admin: 전권(변경 허용)', () => {
    expect(canAdminRoleMutate('super', '/api/admin/settlements/approve')).toBe(true);
    expect(canAdminRoleMutate('admin', '/api/admin/orders/1')).toBe(true);
    expect(canAdminRoleMutate('admin', '/api/admin/distributor/auto-grade/settings')).toBe(true);
  });

  it('finance: 정산/수수료 도메인만 변경 — 주문/상품은 불가', () => {
    expect(canAdminRoleMutate('finance', '/api/admin/settlements/approve')).toBe(true);
    expect(canAdminRoleMutate('finance', '/api/admin/distributor/auto-grade/settings')).toBe(true);
    expect(canAdminRoleMutate('finance', '/api/admin-payouts/run')).toBe(true);
    expect(canAdminRoleMutate('finance', '/api/admin/orders/1/cancel')).toBe(false);
    expect(canAdminRoleMutate('finance', '/api/admin/products/1')).toBe(false);
    // 도매 공급상품 일괄 등록/현황 = distributor 세그먼트 → finance(+admin/super) 영역.
    // (distributor-admin 에 정산/등급/예치금이 함께 있어 ops 노출은 위험 → 의도적으로 finance 게이트)
    expect(canAdminRoleMutate('finance', '/api/admin/distributor/supply-bulk-import')).toBe(true);
    expect(canAdminRoleMutate('ops', '/api/admin/distributor/supply-bulk-import')).toBe(false);
    expect(canAdminRoleMutate('viewer', '/api/admin/distributor/supply-bulk-import')).toBe(false);
  });

  it('ops: 주문/상품 도메인만 — 정산은 불가', () => {
    expect(canAdminRoleMutate('ops', '/api/admin/orders/1/ship')).toBe(true);
    expect(canAdminRoleMutate('ops', '/api/admin/products/1')).toBe(true);
    expect(canAdminRoleMutate('ops', '/api/admin/settlements/approve')).toBe(false);
  });

  it('cs: 반품/문의/리뷰 도메인 — 정산/상품 변경 불가', () => {
    expect(canAdminRoleMutate('cs', '/api/admin/moderation/1')).toBe(true);
    expect(canAdminRoleMutate('cs', '/api/admin/orders/1')).toBe(true); // 조회·반품 처리
    expect(canAdminRoleMutate('cs', '/api/admin/settlements/approve')).toBe(false);
    expect(canAdminRoleMutate('cs', '/api/admin/products/1')).toBe(false);
  });
});

/**
 * 🪦 2026-11-17 도매 파트너(wholesale) 역할 폐지 — 대표 *"응 지워줘"*.
 * 라이브 계정 4개는 전부 소프트 삭제(is_active=0)라 로그인 자체가 안 된다. 그래도 그 값을 가진
 * 토큰·행이 남으면 normalize 가 viewer 로 내린다 → viewer 는 소비자 데이터를 **읽는다**.
 * 즉 역할을 그냥 지우면 *아무것도 못 보던* 계정이 넓어진다. 그 방향을 이 시험이 막는다.
 */
describe('폐지된 역할 wholesale — viewer 로 새지 않고 전면 차단', () => {
  const SECRET = 'test-secret-retired-role'
  const now = () => Math.floor(Date.now() / 1000)
  async function call(role: string, method: string, path: string) {
    const jwt = await import('@tsndr/cloudflare-worker-jwt')
    const { Hono } = await import('hono')
    const { adminRbacMiddleware } = await import('@/worker/middleware/admin-rbac')
    const tok = await jwt.sign({ sub: '20', type: 'admin', role, iat: now(), exp: now() + 600 }, SECRET)
    const app = new Hono<{ Bindings: { JWT_SECRET: string } }>()
    app.use('/api/admin/*', adminRbacMiddleware())
    app.on(['GET', 'POST'], '/api/admin/*', (c) => c.text('HIT'))
    const r = await app.request(path, { method, headers: { Authorization: `Bearer ${tok}` } }, { JWT_SECRET: SECRET })
    return r.status
  }

  it('역할 목록·라벨에서 빠졌고, 폐지 판정은 원시값으로 한다', () => {
    expect(ADMIN_ROLES as readonly string[]).not.toContain('wholesale')
    expect(Object.keys(ADMIN_ROLE_LABEL)).not.toContain('wholesale')
    expect(isRetiredAdminRole('wholesale')).toBe(true)
    expect(isRetiredAdminRole(' WHOLESALE ')).toBe(true)
    for (const r of ['super_admin', 'admin', 'ops', 'cs', 'finance', 'viewer', '', null]) expect(isRetiredAdminRole(r)).toBe(false)
  })

  it('읽기(GET)·본인 보안 설정까지 전부 403 — viewer 였다면 GET 은 통과했다', async () => {
    expect(await call('wholesale', 'GET', '/api/admin/users')).toBe(403)
    expect(await call('wholesale', 'GET', '/api/admin/orders')).toBe(403)
    expect(await call('wholesale', 'POST', '/api/admin/set-login-pin')).toBe(403)
    expect(await call('wholesale', 'GET', '/api/admin/wholesale-orders')).toBe(403)
  })

  it('반대 방향: 다른 역할은 그대로다(viewer 는 읽기 통과)', async () => {
    expect(await call('viewer', 'GET', '/api/admin/users')).toBe(200)
    expect(await call('super_admin', 'GET', '/api/admin/admins')).toBe(200)
  })
});
