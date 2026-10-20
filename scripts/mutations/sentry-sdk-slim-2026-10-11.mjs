/**
 * 📦 Sentry 슬림 진입점 (2026-10-11) — 주입 매니페스트.
 * 가드: src/tests/unit/sentry-sdk-slim-2026-10-11.test.ts
 * 에러가 안 나는 결함이다 — 패키지를 통째로 다시 불러와도 화면은 같고 청크만 300 KB 커진다.
 */
const TEST = 'src/tests/unit/sentry-sdk-slim-2026-10-11.test.ts'

export default [
  {
    name: '[Sentry슬림] 호출부가 다시 패키지를 통째로 불러온다',
    file: 'src/lib/sentry.ts',
    find: "_ready = import('./sentry-sdk')",
    replace: "_ready = import('@sentry/react')",
    test: TEST,
    why: '실측 431 KB → 129 KB 로 줄인 것이 그대로 되돌아간다.',
  },
  {
    name: '[Sentry슬림] 진입점이 통째로 재수출한다',
    file: 'src/lib/sentry-sdk.ts',
    find: "export {\n  init,",
    replace: "export * from '@sentry/react'\nexport {\n  init,",
    test: TEST,
    why: '`export *` 는 번들러가 쓰임을 못 좁혀 전부 싣는다.',
  },
  {
    name: '[Sentry슬림] 진입점이 sentry 청크 밖으로 샌다',
    file: 'vite.config.ts',
    find: "if (id.includes('@sentry') || id.includes('/src/lib/sentry-sdk')) return 'sentry'",
    replace: "if (id.includes('@sentry')) return 'sentry'",
    test: TEST,
    why: '진입점이 app-utils(첫 페인트)로 떨어지면 Sentry 를 정적으로 끌고 온다.',
  },
]
