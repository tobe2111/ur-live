/**
 * 🖼️ 검색 결과 첫 줄 썸네일 preload (2026-11-10 — 시드 배포 뒤 LCP 2.6~2.8s 가 첫 줄 썸네일이었다).
 *
 * 지키는 것:
 *   ① preload 주소 = 줄(`RestaurantRow`)이 그리는 주소 — 같은 `cfImage` · 같은 `ROW_THUMB_OPTS`(줄 소스가 그 상수를 쓴다)
 *   ② 고르는 줄 = 화면이 그리는 줄(범위 필터가 `SearchPage` 와 같다) · 앞에서 4장 · 같은 출처 경로만
 *   ③ 워커가 SEARCH 슬롯에서만, 'auto' 우선순위로 싣는다
 * ⚠️ 못 보는 것: 브라우저가 실제로 preload 를 재사용하는지(배포 뒤 요청 수로 본다 — 같은 주소가 두 번이면 실패).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { searchThumbPreloadHrefs, searchRowVisible, SEARCH_THUMB_PRELOAD_COUNT } from '@/worker/utils/search-thumb-preload'
import { ROW_THUMB_OPTS } from '@/shared/row-thumb'
import { cfImage } from '@/utils/cf-image'

const ROW = stripComments(readFileSync('src/pages/restaurant-map/RestaurantRow.tsx', 'utf8'))
const PAGE = stripComments(readFileSync('src/pages/SearchPage.tsx', 'utf8'))
const img = (i: number) => `https://media.ur-team.com/uploads/p${i}.jpg`
const seed = (rows: object[]) => JSON.stringify({ success: true, data: rows })

describe('① 주소가 줄과 같다', () => {
  it('줄이 같은 상수로 cfImage 를 부른다 · 손으로 적은 옵션 없음', () => {
    expect(ROW).toContain('cfImage(r.image_url, ROW_THUMB_OPTS) || r.image_url')
    expect(ROW).not.toContain('width: 176, quality: 85')
    expect(ROW_THUMB_OPTS).toEqual({ width: 176, quality: 85, format: 'auto' })
  })
  it('preload 주소 = cfImage(원본, ROW_THUMB_OPTS)', () => {
    const hrefs = searchThumbPreloadHrefs(seed([{ image_url: img(1), category: 'meal_voucher' }]), 'voucher')
    expect(hrefs).toEqual([cfImage(img(1), ROW_THUMB_OPTS)])
    expect(hrefs[0].startsWith('/cdn-cgi/image/')).toBe(true)
  })
})

describe('② 고르는 줄', () => {
  const rows = [
    { image_url: img(1), deal_only: 1, category: 'gifticon' },
    { image_url: img(2), category: 'meal_voucher' },
    { image_url: '', category: 'meal_voucher' },
    { image_url: img(4), category: 'fashion' },
    { image_url: img(5), category: 'beauty_voucher' },
    { image_url: img(6) }, { image_url: img(7) }, { image_url: img(8) }, { image_url: img(9) },
  ]
  it('이용권 범위: 교환권·비이용권 분류를 건너뛴 앞 4줄(사진 없는 줄은 빠진다)', () => {
    const hrefs = searchThumbPreloadHrefs(seed(rows), 'voucher')
    expect(hrefs).toEqual([img(2), img(5), img(6)].map((u) => cfImage(u, ROW_THUMB_OPTS)))
    expect(SEARCH_THUMB_PRELOAD_COUNT).toBe(4)
  })
  it('교환권 범위: deal_only=1 만', () => {
    expect(searchThumbPreloadHrefs(seed(rows), 'exchange')).toEqual([cfImage(img(1), ROW_THUMB_OPTS)])
  })
  it('판정이 SearchPage 의 필터와 같은 문장이다', () => {
    expect(PAGE).toContain("if (scope === 'exchange') return Number(product.deal_only) === 1")
    expect(PAGE).toContain('if (Number(product.deal_only) === 1) return false')
    expect(PAGE).toContain('if (product.category && !isVoucherCategory(product.category)) return false')
    expect(searchRowVisible({ deal_only: 1 }, 'voucher')).toBe(false); expect(searchRowVisible({ deal_only: 1 }, 'exchange')).toBe(true)
    expect(searchRowVisible({ category: 'fashion' }, 'voucher')).toBe(false); expect(searchRowVisible({}, 'voucher')).toBe(true)
  })
  it('바깥 주소·깨진 시드·빈 시드 → 빈 배열', () => {
    expect(searchThumbPreloadHrefs(null, 'voucher')).toEqual([]); expect(searchThumbPreloadHrefs('{bad', 'voucher')).toEqual([])
    expect(searchThumbPreloadHrefs(seed([]), 'voucher')).toEqual([])
    for (const h of searchThumbPreloadHrefs(seed([{ image_url: 'https://example.invalid/x.jpg' }]), 'voucher')) expect(h.startsWith('/') && !h.startsWith('//')).toBe(true)
  })
})

describe('③ 워커', () => {
  it('SEARCH 슬롯에서만 · auto 우선순위', () => {
    const w = readFileSync('src/worker/index.ts', 'utf8') // ⚠️ stripComments 금지(source-text 머리말)
    expect(w).toContain("if (ssrTarget?.slot === 'SEARCH' && ssrPayload) for (const th of searchThumbPreloadHrefs(ssrPayload, searchScopeOf(url.search))) appendLcpLink(c.res.headers, th, 'auto');")
  })
})
