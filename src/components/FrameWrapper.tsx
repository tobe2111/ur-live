import { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import GripFrameLayout from './GripFrameLayout'

interface FrameWrapperProps {
  children: ReactNode
}

// PC에서 프레임 안에 보여질 페이지들 (사용자 페이지만)
const FRAME_PAGES = [
  '/',
  '/cart',
  '/checkout',  // 결제 페이지 추가
  '/search',
  '/mypage',
  '/my-orders',
  '/orders',
  '/product/',
  '/login'
]

// 프레임에서 제외할 페이지들 (셀러, 어드민, 브라우즈, 결제 결과, 라이브)
const EXCLUDE_PAGES = [
  '/seller',
  '/admin',
  '/browse',
  '/payment',  // 결제 성공/실패 페이지만 제외
  '/live/'
]

export default function FrameWrapper({ children }: FrameWrapperProps) {
  const location = useLocation()
  
  // 제외 페이지인지 확인
  const isExcludePage = EXCLUDE_PAGES.some(path => {
    return location.pathname.startsWith(path)
  })
  
  if (isExcludePage) {
    return <>{children}</>
  }
  
  // 현재 경로가 프레임 페이지인지 확인
  const isFramePage = FRAME_PAGES.some(path => {
    if (path.endsWith('/')) {
      return location.pathname.startsWith(path)
    }
    return location.pathname === path || location.pathname.startsWith(path + '/')
  })
  
  // 프레임 페이지면 GripFrameLayout으로 감싸기
  if (isFramePage) {
    return <GripFrameLayout>{children}</GripFrameLayout>
  }
  
  // 아니면 그냥 children 렌더링
  return <>{children}</>
}
