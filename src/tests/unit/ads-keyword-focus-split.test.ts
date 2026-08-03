import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { planKeywordSplit, FOCUS_CATEGORIES, PRIORITY_CATEGORIES } from '@/features/marketing/api/influencer-keyword-rotation'
import { CLASSIFIED_CATEGORIES } from '@/features/marketing/api/influencer-classify'

const SRC = readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-auto-collect.ts'), 'utf8')
/**
 * 주석을 걷어낸 본문 — **가드는 코드를 읽어야 한다**. 첫 구현이 이 파일 주석 속 `settings[...]` 예시를
 * 실제 접근으로 세어 빨간불을 냈다(이 레포가 겪은 "주석에만 남아도 통과"의 정확한 반대편).
 */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/**
 * 🎯 **집중 축 전용 슬롯** (2026-08-02 대표 "C안" 확정).
 *
 *   마케팅대행사는 리드 1건이 **매장 N건으로 곱해지는** 유일한 축인데, 우선 풀(3/4)에 얹으면
 *   7분의 1만 받아 몇 주가 걸린다. 그래서 배치의 1/4을 통째로 뗀다.
 *
 *   ⚠️ **자기 반납이 이 설계의 핵심이다.** 대행사 키워드가 고갈되면(무수확 누적 → 자동 비활성)
 *   전용 슬롯은 스스로 0이 되고 그 몫이 우선/일반으로 돌아간다. 이게 없으면 다 훑은 뒤에도
 *   1/4을 영원히 낭비한다 — 아래 검사가 그 성질을 고정한다.
 *   ⚠️ 이 테스트가 못 보는 것: 1/4이라는 **비중이 타당한지**(라이브 수율은 코드 밖 사실이다).
 *   비중을 바꿀 땐 `FOCUS_SHARE` 주석의 근거도 함께 갱신할 것.
 */
