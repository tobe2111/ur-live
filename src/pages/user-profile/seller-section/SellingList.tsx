/**
 * 🔁 판매 중지 · 재개 — 마이 안에서 한 손으로 (2026-09-25, 설계 §14 단계 2)
 *
 * 재료가 떨어졌을 때 **손님 앞에서** 바로 끄는 동작이다. 그래서 선별 표에서 "손님 앞 ●".
 * 등록·수정은 여기서 하지 않는다(사진·옵션이 필요해 한 손으로 못 한다) — 전체 도구로 간다.
 *
 * ⚠️ 끄는 건 `is_active=0 · status='HIDDEN'` 이다. **삭제가 아니다** — 되돌릴 수 있어야 한 손으로 줄 수 있다.
 */
import { Loader2 } from 'lucide-react'
import { formatNumber } from '@/utils/format'
import type { SellerWorkState, WorkProduct } from './useSellerWork'

function Switch({ on, busy }: { on: boolean; busy: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex w-10 h-6 rounded-full transition-colors ${on ? 'bg-brand' : 'bg-gray-300 dark:bg-white/20'} ${busy ? 'opacity-50' : ''}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
    </span>
  )
}

export default function SellingList({ work }: { work: SellerWorkState }) {
  const { products, busyProduct, toggleProduct } = work
  if (products.length === 0) return null

  const shown = products.slice(0, 5)
  const onCount = products.filter((p) => p.isActive).length
  return (
    <div className="mt-3 rounded-2xl bg-surface shadow-lift overflow-hidden">
      <div className="flex items-center justify-between px-4 h-11 border-b border-rule">
        <span className="text-[14px] font-extrabold text-gray-900 dark:text-white">판매 중</span>
        <span className="text-[13px] font-bold text-gray-500 dark:text-gray-400 tabular-nums">{formatNumber(onCount)}개</span>
      </div>
      {shown.map((p: WorkProduct) => (
        <button
          key={p.id}
          type="button"
          role="switch"
          aria-checked={p.isActive}
          aria-label={`${p.name} ${p.isActive ? '판매 중지' : '판매 재개'}`}
          disabled={busyProduct !== null}
          onClick={() => toggleProduct(p)}
          className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-rule last:border-b-0 active:opacity-70 disabled:opacity-60 ${p.isActive ? '' : 'opacity-55'}`}
        >
          <span className="flex-1 min-w-0">
            <span className="block text-[14px] font-semibold text-gray-900 dark:text-white truncate">{p.name}</span>
            <span className="block text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">
              {formatNumber(p.price)}원{p.isActive ? '' : ' · 중지됨'}
            </span>
          </span>
          {busyProduct === p.id
            ? <Loader2 className="w-4 h-4 shrink-0 animate-spin text-gray-400" aria-hidden="true" />
            : <Switch on={p.isActive} busy={false} />}
        </button>
      ))}
      {products.length > shown.length && (
        <p className="px-4 py-2.5 text-[12px] text-gray-500 dark:text-gray-400">
          그 밖에 {formatNumber(products.length - shown.length)}개는 전체 도구에서 볼 수 있어요
        </p>
      )}
    </div>
  )
}
