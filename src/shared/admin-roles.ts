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
 * 🪦 폐지된 역할(RETIRED_ADMIN_ROLES): wholesale(도매 파트너) — 2026-10-11 도매몰 철거, 2026-11-17 역할 삭제
 *   (대표 *"응 지워줘"*). 라이브 계정 4개는 전부 소프트 삭제(is_active=0). 그래도 그 값을 가진 토큰·행은
 *   **viewer 로 내려앉히지 않고 전면 차단**한다 — viewer 는 소비자 데이터를 읽을 수 있어, 그냥 지우면
 *   *아무것도 못 보던* 계정이 오히려 넓어진다.
 *
 * 정책: 읽기는 슈퍼전용 제외 전 허용, 변경은 도메인 제한.
 * ⚠️ ops/cs/finance/viewer 는 신규 역할(기존 계정 0) → 강제해도 기존 super/admin 워크플로 무영향.
 */

export type AdminRole = 'super' | 'admin' | 'ops' | 'cs' | 'finance' | 'viewer';

export const ADMIN_ROLES: AdminRole[] = ['super', 'admin', 'ops', 'cs', 'finance', 'viewer'];

/** 🪦 폐지된 역할 — 이 값을 가진 계정·토큰은 어드민 어디에도 못 들어온다(로그인·refresh·RBAC 모두). */
export const RETIRED_ADMIN_ROLES: readonly string[] = ['wholesale'];

/** admins.role 원시값이 폐지된 역할인가. normalize 보다 **먼저** 불러야 한다(normalize 는 viewer 로 내린다). */
export function isRetiredAdminRole(raw: string | null | undefined): boolean {
  return RETIRED_ADMIN_ROLES.includes(String(raw || '').toLowerCase().trim());
}

/**
 * admins.role 원시값 → 정규화.
 * 🔐 2026-07-12 (어드민 RBAC 감사 G): fail-OPEN 제거.
 *   - 빈값/NULL(role 컬럼 이전 원조 관리자) → super 유지(레거시 보호 — 락아웃 방지).
 *   - 알려진 역할 → 그대로.
 *   - 미지/오타/손상된 non-empty 값 → viewer(최소권한, fail-CLOSED). 기존엔 이 경로도 super 라
 *     JWT 클레임/DB 의 손상·미지 role 문자열이 전권을 획득할 수 있었음.
 *   - ⚠️ 폐지된 역할(wholesale)도 여기선 viewer 가 된다 — 그래서 호출자는 isRetiredAdminRole 로 먼저 막는다.
 */
export function normalizeAdminRole(raw: string | null | undefined): AdminRole {
  const r = String(raw || '').toLowerCase().trim();
  if (r === '') return 'super';
  if (r === 'super_admin' || r === 'super') return 'super';
  if (r === 'admin' || r === 'ops' || r === 'cs' || r === 'finance' || r === 'viewer') return r as AdminRole;
  return 'viewer';
}

/** 슈퍼 전용 영역(읽기·쓰기 모두 차단) — 계정관리(/admins) / 감사로그(/audit-logs).
 *  ⚠️ /2fa 는 각 관리자 본인 2단계인증 self-service 라 제외(전 역할 허용). */
export function isSuperOnlyAdminPath(pathname: string): boolean {
  const seg = adminPathSegment(pathname);
  return seg === 'admins' || seg === 'audit-logs' || seg === 'login-history';
}

/**
 * 본인 계정 보안 self-service 경로 — 역할 무관 전 관리자 허용.
 * ⚠️ 강제 보안 게이트(로그인 PIN / 2FA)가 제한 역할을 RBAC 로 막아
 *    "PIN 설정 강제됐는데 설정 API 는 403" 데드락이 나던 것 방지(대표 신고 2026-06-17).
 *    본인 토큰으로 본인 계정(user.id)만 변경하므로 도메인 격리와 무관하게 안전.
 */
