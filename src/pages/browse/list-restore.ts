/**
 * 🔙 `/browse` 목록 → 상세 → 뒤로 에서 목록을 되살리는 배선.
 *
 * `App.tsx` 는 경로가 바뀌면 페이지를 통째로 리마운트하므로(`key={location.pathname}`) 목록이
 * `useState` 로 들고 있던 것이 전부 사라진다. 그리고 **그게 스크롤 복원까지 무력화한다** —
 * `ScrollToTop` 은 저장된 offset 으로 가려 해도 문서가 그만큼 길지 않으면 갈 수 있는 데까지만
 * 간다. 그래서 **돌아갈 문서를 되돌려 주는 것이 곧 스크롤 복원**이다.
 *
 * 2026-09-14 에 `BrowsePage.tsx` 에서 **이동만** 했다(로직 불변). 그 파일이 배선을 얹으며 600줄
 * 래칫에 걸려, 동결값을 올리는 대신 이 관심사를 통째로 꺼냈다.
 *
 * ⚠️ 페이지 쪽 **보관 effect** 는 `showCount`·`page`·`hasMore` 선언 뒤에 있어야 한다. 위로 올리면
 *   의존성 배열이 렌더 중 평가되며 TDZ 로 페이지가 통째로 빈 화면이 된다(VouchersPage 에서 실제로
 *   밟았고 tsc 가 TS2448 로 잡았다).
 * ⚠️ 보관은 가격대가 기본('all')일 때만 한다 — 다른 가격대의 목록을 보관하면 되살아날 때 화면의
 *   필터 상태와 어긋난다(priceRange 는 URL 에 없어 마운트마다 'all' 로 돌아간다).
 *
 * 보관함의 성격·한계(왜 sessionStorage 가 아닌지 등): `src/lib/list-view-cache.ts`
 */
import { useRef } from 'react'
import { useNavigationType } from 'react-router-dom'
import { readListView } from '@/lib/list-view-cache'
import type { Product } from './types'

export type BrowseViewState = { products: Product[]; page: number; hasMore: boolean; showCount: number }

/**
 * 복원과 보관이 **같은 문자열**을 쓰게 하는 SSOT. 갈리면 조용히 안 살아난다(에러가 안 난다).
 * 가격대(priceRange)는 URL 에 없어 마운트마다 'all' 로 돌아가므로 키에서도 'all' 로 고정하고,
 * 보관도 'all' 일 때만 한다 — 그래야 되살린 목록이 화면의 필터 상태와 어긋나지 않는다.
 */
export const browseViewKey = (cat: string, sort: string) => `browse:${cat}|${sort}|all`

/**
 * 뒤로(POP) 로 돌아온 경우에만 직전 목록을 돌려준다. 하단바로 새로 들어온 사람(PUSH)은
 * 맨 위·첫 페이지를 기대하므로 복원하지 않는다.
 *
 * ⚠️ 키는 페이지의 state 로 못 만든다(sortBy/priceRange 가 아직 선언 전) — **URL 에서 직접**
 *   만든다. 보관 쪽과 `browseViewKey` 를 공유하므로 두 문자열은 구조적으로 같다.
 * ⚠️ 결과는 **첫 렌더에 동기로** 쓰여야 한다. effect 로 미루면 로더가 한 프레임 뜨고,
 *   무엇보다 그 프레임의 짧은 문서에 스크롤 복원이 잘린다.
 */
export function useBrowseRestore(defaultCategory?: string): BrowseViewState | null {
  const navType = useNavigationType()
  const keyRef = useRef<string>('')
  if (!keyRef.current) {
    const sp = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
    keyRef.current = browseViewKey(defaultCategory || sp.get('category') || 'all', sp.get('sort') || 'popular')
  }
  const restoredRef = useRef<BrowseViewState | null | undefined>(undefined)
  if (restoredRef.current === undefined) {
    restoredRef.current = navType === 'POP' ? readListView<BrowseViewState>(keyRef.current) : null
  }
  return restoredRef.current
}
