/**
 * 🖋️ 잉크 토큰 테마 추종 — 주입 매니페스트 (2026-09-16)
 *
 * 대표 신고 *"글자들 개선해. 색깔이 뭐야 이게"* 의 원인은 `text-ink` 가 tailwind 에 **고정 hex**
 * 로 박혀 배경만 테마를 따라간 것이었다(다크 `bg-warm` 위 대비 1.05:1). 되돌리면 빨간불이어야 한다.
 */
export default [
  {
    name: '🖋️ 잉크가 다시 고정 hex 로 돌아간다',
    file: 'tailwind.config.js',
    find: `          DEFAULT: 'var(--ink)',       // 제목/본문/가격 — 라이트 #16181C / 다크 #F5F3F1`,
    replace: `          DEFAULT: '#16181C',`,
    test: 'src/tests/unit/ink-token-theme-2026-09-16.test.ts',
    why:
      '이게 정확히 배포됐던 상태다. `bg-warm`(var(--bg))은 다크에서 #11141C 로 내려가는데 글자는 ' +
      '#16181C 에 고정돼, 입점 랜딩의 제목이 배경에 잠겼다(대비 1.05:1). 값을 tailwind 에 다시 적는 ' +
      '순간 index.css 의 `--ink*` 와 두 벌이 갈린다.',
  },
  {
    name: '🖋️ 다크 대비 가드에서 입점 랜딩이 빠진다',
    file: 'scripts/check-dark-contrast.mjs',
    find: `  { route: '/partners', name: '입점 랜딩(PC)', pc: true, fill: true },`,
    replace: `  // { route: '/partners', name: '입점 랜딩(PC)', pc: true, fill: true },`,
    test: 'src/tests/unit/ink-token-theme-2026-09-16.test.ts',
    why:
      '이 가드는 **경로 목록이 곧 범위**다. `/partners` 가 없던 탓에 50개 경로를 돌고도 0건을 ' +
      '보고했고, 그 초록불 아래에서 안 읽히는 랜딩이 배포됐다. 목록에서 빠지는 것 자체가 결함이다.',
  },
]
