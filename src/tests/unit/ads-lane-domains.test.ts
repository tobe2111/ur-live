/**
 * 🧭 **도메인별 예산 분리** — 한 풀의 레인이 늘어도 다른 풀이 안 깎인다 (2026-08-02 대표 지시).
 *
 * > *"업체 b2b db수집이랑 인플루언서 db 수집을 분리해서 생각할 필요가 있어"*
 *
 * ## 이 파일이 지키는 것
 * 1. **등록된 레인 전부가 표에 있다** — 빠지면 조용히 남의 조에 얹혀 돈다(가장 중요).
 * 2. **격리** — B2B 레인을 10개 더 붙여도 인플루언서 몫이 그대로다. 이게 "분리"의 실체다.
 * 3. **부재 금지** — 레인이 있는 도메인은 최소 1자리. 반올림으로 0 이 되면 영원히 안 돈다.
 * 4. **유료 자동 확대** — 예산 8→64 면 몫도 같은 비율로(표를 손댈 필요 없음).
 * 5. **하위호환** — 라이브에 저장된 구 커서 포맷을 읽어도 안 깨진다.
 *
 * ⚠️ **이 테스트가 못 보는 것**: 3/3/1/1 이라는 *비율이 옳은지*. 그건 각 풀의 백로그·유입으로만
 *   판단되고 문자열로는 판정 불가다(대표 확정값이며, 근거는 어드민 타임라인/stats).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import {
  LANE_DOMAIN, ADS_DOMAINS, DOMAIN_SHARE, domainBudgets, laneDomain, isKnownLane, laneKey, FALLBACK_DOMAIN,
} from '../../worker-ads/lane-domains'
import { selectLanesByDomain, readDomainCursors, domainDispatchSnapshot, FREE_LANES_PER_TICK, PAID_LANES_PER_TICK } from '../../worker-ads/dispatch-budget'

const SRC = 'src/worker-ads/index.ts'

/**
 * 실제 **디스패치되는** 레인 이름을 소스에서 뽑는다 — 표를 표와 비교하면 영원히 통과한다
 * (오늘 이미 한 번 당했다: 상수를 상수와 비교한 유닛이 라이브 0건 버그를 통과시켰다).
 *
 * ⚠️ **`scheduled()` 본문만 본다.** 처음엔 파일 전체를 훑었다가 `app.post('/__ads/route-biz-blogs')`
 *   같은 **수동 HTTP 라우트**까지 잡혀 빨간불이 떴다 — 그건 cron 이 안 돌리는 것이라 도메인 예산의
 *   대상이 아니다. 예산 우회 래칫(`check-ads-dispatch-bypass.mjs`)이 쓰는 것과 같은 기법이다.
 * ⚠️ **못 보는 것**: 생 `ctx.waitUntil` 우회 레인(`sheets-sync` 등 5개). 그것들은 애초에 예산 배분을
 *   안 거치므로 이 표의 대상이 아니고, 별도로 그 래칫이 증가를 막는다.
 */
