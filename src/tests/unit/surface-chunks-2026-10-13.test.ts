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
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createSurfaceChunker } from '../../../scripts/surface-chunks.mjs'
import { buildLucideIconMap, rewriteLucideImports } from '../../../scripts/lucide-deep-imports.mjs'
import { stripComments } from '../helpers/source-text'

const ROOT = '/repo'
const P = (f: string) => path.join(ROOT, f)

/** 가짜 그래프: main → shell ; pageA → {onlyA, shared3, tiny} ; pageB → {shared3, onlyB} ; pageC → shared3 ; admin → onlyAdmin */
function graph() {
  const big = 'x'.repeat(5000)
  const mods: Record<string, { isEntry?: boolean; importedIds: string[]; code?: string }> = {
    [P('src/main.tsx')]: { isEntry: true, importedIds: [P('src/shell.ts'), P('src/hooks/queries/index.ts')] },
    [P('src/shell.ts')]: { importedIds: [], code: big },
    [P('src/hooks/queries/index.ts')]: { importedIds: [P('src/hooks/queries/useMyData.ts')] },
    [P('src/hooks/queries/useMyData.ts')]: { importedIds: [], code: big },
    [P('src/pages/A.tsx')]: { importedIds: [P('src/onlyA.ts'), P('src/shared3.ts'), P('src/tiny.ts'), P('src/hooks/queries/useMyData.ts'), P('src/shell.ts')], code: big },
    [P('src/pages/B.tsx')]: { importedIds: [P('src/shared3.ts'), P('src/onlyB.ts')], code: big },
    [P('src/pages/C.tsx')]: { importedIds: [P('src/shared3.ts')], code: big },
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
const mk = () => createSurfaceChunker({ routes, root: ROOT, commonMin: 3, minGroupBytes: 2000 })

describe('① 묶음기 동작', () => {
  const meta = graph()
  const gate = mk()
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

describe('② app-utils-deferred 는 배럴이 있어도 첫 화면 소속이 아니다', () => {
  it('엔트리 배럴이 다시 내보내도 페이지 묶음으로 간다', () => {
    expect(mk()(P('src/hooks/queries/useMyData.ts'), 'app-utils-deferred', graph())).toBe('lz-a')
  })
  it('같은 모듈이라도 다른 봉투 이름이면 엔트리 판정을 따른다(첫 화면 바이트 보호)', () => {
    expect(mk()(P('src/hooks/queries/useMyData.ts'), 'app-utils', graph())).toBe('app-utils')
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
    expect(w).toContain("? (isMobileUserAgent(c.req.header('user-agent')) ? 'home' : 'homePc')")
  })
  it('role-leak 가드가 PC 홈 표면도 본다', () => {
    expect(readFileSync('scripts/check-surface-role-leak.mjs', 'utf8')).toMatch(/CONSUMER_SURFACES = \[[^\]]*'homePc'/)
  })
})
