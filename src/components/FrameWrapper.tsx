import { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import GripFrameLayout from './GripFrameLayout'

interface FrameWrapperProps {
  children: ReactNode
}

// PC에서 프레임 안에 보여질 페이지 - introduce 페이지만
const FRAME_PAGES = [
  '/introduce'
]

// 프레임에서 제외할 모든 페이지들
const EXCLUDE_PAGES = [
  '/',           // 메인 페이지
  '/cart',       // 장바구니
  '/checkout',   // 결제 페이지
  '/search',     // 검색
  '/user/profile', // 마이페이지 (통합됨)
  '/mypage',     // 마이페이지 (리다이렉트)
  '/my-orders',  // 주문 내역
  '/orders',     // 주문 내역 (별칭)
  '/product/',   // 상품 상세
  '/login',      // 로그인
  '/seller',     // 셀러
  '/admin',      // 어드민
  '/browse',     // 브라우즈
  '/payment',    // 결제 결과
  '/live/',      // 라이브
  '/auth/'       // 인증 콜백
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
  
  // 제외 페이지인지 확인 (프레임 페이지가 아닐 때만)
  const isExcludePage = EXCLUDE_PAGES.some(path => {
    return location.pathname.startsWith(path)
  })
  
  if (isExcludePage) {
    console.log('↩️ FrameWrapper: Returning children directly (excluded page)', {
      pathname: location.pathname
    })
    return <>{children}</>
  }
  
  // 아니면 그냥 children 렌더링
  console.log('👉 FrameWrapper: Returning children directly (default)', {
    pathname: location.pathname
  })
  return <>{children}</>
}
