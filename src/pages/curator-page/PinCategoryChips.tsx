/**
 * 🎫 2026-09-02 (대표 확정 — 유어샵 안3 "왼정렬 헤더 + 카테고리 칩"): 진열대 위 카테고리 칩.
 *
 *   지도 위 칩(`MapTopBar`, B안)과 **같은 그림** — 흰 알약 + 유어딜 선 아이콘, 선택은 브랜드 블루 면.
 *   칩 정의도 같은 SSOT(`MAP_VOUCHER_DEFS`)를 쓴다 — 유어샵만 다른 이름·다른 아이콘을 갖지 않게.
 *
 *   ⚠️ 핀이 `CHIPS_MIN_PINS` 미만이면 **그리지 않는다**(시안 문구: "핀 12개 이상일 때만 의미가 있으니
 *   6개 이하면 칩을 숨깁니다"). 라이브 실측(2026-08-31)상 진열대 최다 4개라 지금은 거의 안 뜬다 —
 *   그래도 넣는 이유는 늘었을 때 자동으로 뜨게 하려는 것이지 지금 보이려는 게 아니다.
 *
 *   쇼핑 상품 핀(이용권 아님)이 있으면 '상품' 칩을 하나 더 낸다(SSOT 4종 밖 — 유어샵만의 것).
 */
import { useTranslation } from 'react-i18next'
import { MAP_VOUCHER_DEFS, type MapVoucherType } from '@/pages/restaurant-map/voucher-types'
import { GiftBoxIcon } from '@/components/icons/urdeal-icons'
import type { CuratorPin } from '@/features/curator/api/curator-api'

export const CHIPS_MIN_PINS = 7
export type PinCategory = MapVoucherType | 'shop'

/** 핀 → 칩 키. 교환권(deal_only)·voucher 카테고리는 4종 중 하나, 나머지는 '상품'. */
export function pinCategory(p: CuratorPin): Exclude<PinCategory, 'all'> {
  const cat = p.category || ''
  if (/^(meal|beauty|stay|etc)_voucher$/.test(cat)) return cat as Exclude<PinCategory, 'all' | 'shop'>
  if (p.deal_only === 1 || /voucher/i.test(cat)) return 'etc_voucher'
  return 'shop'
}

export default function PinCategoryChips({ pins, value, onChange }: { pins: CuratorPin[]; value: PinCategory; onChange: (v: PinCategory) => void }) {
  const { t } = useTranslation()
  if (pins.length < CHIPS_MIN_PINS) return null
  const counts = new Map<string, number>()
  for (const p of pins) { const k = pinCategory(p); counts.set(k, (counts.get(k) || 0) + 1) }
  const defs = [
    ...MAP_VOUCHER_DEFS.filter((d) => d.key === 'all' || (counts.get(d.key) || 0) > 0),
    ...((counts.get('shop') || 0) > 0 ? [{ key: 'shop' as const, labelKey: 'curator.chipShop', defaultLabel: '상품', icon: GiftBoxIcon }] : []),
  ]
  // 카테고리가 하나뿐이면 칩은 정보가 0 — 전체 + 그 하나 = 늘 같은 목록.
  if (defs.length <= 2) return null
  return (
    <div className="max-w-3xl mx-auto px-4 pt-3 flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden" role="tablist" aria-label={t('curator.chipsLabel', { defaultValue: '카테고리' })}>
      {defs.map((d) => {
        const on = value === d.key
        const n = d.key === 'all' ? pins.length : counts.get(d.key) || 0
        return (
          <button
            key={d.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(d.key as PinCategory)}
            className={`shrink-0 inline-flex items-center gap-1.5 h-9 pl-3 pr-3.5 rounded-full text-[13px] font-bold whitespace-nowrap active:scale-95 transition-transform ${on ? 'bg-brand text-white' : 'bg-white dark:bg-[#1D1F29] text-gray-800 dark:text-gray-100 shadow-lift'}`}
          >
            <d.icon size={15} />
            {t(d.labelKey, { defaultValue: d.defaultLabel })} <span className={`tabular-nums ${on ? 'text-white/80' : 'text-gray-400'}`}>{n}</span>
          </button>
        )
      })}
    </div>
  )
}
