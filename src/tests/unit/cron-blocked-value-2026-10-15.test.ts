/**
 * 🧱 하트비트 `skipped` 를 **값까지** 읽는다 (2026-10-15).
 *
 * 실측: 하트비트 145개 중 표식이 붙은 12개를 전수로 읽으니 **11개가 멀쩡한 레인**이었다.
 * 그 거짓 경보가 미해결 `cron_failures` 1,331건을 쌓아 어드민 최신 100건의 81%를 덮었고,
 * **진짜 error 621건이 화면에 도달하지 못했다**. 근거·표는 `worker/utils/cron-beat-blocked.ts` 머리말.
 *
 * 고정하는 것:
 *   ① 값 모양별 판정(카운터 · falsy · 허용목록 · 이유 문자열 · 빈 값 · 표식 없음)
 *   ② **라이브에서 본 12개 문자열** 그대로 — 픽스처를 손으로 지어 쓰지 않는다
 *   ③ **반대 방향** — 2026-08-31 이 잡으려던 사고 모양(이유 문자열)은 여전히 blocked,
 *      그리고 모르는 값의 기본값이 blocked 다(넓히는 것은 허용목록 한 줄로만)
 *   ④ 배선 — `cron-stale-watch` 가 옛 정규식이 아니라 이 술어를 쓴다
 *   ⑤ 어드민 — severity 화이트리스트 · 필터 배선 · **정렬은 안 바꿨다**
 * ⚠️ 못 막는 것: 이유 문자열이 *진짜* 막힘인지(글자만 읽는다) · `skipped` 를 아예 안 싣고
 *    조용히 아무 일도 안 하는 cron(각 cron 이 관례를 따르는 것이 전제다) · 이미 쌓인 1,331건
 *    (새 거짓 경보는 멈추지만 과거 행은 어드민에서 해결 처리해야 줄어든다).
 */
import { describe, it, expect } from 'vitest'
import { readSkipMark, isBlockedBeat, HEALTHY_SKIP_REASONS } from '@/worker/utils/cron-beat-blocked'
import { readCode } from '../helpers/source-text'

const WATCH = 'src/worker/cron/cron-stale-watch.ts'
const ROUTE = 'src/features/admin/api/admin-system-monitoring.routes.ts'
const PAGE = 'src/pages/AdminSystemMonitoringPage.tsx'

describe('① 값 모양별 판정', () => {
  it('표식이 없으면 판정 대상이 아니다', () => {
    expect(readSkipMark('refreshed=20 unchanged=false').verdict).toBe('none')
    expect(readSkipMark('').verdict).toBe('none')
    expect(readSkipMark(null).verdict).toBe('none')
    expect(isBlockedBeat('ok rows=5')).toBe(false)
  })

  it('카운터는 "할 일이 없었다" 다 — blocked 아님', () => {
    for (const r of ['skipped=309', 'skipped=6', 'skipped=27', 'skipped: 0', 'skipped=1_200', 'skipped=1,200']) {
      expect(readSkipMark(r).verdict, r).toBe('healthy')
    }
  })

  it('명시적 falsy 는 "안 건너뛰었다" 다', () => {
    for (const v of ['false', 'FALSE', 'none', 'null', 'undefined', 'no', '없음']) {
      expect(readSkipMark(`skipped=${v}`).verdict, v).toBe('healthy')
    }
  })

  it('허용목록(레인 페이싱)은 blocked 아님', () => {
    expect(HEALTHY_SKIP_REASONS.has('min_interval')).toBe(true)
    expect(readSkipMark("skipped=min_interval last_run_at=1792022400555").verdict).toBe('healthy')
  })

  it('이유 문자열과 true 는 blocked 다', () => {
    for (const v of ['true', 'no_binding', 'missing_kv', 'table_absent']) {
      expect(readSkipMark(`skipped=${v}`).verdict, v).toBe('blocked')
    }
    expect(readSkipMark("skipped: true, reason: 'no binding'").verdict).toBe('blocked')
  })

  it('값이 비면 blocked 다 — 무언가 건너뛴다면서 무엇인지 안 말한 것', () => {
    // 🩸 안전한 쪽으로 넘기면 2026-08-31 이 잡으려던 사고가 다시 조용해진다(머리말 🔴).
    expect(readSkipMark('started=0 skipped= deferred=0').verdict).toBe('blocked')
    expect(readSkipMark('skipped=').verdict).toBe('blocked')
  })

  it('키 경계를 지킨다 — unskipped 같은 이름에 안 걸린다', () => {
    expect(readSkipMark('unskipped=5').verdict).toBe('none')
    expect(readSkipMark('total_skipped=5').verdict).toBe('none')
  })
})

