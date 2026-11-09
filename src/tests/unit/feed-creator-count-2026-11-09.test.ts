/**
 * 🎬 목록 카드 'SNS 후기 N' 〔2026-11-09 대표 *"모두 진행"* — 개선 5〕
 * 지키는 것: ① 숫자는 가게 키로 붙고 교환권엔 안 붙는다 · 실패하면 목록 그대로(fail-soft)
 *           ② 카드와 서버 첫 화면이 같은 문구 함수 · 별점 줄 안(새 줄 0)
 *           ③ 라이브 피드 라우트와 cron 피드 캐시가 같은 헬퍼
 * 못 보는 것: 숫자가 상세 칸 개수와 정확히 같은지(상세는 자동 글을 한 번 더 거른다 — 헬퍼 머리말).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { attachCreatorCounts } from '@/features/creator-content/api/content-counts'
import { storeKeyFor } from '@/features/creator-content/api/content-db'
import { creatorCountLabel } from '@/shared/home-creator-count'

const read = (p: string) => readFileSync(p, 'utf8')
const fakeDB = (rows: { store_key: string; n: number }[], fail = false) => ({
  prepare: () => ({ bind: () => ({ all: async () => { if (fail) throw new Error('x'); return { results: rows } } }) }),
}) as never

describe('① 숫자 붙이기', () => {
  it('가게 키로 붙고 교환권·이름 없는 상품엔 안 붙는다', async () => {
    const key = storeKeyFor('꾸꾸데쎄르', '부산 연제구 연산동 1')
    const out = await attachCreatorCounts(fakeDB([{ store_key: key, n: 7 }]), [
      { id: 1, restaurant_name: '꾸꾸데쎄르', restaurant_address: '부산 연제구 연산동 1' },
      { id: 2, restaurant_name: '꾸꾸데쎄르', restaurant_address: '부산 연제구 연산동 1', deal_only: 1 },
      { id: 3, restaurant_name: null },
    ])
    expect(out.map((p) => (p as { creator_count?: number }).creator_count)).toEqual([7, undefined, undefined])
  })
  it('조회가 실패하면 목록 그대로', async () => {
    const rows = [{ id: 1, restaurant_name: '꾸꾸데쎄르', restaurant_address: '부산 연제구' }]
    expect(await attachCreatorCounts(fakeDB([], true), rows)).toBe(rows)
  })
})

describe('② 카드와 서버 첫 화면', () => {
  it('문구', () => {
    expect(creatorCountLabel(5)).toBe('SNS 후기 5')
    expect(creatorCountLabel(120)).toBe('SNS 후기 99+')
  })
  it('둘 다 같은 함수 · 별점 줄 안', () => {
    const card = read('src/pages/main-home/GroupBuyFeedCard.tsx')
    expect(card).toMatch(/\{reviewCount > 0 && <span>\(\{formatNumber\(reviewCount\)\}\)<\/span>\}\n\s*\{Number\(p\.creator_count\) > 0 && <span className="truncate">\{creatorCountLabel\(Number\(p\.creator_count\)\)\}<\/span>\}/)
    const ssr = read('src/worker/utils/home-first-screen.ts')
    expect(ssr).toMatch(/Number\(p\.creator_count\) > 0 \? `<span class="truncate">\$\{escText\(creatorCountLabel\(Number\(p\.creator_count\)\)\)\}<\/span>`/)
  })
})

describe('③ 라이브 피드와 cron 캐시가 같은 헬퍼', () => {
  it('배선', () => {
    expect(read('src/features/group-buy/api/group-buy-public.routes.ts')).toMatch(/let withFcfs = await \(await import\('\.\.\/\.\.\/creator-content\/api\/content-counts'\)\)\.attachCreatorCounts\(DB as never, mapped\)/)
    // 🩸 2026-11-09 라이브: 뒤의 추첨(fcfs) 덧붙이기가 `mapped.map` 으로 다시 시작해 숫자를 지웠다(응답 40개 중 0개).
    expect(read('src/features/group-buy/api/group-buy-public.routes.ts')).not.toMatch(/withFcfs = mapped\.map\(/)
    expect(read('src/worker/cron/group-buy-feed-cache.ts')).toMatch(/const rows = await attachCreatorCounts\(DB as never, /)
  })
})
