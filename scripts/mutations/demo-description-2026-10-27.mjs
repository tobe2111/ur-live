/** 🧬 주입 — AI 데모 설명(2026-10-27). 가드: src/tests/unit/demo-description-2026-10-27.test.ts */
const T = 'src/tests/unit/demo-description-2026-10-27.test.ts'
export default [
  {
    name: 'demo-description — 금지어 검사를 끈다',
    file: 'src/worker/cron/demo-description.ts',
    find: '  if (BANNED.test(items.join(\'\\n\')) || BANNED.test(intro)) return null\n',
    replace: '',
    test: T,
    why: 'AI 가 실제 가게의 영업시간·가격을 지어내 그대로 실린다.',
  },
  {
    name: 'demo-description — 크론 배선이 빠진다',
    file: 'src/worker/cron/demo-image-rehost.ts',
    find: "(await import('./demo-description')).writeDemoDescriptions(env)",
    replace: "({ writeDemoDescriptions: async () => ({ written: 0, rejected: 0 }) }).writeDemoDescriptions()",
    test: T,
    why: '설명이 영영 안 써진다(에러 0).',
  },
]
