/**
 * 🔎 지역 페이지 제목에 사람들이 실제로 치는 말(맛집·할인) (2026-11-16 검색 유입 점검)
 * 종전 제목 `서울 서초구 이용권·동네딜 할인` 에 '맛집' 이 없었다. 서버 메타와 클라가 같은 함수를 쓴다.
 * ⚠️ 못 보는 것: 실제 순위(색인 갱신까지 수주).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { regionTitleCore } from '@/shared/seo/region-title'

describe('지역 제목', () => {
  it("'맛집' 과 '할인' 이 들어 있고 이용권 명칭을 지킨다", () => {
    const t = regionTitleCore('서울 서초구')
    expect(t.startsWith('서울 서초구 ')).toBe(true)
    for (const w of ['맛집', '할인', '이용권']) expect(t).toContain(w)
    expect((t.match(/·/g) ?? []).length).toBeLessThanOrEqual(1)
  })
  it('서버 메타와 클라 화면이 같은 함수를 쓴다', () => {
    expect(readFileSync('src/worker/utils/surface-ssr-meta.ts', 'utf8')).toContain('withSiteName(regionTitleCore(label), siteName)')
    expect(readFileSync('src/pages/region/RegionPage.tsx', 'utf8')).toContain('`${regionTitleCore(label)} | 유어딜`')
  })
})
