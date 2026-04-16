import { ReactNode } from 'react'

interface MobileAppLayoutProps {
  children: ReactNode
}

/**
 * MobileAppLayout
 * PC에서 모바일 앱처럼 430px 프레임 안에 표시
 * transform: translateZ(0) 으로 fixed 요소가 자동으로 이 컨테이너 기준이 됨
 */
export default function MobileAppLayout({ children }: MobileAppLayoutProps) {
  return (
    <div className="mobile-app-container">
      {children}
    </div>
  )
}
