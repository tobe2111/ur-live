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
  
  // PC에서는 아무것도 렌더링하지 않음
  // GripFrameLayout이 자동으로 브랜딩 + iframe을 추가함
  return null
}
