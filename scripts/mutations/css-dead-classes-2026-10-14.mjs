/**
 * 🧹 index.css 죽은 클래스 (2026-10-14) — 주입 매니페스트.
 * 가드: src/tests/unit/css-dead-classes-2026-10-14.test.ts
 */
const TEST = 'src/tests/unit/css-dead-classes-2026-10-14.test.ts'
export default [
  {
    name: '[css-dead] 아무도 안 쓰는 클래스를 index.css 에 남긴다',
    file: 'src/index.css',
    find: '.ur-admin-nav-active { background: var(--brand-tint); }',
    replace: '.ur-admin-nav-active { background: var(--brand-tint); }\n.ur-gone-feature-card { color: red; }',
    test: TEST,
    why: '지워진 화면의 손 규칙이 모든 화면의 렌더 차단 CSS 에 계속 실린다(2026-10-14 실측 36종).',
  },
  {
    name: '[css-dead] Tailwind 가 다시 시험 파일로 유틸을 만든다',
    file: 'tailwind.config.js',
    find: '    "!./src/tests/**",',
    replace: '',
    test: TEST,
    why: '시험 픽스처의 클래스 문자열이 모든 화면의 렌더 차단 CSS 에 실린다.',
  },
  {
    name: '[css-dead] 워커까지 Tailwind 에서 뺀다',
    file: 'tailwind.config.js',
    find: '    "!./src/tests/**",',
    replace: '    "!./src/tests/**",\n    "!./src/worker/**",',
    test: TEST,
    why: '서버가 그리는 첫 화면 HTML 의 클래스가 CSS 에서 사라져 첫 프레임이 깨진다.',
  },
]
