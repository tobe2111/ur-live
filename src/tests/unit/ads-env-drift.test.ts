/**
 * 🔌 **설정했는데 아무 일도 안 일어나는 env 를 드러낸다** — 계약 (2026-08-03 실측 후 신설).
 *
 * ## 실측
 * ur-ads 바인딩 42개 중 **코드가 한 번도 안 읽는 키 4개**가 있었다:
 * `DS_LOCALDATA_BACKFILL_DAYS`(ADS_ 오타) · `ENRICH_BUDGET` · `ENRICH_ROUNDS` · `SHEETS_SYNC_ENABLED`
 * (뒤 셋은 `ADS_` 접두가 빠진 형태). 넷 다 **오류를 안 낸다** — 대시보드엔 값이 보이고 코드는 기본값으로 돈다.
 *
 * ## 두 방향을 각각 지킨다
 *   · **코드 → 목록**(이 파일): 소스가 읽는 `ADS_*` 키가 SSOT 목록에 다 있는가.
 *     빠지면 그 키가 런타임에 "미사용"으로 **오신고**된다 — 경보가 신뢰를 잃는 가장 빠른 길이다.
 *   · **대시보드 → 목록**: `unknownAdsEnvKeys` 가 런타임에 본다(CI 는 대시보드를 못 본다).
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * - 목록에 **있는데 실은 아무도 안 읽는** 키(반대 방향의 stale). 지우는 판단은 사람이 한다.
 * - 값의 형식 오류(숫자여야 하는데 문자). 이름만 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { ADS_ENV_KNOWN, unknownAdsEnvKeys, envDriftInfo } from '@/worker-ads/env-drift'

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith('.ts')) out.push(p)
  }
  return out
}

describe('코드 → 목록 — 새 노브를 넣고 목록을 안 고치면 오신고가 난다', () => {
  it('🔒 ads 소스가 읽는 `ADS_*` 키가 전부 SSOT 목록에 있다', () => {
    const files = [
      ...walk(resolve(process.cwd(), 'src/worker-ads')),
      ...walk(resolve(process.cwd(), 'src/features/marketing/api')),
    ]
    const found = new Set<string>()
    for (const f of files) {
      if (f.includes('env-drift.ts')) continue // 목록 자신은 제외(자기 참조)
      for (const m of readFileSync(f, 'utf8').matchAll(/\bADS_[A-Z0-9_]+\b/g)) found.add(m[0])
    }
    expect(found.size, '한 개도 못 찾았으면 스캔이 고장난 것이다(측정 0 = 실패)').toBeGreaterThan(10)
    const missing = [...found].filter(k => !ADS_ENV_KNOWN.includes(k)).sort()
    expect(missing, `SSOT 목록(env-drift.ts)에 없는 키 — 넣지 않으면 런타임이 이걸 "미사용"으로 오신고한다`).toEqual([])
  })
})

describe('대시보드 → 목록 — 실측에서 나온 그 4개를 잡는다', () => {
  it('🔒 라이브의 실제 모양(ADS_ 접두 누락·오타)을 잡는다', () => {
    const out = unknownAdsEnvKeys({
      ADS_HIRA_ENABLED: 'true', PUBLIC_DATA_SERVICE_KEY: 'x', DB: {},
      DS_LOCALDATA_BACKFILL_DAYS: '2', ENRICH_BUDGET: '300', ENRICH_ROUNDS: '3', SHEETS_SYNC_ENABLED: 'true',
    })
    expect(out).toEqual(['DS_LOCALDATA_BACKFILL_DAYS', 'ENRICH_BUDGET', 'ENRICH_ROUNDS', 'SHEETS_SYNC_ENABLED'])
  })

  it('🔒 정상 설정만 있으면 **조용하다** — 평상시 소음이 있으면 아무도 안 본다', () => {
    expect(unknownAdsEnvKeys({ ADS_HIRA_ENABLED: 'true', DB: {}, SELF: {}, JWT_SECRET: 'x' })).toEqual([])
    expect(envDriftInfo({ ADS_HIRA_ENABLED: 'true' }), '이상 없으면 키 자체가 붙지 않아야 한다').toEqual({})
  })

  it('내부 주입값·소문자 키는 우리 노브가 아니다(플랫폼/번들러 소관)', () => {
    expect(unknownAdsEnvKeys({ __ADS_BUILD_AT__: 'x', someLowerCase: 1 })).toEqual([])
  })

  it('상한이 있다 — 하트비트 사유줄이 이걸로 넘치면 진짜 사유가 잘린다', () => {
    const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`BOGUS_${i}`, '1']))
    expect(unknownAdsEnvKeys(many).length).toBeLessThanOrEqual(6)
  })

  it('env 가 없거나 이상해도 던지지 않는다 — 관측이 회차를 죽이면 안 된다', () => {
    expect(unknownAdsEnvKeys(null)).toEqual([])
    expect(unknownAdsEnvKeys('nope')).toEqual([])
  })
})

describe('배선 — 판정만 있고 안 실리면 없는 기능이다', () => {
  it('🔒 스케줄 하트비트가 `envDriftInfo` 를 실어 보낸다', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/worker-ads/index.ts'), 'utf8')
    // ⚠️ `[^)]*` 로 쓰면 안 된다 — 같은 줄의 `buildAgeInfo()` 괄호에서 끊겨 **늘 실패**한다(첫 시도가 그랬다).
    expect(src).toMatch(/adsBeat\('scheduled'[\s\S]*?envDriftInfo\(env\)/)
  })
})
