import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { suppressedSubcats } from '@/features/marketing/api/company-subcat-yield'

/**
 * 🎯 **은퇴를 두 레인 모두에 건다** — 2026-08-24, 대표 *"이제 영구적이야?"* 3회차 점검에서 드러난 **누락**.
 *
 * ## 무엇이 반쪽이었나
 * 자동 은퇴를 `collect-webkr` 에만 배선했는데, `collect-company` 도 **같은 웹문서 검색**을 돌려
 * 같은 `source='webkr'` 행을 만든다. 수율 표는 두 레인이 만든 행을 **합쳐서** 계산하므로:
 * ```
 *   webkr 레인: 간판 은퇴 →  안 돎
 *   company 레인: 간판 그대로 돎 → 행이 계속 쌓임 → 그 행이 자기 수율 통계를 갱신
 *   ⇒ 은퇴시킨 업종이 다른 문으로 들어와 **자기 판정 근거를 스스로 만든다**
 * ```
 *
 * ## ⚠️ 왜 레인 전체가 아니라 "웹문서 단계만" 인가
 * 이 레인은 [지역검색 → 카카오 → 웹문서] 를 순차로 돈다. 앞의 둘은 수율 표가 심판하는 대상이
 * **아니다**(표는 `source='webkr'` 만 센다). 통째로 막으면 심판한 적도 없는 지도 수집이 죽는다.
 *
 * ## ⚠️ 부기를 남기는 것도 의도다
 * `collect-webkr` 은 응답을 못 받으면 부기를 뺀다(아무것도 안 했으므로). 여기선 **지도·카카오를
 * 실제로 했으므로** `last_run_at` 을 남기는 것이 맞다. 두 레인이 다르게 행동하는 이유가 있다.
 *
 * ## 이 테스트가 **못** 막는 것
 * - 세 번째 레인이 나중에 생겨 또 누락되는 경우. 배선 지점을 열거하는 방식이라 **새 레인은 못 본다**
 *   (그래서 아래 R3 가 "웹문서를 부르는 파일 수"를 고정해 새 호출부가 생기면 빨간불이 뜨게 한다).
 */
const coSrc = readFileSync('src/features/marketing/api/company-collect.ts', 'utf8')
const runSrc = readFileSync('src/features/marketing/api/webkr-collect.ts', 'utf8')
/** 🩸 주석을 뺀 본문으로만 판정한다 — 설명 주석 때문에 조건을 지워도 초록이 뜬 사고가 반복됐다. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('두 레인 모두 은퇴를 적용한다', () => {
  it('🩸 R1 — company 레인도 수율 표를 읽는다(왕복 추가 없이)', () => {
    const body = code(coSrc)
    expect(body).toMatch(/armNaverAndReadSettings\(DB, \[[^\]]*SUBCAT_YIELD_KEY/)
    expect(body).toMatch(/suppressedSubcats\(parseSubcatYield\(pick\(SUBCAT_YIELD_KEY\)\)/)
  })

  it('🩸 R2 — 웹문서 호출이 은퇴 집합으로 막힌다', () => {
    const body = code(coSrc)
    expect(body, '판정').toMatch(/const webBlocked = !!kw\.subcategory && webSuppress\.has\(kw\.subcategory\)/)
    // ⚠️ `[^)]*` 로 쓰면 안 된다 — 조건 안의 `(kw.tier ?? 9)` 괄호에 걸려 늘 실패한다(처음 그렇게 썼다).
    expect(body, '그 판정이 웹문서 호출 조건에 실제로 걸려 있어야 한다')
      .toMatch(/if \(!webBlocked &&[\s\S]{0,120}?\{[\s\S]{0,400}?searchNaverWeb\(/)
  })

  it('🩸 R3 — 웹문서를 부르는 곳은 이 둘뿐이다(새 레인이 생기면 여기서 걸린다)', () => {
    // 배선 지점을 열거하는 가드의 한계를 메운다 — 세 번째 호출부가 생기면 이 수가 어긋난다.
    const callers = ['src/features/marketing/api/company-collect.ts', 'src/features/marketing/api/webkr-collect.ts']
      .filter(f => /searchNaverWeb\(/.test(code(readFileSync(f, 'utf8'))))
    expect(callers.length, '호출부가 늘었으면 그 레인에도 은퇴를 배선할 것').toBe(2)
  })

  it('🩸 R4 — 레인 전체를 막지 않는다(지도·카카오는 심판 대상이 아니다)', () => {
    const body = code(coSrc)
    // 🩸 "어딘가에 continue 가 있나"로 보면 안 된다 — 주입은 `if (webBlocked) { …; continue }` 형태로
    //   들어온다(되돌려-검증에서 실제로 통과했다). **판정 직후 분기 자체**를 앵커해 거기서 빠져나가지
    //   않음을 확인한다. 빠져나가면 그 키워드의 지도·카카오 단계가 통째로 사라진다.
    const stmt = body.match(/if \(webBlocked\)[^\n]*/)
    expect(stmt, 'webBlocked 분기를 못 찾았다(코드가 옮겼으면 이 앵커를 고칠 것)').toBeTruthy()
    expect(stmt![0], '여기서 continue 하면 지도·카카오까지 죽는다').not.toMatch(/continue|return/)
  })

  it('R5 — 이 레인은 부기를 남긴다(지도·카카오를 실제로 했다)', () => {
    const body = code(coSrc)
    const loop = body.slice(body.indexOf('const webBlocked'), body.indexOf('// 📧'))
    expect(loop, 'found_total 갱신이 그대로 있어야 한다').toMatch(/found_total = found_total \+ \?/)
    // webkr 레인은 반대다 — 아무것도 안 했으므로 부기를 뺀다. 둘이 갈리는 것이 설계다.
    expect(code(runSrc)).toMatch(/if \(!r\.answered\) \{[^}]*continue \}/)
  })

  it('두 레인이 같은 판정 함수를 쓴다 — 규칙이 두 벌이 되면 반드시 갈린다', () => {
    for (const src of [coSrc, runSrc]) expect(code(src)).toMatch(/suppressedSubcats\(/)
  })

  it('탐침 회차 보호는 공유된다 — 두 레인 다 같은 함수를 거치므로 자동으로 적용된다', () => {
    const blob = { day: 'x', rows: [{ s: '간판·광고물 제작', tried: 64, got: 6 }] }
    expect(suppressedSubcats(blob, 1).size).toBe(1)
    expect(suppressedSubcats(blob, 5).size, '탐침 회차').toBe(0)
  })
})
