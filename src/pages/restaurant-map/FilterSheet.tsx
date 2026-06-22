/**
 * 🛍️ 2026-06-20 (대표 — 필터 팝업 리디자인 + 세부 지역): 식당 cuisine 제거 후 '상세 조건' 팝업.
 *   - 지역: KOREA_REGIONS 계층 (시/도 → 세부 지역그룹: 해운대/센텀, 경성대/대연 …)  ← korea-regions.ts SSOT
 *   - 정렬 / 거리반경 / 가격대
 *   - 실시간 결과 카운트(적용 전 'N곳' 미리보기)
 * 카테고리 축(식사/뷰티/헬스/숙소…)은 상단 voucherType 칩이 담당 → 팝업 중복 X.
 * PC 에선 max-w-[430px] 중앙 정렬 (모바일 앱 프레임 일관성).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { KOREA_REGIONS } from '@/shared/constants/korea-regions'
import type { SortBy } from './types'

export type PriceRange = 'all' | 'under10' | '10to30' | 'over30'

interface Props {
  region: string
  district: string
  sortBy: SortBy
  radiusKm: number
  priceRange: PriceRange
  hasUserLoc: boolean
  /** 적용 전 실시간 결과 수 (검색/즐겨찾기 제외, 지역/반경/가격 기준) */
  countFor: (region: string, district: string, radiusKm: number, priceRange: PriceRange) => number
  onApply: (region: string, district: string, sortBy: SortBy, radiusKm: number, priceRange: PriceRange) => void
  onClose: () => void
}

