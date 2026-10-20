/**
 * 🔌 cron 워커가 **런타임에 쓰는 바인딩**은 `wrangler.toml` 에 **선언**돼 있어야 한다.
 *
 * ## 왜 (2026-08-02~03 실측 — 하루에 두 번)
 * `wrangler deploy` 는 이 파일이 선언한 것으로 워커 설정을 **통째로 교체**한다.
 * 즉 대시보드에서 손으로 붙인 바인딩은 **다음 배포에 삭제**된다. "추가하지 않음"이 아니라 "삭제"다.
 *
 * 두 번 당했다:
 *   1. `CACHE_KV` — 대표가 대시보드에서 바인딩(00:31 KST) → `wrangler deploy`(#971, 00:43) 가 지움.
 *      바인딩 12개 → 6개.
 *   2. `BACKUP_BUCKET` — 대표가 바인딩 → **백업 cron 을 켜는 그 배포**(15:43Z)가 지웠다.
 *      하필 백업을 켜는 배포가 백업이 쓸 버킷을 없앤 것이다. 다음 회차는 조용히 실패했을 것이다
 *      (`handleD1Backup` 이 throw → cron_failures 에만 남는다).
 *
 * **에러가 안 난다.** 배포는 초록불이고, 그 바인딩을 쓰는 코드가 실제로 도는 순간에야 터진다.
 * 주간 cron 이면 **일주일 뒤**다.
 *
 * ## 검사
 * cron 진입점(`scheduled.ts`)에서 도달하는 코드가 `env.X` 로 읽는 **리소스 바인딩**(KV/R2/D1/DO)이
 * `wrangler.toml` 에 선언돼 있는가.
 *
 * ⚠️ **못 하는 것**
 * - **Pages 바인딩은 이 파일과 무관**하다(대시보드 관리). 여기서 보장하는 건 **cron 워커**뿐이다.
 * - 시크릿(`secret_text`)은 별도 저장소라 교체 대상이 아니다 — 그래서 검사하지 않는다.
 * - `wrangler.toml` 에 선언했다고 **CF 에 실제로 붙었는지**는 모른다. 그건 배포 후
 *   `GET /accounts/{}/workers/scripts/ur-live/bindings` 만이 답이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const TOML = readFileSync('wrangler.toml', 'utf8')
/** 주석(#)을 걷어낸 선언부만 — 주석 안의 이름에 속지 않기 위해. */
const DECLARED = TOML.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n')

/**
 * cron 워커가 쓰는 **리소스** 바인딩과 그것을 쓰는 자리.
 * 새 cron 이 새 바인딩을 쓰기 시작하면 여기 한 줄 추가할 것 — 안 그러면 다음 배포가 지운다.
 */
const REQUIRED: Array<{ name: string; usedBy: string; why: string }> = [
  { name: 'DB', usedBy: 'src/worker/scheduled.ts', why: '거의 모든 cron 이 D1 을 읽고 쓴다' },
  { name: 'BACKUP_BUCKET', usedBy: 'src/worker/cron/d1-backup.ts', why: '주간 D1 덤프 → R2. 없으면 throw' },
  { name: 'CACHE_KV', usedBy: 'src/worker/cron/cache-prewarm.ts', why: 'SSR 페이로드 전역 워밍(KV put)' },
]

describe('cron 워커 바인딩 선언 (wrangler deploy 는 통째로 교체한다)', () => {
  it('검사 대상이 비어 있지 않다 (측정 0 이면 통과가 아니라 실패)', () => {
    expect(REQUIRED.length).toBeGreaterThan(0)
    expect(DECLARED.length, 'wrangler.toml 을 못 읽었다').toBeGreaterThan(100)
  })

  for (const { name, usedBy, why } of REQUIRED) {
    it(`${name} 이 선언돼 있다 (${why})`, () => {
      // 주석이 아닌 줄에 `binding = "NAME"` 이 있어야 한다.
      const re = new RegExp(`^\\s*binding\\s*=\\s*"${name}"`, 'm')
      expect(re.test(DECLARED),
        `${name} 이 wrangler.toml 에 선언되지 않았다 — ${usedBy} 가 런타임에 쓴다.\n` +
        '   대시보드에서 손으로 붙여도 **다음 wrangler deploy 가 지운다**(2026-08-02~03 에 두 번 당함).',
      ).toBe(true)
    })
  }

  it('코드가 실제로 그 바인딩을 쓴다 (고아 선언 방지)', () => {
    // 반대 방향 — 안 쓰는 걸 선언해 두면 다음 사람이 "이건 왜 있지" 로 지우고, 그때 진짜 사고가 난다.
    for (const { name, usedBy } of REQUIRED) {
      const src = readFileSync(usedBy, 'utf8')
      expect(src.includes(name), `${usedBy} 가 ${name} 을 안 쓴다 — 목록이 낡았다`).toBe(true)
    }
  })
})
