import { describe, it, expect } from 'vitest';
import {
  normalizeAdminRole,
  isSuperOnlyAdminPath,
  canAdminRoleMutate,
  adminPathSegment,
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
