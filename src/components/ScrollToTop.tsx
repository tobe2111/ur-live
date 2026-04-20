import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * 페이지 전환 시 스크롤 최상단으로 이동
 * App.tsx 라우터 안에서 한 번만 렌더
 */
export default function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    // 인스턴트 스크롤 (부드러운 전환보다 빠른 반응)
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])

  return null
}
