import { useTranslation } from 'react-i18next'
import { X, ArrowDownUp, PackageCheck, ChevronRight } from 'lucide-react'
import { WT } from '../wholesale/wholesale-theme'
import { type CatalogSort, CATALOG_SORTS, PRICE_BANDS } from './catalog-controls'

// ── BIZ-4 정렬/필터 컨트롤바 (서버사이드 /catalog 파라미터에 위임) ──
//   WholesaleCatalogPage 분해 (순수 추출, 동작 변화 0) — 상태는 부모 소유, props 로 전달.
export default function FilterControls({ sort, setSort, loggedIn, inStock, setInStock, priceBand, setPriceBand, cat, setCat, committedSearch, setSearch, setCommittedSearch }: {
  sort: CatalogSort
  setSort: (v: CatalogSort) => void
  loggedIn: boolean
  inStock: boolean
  setInStock: React.Dispatch<React.SetStateAction<boolean>>
  priceBand: string
  setPriceBand: (v: string) => void
  cat: string
  setCat: (v: string) => void
  committedSearch: string
  setSearch: (v: string) => void
  setCommittedSearch: (v: string) => void
}) {
  const { t } = useTranslation()
  return (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {/* 정렬 드롭다운 */}
            <div className="relative shrink-0">
              <ArrowDownUp className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: WT.ink3 }} />
              <select
                value={sort} onChange={e => setSort(e.target.value as CatalogSort)}
                aria-label={t('wholesale.sortLabel', { defaultValue: '정렬' })}
                className="appearance-none h-9 pl-8 pr-7 rounded-full text-[13px] font-bold outline-none cursor-pointer"
                style={{ background: WT.fill, color: WT.ink }}>
                {/* 🏭 가격/할인율 정렬은 공급가가 보이는 로그인 판매사에게만 (비로그인엔 무의미) */}
                {CATALOG_SORTS.filter(s => loggedIn || !['price_low', 'price_high', 'discount'].includes(s.id)).map(s => (
                  <option key={s.id} value={s.id}>{t(s.label, { defaultValue: s.defaultLabel })}</option>
                ))}
              </select>
              <ChevronRight className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rotate-90" style={{ color: WT.ink3 }} />
            </div>
            {/* 재고있음 토글 */}
            <button onClick={() => setInStock(v => !v)} aria-pressed={inStock}
              className="shrink-0 inline-flex items-center gap-1 rounded-full px-3 h-9 text-[13px] font-bold whitespace-nowrap transition-colors"
              style={inStock ? { background: WT.ink, color: '#fff' } : { background: WT.fill, color: WT.ink3 }}>
              <PackageCheck className="w-3.5 h-3.5" />{t('wholesale.inStock', { defaultValue: '재고있음' })}
            </button>
            {/* 가격대 칩 — 공급가는 로그인 시에만 보이므로 비로그인엔 숨김 */}
            {loggedIn && (
            <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {PRICE_BANDS.map(b => {
                const on = priceBand === b.id
                return (
                  <button key={b.id} onClick={() => setPriceBand(on ? '' : b.id)} aria-pressed={on}
                    className="shrink-0 rounded-full px-3 h-9 text-[13px] font-bold whitespace-nowrap transition-colors"
                    style={on ? { background: WT.brand, color: '#fff' } : { background: WT.fill, color: WT.ink3 }}>
                    {b.label}
                  </button>
                )
              })}
            </div>
            )}
            {/* 필터 초기화 (활성 필터 있을 때만) */}
            {(inStock || priceBand || cat !== 'all' || sort !== 'popular' || committedSearch) && (
              <button onClick={() => { setInStock(false); setPriceBand(''); setCat('all'); setSort('popular'); setSearch(''); setCommittedSearch('') }}
                className="shrink-0 inline-flex items-center gap-1 text-[12px] font-bold" style={{ color: WT.ink3 }}>
                <X className="w-3.5 h-3.5" />{t('wholesale.resetFilters', { defaultValue: '필터 초기화' })}
              </button>
            )}
          </div>
  )
}
