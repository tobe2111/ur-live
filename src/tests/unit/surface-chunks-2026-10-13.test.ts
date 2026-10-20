/**
 * 🧩 손님 페이지 lazy 코드를 쓰는 페이지끼리 묶는다 — 근거·실측은 `scripts/surface-chunks.mjs` 머리말.
 *
 * 실측(첫 화면 다음에 받는 것, brotli · 2026-10-13 빌드): 이용권 상세 120 → 40KB · 상품 128 → 32 · 유어샵 118 → 32 ·
 * 교환권 111 → 25 · 지도 126 → 52 · 폰 홈 37 → 31(PC 홈 청크를 더는 안 받는다) · 첫 화면 193 → 189.
 *
 * 이 테스트가 고정하는 것:
 *   ① 묶음기를 **가짜 모듈 그래프로 실제로 돌려** — 첫 화면 모듈은 종전 이름 · 한 페이지만 쓰는 모듈은 그 페이지 묶음 ·
 *      여러 페이지가 쓰면 공용 · 대시보드 전용은 종전 이름 · 페이지 파일 자체는 손대지 않음 · 작은 묶음은 공용으로
 *   ② `app-utils-deferred` 는 배럴이 있어도 첫 화면 소속으로 보지 않는다
 *   ③ lucide 이름 import → 아이콘 파일 직접 import (배럴이 그래프를 흐리지 않게)
 *   ④ 배선 — vite 가 묶음기와 lucide 플러그인을 쓰고, 생성기는 import 만으로 맵을 덮어쓰지 않는다
 *   ⑤ 홈은 폰/PC 를 나눈다(워커가 UA 로 고른다) + role-leak 가드가 PC 홈도 본다
 *
 * ⚠️ 못 막는 것: 실제 바이트(빌드 후 `check-bundle-size`·`check-surface-role-leak` 와 실측의 몫) · 청크 사이 순환으로 인한
 *   런타임 초기화 오류(브라우저 렌더 — 2026-10-13 에 22개 경로를 렌더해 새 오류 0 을 확인했다).
 */
import { routeSurface } from '@/shared/route-surface'
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createSurfaceChunker, LIBRARY_ENVELOPES } from '../../../scripts/surface-chunks.mjs'
import { judge, PREFETCH_OK } from '../../../scripts/check-surface-chunk-runtime.mjs'
import { buildLucideIconMap, rewriteLucideImports } from '../../../scripts/lucide-deep-imports.mjs'
import { stripComments } from '../helpers/source-text'

const ROOT = '/repo'
const P = (f: string) => path.join(ROOT, f)

/** 가짜 그래프: main → shell ; pageA → {onlyA, shared3, tiny} ; pageB → {shared3, onlyB} ; pageC → shared3 ; admin → onlyAdmin */
function graph() {
  const big = 'x'.repeat(5000)
  const mods: Record<string, { isEntry?: boolean; importedIds: string[]; dynamicallyImportedIds?: string[]; code?: string }> = {
    [P('src/main.tsx')]: { isEntry: true, importedIds: [P('src/shell.ts'), P('src/hooks/queries/index.ts')], dynamicallyImportedIds: [P('src/vitals.ts'), P('src/pages/A.tsx')] },
    [P('src/vitals.ts')]: { importedIds: [], code: big },
    [P('src/shell.ts')]: { importedIds: [], code: big },
    [P('src/hooks/queries/index.ts')]: { importedIds: [P('src/hooks/queries/useMyData.ts')] },
    [P('src/hooks/queries/useMyData.ts')]: { importedIds: [], code: big },
    [P('src/pages/A.tsx')]: { dynamicallyImportedIds: [P('src/pages/a/Reviews.tsx'), P('src/pages/BPage.tsx')], importedIds: [P('src/vitals.ts'), P('src/onlyA.ts'), P('src/shared3.ts'), P('src/tiny.ts'), P('src/hooks/queries/useMyData.ts'), P('src/shell.ts')], code: big },
    [P('src/pages/B.tsx')]: { importedIds: [P('src/shared3.ts'), P('src/onlyB.ts')], code: big },
    [P('src/pages/C.tsx')]: { importedIds: [P('src/shared3.ts'), P('src/reviewsCore.ts')], code: big },
    [P('src/pages/a/Reviews.tsx')]: { importedIds: [P('src/reviewsCore.ts'), P('src/onlyA.ts')], code: big },
    [P('src/reviewsCore.ts')]: { importedIds: [], code: big },
    [P('src/pages/BPage.tsx')]: { importedIds: [P('src/bPageOnly.ts')], code: big },
    [P('src/bPageOnly.ts')]: { importedIds: [], code: big },
    [P('src/pages/Admin.tsx')]: { importedIds: [P('src/onlyAdmin.ts')], code: big },
    [P('src/onlyA.ts')]: { importedIds: [], code: big },
    [P('src/onlyB.ts')]: { importedIds: [], code: big },
    [P('src/shared3.ts')]: { importedIds: [], code: big },
    [P('src/tiny.ts')]: { importedIds: [], code: 'x' },
    [P('src/onlyAdmin.ts')]: { importedIds: [], code: big },
  }
  return {
    getModuleIds: () => Object.keys(mods)[Symbol.iterator](),
    getModuleInfo: (id: string) => mods[id] ?? null,
  }
}

