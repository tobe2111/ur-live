/**
 * 🗺️ 2026-11-08 대표 *"계속 최적화"* — 지역 착지(`/region/…`, sitemap 38곳) 첫 화면을 서버가 그린다.
 * 라이브 실측(느린 4G 흉내): FCP 1.65s. 박스 실측(390×844, `/region/서울/성동구`): 빵부스러기·h1·딜 수 줄·칩 7개 좌표가
 * 서버 HTML 과 React 에서 전부 같았다. 딜 수는 같은 응답의 `/api/regions` 시드 — 화면 첫 렌더도 그 시드라 깜빡임이 없다.
 * ⚠️ 못 보는 것: 실제 프레임(배포 뒤 라이브) · 카드 영역(종전처럼 화면이 그린다).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { buildRegionFirstScreen, regionFirstCards, REGION_FS_CARDS } from '@/worker/utils/region-first-screen'
import { FEED_PC_GRID } from '@/shared/deal-card-grid'
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
    expect(w).toMatch(/!url\.search && REGION_PATH_RE\.test\(url\.pathname\) && shouldRenderMobileFirstScreen\(c\.req\.header\('user-agent'\)\)\) \{ const regionFirst = buildRegionFirstScreen\(url\.pathname, ssrExtraPayload, urdealLoaderHtml, ssrPayload\)/)
  })
  it('CSS 먼저 + 전용 첫 화면 CSS', () => {
    expect(cssFirstApplies(SEOUL, PHONE)).toBe(true)
    expect(criticalSurfaceOf(SEOUL)).toBe('region')
  })
})

describe('④ 카드 — 화면과 같은 순서·같은 격자 (이용권이 바뀌면 시드가 바뀌어 저절로 따라간다 — 손으로 세팅하는 값 없음)', () => {
  const row = (id: number, sold: number, addr: string) => ({ id, name: `딜${id}`, price: 9000, image_url: `https://media.ur-team.com/uploads/demo/${id}.jpg`, restaurant_address: addr, sold_count: sold, category: 'meal_voucher' })
  const MAIN = JSON.stringify({ success: true, data: [
    row(1, 3, '서울 성동구 왕십리로 1'), row(2, 9, '서울 마포구 1'), row(3, 7, '서울 성동구 성수동 2'),
    row(4, 7, '서울 성동구 3'), row(5, 1, '서울 성동구 4'), row(6, 20, '서울 성동구 5'),
  ] })
  it('지역 필터 → 판매 수 내림차순(같은 수는 시드 순서) → 처음 4장', () => {
    expect(regionFirstCards(MAIN, { sido: '서울', sigungu: '성동구' }).map((p) => p.id)).toEqual([6, 3, 4, 1])
    expect(REGION_FS_CARDS).toBe(4)
  })
  it('격자는 화면 피드(pc)와 같은 상수 · 카드는 즉시 받기', () => {
    const html = buildRegionFirstScreen(SEOUL, STATS, '', MAIN)
    expect(html).toContain(`class="${FEED_PC_GRID} ur-cv-grid"`)
    expect((html.match(/<a href="\/pass\//g) || []).length).toBe(4)
    expect(html).toContain('loading="eager"')
    expect(read('src/pages/main-home/GroupBuyFeed.tsx')).toContain('? FEED_PC_GRID')
    expect(read('src/pages/main-home/GroupBuyFeed.tsx')).toContain('return feedSoldOf(p)')
  })
  it('지역에 카드가 없으면 격자를 안 그린다(빈 상태 문구는 화면 몫)', () => {
    expect(buildRegionFirstScreen('/region/' + encodeURIComponent('제주'), STATS, '', MAIN)).not.toContain('ur-cv-grid')
  })
  it('워커가 MAIN 시드를 넘긴다', () => {
    expect(read('src/worker/index.ts')).toContain('buildRegionFirstScreen(url.pathname, ssrExtraPayload, urdealLoaderHtml, ssrPayload)')
  })
})
