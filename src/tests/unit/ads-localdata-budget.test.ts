/**
 * 🏪 인허가(localdata) 수집 레인 — 예산 소진 시 **이어받기** 계약 (2026-07-29 신설).
 *
 * 왜 테스트로 고정하나: 이 레인은 6회 실행 내내 `total_saved: 0` 이었다(라이브 실측). 원인은
 *   ① cron 이 인라인이라 서브리퀘스트 예산을 다른 레인과 다툼(가드 `check-ads-lane-isolation` 이 담당)
 *   ② 예산 개념 없이 16업종 × 6페이지를 맹목 순회 — 중간에 끊기면 그 회차 수확이 통째로 버려지고
 *      **다음 회차도 업종 0번부터** 다시 시작해 뒤쪽 업종은 영영 미도달(전화 스윕이 `ORDER BY id ASC` 로
 *      tier1 에 못 닿던 것과 같은 클래스).
 *
 * 여기서 고정하는 불변식 두 개 — 깨지면 조용히 데이터가 영구 누락된다:
 *   A. 예산이 끊기면 **중단 지점(업종 인덱스)을 남긴다**.
 *   B. 다음 실행은 **그 지점부터** 재개한다(앞쪽 업종을 다시 긁지 않는다 = 예산 낭비 0).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runLocalDataCollect } from '@/features/marketing/api/localdata-collect'
import { LICENSE_UPJONG } from '@/features/marketing/api/store-prospects'

/** 업종 엔드포인트는 코드 SSOT(LICENSE_UPJONG) — env 는 **대체가 아니라 병합**이라 목록을 여기서 그대로 쓴다. */
const EPS = Object.keys(LICENSE_UPJONG)

/** platform_settings 를 흉내내는 최소 D1 — 이 레인이 쓰는 4가지 패턴만 지원. */
function makeDB(initial: Record<string, string> = {}) {
  const kv: Record<string, string> = { ...initial }
  const prepare = (sql: string) => {
    let args: unknown[] = []
    const api = {
      bind: (...a: unknown[]) => { args = a; return api },
      first: async () => {
        if (/FROM platform_settings/i.test(sql)) {
          const v = kv[String(args[0])]
          return v == null ? null : { value: v }
        }
        if (/COUNT\(\*\)/i.test(sql)) return { n: 0 }
        return null
      },
      run: async () => {
        if (/INSERT OR REPLACE INTO platform_settings/i.test(sql)) kv[String(args[0])] = String(args[1])
        if (/DELETE FROM platform_settings/i.test(sql)) delete kv[String(args[0])]
        return { meta: { changes: 1 } }
      },
      // 설정 키는 **일괄 조회**로 읽는다(D1 도 서브리퀘스트라 3회 → 1회로 줄인 뒤부터).
      all: async () => {
        if (/FROM platform_settings/i.test(sql)) {
          return { results: args.map(k => ({ key: String(k), value: kv[String(k)] })).filter(r => r.value != null) }
        }
        return { results: [] }
      },
    }
    return api
  }
  return { db: { prepare, batch: async () => [] } as unknown as D1Database, kv }
}

const PENDING_KEY = 'ads_localdata_pending'

function makeEnv(db: D1Database, extra: Record<string, string> = {}) {
  return {
    DB: db,
    ADS_LOCALDATA_SERVICE_KEY: 'test-key',
    ADS_LOCALDATA_MAX_PAGES: '1',
    ADS_LOCALDATA_BUDGET: '300', // 예산 자체는 넉넉히 — 이 테스트가 보는 건 '끊겼을 때의 이어받기'다
    ...extra,
  } as unknown as Parameters<typeof runLocalDataCollect>[0]
}

describe('localdata 수집 — 예산 소진 이어받기', () => {
  beforeEach(() => { vi.restoreAllMocks() })
  afterEach(() => { vi.unstubAllGlobals() })

  it('A. 한도에 부딪히면 중단한 업종 인덱스를 커서로 남긴다', async () => {
    const { db, kv } = makeDB()
    let calls = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls++
      // 첫 업종은 정상, 두 번째부터 플랫폼 한도 — 실제 Cloudflare 문구를 그대로 쓴다.
      if (calls >= 2) throw new Error('Too many subrequests by single Worker invocation')
      return new Response(JSON.stringify({ svc: { row: [] } }), { status: 200 })
    }))

    const s = await runLocalDataCollect(makeEnv(db))

    expect(s.limit_hit).toBe(true)
    const pending = JSON.parse(kv[PENDING_KEY] || '[]') as { day: string; idx: number }[]
    expect(pending).toHaveLength(1)
    // 업종 0 은 끝냈고 업종 1 에서 끊겼다 → 다음 틱은 1번부터.
    expect(pending[0].idx).toBe(1)
  })

  it('B. 다음 실행은 남겨둔 업종부터 재개한다(앞쪽을 다시 긁지 않는다)', async () => {
    const day = '20260726'
    const { db, kv } = makeDB({ [PENDING_KEY]: JSON.stringify([{ day, idx: 2 }]) })
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (u: string) => {
      urls.push(String(u))
      return new Response(JSON.stringify({ svc: { row: [] } }), { status: 200 })
    }))

    await runLocalDataCollect(makeEnv(db))

    // 남겨둔 날(20260726)은 업종 2(ep_c)만 조회해야 한다 — ep_a/ep_b 재조회는 예산 낭비.
    const forPendingDay = urls.filter(u => u.includes(`lastModTsBgn=${day}`))
    // 남겨둔 날은 업종 2번부터만 조회해야 한다 — 0·1번 재조회는 순수 예산 낭비.
    expect(forPendingDay).toHaveLength(EPS.length - 2)
    expect(forPendingDay[0]).toContain(`/${EPS[2]}?`)
    expect(forPendingDay.some(u => u.includes(`/${EPS[0]}?`))).toBe(false)
    expect(forPendingDay.some(u => u.includes(`/${EPS[1]}?`))).toBe(false)
    // 완주했으므로 커서는 지워진다(적체가 무한히 쌓이지 않는다).
    expect(kv[PENDING_KEY]).toBeUndefined()
  })
})
