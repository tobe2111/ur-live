/**
 * 🛡️ 2026-06-16 어드민 역할 기반 접근제어(RBAC) — 단일 진실원천(SSOT).
 *
 * 백엔드(worker/middleware/admin-rbac.ts)와 프론트(AdminLayout 네비 게이트)가 같이 사용.
 * worker 는 `@/` alias 못 쓰므로 상대경로(../../shared/admin-roles)로 import.
 *
 * 역할(admins.role):
 *   - super(=super_admin): 전권.
 *   - admin: 운영 전권 — 단 계정관리(/admins)·감사로그(/audit-logs)·2FA 설정은 슈퍼 전용.
 *   - ops: 주문·상품·배송·셀러/제조사 운영.
 *   - cs: 주문 조회·반품/클레임·문의·리뷰.
 *   - finance: 정산·출금·세금·수수료/등급 설정.
 *   - viewer: 읽기 전용(모든 변경 차단).
 *
 * 정책: 읽기(GET/HEAD)는 슈퍼전용 경로를 제외하고 전 역할 허용. 변경은 역할별 도메인 제한.
 * ⚠️ ops/cs/finance/viewer 는 신규 역할(기존 계정 0) → 강제해도 기존 super/admin 워크플로 무영향.
 */

export type AdminRole = 'super' | 'admin' | 'ops' | 'cs' | 'finance' | 'viewer';

export const ADMIN_ROLES: AdminRole[] = ['super', 'admin', 'ops', 'cs', 'finance', 'viewer'];

/** admins.role 원시값 → 정규화. 미지/레거시는 super(전권) — 기존 계정 보호(역호환). */
export function normalizeAdminRole(raw: string | null | undefined): AdminRole {
  const r = String(raw || '').toLowerCase().trim();
  if (r === 'super_admin' || r === 'super') return 'super';
  if (r === 'admin' || r === 'ops' || r === 'cs' || r === 'finance' || r === 'viewer') return r as AdminRole;
  return 'super';
}

/** 슈퍼 전용 영역(읽기·쓰기 모두 차단) — 계정관리(/admins) / 감사로그(/audit-logs).
 *  ⚠️ /2fa 는 각 관리자 본인 2단계인증 self-service 라 제외(전 역할 허용). */
export function isSuperOnlyAdminPath(pathname: string): boolean {
  const seg = adminPathSegment(pathname);
  return seg === 'admins' || seg === 'audit-logs';
}

/** /api/admin/<seg>... 또는 /api/admin-<seg>... 에서 첫 도메인 세그먼트 추출(소문자). */
export function adminPathSegment(pathname: string): string {
  const m = String(pathname || '').match(/\/api\/admin[/-]([a-z0-9-]+)/i);
  return m ? m[1].toLowerCase() : '';
}

/** 역할별 '변경(쓰기)' 허용 도메인(경로 첫 세그먼트). super/admin 은 전권(여기 안 씀). */
const WRITE_DOMAINS: Record<'ops' | 'cs' | 'finance', readonly string[]> = {
  ops: [
    'orders', 'products', 'suppliers', 'sellers', 'seller', 'stays', 'streams', 'stream',
    'kt-alpha', 'cafe24', 'banners', 'side-banners', 'wholesale-banners', 'wholesale-board',
    'wholesale-products', 'wholesale-malls', 'flags', 'blog', 'youtube-growth', 'coupons', 'tools',
  ],
  cs: [
    'orders', 'order', 'moderation', 'abuse', 'reviews', 'review-generator', 'users', 'user',
    'partnership-inquiries', 'wholesale-proposals',
  ],
  finance: [
    'settlements', 'settlement', 'payout-center', 'payouts', 'withholding', 'wholesale-withdrawal',
    'wholesale-deposits', 'wholesale-deposit-account', 'commission-settings', 'tax', 'restaurant-settlement',
    'distributor', 'agencies', 'agency-creator-approvals', 'wholesale', 'metrics', 'business-metrics',
  ],
};

/** 이 역할이 해당 경로에 '변경(mutation)' 을 할 수 있는가. (슈퍼전용 경로 차단은 호출 전 isSuperOnlyAdminPath 로) */
export function canAdminRoleMutate(role: AdminRole, pathname: string): boolean {
  if (role === 'super' || role === 'admin') return true;
  if (role === 'viewer') return false;
  const seg = adminPathSegment(pathname);
  if (!seg) return false;
  const domains = WRITE_DOMAINS[role];
  return !!domains && domains.includes(seg);
}

/** 친화 라벨(배지/안내용). */
export const ADMIN_ROLE_LABEL: Record<AdminRole, string> = {
  super: '슈퍼관리자',
  admin: '일반관리자',
  ops: '운영(주문/상품)',
  cs: '고객응대(CS)',
  finance: '정산/회계',
  viewer: '읽기전용',
};
