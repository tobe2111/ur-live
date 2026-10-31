/**
 * 🖼️ 2026-10-31 (대표 "이용권 페이지도 새로고침을 해야 사진 여러장이 보이는 문제"):
 * 목록 행(사진 최대 3장·설명 없음)으로 상세 캐시를 채우면 상세가 그걸 신선하다고 믿고 다시 받지 않았다.
 * 진짜 QueryClient 로 판정한다 — 목록 시드 뒤에도 상세 fetchQuery(staleTime 60s)는 서버를 부른다.
 * ⚠️ 못 보는 것: 서버가 실제로 사진 몇 장을 주는지 · 브라우저 렌더.
 */
import { describe, it, expect, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { seedDetailFromListRow, queryKeys } from '@/hooks/queries'
import { readCode } from '../helpers/source-text'

describe('목록 행으로 상세 캐시 미리 채우기', () => {
  it('미리 채운 뒤에도 상세는 서버에서 다시 받는다(사진 전체)', async () => {
    const qc = new QueryClient()
    seedDetailFromListRow(qc, { id: 7, images: '["a","b","c"]' })
    expect(qc.getQueryData(queryKeys.groupBuyProduct(7))).toBeTruthy()  // 첫 그림엔 쓴다
    const fetcher = vi.fn(async () => ({ id: 7, images: '["a","b","c","d","e"]' }))
    const got = await qc.fetchQuery({ queryKey: queryKeys.groupBuyProduct(7), queryFn: fetcher, staleTime: 60_000 })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect((got as { images: string }).images).toContain('"e"')
  })
  it('이미 받은 진짜 상세는 목록 행으로 덮지 않는다', () => {
    const qc = new QueryClient()
    qc.setQueryData(queryKeys.groupBuyProduct(7), { id: 7, description: '상세' })
    seedDetailFromListRow(qc, { id: 7 })
    expect((qc.getQueryData(queryKeys.groupBuyProduct(7)) as { description?: string }).description).toBe('상세')
  })
  it('목록 화면들은 상세 캐시에 직접 쓰지 않고 이 함수를 지난다', () => {
    for (const f of ['src/pages/main-home/GroupBuyFeed.tsx', 'src/pages/guest/usePopularPasses.ts', 'src/pages/pc-home/usePopularDeals.ts']) {
      const s = readCode(f)
      expect(s, f).not.toMatch(/setQueryData\(queryKeys\.groupBuyProduct/)
      expect(s, f).toContain('seedDetailFromListRow(qc, p)')
    }
  })
})
