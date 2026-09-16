/**
 * 🔥 탭을 다시 눌러도 화면이 통째로 비지 않는다 〔2026-09-15〕
 *
 * 대표: *"특히 로딩은 더 문제가 있을 것 같은데"* → 실측으로 나온 것:
 * 하단바 '교환권' 을 누를 때마다 **1·2·3회차 전부** 풀스크린 로더가 떴다(마이 탭은 2회차부터 안 뜸).
 * 방금 보고 나온 목록인데도 화면 전체가 덮였다.
 *
 * 콜드용 처방(풀스크린 로더 — 청크 로더와 이어져 '한 번'으로 보이게, 2026-07-01)이
 * **웜 재방문에도 그대로** 걸린 것이다. 재방문엔 청크 로더가 없으니 그 근거가 성립하지 않는다.
 *
 * ## 이 시험이 재는 것
 * `useListSeed` 가 고르는 **값**(POP 복원 ↔ 웜 시드 ↔ 없음). 화면이 로더를 켜는 조건이
 * `products.length === 0` 이므로, 시드가 값을 주면 로더가 안 켜진다.
 *
 * 🩸 첫 판은 **모듈만** 재서, 페이지가 시드를 안 읽게 만들어도 초록이었다(주입 러너가 잡았다).
 *    모듈이 맞아도 배선이 끊기면 화면은 안 바뀐다 — 그래서 ② 배선 검사를 같이 둔다.
 *
 * ## 못 막는 것
 * - 실제 렌더에서 로더가 안 뜨는지(브라우저로 따로 쟀다: 1·2·3회차 전부 0프레임)
 * - 콜드 진입의 풀스크린 로더가 유지되는지(같은 실측에서 마이 1회차 로더 확인)
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { warmSeedProducts } from '@/pages/vouchers/warm-seed'
import { saveListView, dropListView } from '@/lib/list-view-cache'
import { readCode } from '../helpers/source-text'

type P = { id: number }
const KEY = 'vouchers:list:page:|커피/음료||price_low'
const list = (n: number): P[] => Array.from({ length: n }, (_, i) => ({ id: i + 1 }))

beforeEach(() => dropListView(KEY))

describe('웜 시드 — 탭 재진입에서 마지막 목록을 즉시 준다', () => {
  it('🔴 보관본이 있으면 **1페이지분**을 준다 (그러면 로더가 안 켜진다)', () => {
    saveListView(KEY, { products: list(60), page: 3, hasMore: true, embedVisible: 48 })
    const seed = warmSeedProducts<P>(null, KEY, 20)
    expect(seed).toHaveLength(20)
    expect(seed?.[0].id).toBe(1)
  })

  it('🔴 **1페이지분으로 자른다** — 더보기로 편 긴 목록을 통째로 주면 곧 올 응답(1페이지)이 도로 짧게 만든다', () => {
    // 2026-09-13 이 POP 에서 겪은 그 증상이다. 여기서 반복하지 않는다.
    saveListView(KEY, { products: list(200), page: 10, hasMore: false, embedVisible: 160 })
    expect(warmSeedProducts<P>(null, KEY, 20)).toHaveLength(20)
  })

  it('🔴 POP 복원본이 있으면 **비켜선다** — 그쪽이 페이지·펼친 개수·높이까지 되살린다', () => {
    saveListView(KEY, { products: list(60), page: 3, hasMore: true, embedVisible: 48 })
    expect(warmSeedProducts<P>({ products: list(60) }, KEY, 20)).toBeNull()
  })

  it('보관본이 없으면 null — 콜드 진입은 지금처럼 풀스크린 로더가 맞다', () => {
    expect(warmSeedProducts<P>(null, KEY, 20)).toBeNull()
  })

  it('빈 목록을 시드하지 않는다 — 빈 배열을 주면 "없음"을 먼저 그린다(이 세션이 고친 그 거짓말)', () => {
    saveListView(KEY, { products: [], page: 1, hasMore: false, embedVisible: 8 })
    expect(warmSeedProducts<P>(null, KEY, 20)).toBeNull()
  })

  it('필터가 다르면 안 섞인다 (키에 카테고리·브랜드·정렬이 들어 있다)', () => {
    saveListView(KEY, { products: list(30), page: 1, hasMore: true, embedVisible: 8 })
    expect(warmSeedProducts<P>(null, 'vouchers:list:page:|치킨||price_low', 20)).toBeNull()
  })
})

describe('② 배선 — 페이지가 그 시드를 실제로 읽는다', () => {
  const page = () => readCode('src/pages/VouchersPage.tsx')

  it('🔴 목록 초기값이 `warm` 을 읽는다 (안 읽으면 모듈만 초록이고 화면은 그대로)', () => {
    expect(page(), '시드 배선이 끊겼다').toMatch(/restored\?\.products \?\? warm \?\?/)
  })

  it('🔴 로더 초기 조건이 `warm` 을 센다 (안 세면 목록은 있는데 로더가 덮는다)', () => {
    expect(page()).toMatch(/warm == null/)
  })

  it('시드를 고르는 곳이 한 자리다 (페이지가 순서를 다시 짓지 않는다)', () => {
    expect(page()).toContain('useListSeed<VouchersViewState, VoucherProduct>')
  })
})
