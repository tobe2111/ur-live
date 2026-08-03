/**
 * 🔬 인허가 요청 형태(변종) + 프로브 — `license-url.ts` 불변식.
 *
 *   배경: 인허가 레인이 `API: HTTP 500 — Unexpected errors` 로 0건. 500 은 본문에 원인 코드가 없고,
 *   이 개발 환경은 `apis.data.go.kr` CONNECT 가 막혀 **직접 호출로 확인할 수 없다.** 그래서 URL 을
 *   추측으로 바꾸는 대신 후보를 라이브가 고르게 했다. 여기서 고정하는 건 그 장치의 안전성이다.
 *
 *   ⚠️ 가장 중요한 건 **키 노출 금지**(이 레포는 public). 나머지는 판정 규칙이 흔들리지 않게 하는 것.
 */
import { describe, it, expect } from 'vitest'
import {
  LICENSE_VARIANTS, DEFAULT_VARIANT_ID, findVariant, buildLicenseUrl, redactServiceKey, resolveLicenseOperation, usableVariantState, LICENSE_STATE_VERSION,
  resolveLicensePageSize, shouldProbe, probeLicenseVariants, PROBE_COOLDOWN_MS,
} from '@/features/marketing/api/license-url'

const V = (id: string) => findVariant(id)
const url = (id: string, size?: number) => buildLicenseUrl({
  base: 'https://apis.data.go.kr/1741000', endpoint: 'general_restaurants', keyParam: 'KEY%2Babc',
  day: '20260728', page: 2, variant: V(id), size: size ?? resolveLicensePageSize(null, V(id)),
})

