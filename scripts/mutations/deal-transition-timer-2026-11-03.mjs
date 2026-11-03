/** 🧬 주입 — 카드→상세 전환 기다림(2026-11-03). 가드: src/tests/unit/deal-transition-timer-2026-11-03.test.ts */
const T = 'src/tests/unit/deal-transition-timer-2026-11-03.test.ts'
export default [
  { name: 'deal-transition — 상한 타이머가 빠진다(사진이 안 생기면 전환이 끝나지 않는다)', file: 'src/lib/deal-view-transition.ts',
    find: '    const cap = setTimeout(done, HERO_WAIT_MS)\n', replace: '    const cap = 0 as unknown as ReturnType<typeof setTimeout>\n', test: T, why: '숙소처럼 청크가 늦은 상세에서 화면이 ~4초 멈춘다.' },
]
