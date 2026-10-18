/**
 * 💬 2026-10-18 — 카카오 봇 미답변 질문 수집의 주입.
 * 가드: `src/tests/unit/cs-unanswered-2026-10-18.test.ts`
 */
const U = 'src/worker/utils/cs-unanswered.ts'
const H = 'src/worker/routes/kakao-skill-webhook.routes.ts'
const T = 'src/tests/unit/cs-unanswered-2026-10-18.test.ts'

export default [
  {
    name: '💬 미답변 — 번호를 안 가린다',
    file: U,
    find: ".replace(/\\d[\\d\\s-]{2,}\\d/g, m => (m.replace(/\\D/g, '').length >= 4 ? '#' : m))",
    replace: '',
    test: T,
    why: '전화번호·이용권 코드가 그대로 DB 에 남는다.',
  },
  {
    name: '💬 미답변 — 같은 질문이 횟수 대신 덮어써진다',
    file: U,
    find: 'hits = hits + 1',
    replace: 'hits = 1',
    test: T,
    why: '많이 물은 질문을 가릴 수 없어 FAQ 후보 순위가 무의미해진다.',
  },
  {
    name: '💬 미답변 — 폴백 경로에서 기록이 빠진다',
    file: H,
    find: 'if (DB) defer(recordUnanswered(DB, utterance).catch(() => false))',
    replace: '',
    test: T,
    why: '봇이 답 못 한 질문이 다시 아무 데도 남지 않는다.',
  },
]
