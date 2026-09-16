/**
 * 🔥 **탭을 다시 눌렀을 때 화면이 통째로 비지 않게** 하는 시드 (2026-09-15).
 *
 * ## 무엇이 문제였나 (실측)
 * 하단바 '교환권' 을 누를 때마다 `loading=true` 로 시작해 **화면 전체가 로더로 덮였다** —
 * 1·2·3회차 **전부**(마이 탭은 2회차부터 안 뜬다). 방금 보고 나온 목록인데도 그렇다.
 *
 * 원인은 결정 두 개가 겹친 자리다. 둘 다 각자 옳다:
 *   · `VouchersPage` — 콜드 진입에선 **풀스크린** 로더가 맞다. 정적 청크 로더와 이어져
 *     '한 번' 으로 보이고 헤더가 중간에 안 뜬다(2026-07-01).
 *   · `list-view-cache` — **PUSH 로 들어온 목록은 복원하지 않는다.** 탭을 새로 누른 사람은
 *     맨 위를 기대한다(2026-09-13).
 *
 * 그래서 **콜드용 처방이 웜 재방문에도 그대로** 걸렸다. 재방문엔 청크 로더가 아예 없으므로
 * "이어져 보인다" 는 근거가 성립하지 않는데도 화면을 덮는다.
 *
 * ## 이 시드가 하는 일
 * PUSH 재진입이고 보관본이 있으면 **첫 페이지 분량만** 돌려준다. 그러면
 * `loadProducts(1, true)` 가 `productsRef.current.length === 0` 이 아니라서 **로더를 안 켜고**,
 * 응답이 오면 그 자리에서 조용히 교체한다(2026-06-05 "비우지 않고 백그라운드 교체" 와 같은 길).
 *
 * ⚠️ **맨 위 기대는 그대로 지킨다** — 되돌리는 건 *데이터*지 스크롤이 아니다. 스크롤은
 *    `ScrollToTop` 이 PUSH 에서 맨 위로 보낸다. `page`/`hasMore`/`embedVisible` 도 안 건드린다.
 * ⚠️ **첫 페이지 분량으로 자르는 이유**: '더보기' 로 펴 둔 긴 목록을 통째로 시드하면, 곧 도착할
 *    응답(1페이지)이 그걸 **도로 짧게** 만든다 — 2026-09-13 이 POP 에서 겪은 그 증상이다.
 * ⚠️ POP 복원(`restored`)이 있으면 이 시드는 **비켜선다**. 그쪽이 더 많은 것(페이지·펼친 개수·
 *    스크롤)을 되살리므로 덮으면 손해다.
 *
 * ## 이 모듈이 **못** 하는 것
 * - 새로고침·새 탭: 보관함이 탭 메모리라 비어 있다(의도 — 그때는 콜드 처방이 맞다).
 * - 신선도: 최대 TTL(30분) 된 목록이 잠깐 보일 수 있다. 가격의 진실은 상세·결제에서 서버가
 *   다시 정하므로 금액 위험은 없다.
 */
import { useRef } from 'react'
import { useNavigationType } from 'react-router-dom'
import { readListView } from '@/lib/list-view-cache'

export interface WarmSeedable<T> { products: T[] }

/**
 * @param restored POP 복원본(있으면 시드하지 않는다)
 * @param viewKey  필터까지 담은 목록 키
 * @param pageSize 한 페이지 분량 — 이만큼만 시드한다
 */
export function warmSeedProducts<T>(
  restored: WarmSeedable<T> | null,
  viewKey: string,
  pageSize: number,
): T[] | null {
  if (restored != null) return null
  const cached = readListView<WarmSeedable<T>>(viewKey)
  if (!cached || !Array.isArray(cached.products) || cached.products.length === 0) return null
  return cached.products.slice(0, pageSize)
}

/**
 * 목록 시드 두 종을 **한 자리에서** 고른다 — 페이지가 순서를 헷갈릴 일이 없게.
 *
 * · `restored` — POP(뒤로)에서만. 페이지·펼친 개수·높이까지 되살려 스크롤 복원을 살린다(2026-09-13).
 * · `warm`     — 그 외 재진입에서. **1페이지분만** 돌려줘 로더가 화면을 덮지 않게 한다(위 설명).
 *
 * 둘은 배타다 — POP 복원이 있으면 웜은 `null` 이다.
 * ⚠️ 훅이므로 **조건 없이** 부를 것(초기화는 ref 안에서 1회만 일어난다).
 */
export function useListSeed<S extends WarmSeedable<T>, T>(viewKey: string, pageSize: number): {
  restored: S | null
  warm: T[] | null
} {
  const navType = useNavigationType()
  const ref = useRef<{ restored: S | null; warm: T[] | null } | null>(null)
  if (ref.current === null) {
    const restored = navType === 'POP' ? readListView<S>(viewKey) : null
    ref.current = { restored, warm: warmSeedProducts<T>(restored, viewKey, pageSize) }
  }
  return ref.current
}
