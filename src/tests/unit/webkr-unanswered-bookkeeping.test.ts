import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { searchNaverWeb, type SearchOutcome } from '@/features/marketing/api/webkr-search'
import { __resetNaverOpenapiBlock } from '@/features/marketing/api/naver-openapi-block'
import { __resetNaverCallMeter } from '@/features/marketing/api/naver-api-usage'

/**
 * 📮 **"결과 0건"과 "못 물어봤다"를 구분한다** — 2026-08-24 라이브 실측(429 하루 16건, 요청의 15%).
 *
 * ## 무엇이 문제였나 — 피해 경로를 정확히 짚는다
 * `searchNaverWeb` 은 429·타임아웃·쿼터 게이트에서 **빈 배열**을 돌려준다. 호출부가 그걸
 * `found_total = 0` 으로 적으면서 **`last_run_at` 도 함께 찍었다.**
 *
 * ⚠️ 처음에 이 사고를 *"차단이 업종을 은퇴시킨다"* 로 설명했는데 **그건 과장이었다.**
 *   은퇴 판정(`company-subcat-yield`)은 `found_total` 을 읽지 않고 **실제 저장된 행**에서만
 *   수율을 계산하므로, 429 로 0건이 나도 거짓 저수율 신호는 만들어지지 않는다.
 *
 * **진짜 피해는 신선도다.** `pickCompanyKeywords` 의 우선 픽 조건이 `last_run_at IS NULL` 이므로:
 * ```
 *   429 한 번 → last_run_at 찍힘 → "안 돌아본 키워드" 자격 상실 → 회전 뒤로 밀림
 *   ⇒ 2026-08-23 에 넣은 신규 1,410개가 **물어보지도 못한 채** 우선순위를 잃는다
 * ```
 *
 * ## 이 테스트가 **못** 막는 것
 * - `collect-company` 레인은 지도·카카오·웹문서를 한 배열에 합쳐 한 번 부기한다. 거기서 웹문서만
 *   429 여도 지도 쪽 실적이 있으므로 부기가 정당하다 — **그 레인은 의도적으로 손대지 않았다.**
 * - 타임아웃과 429 를 구분하지 못한다. 둘 다 "응답 없음"으로 같이 취급한다 —
 *   *"느리다"는 "없다"가 아니다* 라는 이 레포의 규칙상 **둘 다 증거가 아니어서** 같게 다루는 것이 맞다.
 */
const runSrc = readFileSync('src/features/marketing/api/webkr-collect.ts', 'utf8')
/** 🩸 주석을 뺀 본문으로만 판정한다 — 설명 주석 때문에 조건을 지워도 초록이 뜬 사고가 반복됐다. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

beforeEach(() => { __resetNaverOpenapiBlock(); __resetNaverCallMeter() })

const kw = { id: 1, keyword: '강남 마케팅 대행사', category: '대행사', subcategory: '마케팅 대행사', region: '강남', tier: 1 }

describe('응답 여부 회신', () => {
  it('🩸 429 는 responded 를 세우지 않는다 — 이게 부기 제외의 유일한 근거다', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 429, json: async () => ({}) } as unknown as Response))
    const outcome: SearchOutcome = {}
    const got = await searchNaverWeb('id', 'sec', kw, { left: 10 }, 1, outcome)
    expect(got).toEqual([])
    expect(outcome.responded, '거절은 증거가 아니다').toBeFalsy()
  })

  it('타임아웃/예외도 responded 아님 — "느리다"는 "없다"가 아니다', async () => {
    vi.stubGlobal('fetch', async () => { throw new Error('The operation was aborted due to timeout') })
    const outcome: SearchOutcome = {}
    await searchNaverWeb('id', 'sec', kw, { left: 10 }, 1, outcome)
    expect(outcome.responded).toBeFalsy()
  })

  it('🩸 결과 0건이어도 응답을 받았으면 responded — 그건 진짜 증거다', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, json: async () => ({ items: [] }) } as unknown as Response))
    const outcome: SearchOutcome = {}
    const got = await searchNaverWeb('id', 'sec', kw, { left: 10 }, 1, outcome)
    expect(got).toEqual([])
    expect(outcome.responded, '0건도 측정 결과다 — 부기해야 한다').toBe(true)
  })

  it('정상 수확도 responded', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: true, status: 200,
      json: async () => ({ items: [{ title: '어떤 대행사', link: 'https://example.co.kr/', description: '광고' }] }),
    } as unknown as Response))
    const outcome: SearchOutcome = {}
    const got = await searchNaverWeb('id', 'sec', kw, { left: 10 }, 1, outcome)
    expect(got.length).toBe(1)
    expect(outcome.responded).toBe(true)
  })
})

describe('레인 배선 — 부기 제외', () => {
  const loop = () => {
    const body = code(runSrc)
    return body.slice(body.indexOf('for (let i = 0; i < kws.length'), body.indexOf('const requireContact'))
  }

  it('🩸 응답 못 받은 키워드는 부기 앞에서 빠진다 — last_run_at 이 찍히면 신규 자격을 잃는다', () => {
    const l = loop()
    const guard = l.indexOf('if (!r.answered)')
    const book = l.indexOf('perKeyword.set')
    expect(guard, '부기 제외 가드를 못 찾았다(코드가 옮겼으면 이 앵커를 고칠 것)').toBeGreaterThan(-1)
    expect(book, '부기는 그 가드 뒤에').toBeGreaterThan(guard)
    // 🩸 "순서"만 보면 부기를 가드 **안에** 넣어도 통과한다(2026-08-24 에 같은 함정을 두 번 겪었다).
    const branch = l.match(/if \(!r\.answered\)\s*\{[^}]*\}/)
    expect(branch, '가드 분기를 못 찾았다').toBeTruthy()
    expect(branch![0], '가드 분기 안에서 부기하면 안 된다').not.toMatch(/perKeyword/)
    // 🩸 그리고 **실제로 빠져나가야** 한다. `continue` 를 지우면 분기 본문은 깨끗한데 아래로
    //   흘러내려 그대로 부기된다 — 되돌려-검증에서 이 주입이 초록으로 통과했다.
    expect(branch![0], '빠져나가지 않으면 아래 부기로 흘러내린다').toMatch(/continue/)
  })

  it('🩸 outcome 객체는 키워드마다 새로 만든다 — 폭 4 병렬에서 공유하면 서로 덮어쓴다', () => {
    const l = loop()
    // 그룹 map 콜백 **안에서** 생성돼야 한다(밖이면 4개가 한 객체를 나눠 쓴다).
    expect(l).toMatch(/group\.map\(async \([\s\S]{0,400}?const outcome: SearchOutcome = \{\}/)
  })

  it('응답 못 받은 키워드를 상태줄에 남긴다 — 안 남기면 "수율 0"과 구분이 안 된다', () => {
    const body = code(runSrc)
    expect(body).toMatch(/unanswered\.push\(r\.kw\.keyword\)/)
    expect(body).toMatch(/\n\s*unanswered,/)
  })

  it('건너뛴(은퇴) 키워드도 여전히 부기 제외 — 기존 보호가 유지된다', () => {
    const branch = loop().match(/if \(r\.skip\)\s*\{[^}]*\}/)
    expect(branch).toBeTruthy()
    expect(branch![0]).not.toMatch(/perKeyword/)
    expect(branch![0], '같은 이유로 여기도 빠져나가야 한다').toMatch(/continue/)
  })
})
