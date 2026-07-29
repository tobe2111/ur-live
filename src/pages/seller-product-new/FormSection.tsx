import type { ReactNode } from 'react'

interface Props {
  title: string
  desc?: string
  icon?: ReactNode
  /** 우측 상단 배지/부가 슬롯 (예: 선택 표시). */
  aside?: ReactNode
  children: ReactNode
}

/**
 * 🛡️ 상품 등록 폼 섹션 카드 — 모바일/PC 공통 스캔성 향상.
 *   흰 카드 + 아이콘 헤더 + 본문. 긴 단일 폼을 의미 단위로 쪼개 인지 부담을 줄인다.
 */
export default function FormSection({ title, desc, icon, aside, children }: Props) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              {icon}
            </div>
          )}
          <div>
            <h2 className="text-sm font-bold text-gray-900 sm:text-base">{title}</h2>
            {desc && <p className="mt-0.5 text-xs text-gray-500">{desc}</p>}
          </div>
        </div>
        {aside}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}
