/**
 * 🎫 2026-09-02 (대표 확정 — 유어샵 안3 "왼정렬 헤더 + 카테고리 칩"): 진열대 위 카테고리 칩.
 *
 *   지도 위 칩(`MapTopBar`, B안)과 **같은 그림** — 흰 알약 + 유어딜 선 아이콘, 선택은 브랜드 블루 면.
 *   칩 정의도 같은 SSOT(`MAP_VOUCHER_DEFS`)를 쓴다 — 유어샵만 다른 이름·다른 아이콘을 갖지 않게.
 *
 *   🔧 2026-09-28 (대표 확정 s3): **최소 개수 게이트를 없앴다.** 종전엔 `CHIPS_MIN_PINS = 7` 미만이면
 *   안 그렸는데(시안 문구 "6개 이하면 칩을 숨깁니다"), 라이브 유어샵은 3곳·핀 8개·**최다 5개**라
 *   그 게이트가 **한 번도 열린 적이 없었다** — 칩은 존재하지 않는 기능이었다. 2026-08-31 주석이
 *   "늘었을 때 자동으로 뜨게 하려는 것" 이라고 적어 둔 그 '늘었을 때' 가 오지 않았다.
 *   s3 는 칩을 정렬 줄과 한 쌍으로 쓰므로 적을 때도 "무엇이 몇 개인지" 를 먼저 말해 주는 편이 낫다.
 *   ⇒ 이제 핀이 **하나라도 있으면** 그린다(0 이면 진열대 자체가 비어 EmptyUrShop 이 대신 뜬다).
 *
 *   쇼핑 상품 핀(이용권 아님)이 있으면 '상품' 칩을 하나 더 낸다(SSOT 4종 밖 — 유어샵만의 것).
 *
 *   🔧 2026-09-28 (대표 확정 **상단 1안**): 이 부품은 이제 **자기 줄을 소유하지 않는다.**
 *   정렬 드롭다운이 바로 아래에서 **버튼 하나를 위해 줄 하나를 더** 쓰고 있었고(라이브 실측 32px),
 *   둘을 한 줄에 놓으면 상단이 102px 줄어든다. 그래서 바깥 여백(`max-w-3xl mx-auto px-4 pt-3`)은
 *   호출부의 줄이 갖고, 여기는 `flex-1 min-w-0` 로 그 줄을 나눠 쓴다.
 *   ⚠️ **빈 진열대 판정은 여전히 이 부품이 혼자 한다** — 호출부에 개수 게이트를 두면 언젠가 갈린다.
 */
import { useTranslation } from 'react-i18next'
import { MAP_VOUCHER_DEFS, type MapVoucherType } from '@/pages/restaurant-map/voucher-types'
import { GiftBoxIcon } from '@/components/icons/urdeal-icons'
import type { CuratorPin } from '@/features/curator/api/curator-api'

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
  // 개수 게이트 없음(위 머리말 참조) — 비었을 때만 안 그린다.
  if (pins.length === 0) return null
  const counts = new Map<string, number>()
  for (const p of pins) { const k = pinCategory(p); counts.set(k, (counts.get(k) || 0) + 1) }
  const defs = [
    ...MAP_VOUCHER_DEFS.filter((d) => d.key === 'all' || (counts.get(d.key) || 0) > 0),
    ...((counts.get('shop') || 0) > 0 ? [{ key: 'shop' as const, labelKey: 'curator.chipShop', defaultLabel: '상품', icon: GiftBoxIcon }] : []),
  ]
  // 카테고리가 하나뿐이면 칩은 정보가 0 — 전체 + 그 하나 = 늘 같은 목록.
  if (defs.length <= 2) return null
  return (
    <div className="flex-1 min-w-0 flex gap-2 overflow-x-auto scrollbar-hide" role="tablist" aria-label={t('curator.chipsLabel', { defaultValue: '카테고리' })}>
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
            className={`shrink-0 inline-flex items-center gap-2 h-9 pl-3 pr-4 rounded-full text-[13px] font-bold whitespace-nowrap active:scale-95 transition-transform ${on ? 'bg-brand text-white' : 'bg-white dark:bg-[#1D1F29] text-gray-800 dark:text-gray-100 shadow-lift'}`}
          >
            <d.icon size={15} />
            {t(d.labelKey, { defaultValue: d.defaultLabel })} <span className={`tabular-nums ${on ? 'text-white/80' : 'text-gray-400'}`}>{n}</span>
          </button>
        )
      })}
    </div>
  )
}
