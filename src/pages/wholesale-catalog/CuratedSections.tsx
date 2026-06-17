// ──────────────────────────────────────────────────────────────
// 🏭 2026-06-15 도매몰 시안 큐레이션 섹션 (유통스타트 도매몰.dc.html)
//   ① 카테고리 타일 8종 ② 실시간 베스트(탭 + 순위 그리드). 실데이터 와이어링.
// ──────────────────────────────────────────────────────────────
import { useState } from 'react'
import { Utensils, Home, Dumbbell } from 'lucide-react'
import { WT } from '../wholesale/wholesale-theme'
import { ProductCard } from './cards'
import type { CatalogItem } from './types'

// 🧹 2026-06-17 (시안): 카테고리 3종 — 식품 · 리빙 · 건강. id 는 카탈로그 category 필터값.
const TILES: { id: string; name: string; Icon: typeof Utensils }[] = [
  { id: 'food', name: '식품', Icon: Utensils },
  { id: 'living', name: '리빙', Icon: Home },
  { id: 'health', name: '건강', Icon: Dumbbell },
]

export function CategoryTiles({ onPick }: { onPick: (id: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2 lg:gap-3">
      {TILES.map((t) => (
        <button key={t.id} onClick={() => onPick(t.id)}
          className="flex flex-col items-center gap-2 py-3 lg:py-[15px] px-1 rounded-xl transition-colors hover:bg-[#FAFBFC]"
          style={{ border: '1px solid ' + WT.line }}>
          <span className="flex h-[42px] w-[42px] lg:h-[46px] lg:w-[46px] items-center justify-center rounded-xl" style={{ background: WT.fill }}>
            <t.Icon className="w-[21px] h-[21px]" strokeWidth={1.7} style={{ color: WT.ink }} />
          </span>
          <span className="text-[11.5px] lg:text-[12.5px] font-semibold whitespace-nowrap" style={{ color: '#33373E' }}>{t.name}</span>
        </button>
      ))}
    </div>
  )
}

// 실시간 베스트 — 카테고리 탭 + 5열 순위 그리드 (시안). items 를 클라 필터/슬라이스.
const BEST_TABS: { id: string; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'food', label: '식품' },
  { id: 'living', label: '리빙' },
  { id: 'health', label: '건강' },
]

export function BestGrid({ items, onOpen, onAdd, onPrefetch }: {
  items: CatalogItem[]
  onOpen: (p: CatalogItem) => void
  onAdd: (p: CatalogItem) => void
  onPrefetch?: (id: number) => void
}) {
  const [tab, setTab] = useState('all')
  const shown = (tab === 'all' ? items : items.filter((p) => p.category === tab)).slice(0, 10)
  if (items.length === 0) return null
  return (
    <section className="pt-2">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <h3 className="text-[20px] font-extrabold tracking-[-0.02em]" style={{ color: WT.ink }}>베스트</h3>
        <div className="flex gap-1.5 ml-1">
          {BEST_TABS.map((t) => {
            const on = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="text-[12.5px] font-bold rounded-full px-3 py-1.5 transition-colors"
                style={on ? { background: WT.ink, color: '#fff' } : { background: '#fff', color: WT.ink2, border: '1px solid ' + WT.line2 }}>
                {t.label}
              </button>
            )
          })}
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="text-center py-12 text-[14px]" style={{ color: WT.ink4 }}>해당 카테고리 베스트가 아직 없어요.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-6">
          {shown.map((p, i) => (
            // 🧹 2026-06-17 (사용자 요청): 베스트 그리드 순위 번호 배지 제거 — rank 미전달 → 카드 좌상단 번호 안 붙음.
            <ProductCard key={p.id} p={p} onOpen={onOpen} onAdd={onAdd} onPrefetch={onPrefetch} aboveFold={i < 5} />
          ))}
        </div>
      )}
    </section>
  )
}
