/**
 * 🗺️ **회차 폭을 인용한 설명이 실제 상수와 어긋나지 않는다** — 낡은 지도 차단 (2026-09-16)
 *
 * ## 무엇이 있었나
 * `influencer-round-width.ts` 의 설명이 `COLLECT_KEYWORDS_PER_ROUND = 9` 라고 적어 두고 있었는데,
 * 그 값은 **2026-09-02(#1321)에 14** 가 됐다. 상수 자체는 다른 테스트가 `toBe(14)` 로 잠그고
 * 있었지만 **그 값을 인용한 문장은 아무도 안 봤다.**
 *
 * 에러가 안 나므로 아무도 모른다. 대신 다음 세션이 그 파일을 열어 "보통 회차는 9" 로 오판한다 —
 * 이 레포가 반복해 만난 *낡은 지도* 클래스이고, `check-lock-table-symbols` 가 잠금표에 대해
 * 하는 일을 여기서는 이 파일이 한다.
 *
 * ## 왜 파일을 따로 뒀나 (합치지 말 것)
 * `ads-keyword-focus-split.test.ts` 에는 `expect(COLLECT_KEYWORDS_PER_ROUND).toBe(14)` 가 이미 있다.
 * 거기에 이 검사를 같이 두면 **주입 검증이 헛돈다** — 상수를 13 으로 바꾸는 주입이 그 `toBe(14)`
 * 때문에 빨간불이 나서, *이 검사가 일했는지* 구분할 수 없다(이 레포가 반복해 당한 함정).
 * 여기엔 드리프트 검사 하나만 두어 **빨간불의 원인이 하나뿐**이게 한다.
 *
 * ## ⚠️ 이 파일이 못 보는 것
 * 다른 파일·다른 표현으로 같은 값을 베낀 문장. 여기서 잠그는 것은 **그 한 줄**뿐이고,
 * 근본 처방은 규약이다 — **다른 상수의 값을 주석에 숫자로 베껴 적지 말고 이름을 쓴다.**
 *
 * ⚠️ 그리고 아래 **두 번째 검사는 주입으로 증명되지 않는다.** 대상이 순수 주석이라
 *   `check-guard-mutations` 가 "낡은 지도" 로 거절한다(시도했고 거절당했다) — 그 거절 규칙
 *   자체는 옳다(주석을 고쳐 봐야 동작이 안 바뀐다). 첫 번째 검사만 주입으로 잠겨 있다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { COLLECT_KEYWORDS_PER_ROUND } from '@/features/marketing/api/influencer-round-width'

const DOC = readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-round-width.ts'), 'utf8')

describe('회차 폭 — 설명과 상수가 갈리지 않는다', () => {
  it('🗺️ 설명이 인용한 폭 == 실제 상수', () => {
    const quoted = DOC.match(/`COLLECT_KEYWORDS_PER_ROUND`\s*=\s*\*{0,2}(\d+)/)
    expect(quoted, '폭을 인용한 문장을 못 찾았다 — 문구를 바꿨으면 이 검사도 함께 옮길 것(대상 0건은 통과가 아니다)').toBeTruthy()
    expect(Number(quoted![1]), '설명이 인용한 폭이 실제 상수와 다르다 — 둘 중 하나가 낡았다')
      .toBe(COLLECT_KEYWORDS_PER_ROUND)
  })

  it('🔁 롤백 목표를 숫자로 베껴 적지 않는다 — 그게 이 드리프트의 원인이었다', () => {
    // 네이버 전용 회차(18)의 롤백은 "보통 회차와 같은 폭으로" 다. 08-12 에는 그게 마침 9 였고,
    // 그 숫자를 적어 둔 탓에 폭이 14 가 된 지금은 **되돌리면 오히려 좁아지는** 안내가 됐다.
    expect(DOC).toMatch(/이 상수를 \*\*`COLLECT_KEYWORDS_PER_ROUND` 와/)
  })
})
