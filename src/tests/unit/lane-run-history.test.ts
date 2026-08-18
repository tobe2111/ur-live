import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  summarizeLaneRun, appendRunHistory, serializeRunHistory, serializeLaneStamp,
  LANE_RUN_HISTORY_MAX, LANE_RUNS_KEY,
} from '@/worker-ads/lane-run-history'

/**
 * 🎞️ **회차 이력 + 스탬프 안전 직렬화**
 *
 * 이 둘은 같은 사고에서 나왔다: **관측값이 없거나 깨져서 오진했다.**
 *   · 유실/실패를 못 갈라 "알람 유실"로 단정했다(실제로는 외부 API 네트워크 오류였다)
 *   · 스탬프가 2000자에서 잘려 `collect`·`scan-notices` 가 파싱 불가였다
 *
 * ## 이 테스트가 못 막는 것
 * - 이력이 **런타임에 실제로 쌓이는지** — DO 배선은 아래 앵커로 문자열만 확인한다.
 * - 12회차가 적절한 창인지 — 그건 라이브 패턴을 봐야 안다.
 */
describe('summarizeLaneRun — 무엇을 회차로 세는가', () => {
  it('skip 회차는 이력에 안 남긴다(이력이 스스로를 밀어내면 안 된다)', () => {
    expect(summarizeLaneRun({ skipped: 'min_interval', last_run_at: 1 }, undefined, 0)).toBeNull()
  })

  it('예외로 죽은 회차는 실패로 남는다', () => {
    const e = summarizeLaneRun(null, 'TypeError: boom', Date.UTC(2026, 7, 18, 4, 5))
    expect(e).toMatchObject({ ok: false, e: 'TypeError: boom', t: '2026-08-18T04:05' })
  })

  it('🩸 라이브 실측 — 예외 없이 diag.error 로만 실패한 회차도 실패로 센다', () => {
    // 2026-08-18 00:00 회차: 34.9초 정상 종료, found 0, diag.error 에만 네트워크 오류.
    // 이걸 성공으로 세면 "돌았는데 왜 0건이지?" 를 영영 못 푼다.
    const e = summarizeLaneRun({ found: 0, saved: 0, diag: { error: 'API: 등록현황: 네트워크 오류' } }, undefined, 0)
    expect(e?.ok).toBe(false)
    expect(e?.e).toContain('네트워크 오류')
    expect(e?.n).toBe(0)
  })

  it('레인마다 다른 저장 필드 이름을 흡수한다', () => {
    expect(summarizeLaneRun({ saved: 990 }, undefined, 0)?.n).toBe(990)
    expect(summarizeLaneRun({ last_saved: 141 }, undefined, 0)?.n).toBe(141)
    expect(summarizeLaneRun({ nothing: 1 }, undefined, 0)?.n).toBeNull()
  })
})

describe('appendRunHistory', () => {
  const mk = (t: string) => ({ t, ok: true, n: 1 })
  it('최신이 앞이고 상한을 넘으면 오래된 것부터 버린다', () => {
    let h = [] as ReturnType<typeof mk>[]
    for (let i = 0; i < LANE_RUN_HISTORY_MAX + 5; i++) h = appendRunHistory(h, mk(`t${i}`))
    expect(h).toHaveLength(LANE_RUN_HISTORY_MAX)
    expect(h[0].t).toBe(`t${LANE_RUN_HISTORY_MAX + 4}`)
  })
  it('저장된 값이 깨져 있어도 죽지 않는다(관측이 체인을 끊으면 안 된다)', () => {
    expect(appendRunHistory('not json', mk('a'))).toHaveLength(1)
    expect(appendRunHistory([{ junk: 1 }, mk('b')], null)).toHaveLength(1)
  })
  it('null 항목(skip)은 이력을 밀어내지 않는다', () => {
    const h = appendRunHistory([mk('a'), mk('b')], null)
    expect(h.map(r => r.t)).toEqual(['a', 'b'])
  })
})

describe('직렬화 — 잘린 JSON 을 만들지 않는다', () => {
  it('이력이 예산을 넘으면 자르지 않고 개수를 줄인다', () => {
    const long = Array.from({ length: 12 }, (_, i) => ({ t: `2026-08-18T0${i % 10}:00`, ok: false, n: 0, e: 'x'.repeat(60) }))
    const s = serializeRunHistory(long, 300)
    expect(s.length).toBeLessThanOrEqual(300)
    expect(() => JSON.parse(s)).not.toThrow()
    expect(JSON.parse(s).length).toBeLessThan(12)
  })

  it('🩸 스탬프 — 큰 stats 는 잘리는 대신 통째로 빠진다', () => {
    const base = { at: '2026-08-18T00:00:00.000Z', lane: 'collect', ms: 32646 }
    const huge = { funnel: { days: Array.from({ length: 60 }, (_, i) => ({ d: `2026-08-${i}`, saved: 4977 })) } }
    const s = serializeLaneStamp(base, huge, 2000)
    expect(s.length).toBeLessThanOrEqual(2000)
    const parsed = JSON.parse(s) // ← 예전 `.slice(0, 2000)` 은 여기서 던졌다(라이브 2건이 그 상태였다)
    expect(parsed.lane).toBe('collect')
    expect(parsed.stats).toBeNull()
    expect(parsed.stats_omitted).toBe(true)
  })

  it('작은 stats 는 그대로 실린다', () => {
    const s = serializeLaneStamp({ lane: 'collect-commerce' }, { found: 0, saved: 0 })
    expect(JSON.parse(s).stats).toEqual({ found: 0, saved: 0 })
  })
})

describe('🔌 DO 배선 — 계측이 실제로 기록되는 자리', () => {
  const src = readFileSync('src/worker-ads/lane-alarm.ts', 'utf8')
  it('회차 이력을 DO 저장소와 D1 양쪽에 남긴다', () => {
    expect(src).toContain('summarizeLaneRun(stats, error, t0)')
    expect(src).toContain('put.runHistory = runHistory')
    expect(src).toMatch(new RegExp(`\\$\\{${'LANE_RUNS_KEY'}\\}`))
  })
  it('스탬프에 생 slice 가 돌아오지 않는다(그게 파싱 불가의 원인이었다)', () => {
    expect(src).toContain('serializeLaneStamp(')
    expect(src).not.toMatch(/\}\)\.slice\(0, 2000\)/)
  })
  it('이력 쓰기가 같은 batch 안에 있다 — 서브리퀘스트를 더 쓰면 가장 빠듯한 지점에 얹는 셈이다', () => {
    // ⚠️ 소스에는 **식별자**가 있고 값(ads_lane_runs)은 없다 — 값으로 찾으면 영원히 실패한다.
    expect(LANE_RUNS_KEY).toBe('ads_lane_runs')
    const batch = src.slice(src.indexOf('await DB.batch(['), src.indexOf('])', src.indexOf('await DB.batch([')))
    expect(batch).toContain('LANE_RUNS_KEY')
  })
})
