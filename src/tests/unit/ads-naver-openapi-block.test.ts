import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  OPENAPI_BLOCK_KEY, OPENAPI_BLOCK_TRIP, __resetNaverOpenapiBlock,
  flushOpenapiBlock, isOpenapiBlockStatus, naverOpenapiBlocked, noteOpenapiStatus, openapiBlockSnapshot,
} from '@/features/marketing/api/naver-openapi-block'
import { laneFetch } from '@/features/marketing/api/webkr-search'
import { __resetNaverCallMeter, pendingNaverCalls } from '@/features/marketing/api/naver-api-usage'

/**
 * 🚧 **네이버 오픈API 차단(429/403) 자동 방어** — 2026-08-23, 대표 "모두 다 하자".
 *
 * ## 왜 이 가드가 필요한가
 * `naver-crawl-block.ts` 는 **공개 페이지 크롤**(m.blog / rss)만 센다. 발굴 레인이 실제로 쏘는
 * `openapi.naver.com/v1/search/*` 는 **아무도 안 세고 있었다** — 방어가 0 이었다는 뜻이다.
 * 호출부는 `if (!res.ok) break` 라 429 와 "결과 없음"이 **구분되지 않고**, 실패 응답도 쿼터를 먹는다.
 * ⇒ 막힌 채로 계속 쏘면 ① 그날 허용량만 태우고 ② 수율 학습이 멀쩡한 키워드를 나쁘다고 배운다.
 *
 * ## 이 테스트가 **못** 막는 것 (과신 금지)
 * - 200 + 빈 `items`(소프트 스로틀) — 상태코드로 판정 불가. 일별 카운터로 사람이 대조할 뿐이다.
 * - 네이버가 실제로 어떤 상태코드를 주는지 — 그건 라이브에서만 안다(`ads_naver_openapi_block`).
 * - 차단 이후의 **복구 시점** — 다음 인보케이션은 모듈 스코프가 새로 시작하므로 자동으로 다시 쏜다.
 *   그게 의도다(영구 정지는 더 나쁜 실패다). 그래서 이 방어는 "회차 내 손실 차단"이지 백오프가 아니다.
 */
