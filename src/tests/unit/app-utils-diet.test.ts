/**
 * 🍽️ app-utils 다이어트 (2026-09-02 대표 "모두 다 진행" — 로딩 후속 ②).
 *
 * 번들러 실측 그래프: app-utils 104.6KB 중 **73.8KB(56모듈)가 홈 미도달**인데 엔트리 필수(api.ts 등)와 한 봉투라 홈이
 * 매번 받았다. 큰 것들을 `app-utils-deferred` 로 뺀다. 규칙은 파일 이름 열거(폴더 규칙 금지 — #1310 교훈).
 *
 * ## 이 테스트가 지키는 것
 *   1. 규칙이 존재하고 catch-all(`/src/lib/` 등)보다 **앞**에 있다(뒤면 영원히 안 걸린다).
 *   2. 대표 모듈(sentry·performance-monitor·errorHandler·kakao-login-overlay·read-table-file·useMyFollows)이 규칙에 걸린다.
 *   3. 엔트리 필수(`lib/api`·`lib/auth`·`utils/cf-image`·`hooks/useMediaQuery`)는 걸리지 **않는다**(걸리면 엔트리가 두 청크를 받는다).
 *   4. 홈 진입 파일들의 `@/lib|utils|hooks` import 가 이 규칙에 걸리지 않는다(홈이 봉투를 도로 끌고 오지 않게).
 * ## 못 막는 것
 *   - 실제 번들 결과(그건 CI 의 `check-critical-chunks`·`check-surface-role-leak`·번들 예산이 본다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const cfg = readFileSync('vite.config.ts', 'utf-8')
const ruleLine = cfg.split('\n').find((l) => l.includes("return 'app-utils-deferred'")) || ''
const re = (() => {
  const m = ruleLine.match(/if \((\/.*\/)\.test\(id\)\)/)
  if (!m) throw new Error('app-utils-deferred 규칙을 못 찾았다')
  const body = m[1].slice(1, -1)
  return new RegExp(body)
})()

describe('① 규칙 위치', () => {
  it('규칙이 catch-all 보다 앞에 있다', () => {
    const a = cfg.indexOf("return 'app-utils-deferred'")
    const b = cfg.indexOf("id.includes('/src/utils/') || id.includes('/src/hooks/') || id.includes('/src/lib/')) return 'app-utils'")
    expect(a).toBeGreaterThan(0); expect(b).toBeGreaterThan(a)
  })
})

describe('② 걸려야 하는 것 / ③ 걸리면 안 되는 것', () => {
  const hit = ['src/lib/sentry.ts', 'src/lib/performance-monitor.ts', 'src/lib/errorHandler.ts', 'src/utils/kakao-login-overlay.ts',
    'src/lib/read-table-file.ts', 'src/hooks/queries/useMyFollows.ts', 'src/lib/web-vitals-report.ts', 'src/hooks/useChatPoll.ts']
  const miss = ['src/lib/api.ts', 'src/lib/auth.ts', 'src/utils/cf-image.ts', 'src/hooks/useMediaQuery.ts', 'src/lib/utils.ts',
    'src/hooks/queries/useWholesale.ts', 'src/lib/toss-preload.ts', 'src/utils/format.ts', 'src/hooks/useAuth.ts']
  for (const f of hit) it(`걸림: ${f}`, () => expect(re.test('/repo/' + f)).toBe(true))
  for (const f of miss) it(`안 걸림: ${f}`, () => expect(re.test('/repo/' + f)).toBe(false))
})

describe('④ 홈 진입 파일이 이 봉투를 끌고 오지 않는다', () => {
  const files = ['src/main.tsx', 'src/App.tsx', 'src/pages/pc-home/PcHomePage.tsx', 'src/pages/mobile-home/MobileHomePage.tsx',
    'src/pages/main-home/GroupBuyFeed.tsx', 'src/pages/main-home/GroupBuyFeedCard.tsx']
  for (const f of files) {
    it(f, () => {
      const s = readFileSync(f, 'utf-8')
      // 정적 import 만 본다 — 동적 import(`import('…')`)는 청크가 따로 내려오므로 무관하다(main.tsx 의 sentry 가 그 예).
      const stat = [...s.matchAll(/^import[^'"]*['"]@\/((?:lib|utils|hooks)\/[^'"]+)['"]/gm)].map((m) => 'src/' + m[1])
      const bad = stat.filter((p) => re.test('/repo/' + p + (p.endsWith('.ts') || p.endsWith('.tsx') ? '' : '.ts')))
      expect(bad, `${f} 가 deferred 모듈을 정적으로 import 한다: ${bad.join(', ')}`).toEqual([])
    })
  }
})
