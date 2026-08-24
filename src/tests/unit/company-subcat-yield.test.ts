import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  SUBCAT_EVIDENCE_MIN, SUBCAT_OK_RATE, SUBCAT_PROBE_EVERY, SUBCAT_PROMOTE_EVIDENCE, SUBCAT_PROMOTE_RATE,
  isLowYieldSubcat, isPromotableSubcat, nextPromotion, parsePromoteState, parseSubcatYield,
  recomputeSubcatYield, suppressCompanyPool, suppressedSubcats,
} from '@/features/marketing/api/company-subcat-yield'
import {
  BACKOFF_BASE_MS, BACKOFF_MAX_MS, __resetNaverOpenapiBlock, backoffUntil, isBackedOff,
  noteOpenapiStatus, parseOpenapiBlock,
} from '@/features/marketing/api/naver-openapi-block'

/**
 * 🎯 **업종 자동 은퇴·승격 + 회차 간 백오프** — 2026-08-24 대표 *"남은거 다 해줘"*
 * (직전 질문 *"이제는 영구적이야?"* 에 제가 지목한 마지막 갭).
 *
 * ## 무엇이 영구하지 않았나
 * 2026-08-23 에 업종을 **손으로 재서** 골랐다. 그 판단은 맞았지만 다시 재는 장치가 없어,
 * 수율이 변해도 아무 신호가 없고 다음에도 사람이 또 재야 했다.
 *
 * ## 이 테스트가 **못** 막는 것 (과신 금지)
 * - 문턱값(15%/25%)이 옳은지 — 그건 라이브 분포가 정하는 것이고, 여기서는 *일관성*만 본다.
 * - 승격이 실제로 수집을 늘리는지 — 네이버 색인에 달렸다. 배포 후 `saved_total` 로만 안다.
 * - 소프트 스로틀(200+빈 결과) 판정 — **원리적으로 불가능**하다. `zero_streak` 는 관측치일 뿐이고
 *   키워드가 마른 경우와 구분하지 못한다. 그래서 아무 자동 판단에도 쓰지 않는다.
 */
