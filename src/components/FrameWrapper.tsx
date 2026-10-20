import { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import MobileAppLayout from './MobileAppLayout'
import { logger } from '@/utils/logger'

interface FrameWrapperProps {
  children: ReactNode
}

// 모바일 레이아웃에서 제외할 페이지들 (자체 레이아웃이 있는 대시보드)
const EXCLUDE_MOBILE_LAYOUT = [
  '/seller',     // 셀러 대시보드
  '/admin',      // 어드민 대시보드
  '/embed',      // 임베드 라이브
]

export default function FrameWrapper({ children }: FrameWrapperProps) {
  const location = useLocation()
  
  // 🗑️ 2026-08-11 (AB 스윕): `/introduce` 를 `GripFrameLayout` 으로 감싸던 분기 제거.
  //   그 액자는 **폐기된 라이브커머스** 홍보였다 — PC 로 회사소개에 들어가면 화면 대문이
  //   "LIVE COMMERCE / LIVE NOW: 쇼핑의 새로운 물결" 이고, 진짜 회사소개는 폰 액자 안으로
  //   밀려나 있었다(실측: PC 본문 430자 ↔ 모바일 1,852자). 그 안의 `회사소개서 보기` CTA 도
  //   `/company-brochure.pdf` 가 없어 PDF 대신 SPA 셸(text/html)이 열리는 깨진 링크였다.
  //   라이브커머스는 영구 중단(LIVE_COMMERCE_SUSPENDED)이라 되살릴 것이 아니라 걷어낸다.

  // 모바일 레이아웃 제외 페이지인지 확인 (셀러/어드민)
  const shouldExcludeMobileLayout = EXCLUDE_MOBILE_LAYOUT.some(path => {
    return location.pathname.startsWith(path)
  })
  
  if (shouldExcludeMobileLayout) {
    logger.debug('↩️ FrameWrapper: Returning children directly (excluded page)', {
      pathname: location.pathname
    })
    return <>{children}</>
  }
  
  // 나머지 모든 페이지는 모바일 레이아웃으로 감싸기
  logger.debug('📱 FrameWrapper: Wrapping with MobileAppLayout', {
    pathname: location.pathname
  })
  return <MobileAppLayout>{children}</MobileAppLayout>
}