function registeredLaneNames(): string[] {
  const src = fs.readFileSync(SRC, 'utf8')
  const at = src.indexOf('async function scheduled(')
  expect(at, 'scheduled() 진입점을 못 찾았다 — 코드가 옮겨갔다(통과가 아니라 실패)').toBeGreaterThan(-1)
  const body = src.slice(at)
  const names = new Set<string>()
  for (const m of body.matchAll(/['"`]\/__ads\/([a-z0-9?=&_-]+)['"`]/g)) names.add(laneKey(m[1]))
  for (const m of body.matchAll(/beat:\s*'([a-z0-9?=&_-]+)'/g)) names.add(laneKey(m[1]))
  // 템플릿 경로(`/__ads/maintenance?phase=${phase}`)는 위 정규식이 못 잡는다 — 접두어로 보완.
  for (const m of body.matchAll(/['"`]\/__ads\/([a-z-]+)\?[a-z]+=\$\{/g)) names.add(m[1])
  return [...names].sort()
}

describe('레인 도메인 표', () => {
  /**
   * 🔑 **이게 이 파일의 본체다.** 새 레인이 표에서 빠지면 `FALLBACK_DOMAIN` 으로 흘러가
   *   *돌기는 도는데 남의 예산을 쓴다* — 에러가 없어 아무도 모른다.
   */
  it('등록된 레인이 전부 표에 있다', () => {
    const names = registeredLaneNames()
    expect(names.length).toBeGreaterThan(20)         // 측정 대상이 비면 통과가 아니라 실패
    const missing = names.filter(n => !(n in LANE_DOMAIN))
    expect(missing, `lane-domains.ts 의 LANE_DOMAIN 에 추가할 것:\n  ${missing.join('\n  ')}`).toEqual([])
  })

  it('표의 모든 값이 유효한 도메인이다', () => {
    for (const [name, d] of Object.entries(LANE_DOMAIN)) {
      expect(ADS_DOMAINS, `${name} → ${d}`).toContain(d)
    }
    for (const d of ADS_DOMAINS) expect(DOMAIN_SHARE[d]).toBeGreaterThan(0)
  })

  it('쿼리는 이름에서 뗀다 — 같은 레인의 단계는 같은 조', () => {
    expect(laneDomain('maintenance?phase=merge')).toBe('influencer')
    expect(laneDomain('maintenance?phase=quality')).toBe('influencer')
    expect(laneDomain('reclassify-company?passes=5')).toBe('company')
    expect(laneDomain('collect-localdata?mode=backfill')).toBe('prospect')
  })

  it('표에 없으면 폴백 + 표시 — 빼버리지 않는다(부재가 실패보다 나쁘다)', () => {
    expect(isKnownLane('아무거나-신규')).toBe(false)
    expect(laneDomain('아무거나-신규')).toBe(FALLBACK_DOMAIN)
  })

  /** 유어애즈가 아닌 두 도메인이 실제로 분리돼 있는지 — 서비스 경계는 문서가 아니라 코드로. */
  it('매장후보·도매 레인이 유어애즈 도메인에 섞여 있지 않다', () => {
    expect(laneDomain('collect-maker')).toBe('wholesale')
    for (const n of ['collect-neis', 'collect-hira', 'collect-store-kakao', 'enrich-prospects']) {
      expect(laneDomain(n), n).toBe('prospect')
    }
  })
})

describe('도메인별 몫 배분', () => {
  const ALL = [...ADS_DOMAINS]

  it('대표 확정 비율은 3/3/1/1 이다 — 8자리 기준', () => {
    expect(domainBudgets(8, ALL)).toEqual({ influencer: 3, company: 3, prospect: 1, wholesale: 1 })
  })

  /**
   * 🔻 **총량과 비율은 다른 사람이 정한다** (2026-08-02).
   *   처음엔 이 검사가 `domainBudgets(FREE_LANES_PER_TICK, …)` 로 **총량과 비율을 한 값에 묶어** 뒀다.
   *   그래서 CPU 실측으로 총량을 8 → 6 으로 내리는 순간 *대표 확정 비율까지 빨간불*이 됐다 —
   *   고쳐야 할 것은 총량인데 테스트는 비율이 깨졌다고 말했다.
   *   ⇒ 비율은 8자리 기준으로 고정하고(위), 현재 총량은 **비율을 지키는지만** 본다.
   *   ⚠️ 총량은 플랫폼 CPU 한도가 정한다(`FREE_LANES_PER_TICK` 주석의 실측). 비율은 대표가 정한다.
   */
  it('현재 무료 총량도 비율을 지킨다 — 두 유어애즈 풀이 대등하고, 아무도 0 이 아니다', () => {
    const b = domainBudgets(FREE_LANES_PER_TICK, ALL)
    expect(b.influencer + b.company + b.prospect + b.wholesale).toBe(FREE_LANES_PER_TICK)
    expect(b.influencer, '두 유어애즈 풀은 대등해야 한다').toBe(b.company)
    for (const d of ALL) expect(b[d], `${d} 가 0 이면 그 도메인은 영원히 안 돈다`).toBeGreaterThanOrEqual(1)
    expect(b.influencer, '비율이 최소-1 바닥에 눌리면 3:3:1:1 이 사라진다').toBeGreaterThan(b.prospect)
  })

  /** 💳 표를 손대지 않아도 유료에서 같은 비율로 커진다 — 그게 요금제 노브의 설계다. */
  it('유료 64자리는 같은 비율로 자동 확대', () => {
    const b = domainBudgets(PAID_LANES_PER_TICK, ALL)
    expect(b.influencer + b.company + b.prospect + b.wholesale).toBe(PAID_LANES_PER_TICK)
    expect(b.influencer).toBe(b.company)
    expect(b.influencer / b.prospect).toBeCloseTo(DOMAIN_SHARE.influencer / DOMAIN_SHARE.prospect, 1)
  })

  it('합이 예산을 넘지 않는다 (어떤 예산에서도)', () => {
    for (let p = 1; p <= 64; p++) {
      const b = domainBudgets(p, ALL, p)
      const sum = ADS_DOMAINS.reduce((a, d) => a + b[d], 0)
      expect(sum, `perTick=${p}`).toBeLessThanOrEqual(p)
    }
  })

  /** 🔑 부재 금지 — 몫이 작은 도메인이 반올림에서 0 이 되면 영원히 안 돈다. */
  it('레인이 있는 도메인은 최소 1자리를 받는다', () => {
    for (let p = 4; p <= 64; p++) {
      const b = domainBudgets(p, ALL, p)
      for (const d of ADS_DOMAINS) expect(b[d], `perTick=${p} ${d}`).toBeGreaterThanOrEqual(1)
    }
  })

  /** 예산 < 도메인 수면 전원에게 못 준다 — 그때는 회전시켜 굶는 쪽이 고정되지 않게. */
  it('예산이 부족하면 회차마다 다른 도메인이 자리를 받는다', () => {
    const seen = new Set<string>()
    for (let tick = 0; tick < 8; tick++) {
      const b = domainBudgets(2, ALL, tick)
      for (const d of ADS_DOMAINS) if (b[d] > 0) seen.add(d)
    }
    expect(seen.size).toBe(ADS_DOMAINS.length)   // 8회차 안에 전원이 한 번은 받는다
  })

  it('후보가 없는 도메인엔 자리를 주지 않는다(낭비 금지)', () => {
    const b = domainBudgets(8, ['influencer', 'company'])
    expect(b.prospect).toBe(0)
    expect(b.wholesale).toBe(0)
    expect(b.influencer + b.company).toBe(8)
  })
})

describe('도메인 격리 — 이게 "분리" 의 실체다', () => {
  const lane = (beat: string) => ({ beat, gapMin: 60 })

  /**
   * 🔑 **분리 전의 결함을 그대로 재현한다**: 도메인-무지 라운드로빈에서는 B2B 레인이 늘면
   *   인플루언서 몫이 줄었다. 지금은 늘려도 그대로여야 한다.
   */
  it('B2B 레인이 10개 늘어도 인플루언서 몫이 그대로다', () => {
    // ⚠️ 픽스처에 **네 도메인이 전부** 있어야 한다. 처음엔 인플루언서+업체만 넣었다가 기대값이 어긋났다 —
    //   후보가 없는 도메인의 몫은 있는 쪽으로 재분배되므로(그게 맞는 동작) 인플루언서가 3 이 아니라 4 를 받는다.
    //   라이브에는 항상 네 도메인이 다 있으므로, 픽스처가 라이브를 안 닮으면 숫자가 거짓말을 한다.
    const infl = ['collect', 'enrich-influencer-driver', 'maintenance?phase=merge', 'social-maintenance'].map(lane)
    const rest = ['collect-neis', 'collect-maker'].map(lane)               // prospect · wholesale
    const few = [...infl, ...rest, ...['collect-commerce', 'enrich-company'].map(lane)]
    const many = [...infl, ...rest, ...['collect-commerce', 'enrich-company', 'match-registry', 'sweep-nts',
      'sweep-kakao-chain', 'sweep-mx', 'reclassify-company?passes=5', 'collect-storeinfo', 'collect-company', 'scan-notices'].map(lane)]

    const a = selectLanesByDomain(few, 8, {}, 0)
    const b = selectLanesByDomain(many, 8, {}, 0)

    /**
     * 🔧 **2026-08-11 — 등식에서 하한으로** (`redistributeSlack` 도입).
     *   원래 여기는 `b.budget === a.budget` 이었다. 그런데 그 등식은 서로 다른 두 가지를 한데
     *   묶고 있었다: **① 남이 늘어도 내 몫이 안 줄어든다(하한)** 와 **② 남이 놀아도 내가 더는
     *   못 받는다(상한)**. 격리가 지키려던 것은 ①뿐이다 — ②는 라이브에서 **여섯 자리를 놀리면서
     *   한 레인을 미루는** 손해로 나타났다(`ads_dispatch_last` 02:00 UTC 실측).
     *   ⇒ 하한은 그대로 못 박고, 상한만 푼다. **`redistributeSlack` 은 쓰지 않는 몫만 옮기므로
     *      어떤 도메인의 `run` 수도 이 하한 밑으로 내려갈 수 없다.**
     */
    expect(b.perDomain.influencer.budget).toBe(3)       // 경쟁이 있으면 대표 확정 비율 그대로
    expect(b.perDomain.influencer.run.length).toBe(3)   // 몫 3 < 후보 4
    expect(b.run.length).toBeLessThanOrEqual(8)         // 도메인 합이 회차 예산 안
    // 하한: B2B 가 10개 늘어도 인플루언서가 자기 몫 아래로 안 내려간다(격리의 실체).
    expect(b.perDomain.influencer.run.length).toBeGreaterThanOrEqual(3)
    // 상한이 풀린 결과 — 남이 놀면 더 받는다(그게 이 회차의 낭비를 없앤다).
    expect(a.perDomain.influencer.run.length).toBeGreaterThanOrEqual(b.perDomain.influencer.run.length)
    expect(a.run.length).toBeLessThanOrEqual(8)
  })

  it('도메인별 상세를 스냅샷에 남긴다 — "누가 굶었나"가 보여야 한다', () => {
    const lanes = ['collect', 'enrich-influencer-driver', 'maintenance?phase=merge', 'social-maintenance', 'consented-reminder',
      'collect-commerce', 'enrich-company', 'match-registry', 'sweep-nts',
      'collect-neis', 'collect-hira', 'collect-maker'].map(lane)
    const sel = selectLanesByDomain(lanes, 8, {}, 0)
    const snap = domainDispatchSnapshot(sel, 'free', 8, 0, '2026-08-02T00:00:00.000Z') as Record<string, never>
    const by = snap.by_domain as unknown as Record<string, { budget: number; run: string[]; deferred: string[] }>
    expect(Object.keys(by).sort()).toEqual([...ADS_DOMAINS].sort())
    expect(by.influencer.budget).toBe(3)
    expect(by.wholesale.run).toContain('collect-maker')
    // 미룬 레인이 남아 있어야 다음 회차가 이어받는다(전부 돌면 deferred 는 비는 게 맞다).
    expect(by.influencer.run.length + by.influencer.deferred.length).toBe(5)
  })

  it('표에 없는 레인은 스냅샷에 이름이 남는다(조용한 드리프트 금지)', () => {
    const sel = selectLanesByDomain([lane('collect'), lane('완전-새로운-레인')], 8, {}, 0)
    expect(sel.unknown).toEqual(['완전-새로운-레인'])
    const snap = domainDispatchSnapshot(sel, 'free', 8, 0, 'x') as Record<string, unknown>
    expect(snap.unknown_lanes).toEqual(['완전-새로운-레인'])
  })

  /** 커서가 도메인별로 전진해야 각 조 안에서 굶는 레인이 없다. */
  it('도메인별 커서가 따로 전진한다', () => {
    const lanes = ['collect', 'enrich-influencer-driver', 'maintenance?phase=merge', 'social-maintenance', 'consented-reminder',
      'collect-commerce', 'enrich-company', 'match-registry', 'sweep-nts', 'sweep-mx'].map(lane)
    let cursors = {}
    const seenInfl = new Set<string>()
    for (let i = 0; i < 6; i++) {
      const sel = selectLanesByDomain(lanes, 8, cursors, i)
      sel.perDomain.influencer.run.forEach(n => seenInfl.add(n))
      cursors = sel.nextCursors
    }
    // 6회차 안에 인플루언서 레인 5개가 전부 한 번은 돈다(굶는 레인 0).
    expect(seenInfl.size).toBe(5)
  })
})

describe('커서 하위호환 — 배포 순간 라이브 값', () => {
  /** 구 포맷을 못 읽으면 그 회차만 배분이 한쪽으로 쏠린다(에러 없이). */
  it('숫자 하나였던 구 커서를 전 도메인 시드로 받는다', () => {
    const c = readDomainCursors('7')
    for (const d of ADS_DOMAINS) expect(c[d]?.other).toBe(7)
  })

  it('역할 객체였던 커서도 받는다', () => {
    const c = readDomainCursors(JSON.stringify({ measure: 2, other: 5, tick: 9 }))
    expect(c.influencer).toEqual({ measure: 2, other: 5, tick: 9 })
    expect(c.company).toEqual({ measure: 2, other: 5, tick: 9 })
  })

  it('새 포맷은 그대로 읽는다', () => {
    const raw = JSON.stringify({ influencer: { measure: 1, other: 2, tick: 3 }, company: { measure: 0, other: 4, tick: 3 } })
    const c = readDomainCursors(raw)
    expect(c.influencer).toEqual({ measure: 1, other: 2, tick: 3 })
    expect(c.company?.other).toBe(4)
  })

  it('깨진 값에도 안 터진다', () => {
    for (const raw of ['', 'null', '{oops', undefined, null]) {
      expect(() => readDomainCursors(raw)).not.toThrow()
    }
  })
})