const yieldSrc = readFileSync('src/features/marketing/api/company-subcat-yield.ts', 'utf8')
const runSrc = readFileSync('src/features/marketing/api/webkr-collect.ts', 'utf8')
const collectSrc = readFileSync('src/features/marketing/api/company-collect.ts', 'utf8')
/** 🩸 주석을 뺀 본문으로만 판정한다 — 설명 주석 때문에 조건을 지워도 초록이 뜬 사고가 반복됐다. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const row = (s: string, tried: number, got: number) => ({ s, tried, got })

describe('은퇴 판정 — 모르는 것을 벌주지 않는다', () => {
  it('🩸 증거가 부족하면 절대 은퇴시키지 않는다 — 갓 넣은 업종이 낙인찍히면 탐색이 죽는다', () => {
    expect(isLowYieldSubcat(row('신규', SUBCAT_EVIDENCE_MIN - 1, 0)), '39건은 판정 불가').toBe(false)
    expect(isLowYieldSubcat(row('신규', SUBCAT_EVIDENCE_MIN, 0)), '40건 0%는 저수율').toBe(true)
  })

  it('실측 분포와 일치한다 — 간판 9.4%는 은퇴, 상권분석 20%는 유지', () => {
    expect(isLowYieldSubcat(row('간판·광고물 제작', 64, 6))).toBe(true)
    expect(isLowYieldSubcat(row('상권분석', 225, 45))).toBe(false)
    expect(isLowYieldSubcat(row('마케팅 대행사', 397, 125))).toBe(false)
  })

  it('🩸 탐침 회차엔 아무도 안 막는다 — 없으면 증거가 영영 안 갱신돼 영구 배제가 된다', () => {
    const blob = { day: 'x', rows: [row('간판·광고물 제작', 64, 6)] }
    expect(suppressedSubcats(blob, 1).size).toBe(1)
    expect(suppressedSubcats(blob, SUBCAT_PROBE_EVERY).size, '탐침 회차').toBe(0)
    expect(SUBCAT_PROBE_EVERY).toBeGreaterThan(1)
  })

  it('표가 없거나 깨졌으면 아무도 안 막는다 — 추측하지 않는다', () => {
    expect(suppressedSubcats(null, 1).size).toBe(0)
    expect(parseSubcatYield('{쓰레기')).toBeNull()
    expect(parseSubcatYield(JSON.stringify({ day: 'd', rows: [{ s: 'a', tried: 5, got: 1 }] }))?.rows[0].tried).toBe(5)
  })
})

describe('풀 억제 — 회전이 멈추면 안 된다', () => {
  const pool = [
    { subcategory: '간판·광고물 제작', fresh: true },
    { subcategory: '간판·광고물 제작' },
    { subcategory: '마케팅 대행사' },
  ]

  it('🩸 미실행(fresh) 키워드는 절대 안 막는다 — 새 지역을 시험할 기회가 사라진다', () => {
    const idx = suppressCompanyPool(pool, new Set(['간판·광고물 제작']))
    expect(idx.has(0), 'fresh 는 통과').toBe(false)
    expect(idx.has(1), '회전 항목만 차단').toBe(true)
  })

  it('🩸 회전 몫이 전부 막히면 억제를 포기한다 — 빈 회차는 축을 통째로 멈춘다', () => {
    const all = [{ subcategory: 'X' }, { subcategory: 'X' }]
    expect(suppressCompanyPool(all, new Set(['X'])).size).toBe(0)
  })

  it('막을 게 없으면 빈 집합', () => {
    expect(suppressCompanyPool(pool, new Set()).size).toBe(0)
  })
})

describe('승격 — 은퇴보다 높은 문턱(이력현상)', () => {
  it('🩸 승격 문턱이 은퇴 문턱보다 높다 — 같으면 경계 업종이 승격↔은퇴를 반복한다', () => {
    expect(SUBCAT_PROMOTE_RATE).toBeGreaterThan(SUBCAT_OK_RATE)
    expect(SUBCAT_PROMOTE_EVIDENCE).toBeGreaterThan(SUBCAT_EVIDENCE_MIN)
  })

  it('은퇴와 승격이 동시에 참일 수 없다', () => {
    for (const r of [row('a', 100, 10), row('a', 100, 20), row('a', 100, 30), row('a', 200, 50)]) {
      expect(isLowYieldSubcat(r) && isPromotableSubcat(r)).toBe(false)
    }
  })

  it('증거가 모자라면 수율이 높아도 승격 안 한다', () => {
    expect(isPromotableSubcat(row('a', SUBCAT_PROMOTE_EVIDENCE - 1, 999))).toBe(false)
    expect(isPromotableSubcat(row('a', SUBCAT_PROMOTE_EVIDENCE, SUBCAT_PROMOTE_EVIDENCE))).toBe(true)
  })

  it('한 번에 하나씩, 진행 중인 것을 먼저 끝낸다 — 동시에 넣으면 그 회차 수집이 굶는다', () => {
    const cands = [
      { kw: 'A', category: 'c', subcategory: 'SA', tier: 2 },
      { kw: 'B', category: 'c', subcategory: 'SB', tier: 2 },
    ]
    const blob = { day: 'x', rows: [row('SA', 200, 100), row('SB', 200, 100)] }
    expect(nextPromotion(cands, blob, { done: [], cursor: 0, kw: null })?.kw, '첫 후보').toBe('A')
    expect(nextPromotion(cands, blob, { done: [], cursor: 5, kw: 'B' })?.kw, '진행 중 우선').toBe('B')
    expect(nextPromotion(cands, blob, { done: ['A'], cursor: 0, kw: null })?.kw, '끝난 건 건너뜀').toBe('B')
    expect(nextPromotion(cands, null, { done: [], cursor: 0, kw: null }), '표 없으면 승격 없음').toBeNull()
  })

  it('진행값이 깨져도 처음부터 안전하게 — INSERT OR IGNORE 라 재실행이 무해하다', () => {
    expect(parsePromoteState('{깨짐')).toEqual({ done: [], cursor: 0, kw: null })
    expect(code(collectSrc)).toMatch(/INSERT OR IGNORE INTO ad_company_keywords/)
  })
})

describe('수율 재계산 — 분모가 이 설계의 핵심', () => {
  const fakeDb = (results: unknown[]) => {
    const writes: unknown[][] = []
    let sql = ''
    return {
      writes, get sql() { return sql },
      prepare(q: string) {
        sql += q
        const st = {
          args: [] as unknown[],
          bind(...v: unknown[]) { st.args = v; return st },
          async all<T>() { return { results: results as T[] } },
          async run() { writes.push(st.args); return {} },
        }
        return st
      },
    }
  }

  it('🩸 분모는 크롤을 실제로 가 본 행만 — COUNT(*) 를 쓰면 새 업종이 무조건 0%로 낙인찍힌다', async () => {
    const db = fakeDb([{ s: 'A', tried: 100, got: 30 }])
    await recomputeSubcatYield(db as never, Date.UTC(2026, 7, 24, 1))
    // 🩸 SQL 전체에서 찾으면 안 된다 — `got` 쪽에도 같은 조건이 있어 `tried` 를 COUNT(*) 로 바꿔도 통과한다.
    //   (되돌려-검증에서 실제로 그렇게 통과했다.) **분모 표현식 자체**를 앵커한다.
    expect(db.sql, '분모 = 크롤을 가 본 행').toMatch(/SUM\(CASE WHEN enrich_checked_at IS NOT NULL THEN 1 ELSE 0 END\) AS tried/)
    expect(db.sql, '빈 문자열도 연락처가 아니다').toMatch(/email <> ''/)
    expect(db.sql, '이 레인의 성적으로만 심판한다').toMatch(/source = 'webkr'/)
  })

  it('집계가 비면 옛 표를 덮어쓰지 않는다', async () => {
    const db = fakeDb([])
    expect(await recomputeSubcatYield(db as never, Date.now())).toBeNull()
    expect(db.writes.length).toBe(0)
  })

  it('D1 이 던져도 레인을 죽이지 않는다', async () => {
    const boom = { prepare() { throw new Error('down') } }
    await expect(recomputeSubcatYield(boom as never, Date.now())).resolves.toBeNull()
  })
})

describe('회차 간 백오프', () => {
  beforeEach(() => __resetNaverOpenapiBlock())

  it('연속 확정마다 길어지되 상한에서 멈춘다', () => {
    const now = 1_000_000
    expect(backoffUntil(1, now) - now).toBe(BACKOFF_BASE_MS)
    expect(backoffUntil(2, now) - now).toBe(BACKOFF_BASE_MS * 2)
    expect(backoffUntil(99, now) - now, '상한').toBe(BACKOFF_MAX_MS)
    expect(BACKOFF_MAX_MS).toBeLessThanOrEqual(12 * 60 * 60_000) // 반나절 넘게 자면 그게 더 큰 손해
  })

  it('until 이 지나면 스스로 풀린다 — 영구 정지가 아니다', () => {
    expect(isBackedOff({ until: 2000 }, 1000)).toBe(true)
    expect(isBackedOff({ until: 2000 }, 3000)).toBe(false)
    expect(isBackedOff({}, 3000), '값이 없으면 백오프 없음').toBe(false)
    expect(isBackedOff(parseOpenapiBlock('{깨짐'), 3000)).toBe(false)
  })

  it('🩸 레인이 백오프를 실제로 읽고 회차를 건너뛴다', () => {
    const body = code(runSrc)
    expect(body).toMatch(/isBackedOff\(blockBlob, Date\.now\(\)\)/)
    expect(body, '설정 읽기에 얹어 왕복 추가 0').toMatch(/armNaverAndReadSettings\(DB, \[[^\]]*OPENAPI_BLOCK_KEY/)
  })
})

describe('레인 배선', () => {
  it('🩸 건너뛴 자리도 커서에서는 소비된다 — 안 그러면 회전이 제자리에 갇힌다', () => {
    const body = code(runSrc)
    const loop = body.slice(body.indexOf('for (let i = 0; i < kws.length'), body.indexOf('const requireContact'))
    expect(loop, 'usedKw 는 skip 여부와 무관하게 push').toMatch(/usedKw\.push\(r\.kw\)\s*\n[\s\S]{0,200}?if \(r\.skip\)/)
  })

  it('🩸 건너뛴 키워드는 부기(0건)를 남기지 않는다 — 자기가 만든 증거로 자기를 정당화하게 된다', () => {
    const body = code(runSrc)
    const loop = body.slice(body.indexOf('for (let i = 0; i < kws.length'), body.indexOf('const requireContact'))
    // 🩸 "순서"로 보면 안 된다 — 부기를 skip 분기 **안에** 넣어도 텍스트상으론 뒤에 있다.
    //   (되돌려-검증에서 실제로 그렇게 통과했다.) **분기 본문 자체**에 부기가 없어야 한다.
    const branch = loop.match(/if \(r\.skip\)\s*\{[^}]*\}/)
    expect(branch, 'skip 분기를 못 찾았다(코드가 옮겨졌으면 이 앵커를 고칠 것)').toBeTruthy()
    expect(branch![0], 'skip 분기 안에서 부기하면 안 된다').not.toMatch(/perKeyword/)
    expect(loop, '부기는 skip 을 통과한 뒤에만').toMatch(/continue \}\s*\n[\s\S]*?perKeyword\.set/)
  })

  it('수율 표는 하루 한 번만 다시 센다 — 매 회차 훑으면 예산을 계측에 쓴다', () => {
    expect(code(runSrc)).toMatch(/yieldBlob\.day !== kstDay\(Date\.now\(\)\)/)
  })

  it('승격은 본 시드가 끝난 뒤에만 — 첫 시드와 예산을 다투면 둘 다 느려진다', () => {
    expect(code(collectSrc)).toMatch(/< buildKeywordRows\(\)\.length\) return spent/)
  })

  it('문서가 한계를 명시한다 — 새 업종어를 발명하지는 못한다(사람의 일로 남는다)', () => {
    expect(yieldSrc).toMatch(/발명/)
  })
})
