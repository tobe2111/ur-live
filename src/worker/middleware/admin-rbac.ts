/**
 * 🛡️ 2026-06-16 어드민 RBAC 게이트 — `/api/admin/*` 전역 미들웨어.
 *
 * 목적: 제한 역할(ops/cs/finance/viewer) 계정이 실제로 권한 밖 변경을 못 하게 강제.
 *   기존엔 requireAdmin() 만 있어 '아무 어드민이나 전권' → 제한 역할이 무의미했음.
 *
 * 동작:
 *   - 라우트의 requireAdmin 보다 먼저 도는 전역 게이트 → admin JWT(Bearer)를 직접 검증해 role 추출.
 *   - role 미상(비인증) → next()로 통과시켜 각 라우트의 requireAdmin 이 401 처리(이중 처리 방지).
 *   - super → 전권. 슈퍼전용 경로(/admins·/audit-logs·/2fa)는 super 외 전부 403.
 *   - 읽기(GET/HEAD) → (슈퍼전용 제외) 전 역할 허용.
 *   - 변경(POST/PATCH/PUT/DELETE) → admin=전권 / viewer=차단 / ops·cs·finance=도메인 제한.
 *
 * SSOT: ../../shared/admin-roles.ts (프론트 네비 게이트와 공유). worker 는 @/ alias 불가 → 상대경로.
 */
import type { Context, Next } from 'hono';
import * as jwt from '@tsndr/cloudflare-worker-jwt';
import {
  normalizeAdminRole,
  isSuperOnlyAdminPath,
  isSelfServiceAdminPath,
  canAdminRoleMutate,
  isScopedAdminRole,
  scopedRoleCanAccess,
  type AdminRole,
} from '../../shared/admin-roles';

/** Bearer admin JWT 에서 role 추출. 유효한 admin 토큰이 아니면 null(→ 라우트 auth 가 처리). */
async function adminRoleFromRequest(c: Context): Promise<AdminRole | null> {
  const secret = (c.env as { JWT_SECRET?: string }).JWT_SECRET;
  if (!secret) return null;
  const authHeader = c.req.header('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return null;
  try {
    // HS256 고정(alg-confusion 방어) — auth.ts verifyJWT 와 동일.
    if (!(await jwt.verify(token, secret, { algorithm: 'HS256' }))) return null;
    const payload = (jwt.decode(token).payload || {}) as { type?: string; role?: string };
    if (payload.type !== 'admin') return null;
    return normalizeAdminRole(payload.role);
  } catch {
    return null;
  }
}

export function adminRbacMiddleware() {
  return async (c: Context, next: Next) => {
    const method = c.req.method.toUpperCase();
    if (method === 'OPTIONS') return next(); // CORS preflight

    const role = await adminRoleFromRequest(c);
    // 비인증/미상 → 통과(라우트 requireAdmin 이 401). super → 전권.
    if (!role || role === 'super') return next();

    const pathname = new URL(c.req.url).pathname;

    // 본인 계정 보안 self-service(로그인 PIN / 2FA 설정)는 역할 무관 허용 —
    //   강제 보안 게이트가 제한·도메인-한정 역할(wholesale 등) 본인을 막아 데드락 나는 것 방지.
    //   (requireAdmin 이 뒤에서 본인 토큰 검증, 본인 user.id 만 변경.)
    if (isSelfServiceAdminPath(pathname)) return next();

    // 계정관리·감사로그·2FA = 슈퍼 전용(읽기·쓰기 모두).
    if (isSuperOnlyAdminPath(pathname)) {
      return c.json({ success: false, error: '이 영역은 슈퍼관리자만 접근할 수 있습니다', code: 'ADMIN_ROLE_FORBIDDEN' }, 403);
    }

    // 🆕 도메인-한정 역할(도매 파트너 등) — 읽기·쓰기 모두 자기 도메인만. 그 외 /api/admin/* 는 읽기도 차단.
    if (isScopedAdminRole(role)) {
      return scopedRoleCanAccess(role, pathname)
        ? next()
        : c.json({ success: false, error: '담당 도메인 밖의 영역입니다 (도매 전용 계정)', code: 'ADMIN_ROLE_FORBIDDEN' }, 403);
    }

    // 읽기는 허용(대시보드 조회).
    if (method === 'GET' || method === 'HEAD') return next();

    // 변경 — 역할별 도메인 검사.
    if (canAdminRoleMutate(role, pathname)) return next();
    return c.json(
      { success: false, error: '이 작업을 수행할 권한이 없습니다 (제한된 관리자 계정)', code: 'ADMIN_ROLE_FORBIDDEN' },
      403,
    );
  };
}
