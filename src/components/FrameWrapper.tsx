import { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import GripFrameLayout from './GripFrameLayout'
import MobileAppLayout from './MobileAppLayout'

interface FrameWrapperProps {
  children: ReactNode
}

// PC에서 프레임 안에 보여질 페이지 - introduce 페이지만
const FRAME_PAGES = [
  '/introduce'
]

// 모바일 레이아웃에서 제외할 페이지들 (셀러/어드민 - PC 전체 화면 필요)
const EXCLUDE_MOBILE_LAYOUT = [
  '/seller',     // 셀러 대시보드
  '/admin',      // 어드민 대시보드
  '/checkout',   // 결제 페이지 (배송지 정보가 길어서 PC 전체 화면 필요)
]

export default function FrameWrapper({ children }: FrameWrapperProps) {
  const location = useLocation()
  
  // 🔥 중요: 프레임 페이지 체크를 먼저 수행 (EXCLUDE보다 우선)
  const isFramePage = FRAME_PAGES.some(path => {
    if (path.endsWith('/')) {
      return location.pathname.startsWith(path)
    }
    return location.pathname === path || location.pathname.startsWith(path + '/')
  })
  
  // 프레임 페이지면 GripFrameLayout으로 감싸기 (최우선)
  if (isFramePage) {
    console.log('🖼️ FrameWrapper: Wrapping with GripFrameLayout', {
      pathname: location.pathname,
      children: children ? 'exists' : 'null'
    })
    return <GripFrameLayout>{children}</GripFrameLayout>
  }
  
  // 모바일 레이아웃 제외 페이지인지 확인 (셀러/어드민)
  const shouldExcludeMobileLayout = EXCLUDE_MOBILE_LAYOUT.some(path => {
    return location.pathname.startsWith(path)
  })
  
  if (shouldExcludeMobileLayout) {
    console.log('↩️ FrameWrapper: Returning children directly (excluded page)', {
      pathname: location.pathname
    })
    return <>{children}</>
  }
  
  // 나머지 모든 페이지는 모바일 레이아웃으로 감싸기
  console.log('📱 FrameWrapper: Wrapping with MobileAppLayout', {
    pathname: location.pathname
  })
  return <MobileAppLayout>{children}</MobileAppLayout>
}
