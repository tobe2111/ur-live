/**
 * 🕐 생성물은 **같은 입력이면 같은 바이트**여야 한다 〔2026-09-08 — 실사고 후 신설〕
 *
 * ## 사고
 *
 * `auto-reference.ts`(가이드의 "코드 자동 참조" 섹션)를 만드는 생성기가 파일 안에
 * `new Date().toISOString()` 을 **두 곳**에 박았다. 그리고 pre-commit 훅이 **매 커밋마다**
 * 그 생성기를 돌리고, 내용이 바뀌면 자동으로 스테이지한다.
 *
 * 시각은 매번 다르므로 **내용은 언제나 바뀐다** ⇒ 이 레포의 모든 커밋이 그 두 줄을 건드렸고,
 * 동시에 도는 두 PR 은 **코드가 전혀 안 겹쳐도** 거기서 충돌했다.
 * 2026-09-07 하루에 세 번 났고, 대조해 보니 diff 는 이것뿐이었다:
 *
 *     <  * Generated at: 2026-09-07T08:41:09.442Z
 *     >  * Generated at: 2026-09-07T08:48:40.705Z
 *
 * 그 시각을 읽는 코드는 어디에도 없었다(`src/` 전수 0건).
 *
 * ## 불변식
 *
 * **커밋되는 생성물에 "생성 시각"을 박지 않는다.** 값의 쓸모는 얕고(배포마다 재생성되니
 * 사실상 마지막 배포 시각), 대가는 세션 간 충돌 상시화다.
 *
 * ⚠️ 이 테스트가 **못** 막는 것: 시각 말고 다른 비결정 값(난수·해시·정렬 불안정)이 들어오는 경우.
 *   그건 "두 번 돌려 같은가" 로만 잡히는데, 생성기가 `src/` 에 직접 쓰는 부작용이 있어
 *   유닛에서 돌리지 않는다. 대신 아래 ③ 이 소스에서 그 클래스의 대표(`new Date()`)를 막는다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const GENERATED = 'src/features/guides/api/auto-reference.ts'
const GENERATOR = 'scripts/generate-guide-references.mjs'

describe('생성물 결정론 — 매 커밋 바뀌는 파일을 만들지 않는다', () => {
  it('① 생성물에 ISO 타임스탬프가 없다', () => {
    const src = readFileSync(resolve(root, GENERATED), 'utf-8')
    // 2026-09-07T08:41:09.442Z 형태
    const stamps = src.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/g) ?? []
    expect(
      stamps,
      `생성물에 시각이 박혀 있다(${stamps.slice(0, 2).join(', ')}) — 매 커밋 바뀌어 동시 PR 이 충돌한다`,
    ).toEqual([])
  })

  it('② 측정 대상이 실재한다 (가드가 헛돌지 않는지)', () => {
    // 파일 경로가 바뀌었는데 위 검사가 빈 문자열을 훑고 조용히 통과하는 것을 막는다.
    const src = readFileSync(resolve(root, GENERATED), 'utf-8')
    expect(src.length).toBeGreaterThan(1000)
    expect(src).toContain('AUTO-GENERATED')
  })

  it('③ 생성기가 출력물에 현재 시각을 박지 않는다', () => {
    const gen = readFileSync(resolve(root, GENERATOR), 'utf-8')
    // 🩸 처음엔 "블록 주석을 걷어낸 뒤 `new Date()` 를 찾는다" 로 짰는데 **헛돌았다.**
    //   이 생성기가 내보내는 배너가 그 자체로 `/** … */` 모양이라(템플릿 리터럴 안의 문자열),
    //   주석 제거기가 **출력 템플릿을 통째로 먹어** 거기 심은 타임스탬프를 못 봤다.
    //   되돌려-검증에서 ① 만 빨간불이 되고 ③ 은 초록이라 드러났다.
    //   ⇒ 주석을 지우는 대신 **보간(`${'$'}{...}`)에 든 것만** 본다. 출력물에 시각을 박으려면
    //     반드시 보간을 거치므로, 설명 문장에 `new Date().toISOString()` 이라고 써도 안 걸린다.
    expect(gen, '생성기가 다시 시각을 박고 있다 — 그러면 ① 도 곧 깨진다').not.toMatch(/\$\{\s*new Date\(\)/)
  })
})
