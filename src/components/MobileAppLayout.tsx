import { ReactNode } from 'react'

interface MobileAppLayoutProps {
  children: ReactNode
}

/**
 * MobileAppLayout
 * 
 * PC에서도 모바일 앱처럼 보이게 하는 레이아웃 컴포넌트
 * 
 * Features:
 * - 393px 고정 너비 (iPhone 14 Pro Max 기준)
 * - 화면 정중앙 배치
 * - 은은한 그림자로 입체감
 * - body 배경(#f5f5f7)과 컨테이너(#ffffff) 분리
 */
export default function MobileAppLayout({ children }: MobileAppLayoutProps) {
  return (
    <div className="mobile-app-container">
      {children}
    </div>
  )
}
