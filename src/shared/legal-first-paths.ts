/**
 * ⚖️ 서버가 화면 전체를 그리는 정책 문서 경로 (2026-11-18) — 워커 분기(`worker/index.ts`)·첫 화면 CSS 자격
 * (`worker/utils/css-first-boot.ts`)·빌더(`worker/utils/legal-first-screen.ts`)가 이 판정 하나를 쓴다(셋이 갈리면
 * 서버가 그린 첫 화면이 CSS 를 못 받거나, CSS 만 받고 그림이 없다).
 */
export const LEGAL_FIRST_SCREEN_PATHS = ['/refund', '/terms'] as const
export type LegalPath = typeof LEGAL_FIRST_SCREEN_PATHS[number]

/** `/refund`·`/terms`(끝 `/` 허용) → 경로 키. 그 외(`/terms/seller` 등) null. */
export function legalPathOf(pathname: string): LegalPath | null {
  const p = pathname.replace(/\/+$/, '') || '/'
  return (LEGAL_FIRST_SCREEN_PATHS as readonly string[]).includes(p) ? (p as LegalPath) : null
}
