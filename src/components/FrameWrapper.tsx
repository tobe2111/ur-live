import { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import GripFrameLayout from './GripFrameLayout'

interface FrameWrapperProps {
  children: ReactNode
}

// PC에서 프레임 안에 보여질 페이지들
const FRAME_PAGES = [
  '/',
  '/cart',
  '/search',
  '/mypage',
  '/mypage/addresses',
  '/my-orders',
  '/orders',
  '/product/',
  '/live/'
]

export default function FrameWrapper({ children }: FrameWrapperProps) {
  const location = useLocation()
  
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