const routes = { a: ['src/pages/A.tsx'], b: ['src/pages/B.tsx'], c: ['src/pages/C.tsx'] }
const makeChunker = () => createSurfaceChunker({ routes, root: ROOT, commonMin: 3, minGroupBytes: 2000 })

describe('① 묶음기 동작', () => {
  const meta = graph()
  const gate = makeChunker()
  it('첫 화면 모듈은 종전 이름 그대로', () => {
    expect(gate(P('src/shell.ts'), 'app-shell', meta)).toBe('app-shell')
  })
  it('한 페이지만 쓰는 모듈은 그 페이지 묶음', () => {
    expect(gate(P('src/onlyA.ts'), 'app-components', meta)).toBe('lz-a')
    expect(gate(P('src/onlyB.ts'), 'app-components', meta)).toBe('lz-b')
  })
  it('여러 페이지(기준 이상)가 쓰면 공용', () => {
    expect(gate(P('src/shared3.ts'), 'app-components', meta)).toBe('lz-common')
  })
  it('작은 묶음은 공용으로 합친다(파일 하나 값을 못 한다)', () => {
    // tiny 는 a 만 쓰지만, 그 묶음 lz-a 는 onlyA 덕에 크다 — 같은 묶음이라 lz-a 에 남는다.
    expect(gate(P('src/tiny.ts'), 'app-components', meta)).toBe('lz-a')
    const g2 = createSurfaceChunker({ routes: { t: ['src/pages/C.tsx'], a: ['src/pages/A.tsx'] }, root: ROOT, commonMin: 9, minGroupBytes: 999999 })
    expect(g2(P('src/onlyA.ts'), 'app-components', graph())).toBe('lz-common')
  })
  it('대시보드 전용(손님 페이지가 안 닿음)은 종전 이름', () => {
    expect(gate(P('src/onlyAdmin.ts'), 'app-admin-components', meta)).toBe('app-admin-components')
  })
  it('페이지 파일 자체는 손대지 않는다(매니페스트가 그 청크를 찾는다)', () => {
    expect(gate(P('src/pages/A.tsx'), undefined, meta)).toBeUndefined()
  })
  it('이름 규칙이 있는 라이브러리는 그대로, 이름 없는 라이브러리는 묶는 대상', () => {
    expect(gate('/repo/node_modules/embla/x.js', 'embla', meta)).toBe('embla')
  })
})

