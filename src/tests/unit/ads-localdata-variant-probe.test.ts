/**
 * 🔬 인허가 레인 — 요청 형태 자가 진단(프로브) 통합 계약 (2026-07-29 신설).
 *
 *   배경: 예산 문제를 고치고 나니 남은 벽은 상대편이었다 — `API: HTTP 500 — Unexpected errors`, `found: 0`.
 *   500 은 본문에 원인 코드가 없고, 이 환경은 `apis.data.go.kr` CONNECT 가 막혀 직접 확인이 불가능하다.
 *   ⇒ 추측으로 URL 을 바꾸는 대신 **라이브가 후보를 고르게** 했다. 이 파일이 고정하는 건 그 장치가
 *   ① 실제로 스스로 회복하고 ② 회복한 답을 기억하고 ③ **키를 흘리지 않는가** 이다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runLocalDataCollect, runLocalDataBackfill } from '@/features/marketing/api/localdata-collect'
import { LICENSE_VARIANTS } from '@/features/marketing/api/license-url'

/**
 * ⚠️ 2026-08-03: 아래 픽스처들은 원래 **`v1`(pageIndex/pageSize=500)이 기본**이라는 전제를 리터럴로
 *   박고 있었다. 라이브 실측으로 기본이 `v4`(pageNo/numOfRows)로 바뀌자 네 개가 한꺼번에 깨졌는데,
 *   깨진 건 동작이 아니라 **앵커**였다 — 지켜야 할 계약은 *"현행이 실패하면 후보를 찔러 행을 주는
 *   형태로 갈아타고 그 답을 기억한다"* 이지 "그 형태의 이름이 v2 다" 가 아니다.
 *   ⇒ 기본/대안을 **목록에서 끌어와** 순서가 또 바뀌어도 계약만 남게 한다.
 */
const DEF = LICENSE_VARIANTS[0]   // 현행(기본)
const ALT = LICENSE_VARIANTS[1]   // 프로브가 다음으로 찌를 후보
/** 현행 형태의 요청인가 — 픽스처가 "현행만 실패"를 만들 때 쓴다. */
const isDefaultShape = (u: string) => u.includes(`${DEF.sizeParam}=${DEF.size}`)

const VARIANT_KEY = 'ads_localdata_variant'
const SERVICE_KEY = 'super-secret-key-value'

function makeDB(initial: Record<string, string> = {}) {
  const kv: Record<string, string> = { ...initial }
  const prepare = (sql: string) => {
    let args: unknown[] = []
    const api = {
      bind: (...a: unknown[]) => { args = a; return api },
      first: async () => {
        if (/FROM platform_settings/i.test(sql)) { const v = kv[String(args[0])]; return v == null ? null : { value: v } }
        if (/COUNT\(\*\)/i.test(sql)) return { n: 0 }
        return null
      },
      run: async () => {
        if (/INSERT OR REPLACE INTO platform_settings/i.test(sql)) kv[String(args[0])] = String(args[1])
        if (/DELETE FROM platform_settings/i.test(sql)) delete kv[String(args[0])]
        return { meta: { changes: 1 } }
      },
      all: async () => {
        if (/FROM platform_settings/i.test(sql)) return { results: args.map(k => ({ key: String(k), value: kv[String(k)] })).filter(r => r.value != null) }
        return { results: [] }
      },
    }
    return api
  }
  return { db: { prepare, batch: async () => [] } as unknown as D1Database, kv }
}

const ROW = { opnsvcid: '07_24_04_P', opnsfteamcode: '3000000', mgtno: 'M-1', bplcnm: '테스트식당', rdnwhladdr: '서울특별시 강남구 테헤란로 1', trdstategbn: '01' }

const makeEnv = (db: D1Database, extra: Record<string, string> = {}) => ({
  DB: db, ADS_LOCALDATA_SERVICE_KEY: SERVICE_KEY, ADS_LOCALDATA_MAX_PAGES: '1', ADS_LOCALDATA_BUDGET: '300', ...extra,
} as unknown as Parameters<typeof runLocalDataCollect>[0])

