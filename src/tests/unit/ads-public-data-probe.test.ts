/**
 * 🔬 **공공 API 한 방 프로브** — 계약 (2026-08-01 신설).
 *
 *   왜 만들었나: 공공데이터 레인 다섯 개가 며칠째 0건인데 **원문을 한 번도 못 읽었다.** 원문은 레인이
 *   D1 스탬프를 쓸 때 남는데 그 레인들은 *스탬프 전에 죽는다*. 08-01 13:47 수동 트리거 실측 —
 *   `started:true` 를 받고 72초를 지켜봤지만 `last_run` 은 **07-29 그대로**였다.
 *   ⇒ 레인을 통해서는 볼 수 없다. 그래서 fetch 1회 · D1 0회 · 결과를 응답 본문으로 주는 경로를 만들었다.
 *
 *   여기서 못 박는 것:
 *   ① **키가 절대 새지 않는다**(URL 과 **본문 둘 다** — 게이트웨이가 요청 URL 을 echo 하는 경우가 있다)
 *   ② 프로브 URL 이 **레인이 실제로 쓰는 상수와 같다**(따로 적으면 드리프트하고, 드리프트하면 프로브가 거짓말한다)
 *   ③ 진단이 **던지지 않는다**(진단이 500 을 내면 진단이 아니다)
 *
 *   ⚠️ 이 시험이 **못 보는 것**: 실제 라이브 응답이 무엇인지는 여기서 알 수 없다(이 환경은
 *     `apis.data.go.kr` CONNECT 가 프록시에 막혀 있다). 여기서는 *모양*만 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PROBE_TARGETS, probeTargetNames, probePublicData } from '@/features/marketing/api/public-data-probe'
import type { Env } from '@/worker/types/env'

const KEY = 'SUPER-SECRET-SERVICE-KEY-abc123=='
const env = {} as Env

describe('프로브 URL — 레인이 쓰는 상수와 같은 곳을 찌른다', () => {
  const SRC = (f: string) => readFileSync(resolve(process.cwd(), `src/features/marketing/api/${f}`), 'utf8')

  it('대상이 비어 있지 않다 — 0개면 이 시험 전체가 무의미해진다', () => {
    expect(probeTargetNames().length).toBeGreaterThanOrEqual(6)
  })

  it.each([
    ['commerce-status', 'commerce-notify-collect.ts', 'MllBs_2Service'],
    ['commerce-detail', 'commerce-notify-collect.ts', 'MllBsDtl_3Service'],
    ['franchise', 'franchise-collect.ts', 'FftcBrandRlsInfo2_Service'],
    ['nara', 'nara-vendor-collect.ts', 'UsrInfoService02'],
    ['localdata', 'localdata-collect.ts', '1741000'],
    ['nps', 'nps-workplace-enrich.ts', 'NpsBplcInfoInqireServiceV2'],
  ])('%s — 프로브가 %s 의 실제 엔드포인트(%s)를 쓴다', (target, file, marker) => {
    const url = PROBE_TARGETS[target].url(KEY, env, { rows: 1, page: 1 })
    expect(url, '프로브가 레인과 다른 곳을 찌르면 결과가 무의미하다').toContain(marker)
    expect(SRC(file), '레인 쪽 상수가 바뀌었는데 프로브가 안 따라왔다').toContain(marker)
  })

  it('🔒 통신판매는 상수를 **직접 참조**한다 — 문자열을 베끼면 드리프트한다', () => {
    const probe = SRC('public-data-probe.ts')
    expect(probe).toMatch(/import \{ COMMERCE_SERVICES \} from '\.\/commerce-notify-collect'/)
    expect(probe).toMatch(/COMMERCE_SERVICES\[0\]\.base/)
    expect(probe).toMatch(/COMMERCE_SERVICES\[1\]\.base/)
  })

  it('🔒 rows 상한이 있다 — 프로브가 수집처럼 굴거나 상대편에 부담을 주면 안 된다', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/features/marketing/api/public-data-probe.ts'), 'utf8')
    expect(src).toMatch(/Math\.min\(1000, Math\.max\(1,/)
    expect(src, 'page 도 상한이 필요하다').toMatch(/Math\.min\(100000, Math\.max\(1,/)
  })

  it('기본값은 최소 요청 — 인자를 안 주면 1페이지·1건', () => {
    for (const n of probeTargetNames()) {
      const u = PROBE_TARGETS[n].url(KEY, env, { rows: 1, page: 1 })
      expect(u, `${n}: 페이지 크기가 1이 아니다`).toMatch(/(numOfRows|pageSize)=1(&|$)/)
    }
  })
})

describe('🔐 키가 새지 않는다 (public repo — 한 번 실리면 회수 불가)', () => {
  it('결과의 url 에 원본 키가 없다', async () => {
    // fetch 를 가로채 상대 응답을 흉내낸다(이 환경은 data.go.kr 로 못 나간다).
    const orig = globalThis.fetch
    globalThis.fetch = (async () => new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } })) as typeof fetch
    try {
      const r = await probePublicData(env, 'commerce-status', KEY)
      expect(r.url).not.toContain(KEY)
      expect(r.url).toContain('serviceKey=***')
    } finally { globalThis.fetch = orig }
  })

  it('🔒 **본문에** 키가 echo 돼 와도 가려진다 — 게이트웨이가 요청 URL 을 되돌려주는 경우가 있다', async () => {
    const orig = globalThis.fetch
    globalThis.fetch = (async () => new Response(
      `<OpenAPI_ServiceResponse><errMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</errMsg><returnUrl>https://apis.data.go.kr/x?serviceKey=${KEY}&pageNo=1</returnUrl></OpenAPI_ServiceResponse>`,
      { status: 200, headers: { 'content-type': 'application/xml' } })) as typeof fetch
    try {
      const r = await probePublicData(env, 'commerce-status', KEY)
      expect(r.body, '본문에 키가 그대로 실렸다 — 어드민 화면·인계 문서로 흘러간다').not.toContain(KEY)
      expect(r.body).toContain('SERVICE_KEY_IS_NOT_REGISTERED_ERROR')
      expect(r.is_json, 'XML 인데 JSON 으로 봤다').toBe(false)
    } finally { globalThis.fetch = orig }
  })

  it('네트워크 오류 메시지에도 키가 안 실린다', async () => {
    const orig = globalThis.fetch
    globalThis.fetch = (async () => { throw new Error(`connect fail: https://x?serviceKey=${KEY}`) }) as typeof fetch
    try {
      const r = await probePublicData(env, 'commerce-status', KEY)
      expect(r.error || '').not.toContain(KEY)
    } finally { globalThis.fetch = orig }
  })
})

describe('진단은 던지지 않는다 · 판정을 붙인다', () => {
  it('알 수 없는 대상이면 에러 필드로 알려준다(예외 아님)', async () => {
    const r = await probePublicData(env, 'nope-not-a-target', KEY)
    expect(r.error).toBeTruthy()
    expect(r.http).toBeNull()
  })

  it('키 미설정이면 하드 실패로 표시한다 — 사람이 고쳐야 낫는 것이다', async () => {
    const r = await probePublicData({} as Env, 'commerce-status')
    expect(r.hard).toBe(true)
    expect(r.error).toContain('PUBLIC_DATA_SERVICE_KEY')
  })

  it('🔒 활용신청/회원등급 류는 hard=true — 재시도로 안 낫는 것과 일시 장애를 갈라야 백오프가 옳게 돈다', async () => {
    const orig = globalThis.fetch
    globalThis.fetch = (async () => new Response('개인회원은 사용할 수 없는 OPEN-API입니다', { status: 200 })) as typeof fetch
    try {
      expect((await probePublicData(env, 'franchise', KEY)).hard).toBe(true)
    } finally { globalThis.fetch = orig }
  })

  it('5xx 는 hard 가 아니다 — 상대 사정일 수 있어 재시도 여지를 남긴다', async () => {
    const orig = globalThis.fetch
    globalThis.fetch = (async () => new Response('Unexpected errors', { status: 500 })) as typeof fetch
    try {
      const r = await probePublicData(env, 'localdata', KEY)
      expect(r.http).toBe(500)
      expect(r.hard).toBe(false)
    } finally { globalThis.fetch = orig }
  })
})

describe('🔗 배선 — 만들어 놓고 아무도 안 부르면 관측은 0 이다', () => {
  it('ur-ads 라우트가 있고 lane() 을 쓰지 않는다(레인을 타면 또 스탬프 전에 죽는다)', () => {
    const R = readFileSync(resolve(process.cwd(), 'src/worker-ads/public-data.routes.ts'), 'utf8')
    expect(R).toMatch(/publicDataRoutes\.post\('\/__ads\/probe-public-data'/)
    const block = R.slice(R.indexOf("'/__ads/probe-public-data'"))
    expect(block.slice(0, 400), 'lane() 으로 감싸면 결과가 응답에 안 실린다').not.toMatch(/lane\(/)
  })

  it('어드민 프록시가 **결과를 돌려준다** — fire-and-forget 이면 원문을 여전히 못 본다', () => {
    const P = readFileSync(resolve(process.cwd(), 'src/features/marketing/api/partner-pool.routes.ts'), 'utf8')
    expect(P).toMatch(/app\.post\('\/probe-public-data'/)
    const block = P.slice(P.indexOf("app.post('/probe-public-data'"), P.indexOf("app.post('/probe-public-data'") + 900)
    expect(block, '응답 본문을 읽어 돌려줘야 한다').toMatch(/await r\.json\(\)/)
    expect(block, 'waitUntil 로 던지면 결과를 못 본다').not.toMatch(/waitUntil/)
  })
})

/**
 * 🪜 **사다리** — 어디서 깨지는지 좁힌다 (2026-08-01 프로브 1차 실행이 곧바로 요구한 것).
 *
 *   1차 실행에서 통신판매가 **HTTP 200 · JSON · totalCount 2,649,409** 로 완벽히 정상이었다.
 *   키·활용신청·엔드포인트 전부 유효한데 **레인만** "비JSON 응답" 을 받는다. 차이는 하나 —
 *   `numOfRows` 1 vs **500**. 그래서 rows 를 키워 가며 첫 실패 지점을 찾는 경로를 만들었다.
 *
 *   ⚠️ 이 시험이 못 보는 것: 실제 임계값이 몇인지는 라이브만 안다(여기서는 계약만 고정).
 */
