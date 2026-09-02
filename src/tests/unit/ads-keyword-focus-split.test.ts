import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { planKeywordSplit, mergeKeywordPicks, NAVER_COLLECT_ENRICH_MAX, YT_COLLECT_ENRICH_MAX, COLLECT_KEYWORDS_PER_ROUND, keywordsPerRoundCap, FOCUS_CATEGORIES, PRIORITY_CATEGORIES, ZERO_AXIS_CARRY, AXIS_CARRY_CLAMP, parseAxisCarry, serializeAxisCarry, judgeRotation } from '@/features/marketing/api/influencer-keyword-rotation'
import type { AxisCarry } from '@/features/marketing/api/influencer-keyword-rotation'
import { planRoundWidth, planRoundWidthForShape } from '@/features/marketing/api/influencer-keyword-order'
import { naverOnlyRoundCap, isNaverOnlyRound } from '@/features/marketing/api/influencer-round-width'
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
 *   ⚠️ 이 테스트가 못 보는 것: 배수 3:2:1 이 **타당한지**(라이브 수율은 코드 밖 사실이다).
 *   배수를 바꿀 땐 `AXIS_ROTATION_MULTIPLIER` 주석의 근거도 함께 갱신할 것.
 */
describe('planKeywordSplit — 집중/우선/일반 3분할', () => {
  /**
   * 🔁 **2026-08-05 정책 교체** — 옛 검사는 `nFocus === 4`(= 배치의 1/4)를 고정했다. 그 규칙이
   *   라이브에서 실제로 만든 결과는 *집중 축 키워드가 우선 축보다 7배 자주 도는 것*이었다
   *   (집중 19개가 4슬롯 vs 우선 315개가 9슬롯). 그래서 숙소 19개 중 12개가 **한 번도 못 돌았다.**
   *
   *   ⇒ 이제 고정하는 건 슬롯 수가 아니라 **한 바퀴 시간의 비율**이다. 그게 정책의 실체이고,
   *     풀 크기가 변해도 유지돼야 하는 값이다(옛 규칙은 풀이 커지면 조용히 무너졌다).
   */
  it('🔒 한 바퀴 시간이 배수대로 — 풀 크기가 달라도 유지된다', () => {
    const lap = (pool: number, slots: number) => (slots > 0 ? pool / slots : Infinity)
    for (const [f, p, g] of [[19, 315, 65], [50, 50, 50], [10, 400, 200]] as const) {
      const r = planKeywordSplit(60, f, p, g)
      const lf = lap(f, r.nFocus), lp = lap(p, r.nPri), lg = lap(g, r.nGen)
      // 집중은 우선보다 빨리 돌고, 우선은 일반보다 빨리 돈다(배수 3:2:1).
      expect(lf, `focus lap (${f}/${p}/${g})`).toBeLessThan(lp)
      expect(lp, `pri lap (${f}/${p}/${g})`).toBeLessThan(lg)
    }
  })

  /**
   * 🔁 **2026-08-12 정책 교체** — 옛 검사는 `nFocus >= 1 && nGen >= 1` 을 **매 회차** 요구했다
   *   (불변식 ④ 의 옛 형태 = 축마다 최소 1슬롯). 그 바닥은 폭 16 시절 세금 12% 였는데 폭 9 에서
   *   **22%** 가 되어, 라이브에서 본업 축(우선 358개 · 전체의 78% · 이메일 수율 24.4%)을 가장 느리게
   *   만들었다(축별 평균 미실행 우선 7.04일 vs 일반 3.26일 · 집중 1.34일).
   *
   *   ⇒ 지키려던 것은 "매 회차 1슬롯"이 아니라 **"작은 전략 축이 영구히 0 이 되지 않는 것"** 이다.
   *     이제 그것을 회차 간 이월(carry)로 보장하므로, 검사도 한 회차가 아니라 **연속 회차**를 본다.
   */
  it('🔒 작은 축이 영구 0 이 되지 않는다 — 몇 회차 안에 반드시 슬롯을 받는다', () => {
    let carry = ZERO_AXIS_CARRY
    const got = { focus: 0, general: 0 }
    const ROUNDS = 4
    for (let i = 0; i < ROUNDS; i++) {
      const r = planKeywordSplit(6, 19, 315, 65, undefined, carry)
      expect(r.nFocus + r.nPri + r.nGen, `round ${i} 총량`).toBe(6)
      got.focus += r.nFocus; got.general += r.nGen
      carry = r.carry
    }
    // 집중 지분 = 6×(19×3)/(19×3+315×2+65×1) = 0.47/회차 → 4회차면 최소 1회는 받는다.
    expect(got.focus, '집중 축이 4회차 내내 0 이면 전략 축이 꺼진 것').toBeGreaterThanOrEqual(1)
    expect(got.general, '일반 축이 4회차 내내 0 이면 순환에 구멍').toBeGreaterThanOrEqual(1)
  })

  /**
   * 🎯 **이 수리의 본체** — 장기 평균 회전율이 설계 배수(3:2:1)에 수렴하는가. 폭과 무관해야 한다:
   *   폭이 좁아질 때 조용히 뒤집히던 것이 정확히 이번 사고였다(폭 9 에서 일반이 설계의 3.1배).
   */
  it('🎯 키워드당 회전율이 배수 3:2:1 에 수렴한다 — 폭 6·9·16 전부', () => {
    for (const width of [6, 9, 16]) {
      let carry = ZERO_AXIS_CARRY
      const slots = { f: 0, p: 0, g: 0 }
      const POOLS = { f: 25, p: 358, g: 76 } // 라이브 실측 형상(2026-08-12)
      for (let i = 0; i < 200; i++) {
        const r = planKeywordSplit(width, POOLS.f, POOLS.p, POOLS.g, undefined, carry)
        slots.f += r.nFocus; slots.p += r.nPri; slots.g += r.nGen
        carry = r.carry
      }
      // 키워드당 회전율을 '우선=1' 로 정규화 → 설계값은 1.5 : 1 : 0.5.
      const rate = { f: slots.f / POOLS.f, p: slots.p / POOLS.p, g: slots.g / POOLS.g }
      const nf = rate.f / rate.p, ng = rate.g / rate.p
      expect(nf, `폭 ${width} focus 정규화(설계 1.5)`).toBeGreaterThan(1.35)
      expect(nf, `폭 ${width} focus 정규화(설계 1.5)`).toBeLessThan(1.65)
      expect(ng, `폭 ${width} general 정규화(설계 0.5)`).toBeGreaterThan(0.42)
      expect(ng, `폭 ${width} general 정규화(설계 0.5)`).toBeLessThan(0.58)
    }
  })

  /**
   * ⚠️ **carry 를 안 돌려주면(호출부가 저장을 빠뜨리면) 무슨 일이 나는가** — 매 회차 0 에서 시작하니
   *   비례 배분만 남아 작은 축이 **매 회차 0** 이 된다. 이 검사는 그 실패 모드를 명시적으로 고정해,
   *   "carry 배선은 있어도 되고 없어도 되는 장식"으로 오독되지 않게 한다(#930 집중 커서와 같은 클래스).
   */
  it('🕳️ carry 를 이월하지 않으면 작은 축이 영구 0 이 된다(배선이 필수인 이유)', () => {
    let zeroCarryFocus = 0
    for (let i = 0; i < 10; i++) {
      const r = planKeywordSplit(6, 19, 315, 65) // carry 미전달 = 매 회차 0 에서 시작
      zeroCarryFocus += r.nFocus
    }
    expect(zeroCarryFocus, 'carry 없이도 집중이 슬롯을 받으면 이 검사가 무의미해진다').toBe(0)
  })

  it('🔒 carry 는 무한히 자라지 않는다 — 빈 축은 적립하지 않고, 상한에서 잘린다', () => {
    // 집중 축이 비어 있는 동안 적립하면, 되살아나는 순간 몰아서 독식한다.
    let carry: AxisCarry = { focus: 3.9, priority: 0, general: 0 }
    for (let i = 0; i < 50; i++) carry = planKeywordSplit(9, 0, 300, 60, undefined, carry).carry
    expect(carry.focus, '빈 축은 이월 0').toBe(0)
    for (let i = 0; i < 200; i++) carry = planKeywordSplit(9, 25, 358, 76, undefined, carry).carry
    for (const v of [carry.focus, carry.priority, carry.general]) {
      expect(Number.isFinite(v)).toBe(true)
      expect(Math.abs(v)).toBeLessThanOrEqual(AXIS_CARRY_CLAMP)
    }
  })

  it('🔁 carry 직렬화 왕복 — 손상 입력은 0 으로(경보 아님)', () => {
    const round = parseAxisCarry(serializeAxisCarry({ focus: 0.75, priority: -0.5, general: 0.125 }))
    expect(round.focus).toBeCloseTo(0.75, 3)
    expect(round.priority).toBeCloseTo(-0.5, 3)
    expect(round.general).toBeCloseTo(0.125, 3)
    for (const bad of ['', null, undefined, 'nope', '1:2', 'NaN:NaN:NaN']) {
      const c = parseAxisCarry(bad as string | null | undefined)
      for (const v of [c.focus, c.priority, c.general]) expect(Number.isFinite(v)).toBe(true)
    }
    // 상한 밖 값은 잘린다(손상된 저장값이 한 축을 독식하지 못하게).
    expect(parseAxisCarry('999:0:0').focus).toBe(AXIS_CARRY_CLAMP)
  })

  /**
   * 🔌 **배선 가드** — 순수함수가 옳아도 호출부가 carry 를 읽거나 저장하지 않으면 불변식 ④ 는
   *   조용히 사라진다. 이 레포에서 정확히 그렇게 죽은 것이 집중 축 커서다(#930 — 통계 JSON 에는
   *   있는데 **읽기 키에 없어** 항상 0). 코드(주석 제거본)를 읽어 4가지를 확인한다.
   */
  it('🔌 호출부가 carry 를 읽기·전달·저장 전부 한다', () => {
    expect(CODE, 'SETTING_KEYS 에 carry 키가 없으면 읽기가 항상 undefined').toContain('AXIS_CARRY_KEY]')
    expect(CODE, 'parseAxisCarry 로 읽지 않으면 이월이 전달되지 않는다').toMatch(/parseAxisCarry\(\s*settings\[AXIS_CARRY_KEY\]\s*\)/)
    expect(CODE, 'planKeywordSplit 에 carry 를 안 넘기면 매 회차 0 에서 시작').toMatch(/planKeywordSplit\([^)]*axisCarry\s*\)/)
    expect(CODE, '마감 batch 에 저장하지 않으면 다음 회차가 옛 값을 읽는다').toMatch(/\[AXIS_CARRY_KEY,\s*serializeAxisCarry\(/)
  })

  /**
   * ⚠️ **처음 이 검사를 "다른 축의 슬롯이 안 줄어든다"로 썼다가 스스로 반박당했다.** 슬롯 총량이 고정이므로
   *   한 축이 커지면 다른 축 슬롯은 **실제로 줄어든다** — 그건 예산이 유한하다는 뜻이지 결함이 아니다.
   *   보존돼야 하는 건 슬롯이 아니라 **축 사이의 한 바퀴 시간 비율**이다: 풀이 커지면 모두가 같이 느려져야지,
   *   한쪽만 빨라지면 안 된다. 옛 규칙이 정확히 그 병이었다 — 집중은 고정 1/4 이라 다른 풀이 커질수록
   *   **혼자 상대적으로 빨라졌고**, 그래서 숙소가 굶었다.
   */
  it('🔒 큰 축이 커지면 모두 같이 느려진다 — 한쪽만 빨라지지 않는다(옛 규칙의 병)', () => {
    const lapOf = (r: { nFocus: number; nPri: number; nGen: number }, f: number, p: number, g: number) =>
      ({ f: f / r.nFocus, p: p / r.nPri, g: g / r.nGen })
    const before = lapOf(planKeywordSplit(60, 19, 315, 65), 19, 315, 65)
    const after = lapOf(planKeywordSplit(60, 19, 815, 65), 19, 815, 65)   // 우선 축에 500개 추가
    // 모든 축이 느려지거나 최소한 안 빨라진다(부동소수 여유 5%).
    expect(after.f).toBeGreaterThan(before.f * 0.95)
    expect(after.g).toBeGreaterThan(before.g * 0.95)
    // 그리고 순서(집중 < 우선 < 일반)는 그대로다.
    expect(after.f).toBeLessThan(after.p)
    expect(after.p).toBeLessThan(after.g)
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
    // ⚠️ 2026-08-12: destructuring 에 `carry` 가 추가됐다(불변식 ④ 이월). 이름 셋만 확인해
    //   앵커가 문자열 형태에 다시 묶이지 않게 한다 — 위 "낡은 지도" 주석과 같은 이유.
    expect(CODE).toMatch(/const \{[^}]*nFocus[^}]*nPri[^}]*nGen[^}]*\} = planKeywordSplit\(/)
    /**
     * ⚠️ **앵커가 이사했다**(2026-08-04, 600줄 래칫): 풀 구성이 `keyword-contact-yield.ts`
     *   `buildRotationPools` 로 추출됐다. 여기서 옛 문자열을 계속 찾으면 *낡은 지도*가 되고,
     *   실제로 이 테스트가 그렇게 빨간불을 냈다(순수 이동인데 실패). **지우지 말고 따라간다** —
     *   지키는 불변식(3분할·배타·집중 축 우선)은 그대로다.
     */
    expect(SRC).toMatch(/buildRotationPools\(kws, roundIndex, \{ focus:/)
    const POOLS = readFileSync(join(process.cwd(), 'src/features/marketing/api/keyword-contact-yield.ts'), 'utf8')
    expect(POOLS).toMatch(/focusPool: trim\(kws\.filter\(inFocus\)\)/)
    // 우선/일반 풀이 집중 축을 제외해야 배타가 성립한다.
    expect(POOLS).toMatch(/priPool: trim\(kws\.filter\(k => !inFocus\(k\) && inPri\(k\)\)\)/)
    expect(POOLS).toMatch(/genPool: trim\(kws\.filter\(k => !inFocus\(k\) && !inPri\(k\)\)\)/)
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
 * ## 🗑️ 그리고 2026-08-24 에 **커서 자체를 없앴다**
 * 위 수리(읽기/쓰기 배선)는 옳았지만 병의 절반만 고쳤다. 남은 절반: `pool[(cursor + i) % pool.length]` 의
 * `pool` 은 **회차마다 길이가 변한다**(저수율 억제가 5회차 중 4회차 솎아내고, 승격/은퇴가 멤버십을 바꾼다).
 * 길이가 변하면 같은 커서 값이 다른 키워드를 가리켜, 어떤 자리는 반복 방문되고 어떤 자리는 안 걸린다.
 * 라이브 실측(08-24): **집중 축 25개인데 최악 13.6일 미실행** — 하루 24회차면 못 도는 게 불가능한 크기다.
 * ⇒ 선택 기준을 위치 → **나이**(`pickStalest`)로 바꿨다. 건너뛰어진 키워드는 더 굶어서 스스로 앞으로 온다.
 *
 * ⚠️ 이 테스트가 못 보는 것: 실제 회전 속도(그건 예산과 라이브 수율의 문제다).
 *   여기서 고정하는 건 "읽는 키를 실제로 읽어오는가 · 회차 간 상태를 실제로 저장하는가 ·
 *   위치 커서가 돌아오지 않는가" 셋이다.
 */
describe('설정 키 — 읽는 키는 읽어오고, 회차 간 상태는 저장한다', () => {
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

  it('🔒 회차 간 상태(축 이월)는 platform_settings 에 저장된다 — 통계 JSON 은 다음 회차가 안 읽는다', () => {
    const writes = /await writeSettings\(DB, \[([\s\S]*?)\n {2}\]\)/.exec(CODE)?.[1]
    expect(writes, 'writeSettings 블록을 못 찾음').toBeTruthy()
    // carry 는 #930 과 **정확히 같은 실패 모드**를 갖는 유일한 잔존 상태다(안 쓰면 영구 0 → 불변식 ④ 소멸).
    expect(writes, 'nextAxisCarry 를 계산하고 저장하지 않는다 — carry 가 영구 0 이 된다')
      .toMatch(/AXIS_CARRY_KEY, serializeAxisCarry\(nextAxisCarry\)/)
  })

  /**
   * 🚫 **위치 커서 금지** — 되살리면 편식이 그대로 돌아온다. 코드가 이동하더라도 이 세 패턴
   *   (`% <풀>.length` 인덱싱 · `prefixDone` 전진)은 다시 나타나면 안 된다.
   */
  it('🚫 축 선택이 위치 커서로 되돌아가지 않는다', () => {
    for (const pool of ['focusPool', 'priPool', 'genPool']) {
      expect(CODE, `${pool} 을 인덱스로 순환하고 있다 — 풀 길이가 변하면 반드시 편식한다`)
        .not.toMatch(new RegExp(`${pool}\\[\\(`))
    }
    expect(CODE, 'prefixDone 커서 전진이 되살아났다 — 나이순 선택이 이미 같은 일을 한다')
      .not.toMatch(/prefixDone\(/)
  })

  it('⏳ 축 안의 순서는 나이순(pickStalest)이다 — 세 축 모두', () => {
    expect(CODE).toMatch(/focusPicks = pickStalest\(focusPool, nFocus/)
    expect(CODE).toMatch(/priPicks = pickStalest\(priPool, nPri/)
    expect(CODE).toMatch(/genPicks = pickStalest\(genPool, nGen/)
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
  // ⚠️ 사본이 아니라 **실제 함수**를 쓴다 — 사본을 테스트하면 구현이 갈라져도 초록이 뜬다.
  const merge = mergeKeywordPicks

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

  /**
   * ⚖️ **잘림이 비례해야 한다** (2026-08-11 — `starved` 경보 + 라이브 실측).
   *
   * 1:1:1 로 번갈아 놓으면 회차가 예산에서 끊길 때 **작은 축은 몫을 다 지키고 큰 축만 깎인다.**
   * 라이브 풀(집중 25 · 우선 358 · 일반 76)에서 `planKeywordSplit(9)` = 1/6/2 인데 예산이 5 에서
   * 끊겨, 우선 축(전체의 78%·본업)이 6개 중 4개를 잃고 **키워드 1개당 회전율이 설계의 1/5** 이 됐다
   * (24h 실측 focus:pri:gen = 7.3 : 1 : 3.2, 설계 목표 1.5 : 1 : 0.5).
   *
   * ⚠️ 완전 비례를 요구하진 않는다 — 정수 5개를 1:6:2 로 쪼갤 수 없고, `planKeywordSplit` 의
   *   최소 1슬롯 바닥(불변식 ④)도 의도된 대가다. 고정하는 것은 **"가장 큰 몫을 가진 축이
   *   앞부분에서도 가장 많아야 한다"** — 옛 구현은 이걸 깼다(우선 2 = 일반 2).
   */
  it('🔒 예산에서 잘려도 큰 몫 축이 앞부분에서 최다다 — 라이브 풀(1/6/2)', () => {
    const head = merge([11], [21, 22, 23, 24, 25, 26], [31, 32]).slice(0, 5)
    const nPri = head.filter(x => x >= 20 && x < 30).length
    const nGen = head.filter(x => x >= 30).length
    const nFocus = head.filter(x => x < 20).length
    expect(nPri, `우선 몫 6/9 인데 앞 5개에 ${nPri}개뿐 — 잘림이 비대칭이다`).toBeGreaterThan(nGen)
    expect(nPri).toBeGreaterThan(nFocus)
    expect(nPri, '옛 1:1:1 구현이 내던 값(2)으로 회귀하면 안 된다').toBeGreaterThanOrEqual(3)
  })

  it('🔒 비지 않은 축은 여전히 앞 5개 안에 들어온다(2026-08-04 불변식 유지)', () => {
    const head = merge([11], [21, 22, 23, 24, 25, 26], [31, 32]).slice(0, 5)
    expect(head.filter(x => x < 20), '집중').not.toHaveLength(0)
    expect(head.filter(x => x >= 30), '일반').not.toHaveLength(0)
  })

  it('🔒 풀 내부 상대 순서는 보존된다 — 어기면 prefixDone 커서가 깨진다', () => {
    const merged = merge([11, 12], [21, 22, 23], [31, 32, 33, 34])
    const only = (lo: number, hi: number) => merged.filter(x => x >= lo && x < hi)
    expect(only(10, 20)).toEqual([11, 12])
    expect(only(20, 30)).toEqual([21, 22, 23])
    expect(only(30, 40)).toEqual([31, 32, 33, 34])
    expect(merged).toHaveLength(9)   // 하나도 잃지 않는다
  })

  it('🔌 배선 — 집중 축 프리픽스로 회귀하지 않는다', () => {
    const src = readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-auto-collect.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')  // 주석 제외 — 근거 설명에 옛 코드가 인용된다
    expect(src).not.toMatch(/const picks[^=]*=\s*\[\.\.\.focusPicks\]/)
    // 🔄 2026-08-12: 네 번째 인자(lead)가 붙었다 — 앞자리를 회차마다 돌린다. 인자 유무는 느슨하게 보고,
    //   **회전이 실제로 배선됐는지**는 아래 별도 검사가 고정한다(여기서 고정하면 둘이 갈린다).
    expect(src).toMatch(/mergeKeywordPicks\(focusPicks, priPicks, genPicks/)
  })

  /**
   * 🔄 **앞자리 회전** (2026-08-12 — 라이브 커서 실측으로 원인 확정).
   *
   * 커서 전진은 `prefixDone`(처리된 **선행** 픽 수)인데 회차가 예산에서 잘리므로(계획 16 → 처리 7),
   * 뒤쪽 축은 매번 잘려 `prefixDone = 0` → 그 축 커서가 **영원히 제자리**다. 라이브 실측:
   * ```
   *   수리 전(집중이 앞)   집중 17 전진  ·  우선 5 정지   ·  일반 52 정지
   *   수리 후(우선이 앞)   우선 5→51 전진 ·  집중 1 정지   ·  일반 53 정지
   * ```
   * 앞자리가 바뀌자 움직이는 커서도 그대로 바뀌었다 — **어느 축이 앞서든 나머지는 굶는다.**
   *
   * ⚠️ 이 테스트가 못 보는 것: 회전만으로 충분한가(3회차당 +1 은 일반 풀 한 바퀴에 9일).
   *   그건 `planRoundWidth`(폭 맞춤)와 짝이고, 실제 회복 속도는 라이브 커서 값으로 판정한다.
   */
  it('🔒 lead 축의 첫 픽이 맨 앞에 온다 — 세 축 모두 앞자리를 받을 수 있어야 한다', () => {
    const F = [11, 12], P = [21, 22, 23, 24, 25, 26], G = [31, 32]
    expect(merge(F, P, G, 0)[0], '집중이 앞자리').toBe(11)
    expect(merge(F, P, G, 1)[0], '우선이 앞자리').toBe(21)
    expect(merge(F, P, G, 2)[0], '일반이 앞자리').toBe(31)
  })

  it('🔒 회전해도 몫·풀 내부 순서는 불변이다(잃는 픽 0)', () => {
    for (const lead of [-1, 0, 1, 2]) {
      const merged = merge([11, 12], [21, 22, 23], [31, 32, 33, 34], lead)
      expect(merged, `lead=${lead}`).toHaveLength(9)
      expect(merged.filter(x => x < 20)).toEqual([11, 12])
      expect(merged.filter(x => x >= 20 && x < 30)).toEqual([21, 22, 23])
      expect(merged.filter(x => x >= 30)).toEqual([31, 32, 33, 34])
    }
  })

  it('🔒 lead 없이 부르면 종전과 동일하다(기본값 회귀 방지)', () => {
    expect(merge([11], [21, 22, 23, 24, 25, 26], [31, 32]))
      .toEqual(merge([11], [21, 22, 23, 24, 25, 26], [31, 32], -1))
  })

  it('🔌 배선 — 앞자리를 회차마다 돌린다(고정 축 회귀 금지)', () => {
    expect(CODE).toMatch(/mergeKeywordPicks\(focusPicks, priPicks, genPicks,\s*roundIndex\s*%\s*3\)/)
  })

  it('🔒 빈 축을 lead 로 지정해도 깨지지 않는다', () => {
    expect(merge([], [21, 22], [31, 32], 0)).toEqual([21, 31, 22, 32])
  })
})

/**
 * 📉🧊 **수집 예산 회수 + 폭 동결** (2026-08-04 — 대표 *"수집과 보강 다 잘 되게 하면 안돼?"* → *"①만 진행"*).
 *
 * 라이브 실측이 근거다:
 * ```
 *   회차 예산 56 = yt 24 · naver 28 · cafe 0 · tistory 4 · save 0   ← 네이버가 54%
 *   미측정 행(순수 수집 결과) 이메일:  네이버 1.3%  vs  유튜브 22.4%
 *   블로그  유입 3,895/일  vs  측정 4,184/일  →  여유 +289 (백로그 19,963)
 * ```
 * ⇒ 네이버 수집 시점 보강은 **중복**(보강 레인이 100%를 25%로 만든다)이라 줄여도 손실이 없다.
 * ⇒ 하지만 남은 예산으로 **폭을 넓히면 안 된다** — 측정이 병목이라 백로그만 증가 반전한다.
 *
 * ⚠️ 이 테스트가 못 보는 것: 실제 이메일 손실률 — 라이브 `미측정 네이버 이메일%` 로 판정한다(1.3% 기준).
 */
describe('📉🧊 수집 예산 회수 + 폭 동결', () => {
  it('🔒 네이버 발굴 시점 보강은 최소값 — 0 이 아니라 1(경로 생존 확인용)', () => {
    expect(NAVER_COLLECT_ENRICH_MAX).toBe(1)
  })

  /**
   * 🔓 **2026-08-22 해제** — 이 잠금은 *조건부*였다: **"줄이려면 영상 스니펫의 실제 기여를 먼저 재라."**
   *   그 측정을 했고(회차 `yt_calls` · 보강 레인 커버율 · 분류율), 근거는 `YT_COLLECT_ENRICH_MAX`
   *   docblock 과 `ads-yt-enrich-budget.test.ts` 에 있다. 요지:
   *     · 이메일 몫은 **보강 레인이 96% 커버**(미측정 13.3% → 측정됨 38.4%) = 수집 시점엔 중복
   *     · 분류 몫은 레인이 **못 한다**(영상 제목을 안 본다) = 그래서 0 이 아니라 4, 대상도 분류 실패분만
   *   ⚠️ **잠금의 정신은 남긴다** — 리터럴 금지(조정 지점에 근거가 붙어 있어야 한다) + 8 로 회귀 금지.
   */
  it('🔓 유튜브 보강은 측정 후 4로 — 리터럴 8 로 되돌아가지 않는다', () => {
    const src = readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-auto-collect.ts'), 'utf8')
    expect(src, '상수를 써야 근거(docblock 실측)가 조정 지점에 남는다').toMatch(/enrichMax: YT_COLLECT_ENRICH_MAX/)
    expect(src, '리터럴 8 로 되돌리려면 반박할 실측이 필요하다').not.toMatch(/enrichMax: 8/)
    expect(YT_COLLECT_ENRICH_MAX).toBeLessThan(8)
  })

  it('🔒 폭은 승인된 범위 안에서만 — 조용한 상향/하향 둘 다 차단', () => {
    expect(COLLECT_KEYWORDS_PER_ROUND).toBeGreaterThanOrEqual(5)   // 실측 처리량 아래로 내리면 되레 후퇴
    // 상한 14 = 2026-09-02 대표 승인값("응 다 해줘" — 차단 blocked 0/ok 54,383 · 측정 94.7% 완료 실측 후).
    //   그 전 값은 9(2026-08-11). 올릴 때마다 네이버 호출이 함께 느는 일이라 **매번** 대표 판단 사항이고,
    //   승인 없이 조용히 올라가는 것을 이 못이 막는다.
    expect(COLLECT_KEYWORDS_PER_ROUND, '14 초과 상향은 대표 재승인 필요(네이버 차단 리스크)').toBeLessThanOrEqual(14)
  })

  it('🔒 env 로 재배포 없이 조정 가능(측정이 올라가면 즉시 푼다)', () => {
    expect(keywordsPerRoundCap({ ADS_COLLECT_KEYWORD_CAP: '20' })).toBe(20)
    expect(keywordsPerRoundCap({ ADS_COLLECT_KEYWORD_CAP: '999' })).toBe(40)   // 런어웨이 방지
    expect(keywordsPerRoundCap({ ADS_COLLECT_KEYWORD_CAP: 'abc' })).toBe(COLLECT_KEYWORDS_PER_ROUND)
    expect(keywordsPerRoundCap(undefined)).toBe(COLLECT_KEYWORDS_PER_ROUND)
  })

  it('🔌 배선 — 루프가 실제로 캡을 본다(상수만 있고 안 쓰면 무의미)', () => {
    const src = readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-auto-collect.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
    expect(src).toMatch(/if \(processedIds\.size >= roundCap\) break/)
    expect(src).toMatch(/enrichMax: NAVER_COLLECT_ENRICH_MAX/)
  })
})

/**
 * 📏 **회차 폭을 처리 능력에 맞춘다** (2026-08-12 — 기아의 근본 원인).
 *
 * 계획 16 · 처리 7 이면 9개는 매 회차 뽑혔다가 잘린다. 그 자체는 무해해 보이지만, 커서 전진이
 * `prefixDone`(처리된 **선행** 구간)이라 **잘리는 자리의 축은 커서가 안 밀리고 다음 회차에 같은
 * 키워드를 또 내놓는다.** 라이브에서 102개가 15일간 순번을 못 받은 이유다.
 * ⇒ 초과 계획은 "여유"가 아니라 **기아를 만드는 장치**였다.
 *
 * ⚠️ 이 테스트가 못 보는 것: 실제 커서 회복 속도(라이브 `ads_autocollect_cursor_*` 로 판정).
 */
describe('📏 planRoundWidth — 처리 능력에 맞춘 계획', () => {
  it('🔒 증거가 없으면 종전 값 그대로(모르는 상태에서 좁히지 않는다)', () => {
    expect(planRoundWidth([], 16)).toBe(16)
    expect(planRoundWidth([0, 0], 16), '0 은 증거가 아니다').toBe(16)
  })

  it('🔒 관측 중앙값 + 여유 20% 로 좁힌다 — 라이브(처리 7, 계획 16)', () => {
    expect(planRoundWidth([7, 7, 6, 8, 7], 16)).toBe(9)   // ceil(7*1.2)
  })

  it('🔒 처리량이 늘면 계획도 따라 오른다(자기 조율 — 한 방향 고착 금지)', () => {
    const low = planRoundWidth([5, 5, 5], 16)
    const high = planRoundWidth([13, 14, 13], 16)
    expect(high).toBeGreaterThan(low)
    expect(high).toBeLessThanOrEqual(16)               // hardMax 를 절대 안 넘는다
  })

  it('🔒 바닥이 있다 — 축이 셋이라 3 미만이면 한 축도 못 들어가는 회차가 생긴다', () => {
    expect(planRoundWidth([1, 1, 1], 16)).toBeGreaterThanOrEqual(3)
  })

  it('🔒 이상값에 안 무너진다', () => {
    expect(planRoundWidth([Number.NaN, -3, 7, 7], 16)).toBe(9)
    expect(planRoundWidth([7], 0)).toBe(0)
  })

  it('🔌 배선 — 회차 이력(funnel.recent)의 processed 로 폭을 정한다', () => {
    // ⚠️ 2026-08-12: 폭이 **형상별**(YT 동반/네이버 전용)로 갈려 `planRoundWidthForShape` 를 경유한다.
    //   앵커를 따라간다 — 옛 문자열을 계속 찾으면 조용히 통과하는 낡은 지도가 된다.
    expect(CODE).toMatch(/planRoundWidthForShape\(\s*\(prev\?\.funnel\?\.recent \|\| \[\]\)/)
    expect(CODE).toMatch(/const totalPick = planRoundWidthForShape\(/)
    expect(CODE, '고정 폭으로 회귀 금지').not.toMatch(/const totalPick = batch \+ NAVER_EXTRA/)
  })
})

/**
 * 🌙 **YT 쿼터 소진 회차의 폭 확장** (2026-08-12 대표 승인 "응 해").
 *
 *   라이브 실측: YT 쿼터가 떨어진 뒤의 회차는 `spent 29 / 56` 으로 끝났다 — 폭 9 에서 멈춰
 *   **예산 절반을 남기고** 종료. 네이버 전용은 키워드당 ~3.2 라 56 이면 ~17개를 돌 수 있다.
 *   ⚠️ 이 테스트가 못 보는 것: 넓힌 뒤 네이버가 **차단**하는지(`ads_naver_crawl_block.blocked`).
 *     그건 코드 밖 사실이라 배포 후 관측으로만 판정한다 — 차단이 뜨면 상수를 9 로 되돌린다.
 */
describe('회차 폭 — YT 쿼터 소진 회차만 예산까지 확장', () => {
  it('🔒 YT 가 살아 있는 회차의 폭 = 승인값(2026-09-02 부터 14) — 코드와 env 기본값이 갈리면 안 된다', () => {
    expect(COLLECT_KEYWORDS_PER_ROUND).toBe(14)
    expect(keywordsPerRoundCap({}), 'env 미설정 시 상수와 같아야 한다(갈리면 라이브가 문서와 다르게 돈다)').toBe(14)
  })

  it('🌙 네이버 전용 회차는 더 넓다 — 좁아지는 방향은 구조적으로 불가', () => {
    expect(naverOnlyRoundCap({})).toBeGreaterThan(keywordsPerRoundCap({}))
    // env 로 9 미만을 넣어도 YT 회차보다 좁아지지 않는다(그러면 이 수리가 무의미해진다).
    expect(naverOnlyRoundCap({ ADS_COLLECT_KEYWORD_CAP_NAVER_ONLY: '3' })).toBeLessThanOrEqual(40)
    expect(naverOnlyRoundCap({ ADS_COLLECT_KEYWORD_CAP_NAVER_ONLY: '999' })).toBe(40) // 런어웨이 뚜껑
  })

  it('🌙 네이버 전용 판정 — 쿼터가 이 회차분을 못 감당하면 전용', () => {
    const base = { hasYouTube: true, ytPages: 1, ytBudgetTotal: 90 }
    expect(isNaverOnlyRound({ ...base, ytSearchUsed: 0 })).toBe(false)
    expect(isNaverOnlyRound({ ...base, ytSearchUsed: 89 })).toBe(false) // 89+1 = 90 ≤ 90 → 아직 된다
    expect(isNaverOnlyRound({ ...base, ytSearchUsed: 90 })).toBe(true)  // 90+1 > 90 → 전용
    // 키가 없으면 항상 전용(쿼터와 무관).
    expect(isNaverOnlyRound({ ...base, hasYouTube: false, ytSearchUsed: 0 })).toBe(true)
  })

  /**
   * 📐 **형상별 계획 폭** — 두 형상을 한 중앙값에 섞으면 둘 다 틀린다. 이 검사가 그 혼합을 막는다.
   *   섞으면: YT 회차는 과대 계획(#1142 가 고친 커서 기아 재발) · 네이버 회차는 과소 계획(수리 무효).
   */
  it('📐 계획 폭이 같은 형상의 회차만 본다 — 섞으면 둘 다 틀린다', () => {
    const hist = [
      { processed: 9, yt: { spend: 37 } }, { processed: 9, yt: { spend: 35 } }, { processed: 8, yt: { spend: 40 } },
      { processed: 17, yt: { spend: 0 } }, { processed: 18, yt: { spend: 0 } }, { processed: 16, yt: { spend: 0 } },
    ]
    const ytRound = planRoundWidthForShape(hist, false, 40)
    const nbRound = planRoundWidthForShape(hist, true, 40)
    expect(nbRound, '네이버 전용 회차가 YT 회차보다 넓어야 한다').toBeGreaterThan(ytRound)
    expect(ytRound, 'YT 회차는 ~9 처리 이력 기준(중앙값 9 × 1.2)').toBeLessThanOrEqual(12)
    expect(nbRound, '네이버 회차는 ~17 처리 이력 기준').toBeGreaterThanOrEqual(17)
    // 섞은 중앙값(~12.5×1.2≈15)은 둘 중 어느 것도 아니다 — 그게 섞으면 안 되는 이유다.
    const mixed = planRoundWidth(hist.map(h => h.processed), 40)
    expect(mixed).not.toBe(ytRound)
    expect(mixed).not.toBe(nbRound)
  })

  /**
   * 🧨 **부트스트랩 교착 회귀 가드** — 2026-08-13 라이브 판정에서 실제로 당한 결함이다.
   *   첫 구현은 같은 형상 이력이 없을 때 **섞인 전체 이력**으로 폴백했다. 그러면 네이버 전용 회차를
   *   넓히려면 네이버 전용 이력이 필요한데 넓혀진 적이 없어 그 이력이 생길 수 없다 → **영구 미발동**.
   *   실측(08-13 15:00): yt지출 0 인 회차가 `planned 9 · spent 34/56` 로 끝났다(예산 22 유휴).
   *   ⇒ 다른 형상의 관측은 이 형상의 증거가 아니다. 증거가 없으면 hardMax(원래 규약).
   */
  it('🧨 네이버 전용 이력이 없어도 좁은 혼합 이력으로 폴백하지 않는다(부트스트랩 교착)', () => {
    const onlyYt = [{ processed: 9, yt: { spend: 37 } }, { processed: 9, yt: { spend: 35 } }, { processed: 7, yt: { spend: 34 } }]
    // 혼합 폴백이면 median 9×1.2 = 11 (또는 더 좁게) 로 떨어져 **넓혀지지 않는다**.
    expect(planRoundWidthForShape(onlyYt, true, 40), '증거 없음 → hardMax 여야 발동이 가능하다').toBe(40)
    // 반대로 YT 형상은 자기 이력이 있으니 그걸로 좁게 계획한다(과대계획 = #1142 기아 방지).
    expect(planRoundWidthForShape(onlyYt, false, 40)).toBeLessThanOrEqual(12)
    expect(planRoundWidthForShape([], true, 40)).toBe(40) // 증거 전무 → hardMax(종전 규약)
  })

  it('🔌 호출부가 형상 판정과 폭 분기를 실제로 쓴다', () => {
    expect(CODE, '네이버 전용 판정을 SSOT 로 하지 않으면 조건이 조용히 갈라진다')
      .toMatch(/isNaverOnlyRound\(\{\s*hasYouTube/)
    expect(CODE, '폭 분기가 없으면 유휴 예산이 그대로 남는다')
      .toMatch(/naverOnlyRound \? naverOnlyRoundCap\(env\) : keywordsPerRoundCap\(env\)/)
    expect(CODE, '계획 폭이 형상별 이력을 안 보면 두 형상이 섞인다')
      .toMatch(/planRoundWidthForShape\(/)
  })
})

/**
 * 🩹 **회복 중에는 안 울린다** (2026-08-13 — 대표 *"굳이 필요없는 알람은 없애줘"*).
 *
 * `starved` 는 `oldestDays / cycleDays` 로 판정하는데 `oldestDays` 는 **최악값 하나**라,
 * 밀린 키워드가 자기 차례를 기다리는 동안 계속 커진다. 즉 수리가 먹혀 밀린 무리를 갚는 며칠 내내
 * 경보가 울린다. 라이브 실측(커서 동결 수리 직후): **7일+ 밀린 수 107 → 60(−44%)** 인데
 * `worstCycles` 는 3.46 으로 오히려 올랐다.
 *
 * ⇒ 고장이면 밀린 무리가 **늘고**, 회복이면 **준다**. 그 방향만 본다(임계가 아니라 추세).
 * ⚠️ 이 테스트가 못 보는 것: 7일이라는 관측창이 타당한가(한 바퀴가 7일을 넘으면 의미가 흐려진다).
 *   그 땐 창을 한 바퀴 배수로 바꿔야 하고, 그건 라이브 `cycleDays` 를 보고 판단할 일이다.
 */
describe('🩹 judgeRotation — 회복 중 경보 억제', () => {
  const base = { active: 459, ran24h: 92, avgDays: 3 }   // 한 바퀴 5.0일

  it('🔒 밀린 무리가 줄고 있으면 starved 를 내리지 않는다(라이브 실측 형상)', () => {
    const v = judgeRotation({ ...base, oldestDays: 17.25, behindNow: 60, behindPrev: 107 })
    expect(v.worstCycles).toBeGreaterThan(3)      // 임계는 여전히 넘는다
    expect(v.stalled, '회복 중인데 경보').toBe(false)
    expect(v.recovering).toBe(true)
  })

  it('🔒 밀린 무리가 늘거나 그대로면 그대로 울린다 — 진짜 고장을 덮으면 안 된다', () => {
    expect(judgeRotation({ ...base, oldestDays: 17.25, behindNow: 120, behindPrev: 107 }).reason).toBe('starved')
    expect(judgeRotation({ ...base, oldestDays: 17.25, behindNow: 107, behindPrev: 107 }).reason).toBe('starved')
  })

  it('🔒 직전 표본이 없으면 억제하지 않는다 — 모르면 침묵하지 않는다', () => {
    expect(judgeRotation({ ...base, oldestDays: 17.25 }).reason).toBe('starved')
    expect(judgeRotation({ ...base, oldestDays: 17.25, behindNow: 60 }).reason).toBe('starved')
  })

  it('🔒 순환 정지(stopped)는 추세와 무관하게 항상 울린다', () => {
    const v = judgeRotation({ ...base, ran24h: 0, oldestDays: 30, behindNow: 1, behindPrev: 999 })
    expect(v.reason).toBe('stopped')
    expect(v.stalled).toBe(true)
  })

  it('🔌 배선 — 경보가 밀린 무리를 세고 직전 표본과 비교한다', () => {
    const src = readFileSync(join(process.cwd(), 'src/features/marketing/api/collect-health-alert.ts'), 'utf8')
    expect(src).toMatch(/AS behind7/)
    expect(src).toMatch(/behindNow: rot\?\.behind7/)
    expect(src).toMatch(/writeSetting\(DB, BEHIND_KEY/)
  })
})