describe('인허가 요청 형태 프로브', () => {
  beforeEach(() => { vi.restoreAllMocks() })
  afterEach(() => { vi.unstubAllGlobals() })

  it('현행이 500 이면 후보를 찔러 **행을 주는 형태**로 갈아타고, 그 답을 DB 에 기억한다', async () => {
    const { db, kv } = makeDB()
    vi.stubGlobal('fetch', vi.fn(async (u: string) => {
      // 라이브 가정: **현행 형태만** 500 을 유발하고 다른 형태면 정상(형태가 원인인 상황).
      if (isDefaultShape(String(u))) return new Response('Unexpected errors', { status: 500 })
      return new Response(JSON.stringify({ svc: { row: [ROW] } }), { status: 200 })
    }))

    const s = await runLocalDataCollect(makeEnv(db))

    expect(s.diag.probe?.winner).toBe(ALT.id)
    expect(s.diag.variant).toBe(ALT.id)
    expect(s.found).toBeGreaterThan(0) // 갈아탄 뒤 **같은 업종을 재시도**해 수확한다(그 페이지를 버리지 않는다)
    expect(JSON.parse(kv[VARIANT_KEY]).id).toBe(ALT.id) // 다음 실행은 곧장 그 형태로 — 매번 다시 탐색하지 않는다
  })

  it('기억한 형태는 다음 실행에서 곧바로 쓰이고, 프로브는 다시 돌지 않는다', async () => {
    const { db } = makeDB({ [VARIANT_KEY]: JSON.stringify({ id: ALT.id, probed_at: Date.now() }) })
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (u: string) => { urls.push(String(u)); return new Response(JSON.stringify({ svc: { row: [ROW] } }), { status: 200 }) }))

    const s = await runLocalDataCollect(makeEnv(db))

    expect(s.diag.variant).toBe(ALT.id)
    expect(s.diag.probe).toBeUndefined()
    expect(urls.every(u => u.includes(`${ALT.sizeParam}=${ALT.size}`))).toBe(true)
  })

  it('🔐 진단에 남는 실패 요청에 **서비스키가 없다**(public 레포 — 한 번 새면 회수 불가)', async () => {
    const { db } = makeDB()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Unexpected errors', { status: 500 })))

    const s = await runLocalDataCollect(makeEnv(db))

    expect(s.diag.fail_probe?.url).toBeTruthy()
    expect(JSON.stringify(s.diag)).not.toContain(SERVICE_KEY)
    expect(s.diag.fail_probe?.url).toContain('serviceKey=***')
    expect(s.diag.fail_probe?.msg).toContain('500')
    expect(s.diag.probe?.winner).toBeNull() // 아무도 못 주면 '형태 문제가 아니다' 가 결론
  })

  it('env 로 형태를 고정하면 자동 탐색이 그 결정을 덮어쓰지 않는다', async () => {
    const { db, kv } = makeDB()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Unexpected errors', { status: 500 })))

    const s = await runLocalDataCollect(makeEnv(db, { ADS_LOCALDATA_VARIANT: 'v4' }))

    expect(s.diag.variant).toBe('v4')
    expect(s.diag.probe).toBeUndefined()
    expect(kv[VARIANT_KEY]).toBeUndefined()
  })

  it('페이지 크기는 env 로 무배포 조정된다(500 이 원인이라고 확인되면 배포 없이 내린다)', async () => {
    const { db } = makeDB()
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (u: string) => { urls.push(String(u)); return new Response(JSON.stringify({ svc: { row: [ROW] } }), { status: 200 }) }))

    await runLocalDataCollect(makeEnv(db, { ADS_LOCALDATA_PAGE_SIZE: '50' }))

    expect(urls.length).toBeGreaterThan(0)
    expect(urls.every(u => u.includes(`${DEF.sizeParam}=50`))).toBe(true)
  })

  it('마지막 페이지 판정은 **실제 페이지 크기** 기준이다(예전 500 하드코딩이면 2페이지를 영원히 안 본다)', async () => {
    const { db } = makeDB()
    const pages: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (u: string) => {
      const s = String(u); pages.push(s)
      const page = Number(s.match(new RegExp(`${DEF.pageParam}=(\\d+)`))?.[1] || 1)
      // 1페이지가 꽉 찼다(=50건) → 2페이지가 있을 수 있다. 크기 상수를 잘못 비교하면 여기서 멈춘다.
      return new Response(JSON.stringify({ svc: { row: page === 1 ? Array.from({ length: 50 }, (_, i) => ({ ...ROW, mgtno: `M-${i}` })) : [] } }), { status: 200 })
    }))

    await runLocalDataCollect(makeEnv(db, { ADS_LOCALDATA_PAGE_SIZE: '50', ADS_LOCALDATA_MAX_PAGES: '2' }))

    expect(pages.some(u => u.includes(`${DEF.pageParam}=2`))).toBe(true)
  })

  // ⏱️ 판정 속도 — 일일 레인은 **하루 1회**(KST 05시)다. 백필이 매시간 도는데 프로브를 안 하면
  //   500 의 정체를 아는 데 최대 24시간이 걸린다(관측 기회를 하루 23번 버림).
  it('백필 레인도 프로브해서 형태를 찾는다 — 판정이 하루가 아니라 한 시간 안에 난다', async () => {
    const { db, kv } = makeDB()
    vi.stubGlobal('fetch', vi.fn(async (u: string) => {
      if (isDefaultShape(String(u))) return new Response('Unexpected errors', { status: 500 })
      return new Response(JSON.stringify({ svc: { row: [ROW] } }), { status: 200 })
    }))

    await runLocalDataBackfill(makeEnv(db, { ADS_LOCALDATA_BACKFILL_DAYS: '3' }), 1)

    expect(JSON.parse(kv[VARIANT_KEY] || '{}').id).toBe(ALT.id) // 백필이 스스로 찾아 기억한다
  })

  it('쿨다운을 **공유**하므로 두 레인이 같은 창에서 중복으로 찌르지 않는다', async () => {
    const { db } = makeDB({ [VARIANT_KEY]: JSON.stringify({ id: 'v1', probed_at: Date.now() }) })
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (u: string) => { urls.push(String(u)); return new Response('Unexpected errors', { status: 500 }) }))

    await runLocalDataBackfill(makeEnv(db, { ADS_LOCALDATA_BACKFILL_DAYS: '3' }), 1)

    // 일일 레인이 방금 찔렀으므로(쿨다운 내) 백필은 후보를 하나도 쏘지 않는다 — 현행 형태만 시도.
    expect(urls.every(u => u.includes('pageSize=500'))).toBe(true)
  })
})
