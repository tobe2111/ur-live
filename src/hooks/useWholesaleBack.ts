import { useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

/**
 * 🏭 2026-06-19 도매몰 '뒤로' 버튼 SSOT — 실제 이전 페이지로 복귀.
 *
 * 배경(대표 신고): 도매 페이지들의 '뒤로' 버튼이 `navigate('/wholesale')` 로 하드코딩돼 있어
 *   어느 페이지에서 눌러도 **무조건 카탈로그 홈으로 점프** + 새 히스토리를 push → 브라우저
 *   뒤로가기 스택까지 꼬임("이전 페이지로 각자 안 넘어감"). 일부 페이지(상품상세/결제/약관)만
 *   `navigate(-1)` 로 올바르게 동작 → 일관성 깨짐.
 *
 * 동작:
 *   - 앱 내 이동 이력이 있으면 → `navigate(-1)` (실제 직전 페이지)
 *   - 직접 진입(딥링크·새 탭 — 앱 내 이력 없음)이면 → fallback(기본 `/wholesale`)
 *     React Router 가 최초 진입 location 에 `key === 'default'` 를 부여(이전 이력 없음)하는 것을
 *     폴백 신호로 사용 → 뒤로 갈 곳이 외부/없을 때 카탈로그 홈으로 안전 복귀.
 */
export function useWholesaleBack(fallback = '/wholesale') {
  const navigate = useNavigate()
  const location = useLocation()
  return useCallback(() => {
    if (location.key && location.key !== 'default') navigate(-1)
    else navigate(fallback)
  }, [navigate, location.key, fallback])
}