const runSrc = readFileSync('src/features/marketing/api/webkr-collect.ts', 'utf8')
const searchSrc = readFileSync('src/features/marketing/api/webkr-search.ts', 'utf8')
/** 🩸 주석을 뺀 본문으로만 판정한다 — 설명 주석에 남은 이름 때문에 조건을 지워도 초록이 뜬 사고가 반복됐다. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

beforeEach(() => { __resetNaverOpenapiBlock(); __resetNaverCallMeter() })

describe('판정 규칙 — 좁게 잡는다', () => {
  it('429/403 만 차단으로 센다 — 5xx·타임아웃은 "막혔다"가 아니다', () => {
    expect(isOpenapiBlockStatus(429)).toBe(true)
    expect(isOpenapiBlockStatus(403)).toBe(true)
    for (const s of [200, 400, 401, 404, 500, 502, 503, null, undefined]) {
      expect(isOpenapiBlockStatus(s), `${s} 는 차단이 아니다`).toBe(false)
    }
  })

  it('단발 403 으로는 안 멈춘다 — 연속 3회여야 우리가 막힌 것이다', () => {
    expect(OPENAPI_BLOCK_TRIP).toBeGreaterThanOrEqual(2)
    noteOpenapiStatus(403)
    expect(naverOpenapiBlocked()).toBe(false)
    noteOpenapiStatus(429); noteOpenapiStatus(429)
    expect(naverOpenapiBlocked()).toBe(true)
    expect(openapiBlockSnapshot()).toMatchObject({ blocked: 3, tripped: true, last_status: 429 })
  })

  it('성공 한 번이면 연속이 0 으로 — 회복을 즉시 인정한다(보수적으로 멈춰 있지 않는다)', () => {
    noteOpenapiStatus(429); noteOpenapiStatus(429)
    noteOpenapiStatus(200)
    noteOpenapiStatus(429); noteOpenapiStatus(429)
    expect(naverOpenapiBlocked(), '연속이 끊겼으므로 아직 아니다').toBe(false)
  })

  it('예외(null)는 연속을 늘리지도 지우지도 않는다 — 무응답은 차단의 증거도 회복의 증거도 아니다', () => {
    noteOpenapiStatus(429); noteOpenapiStatus(429)
    noteOpenapiStatus(null)
    expect(naverOpenapiBlocked()).toBe(false)
    noteOpenapiStatus(429)
    expect(naverOpenapiBlocked(), 'null 이 연속을 지우지 않았으므로 3번째에 확정').toBe(true)
  })
})

describe('laneFetch — 막히면 쏘지 않는다', () => {
  it('429 3연속이면 그 다음 호출은 fetch 자체를 안 하고 쿼터도 안 먹는다', async () => {
    let calls = 0
    vi.stubGlobal('fetch', async () => { calls += 1; return { ok: false, status: 429 } as unknown as Response })
    const url = 'https://openapi.naver.com/v1/search/webkr.json?query=x'
    for (let i = 0; i < OPENAPI_BLOCK_TRIP; i++) await laneFetch(url, {})
    expect(calls).toBe(OPENAPI_BLOCK_TRIP)
    const quotaBefore = pendingNaverCalls()

    const res = await laneFetch(url, {})
    expect(res, '막힌 뒤엔 null').toBeNull()
    expect(calls, 'fetch 를 더 쏘지 않는다').toBe(OPENAPI_BLOCK_TRIP)
    expect(pendingNaverCalls(), '실패분도 쿼터를 먹으므로 안 쏘면 안 센다').toBe(quotaBefore)
  })

  it('정상 응답은 연속을 지운다 — laneFetch 가 상태코드를 실제로 기록한다', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: true, status: 200 } as unknown as Response))
    await laneFetch('https://openapi.naver.com/v1/search/webkr.json?query=x', {})
    expect(openapiBlockSnapshot().ok).toBe(1)
  })

  it('🩸 게이트가 `noteNaverCall` **앞**에 있다 — 뒤에 있으면 막힌 채로 쿼터를 계속 깎는다', () => {
    const body = code(searchSrc)
    const gate = body.indexOf('naverOpenapiBlocked()')
    const meter = body.indexOf('noteNaverCall(url)')
    expect(gate).toBeGreaterThan(-1)
    expect(meter).toBeGreaterThan(-1)
    expect(gate, '차단 게이트가 계측 게이트보다 먼저').toBeLessThan(meter)
  })
})

describe('webkr 레인 배선', () => {
  it('🩸 루프 조건에 차단 검사가 있다 — 없으면 막힌 회차가 남은 조를 전부 헛돈다', () => {
    const loop = code(runSrc).split('\n').find(l => l.includes('i += WEBKR_CONCURRENCY') && l.includes('for ('))
    expect(loop, '회차 루프를 못 찾았다(코드가 옮겨졌으면 이 앵커를 고칠 것)').toBeTruthy()
    expect(loop!).toMatch(/!naverOpenapiBlocked\(\)/)
  })

  it('회차 스냅샷에 차단 관측을 싣고 flush 한다 — 안 남기면 "수율 0" 과 구분이 안 된다', () => {
    const body = code(runSrc)
    expect(body).toMatch(/openapi_block: openapiBlockSnapshot\(\)/)
    expect(body).toMatch(/await flushOpenapiBlock\(DB, Date\.now\(\)\)/)
  })

  it('🧾 부기 예약이 flush 2회(읽기+쓰기)를 덮는다 — 안 덮으면 관측이 예산 밖으로 밀려 조용히 실패', () => {
    const m = code(runSrc).match(/const BOOKKEEPING_RESERVE = (\d+)/)
    expect(m).toBeTruthy()
    expect(Number(m![1]), '차단 flush 2 를 더했으므로 10 이상').toBeGreaterThanOrEqual(10)
  })
})

describe('일별 누적', () => {
  const fakeDb = (existing?: string) => {
    const writes: Array<unknown[]> = []
    return {
      writes,
      prepare(sql: string) {
        const st = {
          args: [] as unknown[],
          bind(...v: unknown[]) { st.args = v; return st },
          async first<T>(): Promise<T | null> { return /SELECT value/.test(sql) && existing ? ({ value: existing } as unknown as T) : null },
          async run() { writes.push(st.args); return {} },
        }
        return st
      },
    }
  }

  it('같은 KST 기준일이면 더하고, 다른 날이면 새로 시작한다', async () => {
    const now = Date.UTC(2026, 7, 23, 1, 0, 0) // KST 2026-08-23 10:00
    noteOpenapiStatus(429); noteOpenapiStatus(200)
    const db = fakeDb(JSON.stringify({ day: '2026-08-23', blocked: 5, ok: 7 }))
    await flushOpenapiBlock(db, now)
    const saved = JSON.parse(String(db.writes[0][1]))
    expect(saved).toMatchObject({ day: '2026-08-23', blocked: 6, ok: 8 })
    expect(db.writes[0][0]).toBe(OPENAPI_BLOCK_KEY)

    __resetNaverOpenapiBlock()
    noteOpenapiStatus(429)
    const db2 = fakeDb(JSON.stringify({ day: '2026-08-22', blocked: 99, ok: 99 }))
    await flushOpenapiBlock(db2, now)
    expect(JSON.parse(String(db2.writes[0][1]))).toMatchObject({ day: '2026-08-23', blocked: 1, ok: 0 })
  })

  it('관측이 0 이면 D1 왕복 0 — 계측이 예산을 먹지 않는다', async () => {
    const db = fakeDb()
    await flushOpenapiBlock(db, Date.now())
    expect(db.writes.length).toBe(0)
  })

  it('D1 이 던져도 레인을 죽이지 않는다', async () => {
    noteOpenapiStatus(429)
    const boom = { prepare() { throw new Error('d1 down') } } as never
    await expect(flushOpenapiBlock(boom, Date.now())).resolves.toBeUndefined()
  })
})
