/**
 * 🧭 지도에서 상세로 갈 때 **누르기 전에** 상세를 데운다 (2026-10-15 — 대표 *"지도에서 이용권 들어갈 때 쓸데없는
 * 페이지들이 로딩 중에 잠깐잠깐 뜨거든?"*).
 *
 * 라이브 실측(아이폰13): `/map` → `/pass/:id` 이동이 [풀스크린 로더 ~0.7초 → 상세] 였다. 상세 화면 코드(청크)와
 * 상세 데이터를 **누른 뒤에야** 받기 시작해서다. 홈 카드(`GroupBuyFeedCard`)는 같은 일을 이미 하고 있었고
 * 지도만 빠져 있었다. 같은 캐시 키·같은 lazy 모듈을 쓴다(키가 갈리면 받아 놓고 못 쓴다).
 *
 * 언제 부르나: 카드가 **선택돼 화면에 뜬 순간**(사람이 그 이용권을 보고 있다 — 누를 확률이 가장 높다) +
 * 목록 줄을 **손가락이 닿은 순간**(pointerdown → click 사이 100~200ms 를 번다). 화면 밖·스크롤만으로는 안 부른다
 * (지도 목록은 길어서 트래픽이 커진다).
 */
import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { prefetchGroupBuyProduct } from '@/hooks/queries/useGroupBuyProduct'
import { canonicalDetailPath } from '@/shared/product-flow'
import { warmStayDetail } from '@/pages/stays/stay-detail-warm'
import { loadRoute } from '@/lib/route-preload' // App.tsx 가 등록한 같은 로더 — 받으면 화면이 '준비됨'이 된다

let passChunk = false
const warmed = new Set<string>()

export function usePrefetchMapDetail() {
  const qc = useQueryClient()
  return useCallback((p: { id: number | string; category?: string | null; deal_only?: number | string | null }) => {
    const path = canonicalDetailPath(p) || ''
    if (path.startsWith('/pass/')) {
      if (!passChunk) { passChunk = true; loadRoute('gbDetail').catch(() => { passChunk = false }) }
      const k = String(p.id)
      if (!warmed.has(k)) { warmed.add(k); prefetchGroupBuyProduct(qc, k).catch(() => { warmed.delete(k) }) }
    } else if (path.startsWith('/stays/')) {
      warmStayDetail(p.id)   // 화면 코드 + 데이터 — 상세가 같은 요청을 이어받는다
    }
  }, [qc])
}
