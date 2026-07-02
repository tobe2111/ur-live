import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// 🛡️ 2026-05-20: location state 에 { preserveScroll: true } 가 있으면 스크롤 리셋 skip.
//   사용자 신고: 사이드바 하단 버튼 누르면 페이지 위로 튀어서 헷갈림.
//   `<Link state={{ preserveScroll: true }}>` 로 옵트아웃 가능.
type PreserveScrollState = { preserveScroll?: boolean } | null

/**
 * 페이지 전환 시 스크롤 관리
 * - PUSH/REPLACE: 상단으로
 * - POP (뒤로가기/앞으로가기): 이전 저장된 스크롤 위치 복원
 *
 * v37 FIX: 기존엔 pathname 바뀔 때마다 항상 top=0 → BrowsePage → 상품 → 뒤로 시
 * 맨 위로 돌아가서 찾던 상품 위치를 다시 찾아야 하는 UX 문제.
 * App.tsx 라우터 안에서 한 번만 렌더.
 */
export default function ScrollToTop() {
  const { pathname, search, state } = useLocation()
  const navType = useNavigationType()
  const positionsRef = useRef<Map<string, number>>(new Map())
  const preserveScroll = !!(state as PreserveScrollState)?.preserveScroll

  // 🛡️ 2026-07-02: 브라우저 기본 스크롤 복원(auto)이 SPA 비동기 콘텐츠에선 오작동하며 아래 수동
  //   복원과 충돌 → manual 로 전환해 이 컴포넌트가 단독 관리.
  useEffect(() => {
    if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
      history.scrollRestoration = 'manual'
    }
  }, [])

  // 현재 페이지 스크롤 위치 저장 (페이지 이탈 직전)
  useEffect(() => {
    const key = pathname + search
    const saveScroll = () => {
      positionsRef.current.set(key, window.scrollY)
    }
    window.addEventListener('scroll', saveScroll, { passive: true })
    return () => {
      saveScroll()
      window.removeEventListener('scroll', saveScroll)
    }
  }, [pathname, search])

  // 페이지 전환 시 스크롤 조정
  useEffect(() => {
    // 호출자가 명시적으로 preserveScroll: true 를 넘기면 아무것도 하지 않음.
    if (preserveScroll) return
    const key = pathname + search
    if (navType === 'POP') {
      // 뒤로가기/앞으로가기 — 저장된 위치로 복원.
      const saved = positionsRef.current.get(key)
      if (saved && saved > 0) {
        // 🛡️ 2026-07-02 (대표 신고 — 동네딜 상세 갔다 뒤로오면 맨 위로 튐): 홈/리스트 피드는 데이터를
        //   비동기로 불러와 복귀 순간 페이지 높이가 저장 위치보다 짧음 → RAF 1회 scrollTo 는 top 으로
        //   clamp. 콘텐츠 높이가 목표에 닿을 때까지 여러 프레임 재시도(최대 ~1.2s) 후 정착.
        let raf = 0
        const started = performance.now()
        const tryRestore = () => {
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight
          window.scrollTo({ top: Math.min(saved, Math.max(0, maxScroll)), left: 0, behavior: 'instant' as ScrollBehavior })
          if (maxScroll < saved - 2 && performance.now() - started < 1200) {
            raf = requestAnimationFrame(tryRestore)  // 아직 콘텐츠 로딩 중 — 다음 프레임 재시도
          }
        }
        raf = requestAnimationFrame(tryRestore)
        return () => cancelAnimationFrame(raf)
      }
    }
    // 새 페이지(PUSH/REPLACE) 또는 저장 위치 없음 — 상단으로
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname, search, navType, preserveScroll])

  return null
}