const RADIUS_OPTS: Array<{ v: number; label: string }> = [
  { v: 0, label: '전체' }, { v: 1, label: '1km' }, { v: 3, label: '3km' }, { v: 5, label: '5km' },
]
const PRICE_OPTS: Array<{ v: PriceRange; label: string }> = [
  { v: 'all', label: '전체' }, { v: 'under10', label: '1만원↓' }, { v: '10to30', label: '1~3만' }, { v: 'over30', label: '3만원↑' },
]

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-full text-[13px] font-semibold whitespace-nowrap transition-all ${
        active
          ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
          : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#242424]'
      }`}
    >
      {children}
    </button>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] font-bold text-gray-900 dark:text-white mb-2.5">{children}</p>
}

export default function FilterSheet({ region: ir, district: id, sortBy: isort, radiusKm: irad, priceRange: ip, hasUserLoc, countFor, onApply, onClose }: Props) {
  useEscapeKey(onClose)
  const { t } = useTranslation()
  const [region, setRegion] = useState(ir)
  const [district, setDistrict] = useState(id)
  const [sort, setSort] = useState<SortBy>(isort)
  const [radius, setRadius] = useState(irad)
  const [price, setPrice] = useState<PriceRange>(ip)

  const activeRegion = KOREA_REGIONS.find(x => x.key === region)
  const count = countFor(region, district, radius, price)

  const sortOpts: Array<{ v: SortBy; label: string }> = [
    ...(hasUserLoc ? [{ v: 'distance' as SortBy, label: '거리순' }] : []),
    { v: 'discount', label: '할인율순' }, { v: 'price', label: '가격순' }, { v: 'rating', label: '평점순' },
  ]

  return (
    <div className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-[2px] flex items-end justify-center" onClick={onClose} role="presentation">
      <div
        className="bg-white dark:bg-[#0A0A0A] rounded-t-[28px] w-full max-w-[430px] max-h-[88dvh] flex flex-col sm:rounded-[28px] sm:my-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label={t('map.filter.ariaLabel', { defaultValue: '필터 설정' })}
      >
        {/* grabber + header */}
        <div className="pt-2.5 shrink-0">
          <div className="w-9 h-1 rounded-full bg-gray-200 dark:bg-[#2A2A2A] mx-auto" />
        </div>
        <div className="px-5 pt-3 pb-3 flex items-center justify-between shrink-0">
          <h3 className="text-[17px] font-extrabold text-gray-900 dark:text-white">{t('map.filter.title', { defaultValue: '필터' })}</h3>
          <button
            onClick={() => { setRegion(''); setDistrict(''); setSort(hasUserLoc ? 'distance' : 'discount'); setRadius(0); setPrice('all') }}
            className="text-[13px] font-semibold text-gray-400 dark:text-gray-500 active:text-gray-900 dark:active:text-white"
          >
            {t('map.filter.reset', { defaultValue: '초기화' })}
          </button>
        </div>

        <div className="px-5 pb-2 overflow-y-auto flex-1 min-h-0 space-y-6">
          {/* 지역 — 2단(좌: 시/도 / 우: 동네 리스트). 당근/배민 패턴 — pill 벽보다 깔끔·확장성. */}
          <section>
            <SectionTitle>{t('map.filter.region', { defaultValue: '지역' })}</SectionTitle>
            <div className="flex rounded-2xl border border-gray-100 dark:border-[#1A1A1A] overflow-hidden h-[248px]">
              {/* 시/도 좌측 레일 */}
              <div className="w-[86px] shrink-0 overflow-y-auto no-scrollbar bg-gray-50 dark:bg-[#121212] border-r border-gray-100 dark:border-[#1A1A1A]">
                <button
                  onClick={() => { setRegion(''); setDistrict('') }}
                  className={`w-full text-left px-3 py-2.5 text-[12.5px] transition-colors ${!region ? 'bg-white dark:bg-[#0A0A0A] font-bold text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                >전국</button>
                {KOREA_REGIONS.map(r => (
                  <button
                    key={r.key}
                    onClick={() => { setRegion(r.key); setDistrict('') }}
                    className={`w-full text-left px-3 py-2.5 text-[12.5px] whitespace-pre-line leading-tight transition-colors ${region === r.key ? 'bg-white dark:bg-[#0A0A0A] font-bold text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                  >{r.label}</button>
                ))}
              </div>
              {/* 동네 우측 리스트 */}
              <div className="flex-1 overflow-y-auto">
                {!activeRegion ? (
                  <div className="h-full flex items-center justify-center px-4">
                    <p className="text-[12px] text-gray-400 dark:text-gray-500 text-center">왼쪽에서 시/도를<br />먼저 선택하세요</p>
                  </div>
                ) : (
                  <>
                    <button onClick={() => setDistrict('')} className="w-full flex items-center justify-between px-4 py-3 text-[13px] border-b border-gray-50 dark:border-[#141414]">
                      <span className={!district ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}>{activeRegion.label.replace('\n', ' ')} 전체</span>
                      {!district && <Check className="w-4 h-4 text-gray-900 dark:text-white" />}
                    </button>
                    {activeRegion.districtGroups.map(g => (
                      <button key={g.key} onClick={() => setDistrict(g.key)} className="w-full flex items-center justify-between px-4 py-3 text-[13px] border-b border-gray-50 dark:border-[#141414] last:border-0">
                        <span className={district === g.key ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}>{g.label}</span>
                        {district === g.key && <Check className="w-4 h-4 text-gray-900 dark:text-white shrink-0" />}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          </section>

          {/* 정렬 */}
          <section>
            <SectionTitle>{t('map.filter.sort', { defaultValue: '정렬' })}</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              {sortOpts.map(o => <Pill key={o.v} active={sort === o.v} onClick={() => setSort(o.v)}>{o.label}</Pill>)}
            </div>
          </section>

          {/* 거리반경 */}
          <section>
            <SectionTitle>
              {t('map.filter.radius', { defaultValue: '거리 반경' })}
              {!hasUserLoc && <span className="ml-1.5 text-[11px] font-medium text-gray-400">· 위치 허용 필요</span>}
            </SectionTitle>
            <div className="flex gap-1.5">
              {RADIUS_OPTS.map(o => (
                <Pill key={o.v} active={radius === o.v} onClick={() => hasUserLoc && setRadius(o.v)}>{o.label}</Pill>
              ))}
            </div>
          </section>

          {/* 가격대 */}
          <section>
            <SectionTitle>{t('map.filter.price', { defaultValue: '가격대' })}</SectionTitle>
            <div className="flex gap-1.5">
              {PRICE_OPTS.map(o => <Pill key={o.v} active={price === o.v} onClick={() => setPrice(o.v)}>{o.label}</Pill>)}
            </div>
          </section>
        </div>

        {/* apply with live count */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-[#1A1A1A] shrink-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <button
            onClick={() => onApply(region, district, sort, radius, price)}
            className="w-full py-3.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[15px] font-extrabold rounded-2xl active:scale-[0.98] transition-transform"
          >
            {count > 0
              ? t('map.filter.applyCount', { defaultValue: `${count}곳 보기`, count })
              : t('map.filter.applyEmpty', { defaultValue: '결과 없음' })}
          </button>
        </div>
      </div>
    </div>
  )
}
