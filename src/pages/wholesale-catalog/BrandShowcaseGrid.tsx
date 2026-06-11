import { Sparkles } from 'lucide-react'
import { WT, comma } from '../wholesale/wholesale-theme'
import { cfImage } from '@/utils/cf-image'
import type { BrandEntry } from './types'

// ── 🏷️ 브랜드 전시관 — 브랜드 칩 그리드 (distinct brand_name + 상품수 + 선택적 로고). ──
//   로고(logo_url) 있으면 cfImage 이미지로, 없으면 기존 텍스트 칩. 클릭 시 ?brand=<name> 카탈로그 필터.
//   라이트 테마(WT) 고정 — B2B 대시보드 서피스.
export default function BrandShowcaseGrid({ brands, loading, onPick, t: tr }: {
  brands: BrandEntry[]; loading: boolean; onPick: (name: string) => void; t: (k: string, o?: Record<string, unknown>) => string
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: WT.fill }} />
        ))}
      </div>
    )
  }
  if (!brands.length) {
    // 친절한 빈 상태 — 브랜드제품이 아직 없을 때(페이지 안 깨짐).
    return (
      <div className="rounded-2xl px-6 py-14 text-center" style={{ border: '1px dashed ' + WT.line, background: WT.fill2 }}>
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: WT.brandSoft }}>
          <Sparkles className="w-6 h-6" style={{ color: WT.brand }} />
        </div>
        <p className="text-[15px] font-bold" style={{ color: WT.ink }}>{tr('wholesale.brand.emptyTitle', { defaultValue: '아직 등록된 브랜드가 없어요' })}</p>
        <p className="text-[13px] mt-1" style={{ color: WT.ink3 }}>{tr('wholesale.brand.emptyDesc', { defaultValue: '제조사가 브랜드제품을 등록하면 여기에 브랜드별로 모아 보여드려요.' })}</p>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {brands.map((b) => (
        <button key={b.name} onClick={() => onPick(b.name)}
          className="group flex flex-col items-center justify-center gap-2 rounded-2xl px-4 py-6 transition-colors"
          style={{ border: '1px solid ' + WT.line, background: '#fff', boxShadow: WT.shSoft }}>
          {b.logo_url ? (
            <img
              src={cfImage(b.logo_url, { width: 80, format: 'auto' }) || b.logo_url}
              alt={b.name}
              className="w-14 h-14 object-contain rounded-xl"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className="text-[16px] font-extrabold tracking-[-0.01em] text-center line-clamp-2" style={{ color: WT.ink }}>{b.name}</span>
          )}
          <span className="text-[12px] font-semibold text-center line-clamp-1" style={{ color: WT.ink }}>{b.name}</span>
          <span className="text-[12px] font-semibold tabular-nums rounded-full px-2.5 py-0.5" style={{ background: WT.brandSoft, color: WT.brand }}>
            {comma(b.product_count)}{tr('wholesale.brand.countSuffix', { defaultValue: '개 상품' })}
          </span>
        </button>
      ))}
    </div>
  )
}
