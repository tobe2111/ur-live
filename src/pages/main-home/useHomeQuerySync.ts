import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import type { DealCategory } from '@/pages/pc-home/PcHomeRail'

/** 홈 카테고리 키 — 두 홈이 같은 집합을 쓴다(예전엔 PcHomePage 안에만 있었다). */
export const HOME_CATEGORY_KEYS: DealCategory[] = ['all', 'meal_voucher', 'beauty_voucher', 'stay_voucher', 'etc_voucher']

/** 홈 정렬 키 — 두 홈이 같은 집합을 쓴다. */
// 🗓️ 2026-09-04 (대표 "마감 개념은 없어"): 'deadline' 제거 — 목록에 없으면 그 쿼리는 무시된다(기본 유지).
export const HOME_SORT_KEYS = ['popular', 'newest', 'discount', 'near'] as const
export type HomeSortKey = (typeof HOME_SORT_KEYS)[number]

/**
 * 🔗 홈의 **쿼리 전용 이동**을 화면에 반영한다 (2026-08-27).
 *
 * 편성 섹션의 '더보기'는 `/?sort=popular` 처럼 **경로는 그대로 두고 쿼리만 바꾸는** 링크다
 * (App.tsx 가 `key={pathname}` 이라 리마운트·플래시가 없다). 그런데 홈은 정렬·카테고리를
 * **마운트 시점에만** 읽으므로, 쿼리만 바뀌면 아무 일도 안 일어난다 — 눌러도 화면이 그대로다.
 *
 * 🩸 2026-08-27 대표 신고 *"지금 인기 이용권의 더보기 클릭도 안되고"*: 이 동기화가
 *    **PC 홈에만** 있었다. 모바일 홈은 같은 링크를 받고도 쿼리를 아예 안 읽어서, 폰에서 누르면
 *    정말로 아무 반응이 없었다. 두 홈이 같은 섹션·같은 링크를 쓰는데 한쪽만 반응하면 안 된다
 *    — 그래서 로직을 여기 한 곳에 두고 둘 다 이걸 부른다.
 *
 * 첫 마운트는 스킵한다(일반 홈 진입에서 갑자기 점프하면 안 된다). 두 번째부터, 즉 실제
 * 내비게이션에서만 그리드로 스크롤해 "더보기 = 목록으로 이동"이 눈에 보이게 한다.
 */
export function useHomeQuerySync(opts: {
  setCategory: (c: DealCategory) => void
  setSort: (s: HomeSortKey) => void
  /** 스크롤 목적지(그리드 제목). 없으면 스크롤은 생략하고 상태만 반영한다. */
  gridHeaderRef?: React.RefObject<HTMLElement | null>
}): void {
  const { setCategory, setSort, gridHeaderRef } = opts
  const location = useLocation()
  const firstSync = useRef(true)

  useEffect(() => {
    const q = new URLSearchParams(location.search)
    const qCat = q.get('category') as DealCategory | null
    const qSort = q.get('sort') as HomeSortKey | null

    // 🧭 파라미터가 없으면 'all' 로 되돌린다 — 안 그러면 '전체'(= `/`)를 눌러도 이전 필터가 남는다.
    setCategory(qCat && HOME_CATEGORY_KEYS.includes(qCat) ? qCat : 'all')
    if (qSort && (HOME_SORT_KEYS as readonly string[]).includes(qSort)) setSort(qSort)

    if (firstSync.current) { firstSync.current = false; return }
    if (qSort || qCat) gridHeaderRef?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // location.key = 내비게이션마다 갱신 — 같은 더보기를 두 번 눌러도 다시 스크롤된다.
  }, [location.key, location.search, setCategory, setSort, gridHeaderRef])
}