describe('①-2 엔트리가 나중에 동적으로 부르는 모듈은 페이지 봉투와 떨어진다', () => {
  // 2026-10-13 유어샵 실측: 웹 바이탈 보고(엔트리 동적 import)가 상세 전용 봉투에 들어가 유어샵이 상세 코드 18KB(br)를 받았다.
  it('엔트리 동적 import + 한 페이지 → 별도 봉투(lz-a-boot)', () => {
    expect(makeChunker()(P('src/vitals.ts'), 'app-utils-deferred', graph())).toBe('lz-a-boot')
  })
  it('페이지 진입점으로 가는 동적 import(라우트 lazy)는 boot 로 세지 않는다 — 페이지 전용 모듈은 그대로', () => {
    expect(makeChunker()(P('src/onlyA.ts'), 'app-components', graph())).toBe('lz-a')
  })
})

describe('①-3 페이지가 나중에(lazy) 쓰는 부품은 그 페이지의 lazy 봉투로', () => {
  // 2026-10-13 렌더 실측: 상세의 리뷰·미니 지도가 상품·지도 페이지 봉투에 섞여, 상세가 그 봉투를 통째로 받았다(335 → 259KB).
  it('lazy 로만 쓰는 부품 → lz-aL', () => {
    expect(makeChunker()(P('src/pages/a/Reviews.tsx'), 'app-components', graph())).toBe('lz-aL')
  })
  it('다른 페이지가 정적으로 쓰는 부품을 lazy 로 쓰면 둘이 함께 이름에 남는다(남의 봉투에 섞이지 않는다)', () => {
    expect(makeChunker()(P('src/reviewsCore.ts'), 'app-components', graph())).toBe('lz-aL-c')
  })
  it('이미 정적으로 쓰는 모듈엔 L 을 안 붙인다(첫 화면 봉투가 쪼개지지 않게)', () => {
    expect(makeChunker()(P('src/onlyA.ts'), 'app-components', graph())).toBe('lz-a')
  })
  it('최상위 페이지(XxxPage.tsx)로 가는 동적 import 는 따라가지 않는다(라우트 lazy·카드 prefetch)', () => {
    expect(makeChunker()(P('src/bPageOnly.ts'), 'app-components', graph())).toBe('app-components')
  })
})

describe('①-4 라이브러리 전용 봉투는 건드리지 않는다', () => {
  it('sentry 옆 앱 코드는 페이지 봉투로 빼지 않는다(빼면 sentry 가 전 화면에 실린다)', () => {
    expect(makeChunker()(P('src/onlyA.ts'), 'sentry', graph())).toBe('sentry')
  })
  it('vite 에서 "앱 코드 → 라이브러리 봉투" 규칙의 이름은 전부 보호 목록에 있다', () => {
    const lines = readFileSync('vite.config.ts', 'utf8').split('\n')
    const libNames = new Set<string>()
    const srcNames = new Set<string>()
    for (const l of lines) {
      const m = l.match(/return '([^']+)'/)
      if (!m || l.trim().startsWith('//')) continue
      const conds = [...l.matchAll(/id\.includes\('([^']+)'\)/g)].map((x) => x[1])
      if (conds.some((c) => !c.startsWith('/src/'))) libNames.add(m[1])
      if (conds.some((c) => c.startsWith('/src/'))) srcNames.add(m[1])
    }
    const both = [...srcNames].filter((n) => libNames.has(n))
    expect(both.length).toBeGreaterThan(2)
    for (const n of both) expect(LIBRARY_ENVELOPES.has(n), n).toBe(true)
  })
})

describe('②-2 런타임 청크 판정', () => {
  const S = { home: ['h.tsx'], gbDetail: ['d.tsx'], linkshop: ['c.tsx', 's.tsx'] }
  it('남의 표면 봉투는 위반, 자기·공용·boot·lazy·의도된 미리받기는 통과', () => {
    expect(judge(['lz-gbDetail.js'], 'linkshop', S)).toHaveLength(1)
    expect(judge(['lz-linkshop1.js', 'lz-common.js', 'lz-boot-gbDetail.js', 'lz-gbDetailL-linkshop2L.js'], 'linkshop', S)).toEqual([])
    // ⏳ 2026-10-13 (대표 승인): 카드 미리받기가 load 뒤로 옮겨져 홈·쇼핑은 상세 봉투를 받지 않는다 — 허용 목록 0.
    expect(PREFETCH_OK.home).toBeUndefined()
    expect(PREFETCH_OK.browse).toBeUndefined()
    expect(judge(['lz-gbDetail.js'], 'home', S)).toHaveLength(1)
  })
  it('폰 첫 화면 금지 목록', () => {
    expect(judge(['codes.js', 'capacitor.js', 'app-seller-components.js'], 'home', S)).toHaveLength(3)
  })
})

