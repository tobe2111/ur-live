/**
 * 🔒 도매몰 어드민 — 파일 둘이 **같은 판정**을 쓰게 하는 자리 (2026-09-16 분리).
 *
 * `wholesale-malls-admin.routes.ts` 가 625줄로 자라 신청 라우트를 떼어 냈는데, 그러면서
 * `requireSuperAdmin`·`rejectReservedSlug` 가 두 파일에 필요해졌다. **복사하지 않는다** —
 * 슬러그 판정이 경로마다 갈리면 *신청 경유로만 통과하는 예약어*가 생기고, 그게 예약어면
 * 소비자 라우트가 통째로 죽는다(`urdeal.kr/{슬러그}` 는 영구 주소다).
 */
import { normalizeAdminRole } from '@/shared/admin-roles'
import { validateMallSlug } from '@/shared/mall/slug'

/**
 * 🔒 2026-06-29 (대표 — "도매몰 관리는 슈퍼어드민만"): 몰 생성/수정(관리)은 슈퍼 전용.
 *   GET(몰 목록)은 여러 도매 어드민 화면의 몰 선택기(AdminMallSelect)가 읽으므로 유지 — 관리(쓰기)만 잠금.
 *   requireAdmin 이 c.set('user',{role}) 로 넣은 역할을 정규화해 super 만 통과.
 */
export function requireSuperAdmin() {
  return async (c: import('hono').Context, next: import('hono').Next) => {
    const role = normalizeAdminRole((c.get('user') as { role?: string } | undefined)?.role)
    if (role !== 'super') {
      return c.json({ success: false, error: '도매몰 관리는 슈퍼관리자만 가능합니다', code: 'SUPER_ONLY' }, 403)
    }
    return next()
  }
}

/**
 * 🔴 세션 ③-a 〔대표 경계조건 ② — "가드는 양방향이어야 합니다"〕
 *
 * 슬러그는 `urdeal.kr/{슬러그}` 자리에 앉는다 ⇒ **예약어와 겹치면 그 라우트가 죽는다.**
 * CI 는 `라우트 ⊆ 예약어`(mall-branding.test)를 보지만 **라이브 DB 는 못 읽는다**.
 * 여기가 그 반쪽 — **쓰기 시점 차단**이다.
 *
 * ⚠️ 왜 문자 집합 검사로 안 끝나는가: 그건 `admin`·`products` 같은 예약어를 통과시킨다.
 * ⚠️ 3~30자 하한/상한은 취향이 아니라 **리졸버와의 정합**이다 — `firstPathSegment` 가
 *   `/^[a-z0-9-]{3,30}$/` 로 후보를 거르므로, 그 밖의 슬러그는 **경로로 영영 도달할 수 없다**.
 *   만들 수는 있는데 열리지는 않는 몰을 허용하지 않는다.
 */
export function rejectReservedSlug(s: string): string | null {
  const v = validateMallSlug(s)
  return v.ok ? null : v.reason
}
