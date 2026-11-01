/**
 * 🏠 생활 견적 화면 공용 조각 (2026-10-24). 규칙 SSOT 는 `src/shared/home-service.ts`.
 */
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { categoryDef, type HomeServiceCategory } from '@/shared/home-service'
import { getSellerToken } from '@/lib/seller-auth'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { toast } from '@/hooks/useToast'

/**
 * 🔗 요청 공유 — 휴대폰은 공유 시트(카카오톡 등), 아니면 주소 복사. 손님(아는 업체에게)·업체(동료에게)가 같이 쓴다.
 * 링크를 받은 업체는 `/life/q/:token` → 로그인 → 한 화면 가입 → 그 요청 견적으로 바로 간다.
 */
export async function shareLifeRequest(token: string, title: string): Promise<void> {
  const url = `${window.location.origin}/life/q/${token}`
  const text = `${title} — 유어딜에서 견적을 보내 주세요`
  try {
    if (navigator.share) { await navigator.share({ title, text, url }); return }
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') return // 공유 창을 닫았다
  }
  try { await navigator.clipboard.writeText(url); toast.success('링크를 복사했어요. 카톡방에 붙여 넣어 주세요') }
  catch { window.prompt('링크를 복사해 주세요', url) }
}

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
