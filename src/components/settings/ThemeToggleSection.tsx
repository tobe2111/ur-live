/**
 * 🛡️ 2026-05-02: 화면 테마 선택 (시스템 / 라이트 / 다크) — 공용 섹션.
 *
 * 🛡️ 2026-05-03: 다크 모드 토글 비활성화. 사용자 신고 "화이트/다크 테마 구분 모호" 사고 후 정책 복귀.
 *   - 화이트 테마 페이지 (쇼핑/결제) = 항상 화이트
 *   - 다크 테마 페이지 (홈/마이/라이브) = 항상 다크
 *   - 셀러/어드민/에이전시 = 항상 라이트
 *   토글 UI 자체는 완전히 숨김 (return null). useTheme.applyToDocument 도 no-op.
 *   향후 페이지별 명시 dark: variant 으로 재설계 가능 (CLAUDE.md 정책 변경 시).
 */
export default function ThemeToggleSection() {
  return null
}