describe('probeLadder — 첫 실패 지점을 찾는다', () => {
  it('주어진 rows 를 **전부** 훑는다 — 실패해도 멈추지 않는다(간헐 실패 ≠ 임계값 실패)', async () => {
    const seen: string[] = []
    const orig = globalThis.fetch
    globalThis.fetch = (async (u: string) => {
      seen.push(String(u))
      // ⚠️ **중간** 단이 실패하게 만든다. 마지막 단만 실패시키면 '중간에 break' 를 넣어도 결과 길이가
      //   같아서 시험이 헛돈다 — 실제로 되돌려-검증에서 그렇게 통과했다(그래서 이 시나리오로 바꿨다).
      return String(u).includes('numOfRows=100&')
        ? new Response('<error>too large</error>', { status: 200 })
        : new Response('{"resultCode":"00"}', { headers: { 'content-type': 'application/json' } })
    }) as typeof fetch
    try {
      const { probeLadder } = await import('@/features/marketing/api/public-data-probe')
      // 키가 있어야 실제 요청까지 간다(없으면 '미설정'으로 조기 반환 — 그 자체도 아래에서 시험한다).
      const keyed = { PUBLIC_DATA_SERVICE_KEY: KEY } as unknown as Env
      const rs = await probeLadder(keyed, 'commerce-status', [1, 100, 500])
      expect(rs).toHaveLength(3)
      expect(seen.some(u => u.includes('numOfRows=1&')), 'rows=1 을 안 쐈다').toBe(true)
      expect(seen.some(u => u.includes('numOfRows=500')), 'rows=500 을 안 쐈다 — 중간에 멈췄다').toBe(true)
      expect(rs[1].is_json, '중간 단(rows=100)이 실패해야 하는 시나리오다').toBe(false)
      expect(rs[2].is_json, '중간 실패 뒤에도 마지막 단까지 갔어야 한다').toBe(true)
    } finally { globalThis.fetch = orig }
  })

  it('🔗 라우트가 ladder 를 실제로 배선한다 — 만들어 놓고 안 부르면 없는 것이다', () => {
    const R = readFileSync(resolve(process.cwd(), 'src/worker-ads/public-data.routes.ts'), 'utf8')
    expect(R).toMatch(/probeLadder\(c\.env, target, ladder/)
    const P = readFileSync(resolve(process.cwd(), 'src/features/marketing/api/partner-pool.routes.ts'), 'utf8')
    expect(P, '어드민 프록시가 rows/page/ladder 를 전달해야 한다').toMatch(/\['rows', 'page', 'ladder'\]/)
  })
})
