/**
 * 🏠 생활 견적 화면 공용 조각 (2026-10-24). 규칙 SSOT 는 `src/shared/home-service.ts`.
 */
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { categoryDef, type HomeServiceCategory } from '@/shared/home-service'
import { getSellerToken } from '@/lib/seller-auth'

export function sellerHeaders() {
  const t = getSellerToken()
  return t ? { headers: { Authorization: `Bearer ${t}` } } : {}
}

export const STATUS_LABEL: Record<string, string> = {
  open: '견적 받는 중',
  chosen: '사장님 선택 완료',
  cancelled: '취소함',
  expired: '마감',
}

export function categoryLabel(key: string): string {
  return categoryDef(key as HomeServiceCategory)?.label || '생활'
}

/** 요청서 칸을 라벨과 함께 — 손님·사장님 상세가 같은 표를 쓴다. */
export function DetailRows({ category, details }: { category: string; details: Record<string, string> }) {
  const def = categoryDef(category as HomeServiceCategory)
  if (!def) return null
  return (
    <dl className="divide-y divide-rule">
      {def.fields.filter((f) => details?.[f.key]).map((f) => (
        <div key={f.key} className="flex gap-3 py-3 text-[13px]">
          <dt className="w-24 shrink-0 text-gray-500 dark:text-gray-400">{f.label}</dt>
          <dd className="min-w-0 flex-1 whitespace-pre-wrap break-words text-ink">{details[f.key]}{f.unit ? ` ${f.unit}` : ''}</dd>
        </div>
      ))}
    </dl>
  )
}

export function LifeHeader({ title, back }: { title: string; back?: string }) {
  return (
    <header className="ur-content-narrow flex h-14 items-center gap-3 px-4">
      {back && <Link to={back} aria-label="뒤로" className="-ml-2 p-2 text-ink"><ChevronLeft className="h-5 w-5" /></Link>}
      <h1 className="text-[17px] font-bold text-ink">{title}</h1>
    </header>
  )
}
