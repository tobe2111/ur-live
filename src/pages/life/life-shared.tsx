/**
 * 🏠 생활 견적 화면 공용 조각 (2026-10-24). 규칙 SSOT 는 `src/shared/home-service.ts`.
 */
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { categoryDef, type HomeServiceCategory } from '@/shared/home-service'
import { getSellerToken } from '@/lib/seller-auth'
import { cfImage, cfImageOnError } from '@/utils/cf-image'

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
      {def.fields.filter((f) => details?.[f.key]).map((f) => f.type === 'photos' ? (
        <div key={f.key} className="py-3 text-[13px]">
          <dt className="text-gray-500 dark:text-gray-400">{f.label}</dt>
          <dd className="mt-2"><PhotoStrip urls={details[f.key].split(',')} /></dd>
        </div>
      ) : (
        <div key={f.key} className="flex gap-3 py-3 text-[13px]">
          <dt className="w-24 shrink-0 text-gray-500 dark:text-gray-400">{f.label}</dt>
          <dd className="min-w-0 flex-1 whitespace-pre-wrap break-words text-ink">{details[f.key]}{f.unit ? ` ${f.unit}` : ''}</dd>
        </div>
      ))}
    </dl>
  )
}

/** 요청서 사진 — 누르면 원본을 새 창으로(업체가 크게 봐야 견적을 낸다). */
export function PhotoStrip({ urls }: { urls: string[] }) {
  const list = urls.map((u) => u.trim()).filter(Boolean)
  if (!list.length) return null
  return (
    <div className="flex flex-wrap gap-2">
      {list.map((u) => (
        <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="block h-20 w-20 overflow-hidden rounded-xl bg-warm">
          <img src={cfImage(u, { width: 160, height: 160, fit: 'cover' })} alt="요청서 사진" width={80} height={80} loading="lazy"
            className="h-full w-full object-cover" onError={(e) => cfImageOnError(e.currentTarget, u)} />
        </a>
      ))}
    </div>
  )
}

/** 큰 공사(간판·인테리어) 안내 — 유어딜은 연결만 한다. 요청서와 견적 화면이 같은 글을 쓴다. */
export function BigTicketNote() {
  return (
    <p className="text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
      금액이 큰 공사예요. 유어딜은 업체를 연결해 드리고, 계약과 시공은 손님과 업체가 직접 해요.
      계약 전에 업체의 사업자등록·면허, 항목별 견적서, 계약서(공사 기간·대금 지급 시점·하자 보수)를 꼭 받아 두세요.
    </p>
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
