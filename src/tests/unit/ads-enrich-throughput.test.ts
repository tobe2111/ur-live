/**
 * 📏 **측정 레인 전수조사 수리 4건** (2026-08-03 — 대표 *"측정으로 전수조사"* → *"모두 구현"*).
 *
 * 발견은 전부 라이브 실측이다. 요약:
 * ```
 *   유튜브 쿼터 10,000/일
 *     검색  배정 9,000(90회) · 실사용 2,200(22회)   ← 6,800 유휴
 *     성과  배정 2,000       · 실사용 2,003         ← 소진 → 그날 남은 시간 측정 0
 *   수율   유튜브 45.2%  vs  네이버 블로그 28.6%   ← 멎은 쪽이 더 좋은 축이었다
 *   효율   PT 하루 2,003 units 로 106행 = 19콜/행 (코드상 건당 2~3콜)
 * ```
 *
 * ⚠️ **이 테스트가 못 보는 것**: 19콜/행이 실제로 낮아지는지 — 그건 라이브 한 사이클 뒤에
 *   `yt_rows` / `yt_units` 로 판정한다(그 계측을 이번에 같이 넣었다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  resolveYtPerfCap, pickNaverFirst, starvedLastRound,
  YT_DAILY_QUOTA_UNITS, YT_SEARCH_FLOOR_UNITS,
} from '@/features/marketing/api/influencer-enrich-lane'
import { ENRICH_DEADLINE_MS_ALARM, ENRICH_DEADLINE_MS_DEFAULT } from '@/features/marketing/api/collect-budget'

// 📈 YT 성과는 600줄 래칫으로 `influencer-yt-performance.ts` 로 분리됐다(순수 이동).
//   ⚠️ 앵커를 옮기지 않으면 이 가드가 **빈 파일을 검사하며 조용히 통과**한다 — 이 레포의 "낡은 지도" 클래스.
const YTPERF = readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-yt-performance.ts'), 'utf8')
const LANE = readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-enrich-lane.ts'), 'utf8')
const RUNNERS = readFileSync(join(process.cwd(), 'src/worker-ads/lane-alarm-runners.ts'), 'utf8')

/**
 * ①-a 건너뛴 행이 `pub_checked_at` 을 못 받아 **영구히 선두**로 남던 것.
 *   선택 순서가 `(pub_checked_at IS NULL) DESC` 라, 스탬프가 없으면 다음 회차도 같은 행을 먼저 집고
 *   채널콜을 또 태운다 — 그게 19콜/행의 정체다.
 */
