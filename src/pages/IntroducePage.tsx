import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function IntroducePage() {
  const navigate = useNavigate()
  
  useEffect(() => {
    // 모바일 기기에서는 메인 페이지로 리다이렉트
    const isMobile = window.innerWidth < 1024 // lg breakpoint
    if (isMobile) {
      navigate('/', { replace: true })
    }
  }, [navigate])
  
  // PC에서는 null 반환 - GripFrameLayout이 모든 UI 렌더링
  // (iframe, 브랜딩, 푸터 등)
  return null
}