export function isSelfServiceAdminPath(pathname: string): boolean {
  // ⭐ 2026-08-22: 본인 UI 개인설정(즐겨찾기 등)도 self-service — 읽기전용(viewer)이라도
  //    자기 메뉴는 고정할 수 있어야 한다(권한이 아니라 취향이다).
  //    ⚠️ 세그먼트 `me` 를 통째로 열지 않는다 — 그러면 앞으로 `/api/admin/me/*` 에 붙는
  //       모든 라우트가 RBAC 를 조용히 우회한다. **`/me/prefs/` 만** 정확히 연다.
  if (/^\/api\/admin\/me\/prefs\/[a-z0-9_]+$/i.test(String(pathname || ''))) return true;
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
    'kt-alpha', 'banners', 'side-banners', 'wholesale-banners', 'wholesale-board',
    'wholesale-products', 'wholesale-malls', 'flags', 'blog', 'youtube-growth', 'coupons', 'tools',
  ],
  cs: [
    'orders', 'order', 'moderation', 'abuse', 'reviews', 'review-generator', 'users', 'user',
    'partnership-inquiries', 'wholesale-proposals',
  ],
  finance: [
    'settlements', 'settlement', 'payout-center', 'payouts', 'withholding', 'wholesale-withdrawal',
    'wholesale-deposits', 'wholesale-deposit-account', 'commission-settings', 'tax', 'restaurant-settlement',
    'distributor', 'wholesale', 'metrics', 'business-metrics',
  ],
};

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
  { pattern: /\/sellers\/[^/]+\/(?:donation-commission|commission(?:-settings)?)(?:$|[/?])/, allow: ['finance'] }, // 셀러 수수료율/영입보너스(commission-settings 포함) — ops 차단(2026-07-12 감사 E: -settings 미매칭 갭 수리)
  // 🔐 2026-11-18: 넓은 `sellers`·`tools` 도메인(ops)에 실려 새던 것 — 주인 지정·출금 재개·잔액 병합·원장 잠금 해제.
  { pattern: /\/sellers\/[^/]+\/link-user(?:$|[/?])/, allow: [] },                 // 매장 주인 지정 — super·admin 만
  { pattern: /\/sellers\/[^/]+\/verify-account(?:$|[/?])/, allow: ['finance'] },   // 계좌 재인증(출금 재개) — ops 차단
  { pattern: /\/sellers\/[^/]+\/bank-account(?:$|[/?])/, allow: ['finance'] },     // 🏦 2026-11-24 정산 계좌 대신 입력(돈이 가는 곳) — ops·cs 차단
  { pattern: /\/tools\/(?:points-reconcile|point-ledger-unlock)(?:$|[/?])/, allow: [] }, // 잔액 병합·원장 DDL — super·admin 만
  // 🔐 2026-11-25: `/api/admin/*` **밖**에 있는 어드민 쓰기 — 역할 검사가 그 접두사에만 걸려 있어 조회 전용(viewer)도 통과했다.
  //   라우트 파일이 직접 `adminRbacMiddleware()` 를 건다(`disputes.routes.ts` · `returns.routes.ts`). 첫 세그먼트 규칙이 안 맞는 경로라 여기서 역할을 정한다.
  { pattern: /^\/api\/disputes\/admin\//, allow: ['cs', 'finance'] },                              // 분쟁 승인 = 환불 실행
  { pattern: /^\/api\/returns\/[^/]+\/refund(?:$|[/?])/, allow: ['cs', 'finance'] },               // 반품 환불 실행
  { pattern: /^\/api\/returns\/[^/]+\/(?:approve|reject|inspect)(?:$|[/?])/, allow: ['cs', 'ops'] }, // 반품 접수·검수
];

/** 이 역할이 해당 경로에 '변경(mutation)' 을 할 수 있는가. (슈퍼전용 경로 차단은 호출 전 isSuperOnlyAdminPath 로) */
export function canAdminRoleMutate(role: AdminRole, pathname: string): boolean {
  if (role === 'super' || role === 'admin') return true;
  if (role === 'viewer') return false;
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
};
