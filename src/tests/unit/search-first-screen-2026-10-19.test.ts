/**
 * 🔎 검색 첫 화면이 지도 화면 봉투를 통째로 받던 것 (2026-10-19) — 근거는 vite.config.ts `MAP_ROW_MODULES` 주석.
 *   검색은 지도의 결과 한 줄(`RestaurantRow`)·상세 미리받기를 빌려 쓰는데(모듈 넷, 5.2KB), 그 넷이 지도 봉투(`lz-map`)에 있어
 *   지도 봉투와 그것이 끄는 홈·지도 공용 봉투 · app-ui-utils · 카카오 로더까지 받았다. 인기 검색어 머리의 lucide 아이콘
 *   하나는 lucide 봉투(br 10.2KB)를 끌었다. 결과(정적 폐쇄 brotli): 검색 216.9 → 172.6.
 *
 * 고정하는 것:
 *   ① 고정 묶음 `app-map-row` 의 규칙이 있고 묶음기 보호 목록에 있다
 *   ② 목록 경로가 실재한다(파일이 옮겨지면 규칙이 조용히 아무것도 안 잡는다)
 *   ③ 그 넷이 지도 화면 전용 모듈을 import 하지 않는다 — 하면 묶음이 다시 지도 봉투를 끌고 온다
 *   ④ 검색 화면 쪽 부품이 lucide 뜻 아이콘을 쓰지 않는다(TrendingUp → ChartIcon)
 * ⚠️ 못 막는 것: 실제 바이트(그건 `check-surface-budgets` 의 search 래칫이 잰다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { LIBRARY_ENVELOPES } from '../../../scripts/surface-chunks.mjs'
import { stripComments } from '../helpers/source-text'

const VITE = readFileSync('vite.config.ts', 'utf8')
const at = VITE.indexOf('export const MAP_ROW_MODULES = [')
const MODULES = [...VITE.slice(at, VITE.indexOf(']', at)).matchAll(/'([^']+)'/g)].map((m) => m[1])
const fileOf = (p: string) => [p.slice(1), `${p.slice(1)}.ts`, `${p.slice(1)}.tsx`].find((c) => existsSync(c) && !c.endsWith('/'))

describe('① 고정 묶음', () => {
  it('규칙이 있고 묶음기 보호 목록에 있다', () => {
    expect(stripComments(VITE)).toMatch(/if \(MAP_ROW_MODULES\.some\(\(p\) => id\.includes\(p\)\)\) return 'app-map-row'/)
    expect(LIBRARY_ENVELOPES.has('app-map-row')).toBe(true)
  })
  it('검색이 빌려 쓰는 넷이 목록에 있다', () => {
    expect(MODULES).toEqual(expect.arrayContaining([
      '/src/pages/restaurant-map/RestaurantRow', '/src/pages/restaurant-map/prefetch-detail',
      '/src/pages/restaurant-map/utils.ts', '/src/pages/restaurant-map/CatIcon',
    ]))
  })
})

describe('② 경로 실재', () => {
  it('목록의 경로가 파일로 존재한다', () => {
    for (const p of MODULES) expect(fileOf(p), p).toBeTruthy()
  })
})

describe('③ 묶음이 지도 화면 모듈을 끌지 않는다', () => {
  it('넷의 import 가 같은 목록 밖의 restaurant-map 모듈을 가리키지 않는다', () => {
    const bare = (x: string) => x.replace(/^\.\//, '').replace(/\.tsx?$/, '')
    const inList = (spec: string) => MODULES.some((m) => bare(m).endsWith(`/${bare(spec)}`))
    for (const p of MODULES) {
      const src = stripComments(readFileSync(fileOf(p)!, 'utf8'))
      const local = [...src.matchAll(/^import\s+(?!type\b)[^\n]*from\s+'(\.\/[^']+|@\/pages\/restaurant-map\/[^']+)'/gm)].map((m) => m[1].replace('@/pages/restaurant-map/', './'))
      const outside = local.filter((s) => !inList(s))
      expect(outside, `${p} 가 지도 화면 모듈을 import: ${outside.join(' · ')}`).toEqual([])
    }
  })
})

describe('④ 검색 부품의 아이콘', () => {
  it('인기 검색어 머리는 유어딜 ChartIcon 이다(lucide TrendingUp 아님)', () => {
    const src = stripComments(readFileSync('src/components/search/SearchStates.tsx', 'utf8'))
    expect(src).not.toMatch(/TrendingUp/)
    expect(src).toMatch(/<ChartIcon\b/)
  })
})