describe('② app-utils-deferred 는 배럴이 있어도 첫 화면 소속이 아니다', () => {
  it('엔트리 배럴이 다시 내보내도 페이지 묶음으로 간다', () => {
    expect(makeChunker()(P('src/hooks/queries/useMyData.ts'), 'app-utils-deferred', graph())).toBe('lz-a')
  })
  it('같은 모듈이라도 다른 봉투 이름이면 엔트리 판정을 따른다(첫 화면 바이트 보호)', () => {
    expect(makeChunker()(P('src/hooks/queries/useMyData.ts'), 'app-utils', graph())).toBe('app-utils')
  })
})

describe('③ lucide 직접 import', () => {
  const map = buildLucideIconMap(readFileSync('node_modules/lucide-react/dist/esm/lucide-react.js', 'utf8'))
  it('배럴을 읽어 이름 → 파일 표를 만든다(별칭 포함)', () => {
    expect(map.size).toBeGreaterThan(1000)
    expect(map.get('Home')).toBe('house')
    expect(map.get('Loader2')).toBe('loader-circle')
    expect(map.get('Gift')).toBe('gift')
  })
  it('아이콘만 파일로 바꾸고 타입·비아이콘은 남긴다, 줄 수 보존', () => {
    const src = "import {\n  Gift,\n  type LucideIcon,\n  Home as H,\n  createLucideIcon,\n} from 'lucide-react'\nconst x = 1"
    const out = rewriteLucideImports(src, map)!
    expect(out).toContain("import Gift from 'lucide-react/dist/esm/icons/gift.js'")
    expect(out).toContain("import H from 'lucide-react/dist/esm/icons/house.js'")
    expect(out).toContain("import { type LucideIcon, createLucideIcon } from 'lucide-react'")
    expect(out.split('\n').length).toBe(src.split('\n').length)
    expect(out.endsWith('const x = 1')).toBe(true)
  })
  it('아이콘 이름이라도 type import 는 그대로 둔다(값 import 가 되면 안 된다)', () => {
    const out = rewriteLucideImports("import { type Gift, Home } from 'lucide-react'", map)!
    expect(out).toContain("import { type Gift } from 'lucide-react'")
    expect(out).not.toContain('icons/gift.js')
  })
  it('바꿀 것이 없으면 null', () => {
    expect(rewriteLucideImports("import { type LucideIcon } from 'lucide-react'", map)).toBeNull()
    expect(rewriteLucideImports('const a = 1', map)).toBeNull()
  })
})

