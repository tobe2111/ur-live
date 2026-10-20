/**
 * 🗺️ 회차 폭 설명이 실제 상수와 어긋나는 것(낡은 지도) — 주입 매니페스트 (2026-09-16 등록).
 * 가드: src/tests/unit/round-width-doc-drift-2026-09-16.test.ts
 *
 * 왜 필요한가: 상수 자체는 이미 `toBe(14)` 로 잠겨 있었는데 **그 값을 인용한 문장**은 아무도 안 봤다.
 * `COLLECT_KEYWORDS_PER_ROUND` 가 9 → 14 로 바뀐 뒤에도 설명은 `= 9` 인 채 2주를 지났다.
 * 에러가 안 나니 배포는 초록불이고, 다음 세션만 그 문장을 믿고 오판한다.
 *
 * 🔑 **주입은 코드 쪽(상수)에서 한다.** 러너는 `find` 가 주석에만 있으면 "낡은 지도" 로 거절하는데,
 *    그 규칙 자체는 옳다 — 주석을 고쳐 봐야 동작이 안 바뀌니까. 여기서는 **상수를 움직여** 같은
 *    불일치를 만든다(설명 14 ↔ 상수 13). 가드 파일이 드리프트 검사만 담고 있어서 빨간불의
 *    원인이 하나뿐이고, 그래서 이 주입이 실제로 그 검사를 증명한다.
 *
 * ⚠️ **두 번째 불변식(롤백 안내를 숫자로 베끼지 않는다)은 주입으로 못 잡는다** — 그 대상이
 *    순수하게 주석이라 러너가 위 규칙대로 거절한다(실제로 시도했고 거절당했다). 그 검사는
 *    테스트 파일에 남아 있지만 **CI 가 "실패할 수 있는지" 를 증명해 주지는 않는다.**
 */
const WIDTH = 'src/features/marketing/api/influencer-round-width.ts'
const TEST = 'src/tests/unit/round-width-doc-drift-2026-09-16.test.ts'

export default [
  {
    name: '[회차폭] 상수만 움직여 설명과 어긋나게 함 (14 → 13)',
    file: WIDTH,
    find: 'export const COLLECT_KEYWORDS_PER_ROUND = 14',
    replace: 'export const COLLECT_KEYWORDS_PER_ROUND = 13',
    test: TEST,
    why: '설명은 14 인데 상수는 13 — 2026-09-16 에 발견된 그 상태의 거울상이다. 코드도 문서도 각자 말이 되는데 서로 다르다.',
  },
]
