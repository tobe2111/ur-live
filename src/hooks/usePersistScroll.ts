/**
 * 🏁 2026-06-13 (사용자 반복 신고 — 대시보드 좌측 카테고리 스크롤 최상단 복귀):
 *
 * 배경: Admin/Seller/Agency 의 각 페이지가 자기 자신을 `<XxxLayout>` 으로 감싸는 구조라
 *   라우트 이동 = 레이아웃 전체 remount → 사이드바 `<nav>` 스크롤이 매번 0 으로 리셋.
 *   (Outlet 기반 영속 레이아웃 전환은 수십 페이지 대수술 — 위험. 본 훅은 증상 근본 차단.)
 *
 * 동작: 스크롤 컨테이너(예: 사이드바 <nav>)의 scrollTop 을 sessionStorage 에 저장하고
 *   remount 시 복원. SellerLayout 의 검증된 패턴(2026-06-04)을 공용 훅으로 추출.
 *   사이드바 JSX 가 데스크톱+모바일 2회 렌더되므로 ref 콜백으로 각 인스턴스 개별 처리
 *   (display:none 인 쪽은 scrollTop 이 무시되어 안전).
 *
 * 사용:
 *   const navScrollRef = usePersistScroll('admin-sidebar')
 *   <nav ref={navScrollRef} className="overflow-y-auto">…</nav>
 */
import { useCallback } from 'react'

export function usePersistScroll(key: string) {
  const storageKey = `ur_scroll_${key}`
  return useCallback((el: HTMLElement | null) => {
    if (!el) return
    try {
      const saved = sessionStorage.getItem(storageKey)
      if (saved) {
        const top = parseInt(saved, 10) || 0
        if (top > 0) el.scrollTop = top
      }
    } catch { /* sessionStorage 불가 — no-op */ }
    let raf = 0
    el.addEventListener('scroll', () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        try { sessionStorage.setItem(storageKey, String(el.scrollTop)) } catch { /* quota */ }
      })
    }, { passive: true })
  }, [storageKey])
}
