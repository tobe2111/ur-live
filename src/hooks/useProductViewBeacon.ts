import { useEffect } from 'react'
import api from '@/lib/api'

/**
 * 👁️ **상세를 연 횟수(클릭)를 한 번만 보낸다** — 홈 '인기순'의 세 신호 중 클릭 담당.
 *
 * 2026-09-03 대표 *"리뷰 수, 클릭수, 결제 수로 총합 판정"*. 그 셋 중 **클릭만 실제로는 없었다**
 * (`products.view_count` 컬럼은 있는데 올리는 코드가 블로그 글 조회수뿐이라 이용권 339개가 전부 0).
 *
 * ## 왜 훅으로 빼나
 * 상세 화면이 셋(이용권·공구 / 교환권 / 쇼핑)이라 각자 짜면 **가드 조건이 갈린다** —
 * 한 화면만 세션 가드를 빠뜨려도 그 상품만 숫자가 부풀고, 그게 곧 홈 순서를 바꾼다.
 *
 * ## 비용
 * 세션당·상품당 **1회**. 서버도 IP 분당 60회로 막는다. 실패는 삼킨다 — 카운터가 화면을 막으면 안 된다.
 * ⚠️ 새로고침으로는 안 오른다(sessionStorage). 그게 의도다: "몇 명이 열었나"에 가까운 값이 목적이고,
 *   한 사람의 새로고침이 순위를 흔들면 안 된다.
 */
export function useProductViewBeacon(productId: number | string | null | undefined): void {
  useEffect(() => {
    const id = Number(productId)
    if (!Number.isInteger(id) || id <= 0) return
    const key = `pv:${id}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {
      // 프라이빗 모드 등 — 가드가 없으면 매번 보내게 되므로 **보내지 않는다**(부풀리는 쪽으로 안 깨진다).
      return
    }
    api.post(`/api/products/${id}/view`).catch(() => {})
  }, [productId])
}
