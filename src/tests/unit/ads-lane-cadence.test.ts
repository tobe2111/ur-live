/**
 * ⏱️ ur-ads 레인 주기 신고 — 불변식 고정.
 *
 * 배경(실측): `adsBeat` 이 모든 레인에 워커 cron(`0 * * * *`, 매시간)을 붙여 기록해,
 * 일 1회/N시간/단계순환 레인이 **정상 동작 중에도** `stale` 로 찍혔다. 그 판정은
 * `/api/_healthcheck/cron` → uptime.yml → 이슈+메일로 나간다. 2026-07-29 라이브에서
 * `ads:maintenance?phase=quality` 가 age 167분·stale 이었다(5단계 순환이라 정상인데도).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  staleGapMinutes, dailyGapMinutes, everyNHoursGapMinutes,
  maxPhaseGapHours, phaseGapMinutes, makeHourGates,
  neverFiredLanes, orphanLaneBeats, createLaneRegistry, type KickFn,
} from '../../worker-ads/lane-cadence'
import { expectedMaxAgeMinutes } from '../../worker/utils/cron-heartbeat'

describe('staleGapMinutes — cron-heartbeat 와 같은 공식', () => {
  it('기대주기 × 2 + 30', () => {
    expect(staleGapMinutes(60)).toBe(150)
    expect(staleGapMinutes(24 * 60)).toBe(2910)
  })

  it('매시간 주기는 expectedMaxAgeMinutes("0 * * * *") 와 동치 — 공식이 갈라지면 실패한다', () => {
    expect(staleGapMinutes(60)).toBe(expectedMaxAgeMinutes('0 * * * *'))
  })

  it('일 1회는 expectedMaxAgeMinutes("0 16 * * *") 와 동치', () => {
    expect(dailyGapMinutes()).toBe(expectedMaxAgeMinutes('0 16 * * *'))
  })

  it('0/음수는 최소 1분으로 클램프 — 0 을 넘겨도 즉시-stale 이 되지 않는다', () => {
    expect(staleGapMinutes(0)).toBe(32)
    expect(everyNHoursGapMinutes(0)).toBe(150)
  })
})

describe('maxPhaseGapHours — 자정 불연속까지 센다', () => {
  it('5단계: 단계 4 는 19시 다음이 다음날 4시 → 9시간(5가 아니다)', () => {
    expect(maxPhaseGapHours(5)).toBe(9)
  })

  it('24 의 약수면 정확히 그 값 — 단계를 6개로 늘리면 자동으로 6이 된다', () => {
    expect(maxPhaseGapHours(4)).toBe(4)
    expect(maxPhaseGapHours(6)).toBe(6)
    expect(maxPhaseGapHours(8)).toBe(8)
    expect(maxPhaseGapHours(1)).toBe(1)
  })

  it('약수가 아니면 항상 실제 최대 간격 ≥ 단계 수', () => {
    for (const p of [5, 7, 9, 10, 11]) expect(maxPhaseGapHours(p)).toBeGreaterThanOrEqual(p)
  })

  it('현행 5단계 순환의 stale 기준은 매시간 기준(150분)보다 확실히 크다 — 이게 오탐의 원인이었다', () => {
    expect(phaseGapMinutes(5)).toBeGreaterThan(staleGapMinutes(60))
    expect(phaseGapMinutes(5)).toBe(9 * 60 * 2 + 30)
  })
})

describe('makeHourGates — 발화 조건과 주기 신고가 같은 자리에서 나온다', () => {
  const spy = () => {
    const calls: Array<{ path: string; gap?: number }> = []
    const kick: KickFn = (path, _fn, opts) => { calls.push({ path, gap: opts?.gap }) }
    return { calls, kick }
  }
  const noop = async () => undefined

  it('dailyAt: 지정 시각에만 발화하고, 그때 일 1회 주기를 신고한다', () => {
    const s = spy()
    makeHourGates(16, s.kick).dailyAt(16, '/__ads/collect-nps', noop)
    makeHourGates(15, s.kick).dailyAt(16, '/__ads/collect-nps', noop)
    expect(s.calls).toEqual([{ path: '/__ads/collect-nps', gap: dailyGapMinutes() }])
  })

  it('everyNHours: 조건이 맞는 시각에만, N시간 주기를 신고한다', () => {
    const s = spy()
    for (const h of [0, 1, 2, 3]) makeHourGates(h, s.kick).everyNHours(2, 0, '/__ads/collect-storeinfo', noop)
    expect(s.calls).toHaveLength(2)                       // 0시·2시
    expect(s.calls.every(c => c.gap === everyNHoursGapMinutes(2))).toBe(true)
  })

  it('하루 24시간을 돌려도 일 1회 레인은 정확히 한 번', () => {
    const s = spy()
    for (let h = 0; h < 24; h++) makeHourGates(h, s.kick).dailyAt(20, '/__ads/collect-localdata', noop)
    expect(s.calls).toHaveLength(1)
  })
})

/**
 * 🛡️ 회귀 차단 — 시각 게이트가 `kick` 을 **직접** 호출하면 주기 신고가 빠진다.
 *
 * 이게 정확히 원래 버그의 모양이었다: 조건은 `hourUTC === 16` 인데 하트비트는 매시간으로 기록.
 * 조건과 주기를 따로 적을 수 있는 한 언젠가 또 어긋나고, 어긋나도 **조용하다**(경보만 늘 뿐).
 * ⚠️ 이 테스트가 못 막는 것: `gates.*` 를 쓰되 잘못된 시각/N 을 넣는 경우(값의 정합은 못 본다).
 */