describe('요청 형태 후보', () => {
  it('후보 id 는 중복되지 않고 첫 번째가 기본이다', () => {
    const ids = LICENSE_VARIANTS.map(v => v.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(DEFAULT_VARIANT_ID).toBe(LICENSE_VARIANTS[0].id)
  })

  /**
   * ⚠️ 2026-08-03: 원래 `DEFAULT_VARIANT_ID === 'v1'` 리터럴이었다. 라이브 실측으로 기본이 v4 로 바뀌면서
   *   깨졌는데, **지켜야 할 것은 id 문자열이 아니라 "기본이 실측으로 확인된 형태여야 한다"** 는 것이다.
   *   게이트웨이 응답 봉투가 `{"numOfRows":…,"pageNo":…}` 를 되돌려 준다 = 이 둘이 실제로 읽히는 키다.
   *   `pageIndex`/`pageSize` 는 같이 보내도 조용히 무시되므로, 그쪽을 기본으로 두면 **200 을 받으면서
   *   영원히 1페이지만** 긁는다(에러가 없어 안 보이는 실패).
   */
  it('🔒 기본 후보는 라이브가 echo 하는 페이징 키를 쓴다(pageNo/numOfRows)', () => {
    const d = findVariant(DEFAULT_VARIANT_ID)
    expect(d.pageParam, '이걸 pageIndex 로 되돌리면 200 인 채로 전진이 0 이 된다').toBe('pageNo')
    expect(d.sizeParam).toBe('numOfRows')
  })

  it('알 수 없는 id 는 현행으로 폴백한다(DB 에 쓰레기가 있어도 레인이 죽지 않게)', () => {
    expect(findVariant('없는거').id).toBe(DEFAULT_VARIANT_ID)
    expect(findVariant(null).id).toBe(DEFAULT_VARIANT_ID)
  })

  it('v1 은 2026-07-22 대표 스펙 그대로다(현행을 조용히 바꾸지 않는다)', () => {
    const u = url('v1')
    expect(u).toContain('pageIndex=2')
    expect(u).toContain('pageSize=500')
    expect(u).toContain('type=json')
    expect(u).toContain('resultType=json')
    expect(u).toContain('lastModTsBgn=20260728')
    expect(u).toContain('lastModTsEnd=20260728')
  })

  it('각 후보는 v1 과 **한 가지만** 다르다(그래야 결과가 원인을 지목한다)', () => {
    const v1 = LICENSE_VARIANTS[0]
    const diffs = (v: typeof v1) => [
      v.pageParam !== v1.pageParam || v.sizeParam !== v1.sizeParam,
      JSON.stringify(v.format) !== JSON.stringify(v1.format),
      v.dateFilter !== v1.dateFilter,
      v.size !== v1.size && v.size === 100 && JSON.stringify(v.format) === JSON.stringify(v1.format) && v.dateFilter === v1.dateFilter,
    ].filter(Boolean).length
    for (const v of LICENSE_VARIANTS.slice(1)) expect(diffs(v), `${v.id} (${v.why})`).toBeGreaterThan(0)
  })

  it('v5 는 날짜 필터를 뺀다(변동일 파라미터가 원인인지 가르기 위함)', () => {
    expect(url('v5')).not.toContain('lastModTs')
  })
})

describe('🔐 서비스키 노출 금지 — 진단에 URL 을 남기는 대가', () => {
  it('serviceKey 값을 남기지 않는다', () => {
    const red = redactServiceKey(url('v1'))
    expect(red).not.toContain('KEY%2Babc')
    expect(red).toContain('serviceKey=***')
  })

  it('authKey/대문자 변형도 가린다', () => {
    expect(redactServiceKey('https://x/y?authKey=SECRET&pageIndex=1')).toBe('https://x/y?authKey=***&pageIndex=1')
    expect(redactServiceKey('https://x/y?ServiceKey=SECRET')).toBe('https://x/y?ServiceKey=***')
  })

  it('키 뒤의 다른 파라미터는 보존한다(가리기가 진단을 무의미하게 만들면 안 된다)', () => {
    const red = redactServiceKey(url('v1'))
    expect(red).toContain('pageSize=500')
    expect(red).toContain('lastModTsBgn=20260728')
  })
})

describe('페이지 크기(무배포 조정 레버)', () => {
  it('env 값이 있으면 후보 기본값을 이긴다', () => {
    expect(resolveLicensePageSize('100', V('v1'))).toBe(100)
    expect(url('v1', resolveLicensePageSize('100', V('v1')))).toContain('pageSize=100')
  })
  it('빈값·쓰레기·0 이하는 후보 기본값으로', () => {
    for (const raw of [null, '', 'abc', '0', '-5']) expect(resolveLicensePageSize(raw, V('v1'))).toBe(500)
  })
  it('상한 1000 으로 클램프(오타로 10만을 넣어도 한 요청이 폭발하지 않게)', () => {
    expect(resolveLicensePageSize('999999', V('v1'))).toBe(1000)
  })
})

describe('프로브 쿨다운', () => {
  const now = 1_700_000_000_000
  it('한 번도 안 해봤으면 한다', () => expect(shouldProbe(null, now)).toBe(true))
  it('쿨다운 안이면 안 한다(실패가 상대편 일시 장애일 때 매 라운드 4발 쏘지 않게)', () => {
    expect(shouldProbe({ id: 'v1', probed_at: now - 60_000 }, now)).toBe(false)
  })
  it('쿨다운이 지나면 다시 한다(대표가 활용신청/스펙을 고치면 스스로 살아나야 한다)', () => {
    expect(shouldProbe({ id: 'v1', probed_at: now - PROBE_COOLDOWN_MS - 1 }, now)).toBe(true)
  })
})

describe('프로브 판정', () => {
  const base = { base: 'https://api', endpoint: 'general_restaurants', keyParam: 'K', day: '20260728' }

  it('행을 준 후보를 승자로 뽑고 거기서 멈춘다(뒤 후보는 쏘지 않는다)', async () => {
    const seen: string[] = []
    const r = await probeLicenseVariants({
      // 첫 후보를 건너뛰게 해 "skip 이 실제로 먹는다 + 그 다음에서 즉시 멈춘다"를 함께 본다.
      ...base, skip: [LICENSE_VARIANTS[0].id],
      fetchPage: async (u) => { seen.push(u); return u.includes(`${LICENSE_VARIANTS[1].pageParam}=1`) ? { ok: true, rows: 7 } : { ok: false, rows: 0, msg: 'HTTP 500' } },
    })
    expect(r.winner).toBe(LICENSE_VARIANTS[1].id)
    expect(seen.length).toBe(1) // 첫 후보는 skip, 그 다음에서 즉시 승부
    expect(r.attempts.map(a => a.id)).toEqual([LICENSE_VARIANTS[1].id])
  })

  it('**200 인데 0행**은 승자가 아니다 — 그날 변동이 없어서일 수 있어 판정 근거가 못 된다', async () => {
    const r = await probeLicenseVariants({ ...base, fetchPage: async () => ({ ok: true, rows: 0 }) })
    expect(r.winner).toBeNull()
    expect(r.attempts).toHaveLength(LICENSE_VARIANTS.length)
  })

  it('아무도 못 주면 null — 형태 문제가 아니라는 정보 자체가 결론이다', async () => {
    const r = await probeLicenseVariants({ ...base, fetchPage: async () => ({ ok: false, rows: 0, msg: 'HTTP 500 — Unexpected errors' }) })
    expect(r.winner).toBeNull()
    expect(r.attempts.every(a => a.msg?.includes('500'))).toBe(true)
  })

  it('예산이 없으면 시작한 만큼만 하고 멈춘다(반쯤 하다 끊겨도 이력은 남는다)', async () => {
    let left = 2
    const r = await probeLicenseVariants({
      ...base, canSpend: () => left > 0,
      fetchPage: async () => { left--; return { ok: false, rows: 0, msg: 'HTTP 500' } },
    })
    expect(r.attempts).toHaveLength(2)
    expect(r.winner).toBeNull()
  })

  it('fetch 가 예외를 던져도 프로브 전체가 죽지 않는다', async () => {
    const r = await probeLicenseVariants({ ...base, fetchPage: async () => { throw new Error('boom') } })
    expect(r.attempts).toHaveLength(LICENSE_VARIANTS.length)
    expect(r.attempts[0].ok).toBe(false)
  })
})

/**
 * 🔑 **오퍼레이션 세그먼트(`/info`)** — 인허가 레인이 며칠째 0건이던 진짜 원인 (2026-08-03 라이브 실측).
 *
 * ```
 *   …/1741000/general_restaurants        → 400 · NO_OPENAPI_SERVICE_ERROR(code 12)
 *   …/1741000/general_restaurants/info   → 200 · totalCount 70,469 · 실제 행
 * ```
 * code 12 는 *"주소가 지금 안 맞는다"* 까지만 말하고 **폐기인지 오타인지 구분하지 못한다** —
 * 그래서 이전 세션(나)이 "서비스 폐기 확정"이라고 인계에 적었다. 틀렸고, 빠진 건 경로 한 칸이었다.
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * 기관이 나중에 오퍼레이션명을 바꾸는 것. 그래서 env(`ADS_LICENSE_OPERATION`)로 **배포 없이** 덮을 수
 * 있게 뒀고, 여기서는 그 덮어쓰기가 실제로 URL 에 반영되는지만 본다.
 */
describe('오퍼레이션 세그먼트', () => {
  const build = (operation?: string) => buildLicenseUrl({
    base: 'https://apis.data.go.kr/1741000', endpoint: 'general_restaurants', keyParam: 'K',
    day: '20260803', page: 1, variant: LICENSE_VARIANTS[0], size: 100, operation,
  })

  it('🔒 기본으로 `/info` 가 붙는다 — 없으면 게이트웨이가 code 12 로 거절한다', () => {
    expect(build()).toContain('/1741000/general_restaurants/info?')
  })

  it('🔒 env 로 덮으면 그 이름이 쓰인다(기관이 바꿔도 무배포 수리)', () => {
    expect(buildLicenseUrl({
      base: 'https://apis.data.go.kr/1741000', endpoint: 'general_restaurants', keyParam: 'K',
      day: '20260803', page: 1, variant: LICENSE_VARIANTS[0], size: 100,
      operation: resolveLicenseOperation('list'),
    })).toContain('/general_restaurants/list?')
  })

  it('빈 문자열이면 붙이지 않는다 — 옛 형태로 되돌릴 여지를 남긴다', () => {
    expect(build('')).toContain('/1741000/general_restaurants?')
  })

  it('env 정규화: 슬래시·공백은 떼고, 이상한 문자는 기본값으로 되돌린다(경로 주입 차단)', () => {
    expect(resolveLicenseOperation(' /info/ ')).toBe('info')
    expect(resolveLicenseOperation('bad/../path')).toBe('info')
    expect(resolveLicenseOperation('a?b=c')).toBe('info')
    expect(resolveLicenseOperation(undefined)).toBe('info')
    expect(resolveLicenseOperation(null)).toBe('info')
    expect(resolveLicenseOperation('')).toBe('')      // 명시적 빈 값만 '없음'
  })

  it('프로브도 같은 오퍼레이션으로 찌른다 — 레인과 다른 주소를 시험하면 판정이 무의미하다', async () => {
    const seen: string[] = []
    await probeLicenseVariants({
      base: 'https://api', endpoint: 'general_restaurants', keyParam: 'K', day: '20260803',
      fetchPage: async (u) => { seen.push(u); return { ok: false, rows: 0, msg: 'x' } },
    })
    expect(seen.length).toBeGreaterThan(0)
    for (const u of seen) expect(u).toContain('/general_restaurants/info?')
  })
})

/**
 * 🧊 **저장된 판정의 유효기간** — 라이브가 배포 직후에 드러낸 구멍 (2026-08-03).
 *
 * `/info` 를 고쳐 배포하고 라이브 D1 을 봤더니 이렇게 남아 있었다:
 * ```json
 *   ads_localdata_variant = {"id":"v1","probed_at":…,"attempts":[…전부 code 12 실패…]}
 * ```
 * **주소가 틀렸던 시절의 판정**이다. 그때는 무엇을 찔러도 실패했으니 정보가 아니라 *잔해*다.
 *
 * 그런데 기본값을 v4 로 올린 것만으로는 이게 안 지워진다 — **저장된 값이 항상 이긴다.**
 * 게다가 **스스로 못 빠져나온다**: 프로브는 *실패했을 때만* 도는데, 경로가 고쳐진 지금은 v1 도 200 을
 * 받는다(그 서비스가 `pageIndex`/`pageSize` 를 조용히 무시할 뿐이다) → 실패가 없다 → 프로브가 안 돈다 →
 * **영원히 v1**. 에러도 경고도 없이 같은 페이지만 긁는다.
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * 버전을 올려야 할 변경인데 **안 올리는 것**. 그건 사람이 판단한다(`LICENSE_STATE_VERSION` 주석에 명시).
 */
describe('저장된 변종 판정의 유효기간', () => {
  it('🔒 규칙 버전이 다른 판정은 **없는 것으로 친다** — 안 그러면 옛 형태에 영원히 갇힌다', () => {
    expect(usableVariantState({ id: 'v1', probed_at: 1 })).toBeNull()            // v 없음 = 구버전
    expect(usableVariantState({ id: 'v1', probed_at: 1, v: 0 })).toBeNull()
    expect(usableVariantState({ id: 'v1', probed_at: 1, v: LICENSE_STATE_VERSION - 1 })).toBeNull()
  })

  it('🔒 현행 버전 판정은 그대로 쓴다(매번 다시 탐색하면 예산 낭비다)', () => {
    const s = { id: 'v1', probed_at: 1, v: LICENSE_STATE_VERSION }
    expect(usableVariantState(s)).toBe(s)
  })

  it('빈 상태·id 없는 쓰레기는 null(레인이 죽지 않고 기본값으로 간다)', () => {
    expect(usableVariantState(null)).toBeNull()
    expect(usableVariantState(undefined)).toBeNull()
    expect(usableVariantState({ id: '' })).toBeNull()
  })

  it('무효화된 상태는 쿨다운도 걸리지 않는다 — 즉시 다시 판정할 수 있어야 한다', () => {
    const stale = { id: 'v1', probed_at: Date.now() }          // 방금 찍혔지만 구버전
    expect(shouldProbe(usableVariantState(stale), Date.now())).toBe(true)
  })
})