describe('planKeywordSplit — 집중/우선/일반 3분할', () => {
  it('🔒 집중 축이 몫(1/4)을 먼저 가져간다', () => {
    const r = planKeywordSplit(16, 10, 100, 100)
    expect(r.nFocus).toBe(4)
    expect(r.nFocus + r.nPri + r.nGen).toBe(16)
  })

  it('🔒 집중 축이 비면 슬롯을 **반납**한다 — 다 훑은 뒤 1/4을 낭비하지 않는다', () => {
    const r = planKeywordSplit(16, 0, 100, 100)
    expect(r.nFocus).toBe(0)
    expect(r.nFocus + r.nPri + r.nGen).toBe(16) // 총량 유지 = 반납분이 다른 풀로 갔다
  })

  it('🔒 가용분보다 많이 배정하지 않는다 — 같은 키워드를 한 배치에 두 번 넣지 않게', () => {
    const r = planKeywordSplit(16, 2, 3, 4)
    expect(r.nFocus).toBeLessThanOrEqual(2)
    expect(r.nPri).toBeLessThanOrEqual(3)
    expect(r.nGen).toBeLessThanOrEqual(4)
  })

  it('🔒 슬롯을 버리지 않는다 — total 과 가용합계 중 작은 쪽만큼 꽉 채운다', () => {
    for (const [t, f, p, g] of [[16, 2, 3, 4], [16, 10, 100, 100], [4, 0, 1, 0], [20, 5, 5, 5], [8, 8, 0, 0]] as const) {
      const r = planKeywordSplit(t, f, p, g)
      expect(r.nFocus + r.nPri + r.nGen, `total=${t} f=${f} p=${p} g=${g}`).toBe(Math.min(t, f + p + g))
    }
  })

  it('🐛 이상값(음수·NaN)에도 음수 몫이 안 나온다', () => {
    for (const [t, f, p, g] of [[-5, 1, 1, 1], [Number.NaN, 1, 1, 1], [10, -1, Number.NaN, 5]] as const) {
      const r = planKeywordSplit(t as number, f as number, p as number, g as number)
      for (const v of [r.nFocus, r.nPri, r.nGen]) {
        expect(Number.isFinite(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('📌 집중 축은 분류기가 실제로 만드는 카테고리다 — 오타면 영원히 빈 풀이고 아무도 모른다', () => {
    for (const c of FOCUS_CATEGORIES) expect(CLASSIFIED_CATEGORIES).toContain(c)
  })

  it('🔒 집중 축과 우선 풀은 겹치지 않는다 — 겹치면 같은 키워드가 한 배치에 두 번 들어간다', () => {
    expect(FOCUS_CATEGORIES.filter(c => PRIORITY_CATEGORIES.includes(c))).toEqual([])
  })
})

/** 🔌 배선 잠금 — 순수함수만 테스트하면 "함수는 있는데 부르는 곳이 없는" 사고를 못 잡는다. */
describe('배선 — 수집 루프가 3분할을 실제로 쓴다', () => {
  it('🔒 planKeywordSplit 로 배분하고 세 풀이 서로 배타다', async () => {
    expect(SRC).toMatch(/const \{ nFocus, nPri, nGen \} = planKeywordSplit\(/)
    expect(SRC).toMatch(/const focusPool = kws\.filter\(inFocus\)/)
    // 우선/일반 풀이 집중 축을 제외해야 배타가 성립한다.
    expect(SRC).toMatch(/priPool = kws\.filter\(k => !inFocus\(k\)/)
    expect(SRC).toMatch(/genPool = kws\.filter\(k => !inFocus\(k\)/)
    expect(SRC).toMatch(/focus_n: nFocus/)   // 밖에서 "대행사를 돌고 있나"를 볼 수 있어야 한다
  })
})

/**
 * 🧊 **커서가 얼어붙는 병** (2026-08-03 라이브 실측 — 대행사 축이 왜 얇은지의 진짜 답).
 *
 * ## 무엇이 고장이었나
 * 집중 축 슬롯(#930)은 배치의 1/4을 대행사 키워드에 떼어 주는데, **커서가 항상 0** 이었다.
 * 원인이 둘 다 "조용한 부재"였다:
 * ```
 *   ① 읽기: settings['ads_autocollect_cursor_focus'] ← 이 키가 readSettings 목록에 없음
 *           → 에러가 아니라 undefined → parseInt('0') → 0
 *   ② 쓰기: nextFocusCursor 를 계산해 통계 JSON 에만 넣고 platform_settings 엔 안 씀
 *           → 라이브 실측: cursor_pri=158 · cursor=6 인데 cursor_focus **행 자체가 없음**
 * ```
 * 결과(라이브): 활성 대행사 키워드 18개 중 **앞 4개만 무한 반복**.
 * ```
 *   56459 마케팅 대행사  found 2,070   56462 디지털 마케팅  found 0 · last_run null
 *   56460 광고 대행사    found 1,150   …
 *   56461 온라인 마케팅  found    58   56476 지역 광고      found 0 · last_run null
 * ```
 * "체험단 대행"·"인플루언서 섭외"처럼 **대행사를 가장 잘 찾을 키워드가 한 번도 검색된 적이 없다.**
 * 슬롯은 정상 배정되고 있었으므로(`focus_n: 4`) 통계만 봐선 정상으로 보였다.
 *
 * ⚠️ 이 테스트가 못 보는 것: 커서가 **얼마나** 도는지(그건 예산과 라이브 수율의 문제다).
 *   여기서 고정하는 건 "읽는 키를 실제로 읽어오는가 · 민 값을 실제로 저장하는가" 둘뿐이다.
 */
describe('설정 키 — 읽는 키는 읽어오고, 민 커서는 저장한다', () => {
  /** `settings[X]` 로 읽는 키를 전부 뽑는다(리터럴·상수 양쪽). */
  const READS = Array.from(CODE.matchAll(/\bsettings\[([^\]]+)\]/g)).map(m => m[1]!.trim())

  it('읽는 키를 찾았다 — 0개면 아래 검사가 통째로 무의미하다', () => {
    expect(READS.length).toBeGreaterThan(3)
  })

  it('🔒 `settings[...]` 로 읽는 키는 전부 readSettings 목록에 있다 — 없으면 조용히 기본값이 된다', () => {
    const decl = /const SETTING_KEYS = \[([^\]]*)\]/.exec(CODE)?.[1]
    expect(decl, 'SETTING_KEYS 선언을 못 찾음(리네임됐다면 이 테스트도 갱신할 것)').toBeTruthy()
    for (const key of READS) {
      expect(decl, `settings[${key}] 를 읽는데 SETTING_KEYS 에 없다 — undefined 가 온다`).toContain(key)
    }
  })

  it('🔒 계산한 커서는 전부 platform_settings 에 저장된다 — 통계 JSON 은 다음 회차가 안 읽는다', () => {
    const writes = /await writeSettings\(DB, \[([\s\S]*?)\n {2}\]\)/.exec(CODE)?.[1]
    expect(writes, 'writeSettings 블록을 못 찾음').toBeTruthy()
    const cursors = Array.from(new Set(Array.from(CODE.matchAll(/\bconst (next\w*Cursor)\b/g)).map(m => m[1]!)))
    expect(cursors.length, '커서 변수를 못 찾음').toBeGreaterThanOrEqual(3)
    for (const v of cursors) {
      expect(writes, `${v} 를 계산하고 저장하지 않는다 — 다음 회차가 같은 자리에서 다시 돈다`).toContain(v)
    }
  })

  it('🔒 집중 축 커서도 **처리된 접두**만큼만 민다 — 계획한 수만큼 밀면 안 돈 키워드를 건너뛴다', () => {
    expect(SRC).toMatch(/const focusDone = prefixDone\(focusPicks\)/)
    expect(SRC).toMatch(/nextFocusCursor = focusPool\.length \? \(focusCursor \+ focusDone\)/)
  })
})

/**
 * 🔀 **세 풀 라운드로빈** (2026-08-04 — 커버리지 붕괴 경보).
 *
 * 활성 399 중 **323개가 이틀째 미실행**이었다. 회차는 `planned 16 → processed 5`(예산 56/56 소진)인데
 * 옛 코드가 **집중 축을 무조건 앞머리**에 둬서 집중 4개가 앞자리를 먹고 일반 풀엔 1개만 남았다.
 * `prefixDone` 이 처리된 **앞부분만** 세므로 뒤 풀은 커서도 안 움직여 **같은 키워드를 무한 재실행**한다.
 *
 * ⚠️ 이 테스트가 못 보는 것: 실제 커버리지 회복 속도 — 그건 라이브 `never/2일+` 카운트로 판정한다.
 */
describe('🔀 세 풀 병합 — 잘릴 때 공평하게 잘린다', () => {
  const merge = (focus: number[], pri: number[], gen: number[]): number[] => {
    const out: number[] = []
    for (let i = 0; i < Math.max(focus.length, pri.length, gen.length); i++) {
      if (i < focus.length) out.push(focus[i])
      if (i < pri.length) out.push(pri[i])
      if (i < gen.length) out.push(gen[i])
    }
    return out
  }

  it('🔒 앞 5개(=실측 처리량) 안에 세 풀이 모두 들어간다', () => {
    const head = merge([101, 102, 103, 104], [201, 202, 203, 204, 205, 206], [301, 302, 303, 304, 305, 306]).slice(0, 5)
    expect(head.filter(x => x < 200), '집중').not.toHaveLength(0)
    expect(head.filter(x => x >= 200 && x < 300), '우선').not.toHaveLength(0)
    expect(head.filter(x => x >= 300), '일반').not.toHaveLength(0)
  })

  it('🔒 옛 프리픽스 방식이면 일반 풀이 앞 5개에서 밀려난다 — 이것이 고장의 형태였다', () => {
    const oldWay = [101, 102, 103, 104, 201, 301, 202, 302]
    expect(oldWay.slice(0, 5).filter(x => x >= 300), '일반이 0개 = 커서 동결').toHaveLength(0)
  })

  it('🔒 한 풀이 비어도 나머지가 순서를 유지한다(집중 고갈 시 자동 회수)', () => {
    expect(merge([], [201, 202], [301, 302])).toEqual([201, 301, 202, 302])
  })

  it('🔌 배선 — 집중 축 프리픽스로 회귀하지 않는다', () => {
    const src = readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-auto-collect.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')  // 주석 제외 — 근거 설명에 옛 코드가 인용된다
    expect(src).not.toMatch(/const picks[^=]*=\s*\[\.\.\.focusPicks\]/)
    expect(src).toMatch(/Math\.max\(focusPicks\.length, priPicks\.length, genPicks\.length\)/)
  })
})