describe('worker-ads/index.ts — 시각 게이트는 반드시 gates 헬퍼를 쓴다', () => {
  const src = readFileSync(join(process.cwd(), 'src/worker-ads/index.ts'), 'utf8')

  it('hourUTC 조건 블록 안에서 raw kick( 을 호출하지 않는다', () => {
    // `if (... hourUTC ...) {` 바로 뒤 몇 줄 안에 kick( 이 오면 위반.
    const offenders = [...src.matchAll(/if \([^\n]*hourUTC[^\n]*\) \{\n(?:[^\n]*\n){0,4}?[^\n]*\bkick\(/g)]
      .map(m => m[0].split('\n')[0].trim())
    expect(offenders).toEqual([])
  })

  it('검사 대상이 실제로 존재한다 — 0건 통과(측정 대상 없음)를 성공으로 오인하지 않게', () => {
    expect(src).toContain('makeHourGates')
    expect((src.match(/gates\.(dailyAt|everyNHours)\(/g) || []).length).toBeGreaterThanOrEqual(10)
  })

  it('단계 순환 레인은 단계 수에서 유도한 주기를 신고한다(리터럴 하드코딩 금지)', () => {
    expect(src).toMatch(/phaseGapMinutes\(PHASES\.length\)/)
  })
})

describe('neverFiredLanes — "게이트는 ON 인데 기록이 없다"', () => {
  it('하트비트가 없는 레인만 고른다', () => {
    expect(neverFiredLanes(['collect', 'collect-nps'], ['ads:collect', 'ads:scheduled']))
      .toEqual(['collect-nps'])
  })

  it('쿼리가 붙은 하트비트도 같은 레인으로 본다 — 단계 순환이 오탐되지 않게', () => {
    // maintenance 는 매 시간 ?phase=… 가 달라진다. 쿼리째 비교하면 4개 단계가 전부 never-fired 로 잡힌다.
    expect(neverFiredLanes(['maintenance'], ['ads:maintenance?phase=merge'])).toEqual([])
  })

  it('ads: 접두가 아닌 메인 워커 cron 은 비교에 끼어들지 않는다', () => {
    expect(neverFiredLanes(['collect'], ['cache-prewarm', 'retry-alimtalk'])).toEqual(['collect'])
  })

  it('알려진 레인이 없으면 아무것도 신고하지 않는다(첫 배포 오탐 방지)', () => {
    expect(neverFiredLanes([], ['ads:collect'])).toEqual([])
  })
})

describe('createLaneRegistry — 발화하지 않는 시각에도 레인을 알아본다', () => {
  it('일 1회 레인은 조건이 안 맞는 시각에도 등록된다 (이게 never-fired 판정의 전제)', () => {
    const reg = createLaneRegistry()
    const fired: string[] = []
    const kick: KickFn = (p) => { fired.push(p) }
    // 03시 — NPS(16시)는 발화하지 않는다
    makeHourGates(3, kick, reg).dailyAt(16, '/__ads/collect-nps', async () => undefined)
    expect(fired).toEqual([])                    // 안 돌았지만
    expect(reg.list()).toEqual(['collect-nps'])  // 존재는 안다
  })

  it('쿼리는 떼고 중복은 합친다', () => {
    const reg = createLaneRegistry()
    reg.note('/__ads/maintenance?phase=merge')
    reg.note('/__ads/maintenance?phase=quality')
    expect(reg.list()).toEqual(['maintenance'])
  })
})

/**
 * 🛡️ 순서 불변식 — 레인 등록은 `recordKnownLanes` **이전**에 끝나야 한다.
 *
 * 나중에 누가 kick 을 파일 아래쪽에 추가하면 그 레인은 목록에서 조용히 빠지고,
 * "게이트 ON 인데 기록 없음" 판정이 그 레인에 대해서만 영영 안 나온다(가드가 헛도는 클래스).
 */
describe('worker-ads/index.ts — 레인 등록은 저장보다 먼저 끝난다', () => {
  const src = readFileSync(join(process.cwd(), 'src/worker-ads/index.ts'), 'utf8')
  const lines = src.split('\n')
  const persistAt = lines.findIndex(l => l.includes('recordKnownLanes(env'))

  it('recordKnownLanes 호출이 존재한다', () => {
    expect(persistAt).toBeGreaterThan(0)
  })

  it('그 뒤로는 kick/gates 호출이 없다 — 있으면 그 레인이 목록에서 누락된다', () => {
    const after = lines.slice(persistAt + 1)
      .map((l, i) => ({ n: persistAt + 2 + i, l }))
      .filter(x => /\bkick\(|gates\.(dailyAt|everyNHours)\(/.test(x.l))
      .map(x => `${x.n}: ${x.l.trim().slice(0, 80)}`)
    expect(after).toEqual([])
  })
})

/**
 * 🛡️ 부모 cron 인보케이션에서 **라운드 루프를 돌리지 않는다**.
 *
 * 이 레포가 네 번 데인 실패 양식이다(#830 수집 러너 · #831 kick 격리 · #835 인플루언서 보강 ·
 * 2026-07-29 파트너풀 보강). `for (…) await env.SELF.fetch(…)` 를 부모에서 돌리면 그동안 부모가
 * 살아 있어야 하고, 부모가 먼저 회수되면 **뒤쪽 레인이 하트비트도 없이 조용히 사라진다**
 * (실측: 07:00 틱이 8개 레인에서 절단, 실패 기록 0). 라운드는 드라이버 인보케이션이 돈다.
 *
 * ⚠️ 이 테스트가 못 막는 것: 루프가 아닌 **단발** 인라인 await(무거운 단일 작업)는 잡지 않는다.
 */
describe('worker-ads/index.ts — 부모는 라운드 루프를 돌리지 않는다', () => {
  const src = readFileSync(join(process.cwd(), 'src/worker-ads/index.ts'), 'utf8')

  it('for 루프 안에서 env.SELF.fetch 를 await 하지 않는다', () => {
    // ⚠️ 표기 변종(`env.SELF.fetch` · `env.SELF?.fetch` · `env.SELF!.fetch`)을 전부 덮어야 한다 —
    //   처음 쓴 정규식이 `!` 를 놓쳐 회귀 주입을 통과시켰다(깨뜨려 보지 않았으면 헛도는 가드가 됐다).
    const offenders: string[] = []
    for (const m of src.matchAll(/\bfor\s*\(/g)) {
      const window = src.slice(m.index ?? 0, (m.index ?? 0) + 300)
      if (/await\s+env\.SELF\s*[!?]?\s*\.?\s*fetch/.test(window)) offenders.push(window.split('\n')[0].trim().slice(0, 70))
    }
    expect(offenders).toEqual([])
  })

  it('라운드가 필요한 레인은 드라이버 경로로 kick 한다(검사 대상 존재 확인)', () => {
    expect(src).toMatch(/kick\('\/__ads\/enrich-influencer-driver'/)
    expect(src).toMatch(/kick\('\/__ads\/enrich-company-driver'/)
  })
})

/**
 * 🛡️ 드라이버는 **응답을 라운드 뒤로 미루지 않는다**.
 *
 * 부모의 `kick` 은 SELF fetch 를 await 한다 → 드라이버가 라운드를 다 돌고 응답하면
 * 부모가 그 시간 내내 묶인다. #835 가 라운드를 부모의 *서브리퀘스트 예산*에서는 뺐지만
 * *수명*에서는 못 뺐던 이유이고, 그래서 07:00 틱에 느린 레인이 통째로 굶었다.
 * ⚠️ 못 막는 것: 드라이버가 아닌 **단발 느린 레인**(collect 등)은 여전히 부모를 붙잡는다.
 */
describe('enrich.routes.ts — 드라이버는 즉시 응답한다', () => {
  const src = readFileSync(join(process.cwd(), 'src/worker-ads/enrich.routes.ts'), 'utf8')

  it('드라이버 핸들러 본문에 라운드 for 루프가 직접 들어있지 않다', () => {
    const offenders: string[] = []
    for (const m of src.matchAll(/enrichRoutes\.post\('\/__ads\/[a-z-]*-driver'[\s\S]{0,600}?\n\}\)/g)) {
      if (/\bfor\s*\(/.test(m[0])) offenders.push(m[0].split('\n')[0].slice(0, 70))
    }
    expect(offenders).toEqual([])
  })

  it('드라이버는 체인을 await 한 채 응답하지 않는다 — 부모의 kick 이 그만큼 묶인다', () => {
    const offenders: string[] = []
    for (const m of src.matchAll(/enrichRoutes\.post\('\/__ads\/[a-z-]*-driver'[\s\S]{0,600}?\n\}\)/g)) {
      if (/await\s+runRoundChain\(/.test(m[0])) offenders.push(m[0].split('\n')[0].slice(0, 70))
    }
    expect(offenders).toEqual([])
  })

  it('체인은 waitUntil 로 분리되고 결과를 하트비트로 남긴다(관측 유실 금지)', () => {
    expect(src).toMatch(/executionCtx\?\.waitUntil/)
    expect(src).toMatch(/driverBeat\(/)
  })

  it('드라이버가 두 개 다 분리 헬퍼를 쓴다(검사 대상 존재 확인)', () => {
    expect((src.match(/dispatchRoundChain\(/g) || []).length).toBeGreaterThanOrEqual(3)
  })

  /**
   * 🔎 **부분 실행이 조용히 성공으로 보이지 않는가** (2026-07-29 라이브 실측 후 추가).
   *
   * 10:00 틱 기록: `ads:enrich-influencer-driver · ok:true · ms:18,615`. 12라운드를 계획했는데
   * 라운드 1회가 실측 16초니 **한 라운드밖에 못 돈 것**이다. 그런데 `ok:true` 라 화면상 정상이었고,
   * 왜 멈췄는지는 어디에도 없었다. 이 레포가 반복해 만난 형태 — 실패가 아니라 **조용한 부분 실행**.
   *
   * ⚠️ 지금 구현은 self-chain(라운드마다 새 인보케이션)이라 depth 0 이 "몇 라운드 돌았는지"를 알 수 없다.
   *    대신 `planned`(계획) 와 `chained`(다음 라운드를 낳았는가) 로 판정한다 — 계획이 12인데
   *    `chained=false` 면 그 자리에서 끊긴 것이고, `error` 가 그 이유다.
   */
  it('체인 결과(planned/chained/error)를 하트비트에 남긴다 — 부분 실행을 조용히 넘기지 않는다', () => {
    const beat = /async function driverBeat\([\s\S]{0,700}?\n\}/.exec(src)?.[0] || ''
    expect(beat).toMatch(/recordCronBeat\(/)
    for (const k of ['planned', 'chained', 'error']) expect(beat).toContain(k)
  })
})

/**
 * 🛡️ ur-ads 배포 트리거가 **실제 의존 코드**를 덮는가.
 *
 * `deploy-ads.yml` 의 `paths` 는 손으로 적은 목록이라 드리프트한다. 실제로 드리프트해 있었다:
 * `src/worker/**`(ur-ads 의 하트비트 기록기 `cron-heartbeat.ts` 가 여기 있다)와
 * `src/features/social-media/**`(매시간 도는 소셜 유지보수)가 빠져 있어서, 그 파일만 바꾸면
 * **배포가 아예 안 돌고 ur-ads 는 조용히 낡은 코드로 계속 돈다** — 실패도 안 나므로 눈치채기 어렵다.
 *
 * ⚠️ 못 막는 것: 전이 의존(worker-ads → marketing → 제3의 폴더)까지는 안 본다. 직접 import 만.
 */
describe('deploy-ads.yml — 배포 트리거가 ur-ads 의존 경로를 덮는다', () => {
  const wf = readFileSync(join(process.cwd(), '.github/workflows/deploy-ads.yml'), 'utf8')
  const srcFiles = ['index.ts', 'enrich.routes.ts', 'public-data.routes.ts', 'lane-cadence.ts']
    .map(f => join(process.cwd(), 'src/worker-ads', f))
    .filter(p => { try { readFileSync(p); return true } catch { return false } })

  // `@/features/marketing/...` → 'src/features/marketing' · `@/worker/utils/...` → 'src/worker/utils'
  const prefixes = new Set<string>()
  for (const f of srcFiles) {
    const t = readFileSync(f, 'utf8')
    for (const m of t.matchAll(/@\/([a-z-]+)\/([a-z-]+)/g)) prefixes.add(`src/${m[1]}/${m[2]}`)
  }
  /** 정확히 그 경로거나, 더 넓은 상위 경로가 있으면 덮인 것으로 본다. */
  const covered = (p: string): boolean => {
    const parts = p.split('/')
    for (let i = parts.length; i >= 2; i--) if (wf.includes(`'${parts.slice(0, i).join('/')}/**'`)) return true
    return false
  }

  it('검사 대상이 실제로 있다 — 0건 통과를 성공으로 오인하지 않게', () => {
    expect(srcFiles.length).toBeGreaterThan(0)
    expect(prefixes.size).toBeGreaterThan(0)
  })

  it('worker-ads 가 import 하는 모든 최상위 경로가 paths 에 있다', () => {
    const missing = [...prefixes].filter(p => !covered(p)).sort()
    expect(missing).toEqual([])
  })
})

describe('orphanLaneBeats — 기록은 있는데 지금은 아무도 안 부르는 이름', () => {
  it('알려진 목록에 없는 ads 기록을 고아로 잡는다', () => {
    // 실측 사례: sweep-kakao-phone → sweep-kakao-chain 개명 후 옛 행이 영원히 stale
    expect(orphanLaneBeats(['sweep-kakao-chain'], ['ads:sweep-kakao-phone', 'ads:sweep-kakao-chain']))
      .toEqual(['ads:sweep-kakao-phone'])
  })

  it("스케줄러 자체 신호('scheduled')는 레인이 아니므로 고아로 보지 않는다", () => {
    expect(orphanLaneBeats(['collect'], ['ads:scheduled', 'ads:collect'])).toEqual([])
  })

  it('쿼리가 붙은 이름도 레인 기준으로 판정한다', () => {
    expect(orphanLaneBeats(['maintenance'], ['ads:maintenance?phase=merge'])).toEqual([])
  })

  it('메인 워커 cron 은 비교 대상이 아니다', () => {
    expect(orphanLaneBeats([], ['cache-prewarm', 'retry-alimtalk'])).toEqual([])
  })

  it('never_fired 와 정확히 반대 방향이다 — 둘을 같이 봐야 "안 도는 것"과 "이제 없는 것"이 갈린다', () => {
    const known = ['collect', 'collect-nps']
    const beats = ['ads:collect', 'ads:old-lane']
    expect(neverFiredLanes(known, beats)).toEqual(['collect-nps'])
    expect(orphanLaneBeats(known, beats)).toEqual(['ads:old-lane'])
  })
})
