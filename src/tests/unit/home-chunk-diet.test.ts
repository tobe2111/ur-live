/**
 * 🏠 홈 청크 다이어트 — 2026-09-02 (대표 "홈 청크 다이어트도 지금 해줘").
 *
 * 번들러 실측(generateBundle 로 chunk.modules + 모듈 그래프 덤프): 홈 정적 폐쇄 27청크 956KB 중
 * `app-components` 281KB 는 홈이 21/66 모듈만 쓰고, 그 안 쓰는 모듈들이 `components/ui/button` 등을 import 해
 * `app-ui-utils`(tailwind-merge 97KB, 홈 도달 0)·`radix-ui`·`app-kakao-sdk`·`app-features`(2/25) 까지 청크 단위로
 * 끌고 왔다. 처방 = 홈이 닿는 모듈을 `app-home` 청크로 모아 그 간선을 끊는다.
 *
 * 이 테스트가 지키는 것(빌드 없이):
 *   ① vite.config 에 app-home 규칙이 있고, 실측 도달 집합의 경로들이 전부 들어 있다
 *   ② 홈 진입 모듈(PcHomePage·MobileHomePage·GroupBuyFeed·GroupBuyFeedCard)이 import 하는 `@/components|shared|features`
 *      경로는 **app-home 이거나 이미 홈 폐쇄에 있던 청크 규칙**(app-layout·app-shared·app-constants·app-auth·app-stores·app-utils)에
 *      걸려야 한다 — 새 import 하나가 `/src/components/` catch-all 로 떨어지면 app-components 281KB 가 홈으로 돌아온다.
 * ⚠️ 못 막는 것: 실제 Rollup 배치(빌드 산출물) — 그건 CI 의 check-critical-chunks / check-surface-role-leak 가 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const VITE = readFileSync('vite.config.ts', 'utf8')
const HOME_ENTRIES = [
  'src/pages/pc-home/PcHomePage.tsx', 'src/pages/mobile-home/MobileHomePage.tsx',
  'src/pages/main-home/GroupBuyFeed.tsx', 'src/pages/main-home/GroupBuyFeedCard.tsx',
]
/** app-home 규칙에 들어 있어야 하는 경로 조각(실측 도달 집합) */
const APP_HOME_PARTS = [
  '/src/components/home/', '/src/pages/pc-home/', '/src/pages/main-home/GroupBuyFeedCard',
  '/src/components/deal/DealCardMedia', '/src/components/deal/WishlistHeart', '/src/components/deal/StarRating',
  '/src/components/region/', '/src/components/SEO', '/src/components/ui/sort-menu', '/src/shared/seo/',
  '/src/shared/home-', '/src/shared/product-flow', '/src/shared/deal-category-icon',
  '/src/features/group-buy/FcfsBadge', '/src/features/group-buy/useFcfs',
]
/** 홈 폐쇄에 원래 있던(= 받아도 되는) 청크의 규칙 조각 — 여기 걸리면 통과 */
const OK_PARTS = [
  '/src/components/main/', '/src/components/auth/', '/src/shared/config/', '/src/shared/utils/', '/src/shared/constants/',
  '/src/shared/types/', '/src/shared/stores/', '/src/utils/', '/src/hooks/', '/src/lib/', '/src/shared/seller-roles',
  '/src/components/icons/', '/src/client/', '/src/i18n', '/src/pages/main-home/GroupBuyFeed', '/src/pages/mobile-home/',
  '/src/routes/', '/src/shared/feature-flags', '/src/components/brand/', // app-shell 규칙(엔트리 셸)에 이미 있는 것
]
const ruleBlock = (() => {
  const at = VITE.indexOf(") return 'app-home'")
  expect(at, 'app-home 규칙').toBeGreaterThan(0)
  const start = VITE.lastIndexOf('if (', at)
  return VITE.slice(start, at)
})()

describe('① app-home 규칙', () => {
  it('실측 도달 집합의 경로가 전부 규칙에 있다', () => {
    for (const p of APP_HOME_PARTS) expect(ruleBlock, p).toContain(`id.includes('${p}')`)
  })
  it("규칙이 '/src/components/' catch-all 보다 앞에 있다(뒤면 무효)", () => {
    expect(VITE.indexOf(") return 'app-home'")).toBeLessThan(VITE.indexOf("if (id.includes('/src/components/')) return 'app-components'"))
    expect(VITE.indexOf(") return 'app-home'")).toBeLessThan(VITE.indexOf("if (id.includes('/src/features/')) return 'app-features'"))
  })
})

describe('①-b deal/ 폴더 통째 금지', () => {
  it("app-home 규칙에 '/src/components/deal/' 폴더 전체가 없다(DetailFloatingHeader 가 app-components 를 도로 끌고 온다)", () => {
    expect(ruleBlock).not.toContain("id.includes('/src/components/deal/')")
  })
})

describe('② 홈 진입 모듈의 import 가 app-home 또는 기존 홈 청크에 걸린다', () => {
  const resolve = (spec: string) => spec.startsWith('@/') ? '/src/' + spec.slice(2) : spec
  for (const f of HOME_ENTRIES) {
    it(f, () => {
      const src = readFileSync(f, 'utf8')
      const specs = [...src.matchAll(/^import[^'"]*from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1])
        .filter((s) => s.startsWith('@/') && !/^@\/(pages\/pc-home|pages\/mobile-home|pages\/main-home)/.test(s))
      const bad = specs.filter((s) => {
        const id = resolve(s)
        return !APP_HOME_PARTS.some((p) => id.startsWith(p) || id.includes(p)) && !OK_PARTS.some((p) => id.startsWith(p) || id.includes(p))
      })
      expect(bad, `이 import 는 app-components/app-features 를 홈으로 끌고 온다 — app-home 규칙에 넣거나 lazy 로: ${bad.join(', ')}`).toEqual([])
    })
  }
})
