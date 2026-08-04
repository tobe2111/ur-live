/**
 * 🧠 **CPU 사망 자기교정** — 계약 (2026-08-04, 대표 승인 "응 하자").
 *
 * 08-04 에 사람이 손으로 한 것(재분류 5,000행→1,000행 · 파트너 수집 마감선)을 기계가 하게 한다.
 * 그 손작업은 **효과가 라이브로 확인됐다**(`ms=1,316` 사망 → `ms=5,681` 완주 · `run_ms 31,376 → 12,981`).
 *
 * ## 이 시험이 지키는 것
 * 1. **되돌릴 수 있는가** — 바닥이 있고, 깨끗하면 되돌아오고, 완전 회복하면 흔적이 사라진다
 * 2. **엉뚱한 신호에 안 움직이는가** — CPU 와 무관한 실패로 상한을 내리면 멀쩡한 레인이 쪼그라든다
 * 3. **쓰기를 아끼는가** — 바뀐 게 없으면 `changed:false`(매 회차 D1 쓰기를 하면 안 된다)
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * - **문구 변화**: Cloudflare 가 에러 문장을 바꾸면 `isCpuDeath` 가 조용히 안 잡는다. 그때는
 *   백오프가 멈출 뿐 오작동은 아니다(안전한 방향) — 하지만 자동수리가 사라진 걸 아무도 모른다.
 *   ⇒ 그 감지는 이 유닛이 아니라 **라이브 하트비트**로만 가능하다.
 * - **q 가 바닥에 붙은 레인**: 줄여도 계속 죽는다는 뜻이라 근본 원인이 따로 있다. 기계는 못 고친다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  isCpuDeath, parseQuanta, quantumFor, applyQuantum, reduceCpuQuanta,
  Q_MIN, Q_BACKOFF, Q_CLEAN_RUNS, CPU_QUANTA_KEY,
} from '@/features/marketing/api/cpu-quantum'

// ⚠️ **라이브의 실제 모양**이다 — `adsBeat` 이 실패를 객체로 싣는다(문자열이 아니다).
//   첫 판이 문자열을 가정했다가 `"[object Object]"` 로 영영 안 잡히는 무음 고장을 만들 뻔했다.
const death = (name: string) => ({ name, ok: false, result: { err: 'limit', detail: 'Worker exceeded CPU time limit.' } })
const good = (name: string) => ({ name, ok: true, result: null })

describe('isCpuDeath — 라이브 실측 문자열로 고정', () => {
  it('🔑 **객체**로 들어온다 — adsBeat 이 싣는 실제 모양', () => {
    // `adsBeat`: result = { err: cronErrorCode(err), detail: '…' }. 문자열로 가정하면 영영 안 잡힌다.
    expect(isCpuDeath({ err: 'limit', detail: 'Worker exceeded CPU time limit.' })).toBe(true)
    expect(isCpuDeath({ err: 'Error', detail: 'Worker exceeded CPU time limit.' })).toBe(true)
  })
  it('문자열로 와도 잡는다(하트비트 행의 r 필드)', () => {
    // 2026-08-04 `cron_hb:ads:collect-hira` 저장된 원문
    expect(isCpuDeath('err=Error detail=Worker exceeded CPU time limit.')).toBe(true)
  })
  it('무관한 실패는 안 잡는다 — 여기서 오탐하면 멀쩡한 레인이 쪼그라든다', () => {
    // 서브리퀘스트 한도는 `nextSubreqCap` 소관이다 — 두 조절기가 같은 신호를 두 번 먹으면 안 된다.
    expect(isCpuDeath({ err: 'limit', detail: 'Too many subrequests.' })).toBe(false)
    expect(isCpuDeath('err=Error detail=Too many subrequests.')).toBe(false)
    expect(isCpuDeath('SYNC_FAILED')).toBe(false)
    expect(isCpuDeath(null)).toBe(false)
    expect(isCpuDeath(undefined)).toBe(false)
    expect(isCpuDeath('')).toBe(false)
  })
})

describe('백오프 — 죽으면 반으로', () => {
  it('첫 사망에 절반', () => {
    const { next, changed } = reduceCpuQuanta({}, [death('a')])
    expect(changed).toBe(true)
    expect(next.a.q).toBe(Q_BACKOFF)
  })

  it('계속 죽어도 바닥 아래로는 안 간다 — 0 이면 레인이 영영 아무것도 못 한다', () => {
    let s = {}
    for (let i = 0; i < 20; i++) s = reduceCpuQuanta(s, [death('a')]).next
    expect(quantumFor(s, 'a')).toBe(Q_MIN)
  })

  it('사망은 회복 카운터를 리셋한다', () => {
    let s = reduceCpuQuanta({}, [death('a')]).next
    s = reduceCpuQuanta(s, [good('a')]).next
    expect(s.a.c).toBe(1)
    s = reduceCpuQuanta(s, [death('a')]).next
    expect(s.a.c).toBe(0)
  })
})

describe('회복 — 깨끗하면 가산으로 되돌아온다', () => {
  it(`깨끗한 회차 ${Q_CLEAN_RUNS}번마다 한 단계 오른다`, () => {
    let s = reduceCpuQuanta({}, [death('a')]).next
    const before = s.a.q
    for (let i = 0; i < Q_CLEAN_RUNS; i++) s = reduceCpuQuanta(s, [good('a')]).next
    expect(s.a.q).toBeGreaterThan(before)
  })

  it('완전히 회복하면 표에서 사라진다 — 표가 무한히 자라면 안 된다', () => {
    let s = reduceCpuQuanta({}, [death('a')]).next
    for (let i = 0; i < 200 && s.a; i++) s = reduceCpuQuanta(s, [good('a')]).next
    expect(s.a).toBeUndefined()
    expect(quantumFor(s, 'a')).toBe(1)
  })

  it('🔑 회복이 **가산**이다 — 배율이면 백오프(×0.5)와 맞물려 2주기 진동한다', () => {
    // nextSubreqCap 이 같은 실사고로 배율→가산으로 바뀌었다. 같은 함정을 여기서 다시 파지 않는다.
    let s = reduceCpuQuanta({}, [death('a')]).next
    const steps: number[] = []
    for (let r = 0; r < 3; r++) {
      for (let i = 0; i < Q_CLEAN_RUNS; i++) s = reduceCpuQuanta(s, [good('a')]).next
      if (s.a) steps.push(s.a.q)
    }
    // 가산이면 증가폭이 일정하다. 배율이면 갈수록 커진다.
    if (steps.length >= 2) {
      const d1 = steps[1] - steps[0]
      expect(d1).toBeLessThanOrEqual(0.11)
    }
  })
})

describe('🔑 엉뚱한 신호에 안 움직인다', () => {
  it('CPU 무관 실패는 상한을 안 내린다', () => {
    const { next, changed } = reduceCpuQuanta({}, [{ name: 'a', ok: false, result: { err: 'limit', detail: 'Too many subrequests' } }])
    expect(changed).toBe(false)
    expect(next.a).toBeUndefined()
  })

  it('제한 없는 레인의 성공은 아무 일도 안 한다 — 매 회차 쓰기가 되면 안 된다', () => {
    const { next, changed } = reduceCpuQuanta({}, [good('a'), good('b'), good('c')])
    expect(changed).toBe(false)
    expect(Object.keys(next)).toHaveLength(0)
  })
})

describe('applyQuantum — 실제 상한에 적용', () => {
  it('배수만큼 줄이되 바닥을 지킨다', () => {
    expect(applyQuantum(1000, 0.5)).toBe(500)
    expect(applyQuantum(1000, 0.2)).toBe(200)
    expect(applyQuantum(3, 0.2, 1)).toBe(1)       // 바닥이 없으면 0 이 된다
    expect(applyQuantum(12, 0.5, 2)).toBe(6)
  })
  it('제한이 없으면(q>=1) 원래 값 그대로', () => {
    expect(applyQuantum(1000, 1)).toBe(1000)
    expect(applyQuantum(1000, 5)).toBe(1000)
  })
  it('손상값에 throw 하지 않는다', () => {
    expect(applyQuantum(1000, NaN)).toBe(1000)
    expect(applyQuantum(NaN, 0.5)).toBeNaN()
    expect(applyQuantum(0, 0.5)).toBe(0)
  })
})

describe('parseQuanta — 손상 내성', () => {
  it('부재·손상은 빈 표', () => {
    expect(parseQuanta(null)).toEqual({})
    expect(parseQuanta('{{{')).toEqual({})
    expect(parseQuanta('[1,2]')).toEqual({})
  })
  it('범위 밖 값은 버린다 — 저장이 오염돼도 레인을 멈추면 안 된다', () => {
    expect(parseQuanta('{"a":{"q":0,"c":0}}').a).toBeUndefined()
    expect(parseQuanta('{"a":{"q":-1,"c":0}}').a).toBeUndefined()
    expect(parseQuanta('{"a":{"q":2,"c":0}}').a).toBeUndefined()   // 1 이상이면 제한이 아니다
  })
  it('정상값은 살린다', () => {
    expect(parseQuanta('{"a":{"q":0.5,"c":2}}')).toEqual({ a: { q: 0.5, c: 2 } })
  })
  it('저장 키가 단일 행이다 — 레인마다 행을 만들면 표가 폭증한다', () => {
    expect(CPU_QUANTA_KEY).toBe('ads_cpu_quanta')
  })
})

describe('🚧 배선 — 학습값이 실제로 상한을 줄이는가 (가짜 DB로 동작 확인)', () => {
  const fakeDB = (value: string | null) => ({
    prepare: () => ({ bind: () => ({ first: async () => (value === null ? null : { value }) }) }),
  })

  it('DB 를 안 주면 종전 값 그대로 — 테스트·수동 호출 무영향', async () => {
    const { reclassifyWorkPlan } = await import('@/features/marketing/api/collect-budget')
    const plan = await reclassifyWorkPlan(undefined)
    expect(plan.rowsPerPass).toBe(250)
    expect(plan.q).toBeUndefined()
  })

  it('학습값이 없으면(빈 표) 줄이지 않는다', async () => {
    const { reclassifyWorkPlan } = await import('@/features/marketing/api/collect-budget')
    const plan = await reclassifyWorkPlan(undefined, fakeDB('{}') as never)
    expect(plan.rowsPerPass).toBe(250)
  })

  it('🔑 학습값이 있으면 **실제로 줄어든다** — 이게 이 기능의 전부다', async () => {
    const { reclassifyWorkPlan, RECLASSIFY_LANE } = await import('@/features/marketing/api/collect-budget')
    const plan = await reclassifyWorkPlan(undefined, fakeDB(JSON.stringify({ [RECLASSIFY_LANE]: { q: 0.5, c: 0 } })) as never)
    expect(plan.rowsPerPass).toBeLessThan(250)
    expect(plan.q).toBe(0.5)
  })

  it('🔑 레인 이름이 하트비트 키와 같다 — `ads:` 를 빼면 학습값이 있어도 조용히 안 걸린다', async () => {
    const { RECLASSIFY_LANE } = await import('@/features/marketing/api/collect-budget')
    // `adsBeat` 이 `ads:${name}` 으로 싣는다. 이 접두어가 없으면 표를 못 찾고 **에러 없이** 안 줄어든다.
    expect(RECLASSIFY_LANE.startsWith('ads:')).toBe(true)
    expect(RECLASSIFY_LANE).toBe('ads:reclassify-company?passes=5')
  })

  it('바닥이 있다 — 아무리 줄여도 0 행이 되면 백로그가 영영 안 준다', async () => {
    const { reclassifyWorkPlan, RECLASSIFY_LANE } = await import('@/features/marketing/api/collect-budget')
    const plan = await reclassifyWorkPlan(undefined, fakeDB(JSON.stringify({ [RECLASSIFY_LANE]: { q: 0.2, c: 0 } })) as never)
    expect(plan.rowsPerPass).toBeGreaterThanOrEqual(50)
    expect(plan.maxRows).toBeGreaterThanOrEqual(100)
  })

  it('DB 가 던져도 레인이 안 죽는다 — 학습 실패가 수집을 막으면 안 된다', async () => {
    const { reclassifyWorkPlan } = await import('@/features/marketing/api/collect-budget')
    const boom = { prepare: () => ({ bind: () => ({ first: async () => { throw new Error('D1 down') } }) }) }
    const plan = await reclassifyWorkPlan(undefined, boom as never)
    expect(plan.rowsPerPass).toBe(250)   // 종전 값으로 진행
  })

  it('감지 배선 — 하트비트를 **쓴 뒤에** 학습한다(순서가 뒤집히면 기록을 잃는다)', () => {
    const src = readFileSync(join(process.cwd(), 'src/worker-ads/beat-batch.ts'), 'utf8')
    const write = src.indexOf('await env.DB.batch(list.map((b) => {')
    const learn = src.indexOf('await learnCpuQuanta(env, list)')
    expect(write, '하트비트 배치 쓰기를 못 찾았다').toBeGreaterThan(0)
    expect(learn, '학습 호출이 없다 — 순수함수만 있고 아무도 안 부르면 아무 일도 안 일어난다').toBeGreaterThan(0)
    expect(learn).toBeGreaterThan(write)
    // fail-soft: 학습이 던져도 이 함수가 실패하면 안 된다
    expect(src).toMatch(/await learnCpuQuanta\(env, list\)\.catch\(/)
  })
  // ── 소비 배선 (2026-08-05) — 감지만 있고 소비가 없으면 그냥 no-op 이다 ──────────────────
  describe('readLaneSettings — 한 조회로 설정 + CPU 배수', () => {
    /** 한 문장으로 여러 키를 돌려주는 가짜 D1. 발행된 SQL/바인드도 검사할 수 있게 기록한다. */
    const manyDB = (rows: Record<string, string>) => {
      const seen: { sql: string; binds: unknown[] } = { sql: '', binds: [] }
      return {
        seen,
        db: {
          prepare: (sql: string) => ({
            bind: (...binds: unknown[]) => {
              seen.sql = sql; seen.binds = binds
              return { all: async () => ({ results: binds.filter(b => rows[String(b)] != null).map(b => ({ key: String(b), value: rows[String(b)] })) }) }
            },
          }),
        },
      }
    }

    it('조회는 **한 번**이다 — 레인마다 읽기를 늘리면 부모 꼬리 예산을 갉는다', async () => {
      const { readLaneSettings, CPU_QUANTA_KEY } = await import('@/features/marketing/api/cpu-quantum')
      const { seen, db } = manyDB({ a: '1', b: '2' })
      const s = await readLaneSettings(db as never, ['a', 'b'], 'ads:x')
      expect(s.get('a')).toBe('1')
      expect(s.get('b')).toBe('2')
      // 요청한 키 + 학습표가 **같은 문장**에 들어간다
      expect(seen.sql).toContain('key IN (?,?,?)')
      expect(seen.binds).toEqual(['a', 'b', CPU_QUANTA_KEY])
    })

    it('학습값이 있으면 그 레인의 배수가 나온다', async () => {
      const { readLaneSettings, CPU_QUANTA_KEY } = await import('@/features/marketing/api/cpu-quantum')
      const { db } = manyDB({ [CPU_QUANTA_KEY]: JSON.stringify({ 'ads:collect-hira': { q: 0.5, c: 0 } }) })
      expect((await readLaneSettings(db as never, [], 'ads:collect-hira')).q).toBe(0.5)
      expect((await readLaneSettings(db as never, [], 'ads:other')).q).toBe(1)   // 표에 없으면 제한 없음
    })

    it('🔒 실패는 항상 안전한 방향 — 조회가 깨져도 q=1(현행 그대로), 더 일하지 않는다', async () => {
      const { readLaneSettings } = await import('@/features/marketing/api/cpu-quantum')
      const boom = { prepare: () => ({ bind: () => ({ all: async () => { throw new Error('D1 down') } }) }) }
      const s = await readLaneSettings(boom as never, ['a'], 'ads:x')
      expect(s.q).toBe(1)
      expect(s.get('a')).toBeUndefined()
      expect((await readLaneSettings(null, ['a'], 'ads:x')).q).toBe(1)
      // 배수 1 은 원본을 그대로 통과시킨다 = 레인 동작 무변화
      const { applyQuantum } = await import('@/features/marketing/api/cpu-quantum')
      expect(applyQuantum(3, s.q, 1)).toBe(3)
    })
  })

  describe('레인 소비 배선 — 표에 적히기만 하고 아무도 안 읽으면 조용한 no-op 이다', () => {
    const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

    it('collect-hira — 페이지 수에 배수가 걸린다', () => {
      const src = read('src/features/marketing/api/hira-hospital-collect.ts')
      // 레인 이름은 하트비트와 **글자 그대로** 같아야 표를 찾는다(`ads:` 접두어 포함)
      expect(src).toContain("'ads:collect-hira'")
      expect(src).toMatch(/maxPages = maxPagesArg \?\? applyQuantum\(/)
      // 조회 합치기 — 예전의 개별 SELECT 두 건이 남아 있으면 비용 주장이 거짓이 된다
      expect(src).not.toContain('bind(STATS_KEY)')
      expect(src).not.toContain('bind(CURSOR_KEY)')
    })

    it('maintenance — phase 별로 배우고, 연산 예산에 배수가 걸린다', () => {
      const src = read('src/features/marketing/api/influencer-maintenance.ts')
      // 하트비트가 `ads:maintenance?phase=quality` 로 적히므로 키도 그 형태여야 한다
      expect(src).toContain('`ads:maintenance?phase=${phase}`')
      expect(src).toMatch(/const total = applyQuantum\(resolveSubreqBudget\(/)
    })
  })
})
