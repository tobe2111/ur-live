/**
 * 🛡️ 2026-04-22 배치 127: 셀러/에이전시 대시보드 공통 디자인 시스템
 *
 * 일관된 페이지 헤더 — 제목 + 부제 + 우측 액션 슬롯.
 * 전 대시보드 페이지가 동일한 시각 언어를 가지도록.
 */
import type { ReactNode } from 'react'

interface DashboardPageHeaderProps {
  /**
   * 🧹 2026-08-31: **선택**으로 바꿨다. 상단바와 탭이 이미 같은 말을 하는 페이지가 있다
   * (`/seller/products` 는 상단바 "상품 관리" · 탭 "상품 관리" · 제목 "상품 관리" — **세 번**).
   * 그런 페이지는 제목을 비우고 액션만 남긴다.
   */
  title?: string
  subtitle?: string
  icon?: ReactNode
  actions?: ReactNode
}

export default function DashboardPageHeader({
  title,
  subtitle,
  icon,
  actions,
}: DashboardPageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        {/* 🎨 2026-08-31: 아이콘 칩이 `bg-blue-50 text-blue-600` 이었다 — 파랑은 이 제품의 색이 아니고
            (잉크 + 로즈), 여기서 **아무 뜻도 하지 않는다**. 중립 톤으로. */}
        {icon && title && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
            {icon}
          </div>
        )}
        {title && (
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
          </div>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
