/**
 * 🎛️ 유어쇼츠 전체 보기 — 칩(도시·카테고리) 계산 (순수 함수, 2026-09-21).
 *
 * 화면에서 분리한 이유는 **셋 다 조용히 틀릴 수 있는 규칙**이기 때문이다:
 * 개수 세기 · 어떤 칩을 그릴지 · 고른 칩으로 거르기. jsdom 없이 실제 값으로 시험한다.
 */
import type { UrShortItem } from '@/shared/urshorts'
import { VOUCHER_CATEGORY_LABEL, normalizeCategory } from '@/shared/constants/voucher-categories'
import { shortsRegionLabel } from '@/shared/urshorts-regions'

export interface Facet {
  /** 고른 값(쿼리에 실린다). */
  key: string
  /** 칩에 찍히는 이름. */
  label: string
  /** 그 값을 가진 영상 수. */
  count: number
}

/** 화면이 들고 있는 필터 상태. `null` 은 '전체'. */
export interface ShortsFilter {
  si: string | null
  category: string | null
}

/**
 * 🔴 **칩 줄은 고를 것이 둘 이상일 때만 그린다.**
 *
 * 값이 한 종류뿐이면 `[전체 10] [식사 10]` 이 되는데, 두 버튼이 **똑같은 목록**을 보여 준다 —
 * 정보가 아니라 소음이고, 누르면 아무 일도 안 일어나는 것처럼 보인다. 오늘(2026-09-21) 올라온
 * 10편이 **전부 식사**라 카테고리 줄은 실제로 안 그려진다. 미용·숙소 쇼츠가 한 편이라도
 * 올라오면 **그날 바로** 뜬다 — 데이터가 정하지 우리가 켜고 끄지 않는다.
 */
export const MIN_FACETS_TO_SHOW = 2

/** 값이 없는(=모르는) 영상은 세지 않는다. 모르는 것에 칩을 만들면 "모름" 이라는 도시가 생긴다. */
function tally(items: readonly UrShortItem[], pick: (i: UrShortItem) => string | null | undefined) {
  const n = new Map<string, number>()
  for (const it of items) {
    const v = (pick(it) ?? '').trim()
    if (!v) continue
    n.set(v, (n.get(v) ?? 0) + 1)
  }
  return n
}

/** 많은 순 → 같으면 이름 순(가나다). 순서가 매번 흔들리면 같은 칩이 자리를 옮겨 다닌다. */
function sortFacets(f: Facet[]): Facet[] {
  return f.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ko'))
}

export function cityFacets(items: readonly UrShortItem[]): Facet[] {
  return sortFacets(
    [...tally(items, (i) => i.region_si)].map(([key, count]) => ({
      key, label: shortsRegionLabel(key) || key, count,
    })),
  )
}

export function categoryFacets(items: readonly UrShortItem[]): Facet[] {
  return sortFacets(
    [...tally(items, (i) => normalizeCategory(i.category) ?? i.category)].map(([key, count]) => ({
      key,
      // 칩은 짧은 이름(식사·미용·숙소·기타) — 이용권 SSOT 의 `short` 그대로다.
      label: VOUCHER_CATEGORY_LABEL[key]?.short ?? key,
      count,
    })),
  )
}

/**
 * 고른 칩으로 거른다. 두 축은 **AND** 다(부산 + 식사).
 *
 * ⚠️ 값이 없는 영상은 그 축을 고른 순간 빠진다 — 그게 맞다. "부산" 을 고른 사람에게
 * 도시를 모르는 영상을 끼워 주면 그 칩이 거짓말이 된다. 모르는 영상의 자리는 '전체' 다.
 */
export function filterShorts(items: readonly UrShortItem[], f: ShortsFilter): UrShortItem[] {
  return items.filter((it) => {
    if (f.si && (it.region_si ?? '') !== f.si) return false
    if (f.category) {
      const c = normalizeCategory(it.category) ?? it.category ?? ''
      if (c !== f.category) return false
    }
    return true
  })
}

/**
 * 고른 값이 **지금 목록에 없으면** 그 필터를 푼다.
 *
 * 공유된 링크(`?si=제주`)로 들어왔는데 그 도시 영상이 내려갔으면, 그대로 두면 빈 화면에
 * 누를 수 없는 칩만 남는다. 조용히 '전체' 로 되돌리는 편이 낫다.
 */
export function pruneFilter(f: ShortsFilter, city: readonly Facet[], cat: readonly Facet[]): ShortsFilter {
  return {
    si: f.si && city.some((x) => x.key === f.si) ? f.si : null,
    category: f.category && cat.some((x) => x.key === f.category) ? f.category : null,
  }
}
