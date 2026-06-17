import { describe, it, expect } from 'vitest';
import {
  normalizeAdminRole,
  isSuperOnlyAdminPath,
  isSelfServiceAdminPath,
  canAdminRoleMutate,
  adminPathSegment,
  isScopedAdminRole,
  scopedRoleCanAccess,
} from '@/shared/admin-roles';

describe('admin-roles RBAC SSOT', () => {
  it('normalizeAdminRole: super_admin/super → super, 미상 → super(역호환)', () => {
    expect(normalizeAdminRole('super_admin')).toBe('super');
    expect(normalizeAdminRole('super')).toBe('super');
    expect(normalizeAdminRole('VIEWER')).toBe('viewer');
    expect(normalizeAdminRole('finance')).toBe('finance');
    expect(normalizeAdminRole(null)).toBe('super');      // 레거시 계정 보호
    expect(normalizeAdminRole('zzz')).toBe('super');
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

describe('wholesale 도메인-한정 역할 (외부 도매 파트너 — 읽기·쓰기 모두 도매만)', () => {
  it('normalize + scoped 플래그', () => {
    expect(normalizeAdminRole('wholesale')).toBe('wholesale');
    expect(isScopedAdminRole('wholesale')).toBe(true);
    expect(isScopedAdminRole('finance')).toBe(false); // finance 는 읽기 개방형(한정 아님)
    expect(isScopedAdminRole('super')).toBe(false);
  });

  it('도매 도메인은 읽기·쓰기 모두 허용', () => {
    for (const p of [
      '/api/admin/wholesale-deposits/1/confirm',
      '/api/admin/wholesale-withdrawals/2/approve',
      '/api/admin/wholesale-orders/3',
      '/api/admin/wholesale/tax/purchase-invoices/issue',
      '/api/admin/wholesale/integrity',
      '/api/admin/distributor/supply-bulk-import',
      '/api/admin/distributor/grades',
      '/api/admin/suppliers/9/approve',
      '/api/admin/partnership-inquiries/4',
    ]) {
      expect(scopedRoleCanAccess('wholesale', p)).toBe(true); // 읽기
      expect(canAdminRoleMutate('wholesale', p)).toBe(true);  // 쓰기
    }
  });

  it('도매 밖 영역은 읽기·쓰기 모두 차단 (유어딜 소비자 데이터 격리)', () => {
    for (const p of [
      '/api/admin/users/1',
      '/api/admin/orders/1/cancel',
      '/api/admin/settlements/approve',
      '/api/admin-payouts/run',
      '/api/admin/products/1',
      '/api/admin/group-buy/1',
    ]) {
      expect(scopedRoleCanAccess('wholesale', p)).toBe(false); // 읽기 차단
      expect(canAdminRoleMutate('wholesale', p)).toBe(false);  // 쓰기 차단
    }
  });

  it('슈퍼 전용(계정/감사)은 도매 역할도 당연히 차단', () => {
    expect(isSuperOnlyAdminPath('/api/admin/admins')).toBe(true);
    expect(isSuperOnlyAdminPath('/api/admin/audit-logs')).toBe(true);
    // (미들웨어가 isSuperOnlyAdminPath 를 scoped 검사보다 먼저 처리)
  });
});
