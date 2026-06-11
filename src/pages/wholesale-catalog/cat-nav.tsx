import { WT } from '../wholesale/wholesale-theme'
import type { CatOpt } from './types'

// ── 카테고리 칩 ── (실제 상품에 존재하는 카테고리만 — 데이터 기반)
export function CatChips({ cat, setCat, cats }: { cat: string; setCat: (c: string) => void; cats: CatOpt[] }) {
  return (
    <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {cats.map((c) => {
        const on = cat === c.id
        return (
          <button key={c.id} onClick={() => setCat(c.id)}
            className="shrink-0 rounded-full px-4 h-9 text-[14px] font-semibold transition-colors whitespace-nowrap"
            style={on ? { background: WT.ink, color: '#fff' } : { background: WT.fill, color: WT.ink2 }}>
            {c.label}
          </button>
        )
      })}
    </div>
  )
}

// ── 데스크톱 사이드바 ──
export function Sidebar({ cat, setCat, counts, cats }: { cat: string; setCat: (c: string) => void; counts: Record<string, number>; cats: CatOpt[] }) {
  return (
    <aside className="w-[176px] shrink-0 hidden lg:block">
      <div className="text-[13px] font-bold mb-2 px-1" style={{ color: WT.ink3 }}>카테고리</div>
      <ul className="space-y-0.5">
        {cats.map((c) => {
          const on = cat === c.id
          return (
            <li key={c.id}>
              <button onClick={() => setCat(c.id)}
                className="w-full flex items-center justify-between rounded-xl px-3.5 h-11 text-[15px] transition-colors"
                style={on ? { background: WT.brandSoft, color: WT.brand, fontWeight: 700 } : { color: WT.ink2 }}>
                <span>{c.label}</span><span className="text-[13px] tabular-nums" style={{ color: on ? WT.brand : WT.ink4 }}>{counts[c.id] ?? ''}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
