/**
 * 🧬 주입 — 프랜차이즈 수집 키워드 (2026-11-23)
 *    가드: src/tests/unit/franchise-keyword-echo-2026-11-23.test.ts
 */
const T = 'src/tests/unit/franchise-keyword-echo-2026-11-23.test.ts'
const F = 'src/features/marketing/api/franchise-collect.ts'
export default [
  { name: '프랜차이즈 — 수집 키워드가 브랜드명으로 폴백한다', file: F,
    find: "  return 'franchise'\n}", replace: "  return String(it?.brandNm ?? '') || 'franchise'\n}", test: T,
    why: '상호 = 키워드가 돼 분류기가 전부 거절한다(라이브 100회 실행 저장 0).' },
  { name: '프랜차이즈 — 실제 관리번호 칸(brandMnno)을 안 읽는다', file: F,
    find: "  for (const k of ['brandMnno', 'jnghdqrtrsMnno', 'brandMngtNo', 'jnghdMngtNo']) {", replace: "  for (const k of ['brandMngtNo', 'jnghdMngtNo']) {", test: T,
    why: '원부의 관리번호를 못 찾아 모든 행의 키워드가 같은 고정값이 된다.' },
]
