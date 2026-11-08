/**
 * 🗺️ 2026-11-08 대표 *"계속 최적화"* — 지역 착지(`/region/…`, sitemap 38곳) 첫 화면을 서버가 그린다.
 * 라이브 실측(느린 4G 흉내): FCP 1.65s. 박스 실측(390×844, `/region/서울/성동구`): 빵부스러기·h1·딜 수 줄·칩 7개 좌표가
 * 서버 HTML 과 React 에서 전부 같았다. 딜 수는 같은 응답의 `/api/regions` 시드 — 화면 첫 렌더도 그 시드라 깜빡임이 없다.
 * ⚠️ 못 보는 것: 실제 프레임(배포 뒤 라이브) · 카드 영역(종전처럼 화면이 그린다).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { buildRegionFirstScreen } from '@/worker/utils/region-first-screen'
import { regionDealCount } from '@/shared/region-page'
import { cssFirstApplies, criticalSurfaceOf } from '@/worker/utils/css-first-boot'

const read = (p: string) => fs.readFileSync(path.join(__dirname, '../../..', p), 'utf8')
const SEOUL = '/region/' + encodeURIComponent('서울') + '/' + encodeURIComponent('성동구')
const STATS = JSON.stringify({ success: true, data: [{ sido: '서울', count: 89, indexable: true, sigungu: [{ sigungu: '성동구', count: 8, indexable: true }] }] })
const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

describe('① 그리는 것', () => {
  it('제목 · 시드의 딜 수 · 칩 여섯 + 지도 링크', () => {
    const html = buildRegionFirstScreen(SEOUL, STATS, '<div style="min-height:100dvh">L</div>')
    expect(html).toContain('<h1')
    expect(html).toContain('서울 성동구 이용권·동네딜')
    expect(html).toContain('8개</b>')
    expect((html.match(/aria-pressed=/g) || []).length).toBe(6)
    expect(html).toContain('min-height:34dvh')
    expect(html).not.toContain('<svg')
  })
  it('시드가 없으면 화면 첫 렌더와 같은 0 문구 · 지역이 아니면 빈 문자열', () => {
    expect(buildRegionFirstScreen(SEOUL, null, '')).toContain('아직 이 지역에 진행 중인 딜이 없어요')
    expect(buildRegionFirstScreen('/region', STATS, '')).toBe('')
  })
  it('딜 수 계산 = 화면과 같은 함수', () => {
    expect(regionDealCount(JSON.parse(STATS).data, { sido: '서울', sigungu: '성동구' })).toBe(8)
    expect(regionDealCount(JSON.parse(STATS).data, { sido: '서울' })).toBe(89)
  })
})

describe('② 화면이 같은 SSOT · 같은 시드', () => {
  const page = read('src/pages/region/RegionPage.tsx')
  it('선택된 칩 = 브랜드 블루 면(검정 면 금지 — 2026-09-29 칩 선택 규칙, 이 .ts 파일은 전수 시험이 안 훑는다)', () => {
    expect(read('src/shared/region-page.ts')).toContain("  chipOn: 'bg-brand text-white border-brand',")
  })
  it('상수·계산을 import 한다', () => {
    expect(page).toContain('const CATEGORY_CHIPS = REGION_CATEGORY_CHIPS')
    expect(page).toContain('const dealCount = regionDealCount(regions, ref)')
    expect(page).toContain('<h1 className={C.h1}>')
  })
  it('첫 렌더부터 시드 통계를 쓴다(깜빡임 방지) · 마운트 때 새로 받는다', () => {
    expect(page).toMatch(/initialData: readRegionsSeed\(\),\s*\n\s*refetchOnMount: 'always'/)
  })
})

describe('③ 배선', () => {
  const w = read('src/worker/index.ts')
  it('지역이면 통계 시드를 같이 받는다', () => {
    expect(w).toContain("else ssrExtra = { slot: 'REGIONS', path: '/api/regions' };")
  })
  it('폰 UA · 쿼리 없는 지역 경로만 · 크롤러 요약은 뒤에 붙인다', () => {
    expect(w).toMatch(/!url\.search && REGION_PATH_RE\.test\(url\.pathname\) && shouldRenderMobileFirstScreen\(c\.req\.header\('user-agent'\)\)\) \{ const regionFirst = buildRegionFirstScreen\(url\.pathname, ssrExtraPayload, urdealLoaderHtml\)/)
  })
  it('CSS 먼저 + 전용 첫 화면 CSS', () => {
    expect(cssFirstApplies(SEOUL, PHONE)).toBe(true)
    expect(criticalSurfaceOf(SEOUL)).toBe('region')
  })
})
