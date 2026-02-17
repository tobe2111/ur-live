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
  
  // PC에서는 빈 div 렌더링 (GripFrameLayout이 감싸서 처리)
  // null을 리턴하면 FrameWrapper가 작동하지 않음
  return <div className="w-full h-full" />
}
