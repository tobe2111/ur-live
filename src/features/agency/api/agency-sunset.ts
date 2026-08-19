/**
 * 🌇 에이전시 대시보드 일몰 — 신규 가입 종료 정책 (SSOT, 2026-08-19)
 *
 * 클라이언트 라우트 분기(`src/routes/agency.routes.tsx`)와 **한 쌍**이다:
 *   화면만 막으면 직접 POST 로 우회되고(계정이 조용히 생긴다),
 *   서버만 막으면 사용자가 폼을 다 채운 뒤 403 을 본다.
 * 두 가입 경로(`/register`, `/register-from-user`)가 같은 문구를 쓰도록 여기 한 곳에 둔다 —
 * 문구가 두 벌이 되면 반드시 갈린다.
 *
 * ⚠️ 기존 계정의 로그인/정산/위임은 막지 않는다. 일몰은 "새로 안 받는다"이지
 *    "쓰던 사람을 끊는다"가 아니다. 설계: docs/design/store-operator-model.md
 */
import type { Context } from 'hono'
import { AGENCY_DASHBOARD_SUNSET } from '@/shared/feature-flags'

/** 일몰 중이면 403 응답, 아니면 null(가입 계속 진행). 호출부는 한 줄. */
export function agencySignupClosed(c: Context<any>) {
  if (!AGENCY_DASHBOARD_SUNSET) return null
  return c.json({
    success: false,
    error: '에이전시 신규 가입은 종료되었습니다. 매장 운영 위임은 셀러 대시보드에서 진행됩니다.',
    code: 'AGENCY_SIGNUP_CLOSED',
  }, 403)
}