describe('①-a YT 재선택 churn — 건너뛴 행도 pub 은 확인됐다', () => {
  it('🔒 예산으로 건너뛴 행에도 pub_checked_at 을 찍는다', () => {
    const skipped = /if \(budgetSkipped\.has\(r\.id\) \|\| measureFailed\)[\s\S]{0,400}?\.bind\(/.exec(YTPERF)?.[0] || ''
    expect(skipped, '건너뛰기 분기를 못 찾음(파일이 또 옮겨갔다면 앵커를 갱신할 것)').not.toBe('')
    expect(skipped).toMatch(/pub_checked_at = datetime\('now'\)/)
  })

  it('🔒 그래도 perf_checked_at 은 안 찍는다 — 0 각인은 "측정했는데 0회"와 구분이 안 된다', () => {
    const skipped = /if \(budgetSkipped\.has\(r\.id\) \|\| measureFailed\)[\s\S]{0,400}?\.bind\(/.exec(YTPERF)?.[0] || ''
    expect(skipped).not.toMatch(/perf_checked_at = datetime/)
  })

  it('📌 순서가 pub_checked_at 을 여전히 본다 — 안 보면 이 수리가 무의미하다', () => {
    expect(YTPERF).toMatch(/\(pub_checked_at IS NULL\) DESC/)
  })
})

/** ①-b 검색이 안 쓰는 쿼터를 성과가 넘겨받는다. */
describe('①-b YT 성과 상한 — 고정이 아니라 검색 실사용의 나머지', () => {
  it('🔒 검색이 적게 쓰면 성과가 크게 받는다 (라이브: 검색 22회=2,200)', () => {
    expect(resolveYtPerfCap(2200)).toBe(YT_DAILY_QUOTA_UNITS - YT_SEARCH_FLOOR_UNITS) // 7,000
    expect(resolveYtPerfCap(2200)).toBeGreaterThan(2000)                              // 오늘보다 반드시 낫다
  })

  it('🔒 검색이 많이 쓴 날은 성과가 줄어든다 — 같은 풀이다', () => {
    expect(resolveYtPerfCap(6000)).toBe(4000)
    expect(resolveYtPerfCap(8000)).toBe(2000) // 기본값 바닥
  })

  it('🔒 검색 바닥을 절대 침범하지 않는다 — 성과가 굶주려도 검색은 돈다', () => {
    for (const used of [0, 1000, 2200, 5000, 9000, 99999]) {
      expect(resolveYtPerfCap(used), `used=${used}`).toBeLessThanOrEqual(YT_DAILY_QUOTA_UNITS - YT_SEARCH_FLOOR_UNITS)
    }
  })

  /**
   * 🚧 **무료 한도를 구조적으로 못 넘는다** (2026-08-03 대표 질문으로 발견).
   *   옛 규칙 *"기본값 2,000 밑으로 안 내려간다"* 는 **틀렸다** — 검색이 9,000(배정 90회)을 쓴 날
   *   성과 2,000 을 보장하면 총 11,000 으로 일일 쿼터를 넘는다. 바닥보다 **총합**이 상위 불변식이다.
   */
  it('🔒 검색 실사용 + 성과 상한 ≤ 일일 쿼터 — 어떤 입력에도', () => {
    for (const used of [0, 1000, 2200, 5000, 6000, 7500, 8000, 8500, 9000, 9999, 10000]) {
      expect(used + resolveYtPerfCap(used), `used=${used}`).toBeLessThanOrEqual(YT_DAILY_QUOTA_UNITS)
    }
  })

  it('🔒 쿼터가 남아 있는 한 오늘보다 나빠지지 않는다(기본값 2,000)', () => {
    for (const used of [0, 2200, 5000, 8000, Number.NaN, -5]) {
      expect(resolveYtPerfCap(used as number), `used=${used}`).toBeGreaterThanOrEqual(2000)
    }
  })

  it('🔒 쿼터를 다 쓴 날엔 0 — 없는 몫을 지어내지 않는다', () => {
    expect(resolveYtPerfCap(10000)).toBe(0)
    expect(resolveYtPerfCap(20000)).toBe(0)
    expect(resolveYtPerfCap(9500)).toBe(500)
  })

  it('🔒 명시 env 가 이긴다 — 수동 개입이 자동보다 우선(레포 규약)', () => {
    expect(resolveYtPerfCap(2200, '500')).toBe(500)
    expect(resolveYtPerfCap(2200, '99999')).toBe(9000) // 상한 클램프는 유지
    expect(resolveYtPerfCap(2200, '')).toBe(7000)      // 빈 값은 무시 → 자동
  })

  it('🔌 배선 — 상한이 검색 실사용에서 나온다(고정 상수 회귀 금지)', () => {
    expect(LANE).toMatch(/resolveYtPerfCap\(ytSearchCalls \* YT_SEARCH_UNIT_COST, env\.ADS_YT_PERF_UNITS\)/)
    expect(LANE).toMatch(/readYtSearchCalls\(DB, ytDay\)/)
  })
})

/**
 * ③ 알람에는 `depth` 가 없다(항상 0) → `depth % 2 === 1` 이 영원히 거짓 → 결정적 교대가 죽어 있었다.
 *   지금은 앞 레인이 0을 내서 무해했지만, ①-b 로 YT 가 살아나면 블로거가 굶는다. 둘은 한 몸이다.
 */
describe('③ 선두 교대 — 깊이가 아니라 직전 선두로', () => {
  it('🔒 번갈아 간다', () => {
    expect(pickNaverFirst({ led: 'naver' })).toBe(false)
    expect(pickNaverFirst({ led: 'front' })).toBe(true)
  })

  it('🔒 직전에 블로거가 굶었으면 교대를 무시하고 블로거 선두', () => {
    expect(pickNaverFirst({ led: 'naver', naver: { selected: 12, tried: 0 } })).toBe(true)
  })

  it('🔒 스냅샷이 없으면 블로거 선두 — 백로그가 가장 큰 레인이라 손해가 적다', () => {
    expect(pickNaverFirst(null)).toBe(true)
    expect(pickNaverFirst(undefined)).toBe(true)
    expect(pickNaverFirst({})).toBe(true)
  })

  it('🔒 굶음 판정은 "큐가 빈 것"과 다르다 — selected 0 은 굶은 게 아니다', () => {
    expect(starvedLastRound({ naver: { selected: 0, tried: 0 } })).toBe(false)
    expect(starvedLastRound({ naver: { selected: 12, tried: 0 } })).toBe(true)
  })

  it('🔌 배선 — depth 기반 교대로 회귀하지 않는다(알람에선 영원히 거짓)', () => {
    expect(LANE).toMatch(/const naverFirst = pickNaverFirst\(prev\)/)
    expect(LANE).not.toMatch(/naverFirst = depth % 2 === 1/)
    // 다음 회차가 교대하려면 이번 선두가 기록돼야 한다 — 없으면 교대가 성립 안 함.
    expect(LANE).toMatch(/led: naverFirst \? 'naver' : 'front'/)
  })
})

/** ④ cron 시절 창(7초)의 근거는 "부모가 10.5초에 죽는다"였다. 알람엔 부모가 없다. */
describe('④ 알람 창 — 사라진 전제 위의 값을 그대로 쓰지 않는다', () => {
  it('🔒 알람 창이 cron 기본값보다 크다', () => {
    expect(ENRICH_DEADLINE_MS_ALARM).toBeGreaterThan(ENRICH_DEADLINE_MS_DEFAULT)
  })

  it('🔒 실측된 알람 수명(28.6초) 안쪽이다 — 근거 없이 키우지 않는다', () => {
    expect(ENRICH_DEADLINE_MS_ALARM).toBeLessThan(28_000)
  })

  it('🔌 배선 — 알람 러너가 driver 를 알려주고, 레인이 그걸로 창을 고른다', () => {
    expect(RUNNERS).toMatch(/runInfluencerEnrich\(env, 0, undefined, null, \{ driver: 'alarm' \}\)/)
    expect(LANE).toMatch(/opts\?\.driver === 'alarm' \? ENRICH_DEADLINE_MS_ALARM/)
    // 명시 env 는 여전히 이긴다(운영자가 잠글 수 있어야 한다).
    expect(LANE).toMatch(/ADS_ENRICH_DEADLINE_MS\s*\n?\s*\?\s*envEnrichDeadlineMs\(env\)/)
  })
})

/**
 * 🧾 **마지막 한 칸은 저장 몫** — 순수 이동으로 드러난 선재 위반(래칫이 옛 경로에 동결하고 있었다).
 *
 * 영상 통계 루프 **뒤에** `DB.batch(stmts)` 가 온다 — 이 회차 측정 결과 전량의 유일한 쓰기다.
 * D1 도 서브리퀘스트라 루프가 마지막 칸까지 쓰면 batch 가 던지고 `.catch(() => null)` 이 삼킨다
 * → 쿼터를 다 태우고 **저장 0** + 스탬프 없음 → 그 행들이 다음 회차에도 맨 앞(이 PR 이 잡는 churn 을 되레 만든다).
 */
describe('🧾 예산 부기 — 루프가 자기 기록 몫을 남긴다', () => {
  it('🔒 영상 통계 루프가 batch 쓸 1칸을 예약한다', () => {
    expect(YTPERF).toMatch(/allIds\.length && budget\.left > 1 &&/)
    expect(YTPERF, '`> 0` 회귀 — 마지막 칸까지 쓰면 그 회차 저장이 통째로 사라진다').not.toMatch(/allIds\.length && budget\.left > 0 &&/)
  })
})

/** 📈 계측 — 19콜/행이 실제로 낮아졌는지 라이브에서 판정할 수 있어야 한다. */
describe('계측 — 효율을 밖에서 잴 수 있다', () => {
  it('🔒 스냅샷에 이번 회차의 YT 처리 행수를 남긴다', () => {
    expect(LANE).toMatch(/yt_rows: yt/)
    expect(LANE).toMatch(/yt_units: \{ used:/)
  })
})
