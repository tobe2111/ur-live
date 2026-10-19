/**
 * 🗺️ 2026-10-19 — 지역 페이지(`/region/*`, 색인 44개)가 PC 홈 전용 봉투를 받던 것.
 *
 * 지역 페이지는 `RegionLinkGrid` 하나를 PC 홈과 같이 쓴다. 그 부품이 PC 홈 전용 봉투(`lz-homePc` — 히어로 배너·
 * 앱 띠·지역 타일·사이드바)에 들어 있어서 지역 첫 화면이 그 봉투를 통째로 받았다(에러 0). 지역은 묶음용 ROUTES 밖이라
 * 묶음기가 '사용자'로 세지 못한다. 처방: 그 부품만 작은 고정 묶음(`app-region-grid`)으로 — 지도 목록 줄(`app-map-row`)과 같은 처방.
 * 결과(정적 폐쇄 brotli): region 198.5 → 194.2 · PC 홈 +0.8(요청 하나, 바이트는 같다).
 *
 * ⚠️ 못 보는 것: 바이트 자체(`check-surface-budgets` 가 잠근다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { LIBRARY_ENVELOPES } from '../../../scripts/surface-chunks.mjs'

const VITE = readFileSync('vite.config.ts', 'utf8')

describe('지역 링크 표는 자기 묶음에 산다', () => {
  it('vite 규칙이 RegionLinkGrid 를 app-region-grid 로 보낸다', () => {
    expect(VITE).toMatch(/REGION_GRID_MODULES\s*=\s*\['\/src\/components\/region\/RegionLinkGrid'\]/)
    expect(VITE).toMatch(/if \(REGION_GRID_MODULES\.some\(\(p\) => id\.includes\(p\)\)\) return 'app-region-grid'/)
  })
  it('묶음기가 그 이름을 덮어쓰지 않는다(보호 목록)', () => {
    expect(LIBRARY_ENVELOPES.has('app-region-grid')).toBe(true)
  })
  it('그 부품의 의존은 첫 화면에 이미 있는 것뿐이다(남의 봉투를 끌지 않는다)', () => {
    const src = readFileSync('src/components/region/RegionLinkGrid.tsx', 'utf8')
    const deps = [...src.matchAll(/^import\s[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1])
    expect(deps.sort()).toEqual(['@/hooks/queries/useApiQuery', '@/shared/constants/region-slugs', 'react', 'react-router-dom'].sort())
  })
  it('지역 페이지는 여전히 그 부품을 쓴다(지우고 통과하지 않는다)', () => {
    expect(readFileSync('src/pages/region/RegionPage.tsx', 'utf8')).toMatch(/import RegionLinkGrid from '@\/components\/region\/RegionLinkGrid'/)
  })
})
