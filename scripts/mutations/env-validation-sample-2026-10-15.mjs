// 🎲 2026-10-15 — 환경값 검사 운영 표본(main.tsx)
export default [
  {
    name: '🎲 환경값 검사가 다시 모든 방문자에게 돈다',
    file: 'src/main.tsx',
    find: 'const envSampled = import.meta.env.DEV || Math.random() < 0.01',
    replace: 'const envSampled = true',
    test: 'src/tests/unit/env-validation-sample-2026-10-15.test.ts',
    why: 'SPA 화면 데이터·사진과 zod 15KB 가 다시 회선을 나눠 쓴다',
  },
]
