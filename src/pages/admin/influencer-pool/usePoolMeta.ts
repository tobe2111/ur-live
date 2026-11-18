import { useCallback, useState } from 'react'
import api from '@/lib/api'
import type { Keyword } from './KeywordManager'

/**
 * ⚡ **풀 페이지 메타 로더 — 통계와 키워드를 따로 받는다** (2026-08-05, 페이지 600줄 래칫으로 분리).
 *
 *   왜 나눠 받는지는 `KeywordManager.tsx` 헤더가 SSOT 다(요약: 첫 로딩 310KB 중 224KB 가 키워드인데
 *   그 패널은 접혀 있어 대부분 안 열린다). 여기선 **누가 언제 부르는가**만 정한다:
 *     · `loadStats` — 마운트 · 정비 폴링(10초). 가볍고(8.8KB) 진행 표시에 필요한 전부다.
 *     · `loadKeywords` — 패널을 **처음 펼칠 때** 1회.
 *     · `loadMeta` — 키워드 편집 뒤. 분류 통계도 같이 바뀌므로 **둘 다** 다시 받는다.
 *
 *   ⚠️ 실패는 조용히 삼킨다(`catch`) — 이 화면의 메타는 보조 정보라, 한 번 실패했다고 페이지를
 *     못 쓰게 만들면 손해가 더 크다. 진짜 실패는 값이 안 변하는 것으로 드러난다.
 */
export function usePoolMeta(applyMeta: (d: Record<string, unknown>) => void) {
  const [keywords, setKeywords] = useState<Keyword[]>([])

  // ⏱️ `fresh` — 데이터를 바꾼 직후(키워드 편집·액션 뒤)에만 캐시를 건너뛴다. 첫 로드·폴링은 캐시(서버 30분)로 즉시.
  //   🩸 예전엔 매번 전수 집계라 3.5~9초 걸렸고, 15초 한도에 걸리면 아래 catch 가 삼켜 그래프가 통째로 사라졌다.
  const loadStats = useCallback(async (fresh = false) => {
    try {
      const s = await api.get(`/api/admin/ads/influencer-pool/stats${fresh ? '?fresh=1' : ''}`)
      if (s.data?.success) applyMeta(s.data)
    } catch { /* soft */ }
  }, [applyMeta])

  const loadKeywords = useCallback(async () => {
    try {
      const k = await api.get('/api/admin/ads/influencer-pool/keywords')
      if (k.data?.success) setKeywords(k.data.keywords || [])
    } catch { /* soft */ }
  }, [])

  const loadMeta = useCallback(async () => { await Promise.all([loadStats(true), loadKeywords()]) }, [loadStats, loadKeywords])

  return { keywords, loadStats, loadKeywords, loadMeta }
}
