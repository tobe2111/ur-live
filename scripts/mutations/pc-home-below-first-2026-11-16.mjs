/** 🧬 주입 — PC 홈 첫 섹션 아래(유어쇼츠 + 둘째 섹션). 가드: src/tests/unit/pc-home-below-first-2026-11-16.test.ts */
const T = 'src/tests/unit/pc-home-below-first-2026-11-16.test.ts'
const F = 'src/worker/utils/pc-home-first-screen.ts'
export default [
  { name: 'PC홈아래 — 다시 첫 섹션만', file: F, find: 'return first + pcBelowFirstHtml(visible[1], shortsSeedJson, bannersPayload)', replace: 'return first', test: T, why: '2026-11-16 라이브 PC 유어쇼츠·둘째 섹션 2.7~3.6s.' },
  { name: 'PC홈아래 — inline 배너가 있어도 둘째 섹션', file: F, find: "return shorts + (inline > 0 ? '' : pcSectionHtml(sec2, false))", replace: 'return shorts + pcSectionHtml(sec2, false)', test: T, why: '화면은 둘째 섹션 앞에 inline 배너를 그린다 — 밀린다.' },
  { name: 'PC홈아래 — 둘째 섹션도 eager', file: F, find: 'cardHtml(p, isFirst && i < HOME_CARD_ABOVE_FOLD,', replace: 'cardHtml(p, i < HOME_CARD_ABOVE_FOLD,', test: T, why: '화면 밖 사진이 첫 화면 사진과 회선을 나눈다.' },
]