describe('④ 배선', () => {
  const vite = stripComments(readFileSync('vite.config.ts', 'utf8'))
  it('manualChunks 가 묶음기를 거친다', () => {
    expect(vite).toMatch(/manualChunks\(id, meta\) \{ return gateLazy\(id, /)
    expect(vite).toMatch(/const gateLazy = createSurfaceChunker\(\{\s*routes: SURFACE_ROUTES,/)
  })
  it('lucide 플러그인이 plugins 에 있다', () => {
    const plugins = vite.slice(vite.indexOf('plugins: ['), vite.indexOf('],', vite.indexOf('plugins: [')))
    expect(plugins).toContain('lucideDeepImportsPlugin()')
  })
  it('생성기는 직접 실행할 때만 맵을 쓴다(vite 가 import 해도 덮어쓰지 않는다)', () => {
    const gen = readFileSync('scripts/generate-route-chunk-map.mjs', 'utf8')
    expect(gen).toMatch(/export const ROUTES = \{/)
    expect(gen).toMatch(/if \(process\.argv\[1\] && import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href\) main\(\)/)
    expect(gen.startsWith('#!')).toBe(false) // vite 가 설정 번들에 넣으면 셔뱅이 구문 오류가 된다
  })
})

describe('⑤ 홈은 폰/PC 를 나눈다', () => {
  it('ROUTES — home 은 폰 홈만, homePc 는 PC 홈만', () => {
    const gen = stripComments(readFileSync('scripts/generate-route-chunk-map.mjs', 'utf8'))
    expect(gen).toMatch(/home: \['src\/pages\/mobile-home\/MobileHomePage\.tsx'\],/)
    expect(gen).toMatch(/homePc: \['src\/pages\/pc-home\/PcHomePage\.tsx'\],/)
  })
  it('워커가 UA 로 고른다', () => {
    const w = readFileSync('src/worker/index.ts', 'utf8')
    // 🧭 2026-10-15: 판정은 공용 함수(shared/route-surface) — 워커는 UA 를 그 함수에 넘긴다.
    expect(w).toContain("const chunkSurface = routeSurface(url.pathname, isMobileUserAgent(c.req.header('user-agent')), authed)")
    expect(routeSurface('/', true, false)).toBe('home')
    expect(routeSurface('/', false, false)).toBe('homePc')
  })
  it('role-leak 가드가 PC 홈 표면도 본다', () => {
    expect(readFileSync('scripts/check-surface-role-leak.mjs', 'utf8')).toMatch(/CONSUMER_SURFACES = \[[^\]]*'homePc'/)
  })
})

describe('⑥ 유어샵이 안 쓰는 것을 받지 않는다 (2026-10-13 느린 4G 재생 실측)', () => {
  it('서버 시드로 그렸으면 같은 데이터 재요청을 load 뒤로 미룬다(주인은 바로)', () => {
    const c = stripComments(readFileSync('src/pages/CuratorPage.tsx', 'utf8'))
    expect(c).toMatch(/const deferRefresh = ssrSeededFor === handle && !isOwner && typeof document !== 'undefined' && document\.readyState !== 'complete'/)
    expect(c).toMatch(/if \(!deferRefresh\) \{ run\(\); return/)
    expect(c).toMatch(/window\.addEventListener\('load', onLoad, \{ once: true \}\)/)
    expect(c).toMatch(/\{ ssrSeededFor = handle; return parsed \}/)
  })
  it('유어샵 QR 카드는 PC 에서만 마운트한다(폰에서 qrcode 17KB 를 받지 않게)', () => {
    const qr = stripComments(readFileSync('src/pages/curator-page/UShopQrCard.tsx', 'utf8'))
    expect(qr).toMatch(/const isDesktop = useMediaQuery\('\(min-width: 1024px\)'\)\s*if \(!isDesktop\) return null/)
  })
  it('웹에서는 앱 SDK(native)를 부르지 않는다', () => {
    const app = stripComments(readFileSync('src/App.tsx', 'utf8'))
    expect(app).toMatch(/if \(isNativeShell\(\)\) import\('\.\/lib\/native'\)\.then\(\(\{ setStatusBarStyle \}\)/)
  })
  it('환경 검증(zod)은 load 뒤로 미룬다 — 백스톱 포함', () => {
    const main = stripComments(readFileSync('src/main.tsx', 'utf8'))
    expect(main).toMatch(/window\.addEventListener\('load', \(\) => setTimeout\(once, 0\), \{ once: true \}\)\s*setTimeout\(once, 12000\)/)
    expect(main).not.toMatch(/^import\('@\/shared\/config\/env-validator'\)/m)
    // 부르는 자리는 정확히 둘 — 이미 load 끝난 경우 · load 뒤(once). 셋째가 생기면 부팅 중에 부르는 것이다.
    expect(main.match(/runEnvValidation\(\)/g)?.length).toBe(2)
    expect(main).toMatch(/if \(typeof window === 'undefined' \|\| document\.readyState === 'complete'\) runEnvValidation\(\)\nelse \{/)
  })
})
