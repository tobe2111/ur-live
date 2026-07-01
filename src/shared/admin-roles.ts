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
 *   - wholesale: 🆕 도매(유통스타트) 전용 — 도매 도메인만 읽기·쓰기, 그 외 /api/admin/* 전부 차단(외부 동업자).
 *
 * 정책: (일반역할) 읽기는 슈퍼전용 제외 전 허용, 변경은 도메인 제한.
 *       (도메인-한정역할 wholesale) 읽기·쓰기 모두 자기 도메인만 — 유어딜 소비자 어드민 데이터 격리.
 * ⚠️ ops/cs/finance/viewer/wholesale 는 신규 역할(기존 계정 0) → 강제해도 기존 super/admin 워크플로 무영향.
 */

export type AdminRole = 'super' | 'admin' | 'ops' | 'cs' | 'finance' | 'viewer' | 'wholesale';

export const ADMIN_ROLES: AdminRole[] = ['super', 'admin', 'ops', 'cs', 'finance', 'viewer', 'wholesale'];

/** admins.role 원시값 → 정규화. 미지/레거시는 super(전권) — 기존 계정 보호(역호환). */
export function normalizeAdminRole(raw: string | null | undefined): AdminRole {
  const r = String(raw || '').toLowerCase().trim();
  if (r === 'super_admin' || r === 'super') return 'super';
  if (r === 'admin' || r === 'ops' || r === 'cs' || r === 'finance' || r === 'viewer' || r === 'wholesale') return r as AdminRole;
  return 'super';
}

/** 슈퍼 전용 영역(읽기·쓰기 모두 차단) — 계정관리(/admins) / 감사로그(/audit-logs).
 *  ⚠️ /2fa 는 각 관리자 본인 2단계인증 self-service 라 제외(전 역할 허용). */
export function isSuperOnlyAdminPath(pathname: string): boolean {
  const seg = adminPathSegment(pathname);
  return seg === 'admins' || seg === 'audit-logs' || seg === 'login-history';
}

/**
 * 본인 계정 보안 self-service 경로 — 역할 무관 전 관리자 허용.
 * ⚠️ 강제 보안 게이트(로그인 PIN / 2FA)가 제한·도메인-한정 역할(wholesale 등)을 RBAC 로 막아
 *    "PIN 설정 강제됐는데 설정 API 는 403" 데드락이 나던 것 방지(대표 신고 2026-06-17).
 *    본인 토큰으로 본인 계정(user.id)만 변경하므로 도메인 격리와 무관하게 안전.
 */
export function isSelfServiceAdminPath(pathname: string): boolean {
  const seg = adminPathSegment(pathname);
  return seg === 'set-login-pin' || seg === '2fa';
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

/**
 * 🆕 도메인-한정 역할 — 읽기·쓰기 모두 자기 도메인만(그 외 /api/admin/* 전부 차단).
 *   ops/cs/finance(읽기 개방) 와 달리, 외부 동업자(wholesale)는 유어딜 소비자 데이터도 못 봄.
 *   prefixes: 세그먼트가 이 접두로 시작하면 허용. exact: 정확 일치 허용.
 */
const SCOPED_ROLE_DOMAINS: Partial<Record<AdminRole, { prefixes: readonly string[]; exact: readonly string[] }>> = {
  // 도매: /api/admin/wholesale*(deposits/withdrawals/orders/board/banners/products/malls/proposals/claims/quotes/tax/integrity/guide/overview)
  //   + /api/admin/wholesale/*(tax·integrity) + distributor(등급/주문/일괄등록/통계) + suppliers(제조사) + partnership(제휴문의).
  wholesale: {
    prefixes: ['wholesale', 'partnership', 'distributor', 'supplier'],
    exact: ['suppliers'],
  },
};

/** 도메인-한정 역할인가(읽기까지 격리). */
export function isScopedAdminRole(role: AdminRole): boolean {
  return Object.prototype.hasOwnProperty.call(SCOPED_ROLE_DOMAINS, role);
}

/** 도메인-한정 역할이 이 경로(읽기·쓰기 공통)에 접근 가능한가. */
export function scopedRoleCanAccess(role: AdminRole, pathname: string): boolean {
  const cfg = SCOPED_ROLE_DOMAINS[role];
  if (!cfg) return false;
  const seg = adminPathSegment(pathname);
  if (!seg) return false;
  if (cfg.exact.includes(seg)) return true;
  return cfg.prefixes.some((p) => seg === p || seg.startsWith(p));
}

/**
 * 🛡️ 2026-07-01 (권한 과대부여 감사): 재무성/파괴적 *하위경로*는 명시 역할만 변경 허용.
 *   WRITE_DOMAINS 는 경로 첫 세그먼트로만 매칭 → 도메인 하나를 주면 그 아래 민감 서브패스까지
 *   통째로 열렸음(예: ops 가 'tools' 로 정산일괄·플랫폼설정, 'sellers' 로 수수료율 / cs 가 'users' 로
 *   딜 지급). 이 목록의 경로는 아래 allow(+super/admin) 만 허용해 갭을 차단. super/admin 은
 *   canAdminRoleMutate 상단에서 이미 통과하므로 여기서 제외해도 전권 유지.
 */
const SENSITIVE_MUTATIONS: { readonly pattern: RegExp; readonly allow: readonly AdminRole[] }[] = [
  { pattern: /\/gift-deal(?:$|[/?])/, allow: ['finance'] },                    // 딜 지급(머니 발행) — cs 차단
  { pattern: /\/tools\/settlements\/process(?:$|[/?])/, allow: ['finance'] },  // 정산 일괄 처리 — ops 차단
  { pattern: /\/tools\/settings(?:$|[/?])/, allow: ['finance'] },              // 플랫폼 설정(수수료 기본값 등) — ops 차단
  { pattern: /\/sellers\/[^/]+\/(?:donation-commission|commission)(?:$|[/?])/, allow: ['finance'] }, // 셀러 수수료율 — ops 차단
];

/** 이 역할이 해당 경로에 '변경(mutation)' 을 할 수 있는가. (슈퍼전용 경로 차단은 호출 전 isSuperOnlyAdminPath 로) */
export function canAdminRoleMutate(role: AdminRole, pathname: string): boolean {
  if (role === 'super' || role === 'admin') return true;
  if (role === 'viewer') return false;
  if (isScopedAdminRole(role)) return scopedRoleCanAccess(role, pathname); // 도매: 자기 도메인만 변경
  // 재무성 하위경로: 넓은 세그먼트 도메인 grant 로 새지 않도록 명시 역할만(첫 세그먼트 매칭 갭 차단).
  const sensitive = SENSITIVE_MUTATIONS.find((s) => s.pattern.test(pathname));
  if (sensitive) return sensitive.allow.includes(role);
  const seg = adminPathSegment(pathname);
  if (!seg) return false;
  const domains = WRITE_DOMAINS[role as 'ops' | 'cs' | 'finance'];
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
  wholesale: '도매 파트너',
};
