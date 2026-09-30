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
 *   🩸 2026-09-30 (대표 한 톤 확정 — *"아예 모두 똑같이 배경색을 카드 색상이랑 같게 한다면???"* →
 *   *"일단 이 형태가 낫고"*): **알약 칩 → 밑줄 탭.** 알약은 *자기 배경*으로 존재를 주장하는 부품이라,
 *   페이지·카드·칩이 전부 같은 톤이 되면 흰 알약이 흰 바탕 위에 그림자로만 떠 있는 모양이 된다
 *   (대표가 "지저분하다" 고 한 자리 중 하나). 밑줄 탭은 **선 하나로** 활성만 말하므로 톤이 하나여도
 *   읽힌다. 개수는 그대로 남긴다 — 대표가 *"각 이용권마다 숫자도 달아줘"* 로 직접 요청한 항목이다.
 *   ⚠️ 선 아이콘은 탭에서 **안 그린다**(라벨 + 숫자 + 밑줄이면 충분하고, 아이콘까지 넣으면 탭 하나가
 *      다시 알약만큼 넓어져 한 화면에 두 개밖에 안 들어간다). 정의 SSOT 는 그대로 쓴다.
 *
 *   🔧 2026-09-28 (대표 확정 **상단 1안**): 이 부품은 이제 **자기 줄을 소유하지 않는다.**
 *   정렬 드롭다운이 바로 아래에서 **버튼 하나를 위해 줄 하나를 더** 쓰고 있었고(라이브 실측 32px),
 *   둘을 한 줄에 놓으면 상단이 102px 줄어든다. 그래서 바깥 여백(`max-w-3xl mx-auto px-4 pt-3`)은
 *   호출부의 줄이 갖고, 여기는 `flex-1 min-w-0` 로 그 줄을 나눠 쓴다.
 *   ⚠️ **빈 진열대 판정은 여전히 이 부품이 혼자 한다** — 호출부에 개수 게이트를 두면 언젠가 갈린다.
 */
import { useTranslation } from 'react-i18next'
import { MAP_VOUCHER_DEFS, type MapVoucherType } from '@/pages/restaurant-map/voucher-types'
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
    ...((counts.get('shop') || 0) > 0 ? [{ key: 'shop' as const, labelKey: 'curator.chipShop', defaultLabel: '상품' }] : []),
  ]
  // 카테고리가 하나뿐이면 칩은 정보가 0 — 전체 + 그 하나 = 늘 같은 목록.
  if (defs.length <= 2) return null
  return (
    <div className="flex-1 min-w-0 flex overflow-x-auto scrollbar-hide" role="tablist" aria-label={t('curator.chipsLabel', { defaultValue: '카테고리' })}>
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
            className={`shrink-0 inline-flex items-center gap-1 h-9 px-3 -mb-px border-b-2 text-[15px] font-bold whitespace-nowrap active:opacity-60 transition-colors ${on ? 'border-brand text-gray-900 dark:text-white' : 'border-transparent text-gray-400 dark:text-gray-500'}`}
          >
            {t(d.labelKey, { defaultValue: d.defaultLabel })}
            {/* 🩸 2026-09-30 — `text-gray-300 dark:text-gray-600` 으로 썼다가 **CI 의 `contrast` 가 잡았다**
                (다크 2.15:1 — 안 보이는 글자). 실측해 보니 라이트는 더 나빴다(**1.50:1**) — 그 검사는
                다크만 렌더하므로 라이트 쪽은 아무도 안 보고 있었다. 개수는 대표가 직접 요청한
                *정보*(*"각 이용권마다 숫자도 달아줘"*)라 장식으로 칠하면 안 된다.
                ⇒ 라벨과 **같은 회색 단계**로: 라이트 3.67:1 · 다크 3.09:1(둘 다 통과). 위계는 색이 아니라
                크기가 만든다(라벨 15px vs 개수 12px). 가드가 이 비율을 **계산해서** 고정한다. */}
            <span className={`text-[12px] tabular-nums ${on ? 'text-brand' : 'text-gray-400 dark:text-gray-500'}`}>{n}</span>
          </button>
        )
      })}
    </div>
  )
}