describe('② 라이브에서 본 12개 그대로', () => {
  // 🔬 2026-10-15 어드민 `/api/admin/cron-heartbeats` 응답에서 그대로 떠 왔다 —
  //    픽스처를 손으로 지어 쓰면 "그 경우를 담지 않아 규칙을 없애도 초록" 이 된다.
  const HEALTHY_LIVE: Array<[string, string]> = [
    ['__catchup', 'started=0 skipped=6 deferred=0 known=145'],
    ['ads:collect-franchise', 'skipped=min_interval last_run_at=1792022400555'],
    ['ads:collect-localdata-chain', 'skipped=min_interval last_run_at=1792029600072'],
    ['ads:collect-nara-contract', 'skipped=min_interval last_run_at=1791957600085'],
    ['ads:collect-nara-vendor', 'skipped=min_interval last_run_at=1791957600092'],
    ['ads:collect-storeinfo', 'skipped=min_interval last_run_at=1792022400093'],
    ['ads:daily-batch', 'skipped=min_interval last_run_at=1792022400120'],
    ['ads:maintenance-rescan', 'skipped=min_interval last_run_at=1792022400078'],
    ['ads:sweep-mx', 'skipped=min_interval last_run_at=1792022400584'],
    ['ads:sweep-nts', 'skipped=min_interval last_run_at=1792022400075'],
    ['demo-name-heal', 'healed=0 skipped=309 samples[0]'],
    ['group-buy-feed-cache', 'refreshed=0 skipped=false unchanged=true touched=20'],
  ]

  it('12개 전부 blocked 가 아니다 — 종전엔 전부 blocked 였다', () => {
    const blocked = HEALTHY_LIVE.filter(([, r]) => isBlockedBeat(r)).map(([n]) => n)
    expect(blocked).toEqual([])
  })

  it('종전 정규식은 그 12개를 전부 집었다 — 이 시험이 무엇을 고쳤는지의 증거', () => {
    const OLD = /(^|[\s,{])skipped[=:]/
    expect(HEALTHY_LIVE.filter(([, r]) => OLD.test(r))).toHaveLength(12)
  })
})

describe('③ 반대 방향 — 기본값은 blocked 로 남는다', () => {
  it('2026-08-31 이 잡으려던 사고 모양은 여전히 blocked', () => {
    // 바인딩이 없어 이미지 이관이 넉 달간 `migrated=0` 을 성실히 반환한 그 사고.
    expect(isBlockedBeat("migrated=0 skipped:'no R2 binding'")).toBe(true)
    expect(isBlockedBeat('migrated=0 skipped=no_binding')).toBe(true)
  })

  it('허용목록이 과하게 자라지 않는다 — 지금은 하나뿐', () => {
    expect([...HEALTHY_SKIP_REASONS]).toEqual(['min_interval'])
  })

  it('허용목록에 true 나 빈 문자열을 넣지 않았다', () => {
    for (const bad of ['true', '', 'yes', 'blocked']) {
      expect(HEALTHY_SKIP_REASONS.has(bad), bad).toBe(false)
    }
  })
})

describe('④ 배선', () => {
  it('cron-stale-watch 가 이 술어를 쓴다', () => {
    const code = readCode(WATCH)
    expect(code).toContain('isBlockedBeat(b.result)')
    // 옛 정규식이 실행되는 줄에 남아 있으면 두 벌이 된다.
    expect(code).not.toMatch(/\/\(\^\|\[\\s,\{\]\)skipped/)
  })
  it('검사 대상이 비어 있지 않다 — 경로가 낡으면 통과가 아니라 실패', () => {
    expect(readCode(WATCH)).toContain('cron_stale_alerts')
  })
})

describe('⑤ 어드민이 심각도로 행에 닿는다', () => {
  it('severity 는 화이트리스트로만 받는다', () => {
    const code = readCode(ROUTE)
    expect(code).toContain("['critical', 'error', 'warning'].includes(sevRaw)")
    // 생값을 SQL 에 끼우지 않는다 — 바인딩으로만.
    expect(code).not.toMatch(/severity\s*=\s*'\$\{/)
    expect(code).toContain("AND severity = ?")
  })
  it('정렬은 안 바꿨다 — severity 우선으로 바꾸면 최근 warning 이 영영 안 보인다', () => {
    // 🩸 첫 판은 파일 전체에 `toContain('ORDER BY created_at DESC LIMIT 100')` 을 걸었는데
    //    그 문장이 이 파일에 **4곳** 있어서, cron-failures 쿼리만 severity 우선으로 바꿔도
    //    다른 셋 때문에 통과했다(주입이 잡았다). ⇒ **그 쿼리만 떼어 내서** 본다.
    const code = readCode(ROUTE)
    const i = code.indexOf("FROM cron_failures")
    expect(i).toBeGreaterThan(0)
    const q = code.slice(i, code.indexOf('`', i))
    expect(q).toContain('ORDER BY created_at DESC LIMIT 100')
    // severity 로 줄을 세우는 어떤 모양도 금지(`ORDER BY severity` · `ORDER BY CASE severity` …).
    expect(q).not.toMatch(/ORDER BY[^]*?severity/i)
  })
  it('화면 칩이 눌리고 쿼리 키에 필터가 들어간다', () => {
    const code = readCode(PAGE)
    expect(code).toContain('setCronSeverity')
    expect(code).toContain("['admin', 'cron-failures', showResolved, cronSeverity]")
    expect(code).toMatch(/severity: cronSeverity/)
  })
})
