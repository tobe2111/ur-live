import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { readMallOrigin } from '@/shared/mall/origin'

/**
 * 🏪 **"당신은 지금 ○○ 가게에서 사는 중입니다"** — 2026-08-12 (대표 *"완전 별개, 분리"* + 잠금 해제 허가)
 *
 * 몰 손님은 `카톡 → urdeal.kr/{슬러그} → 상품 → 장바구니 → 결제 → 완료` 로 간다.
 * 그런데 **장바구니부터 끝까지가 전부 유어딜 화면**이라, 손님 입장에서 가게가 중간에 사라진다.
 * 운영자 입장에선 자기가 데려온 손님이 결제 순간 남의 간판 아래로 넘어가는 것이다.
 *
 * ⇒ 결제 동선에 **가게 간판 한 줄**을 남기고, 끝나면 **그 가게로 돌아갈 문**을 준다.
 *
 * ## 설계 원칙
 * - **흔적이 없으면 아무것도 안 그린다**(`null`). 빈 자리·placeholder 금지 —
 *   본진 손님 화면은 **byte-불변**이어야 한다.
 * - 조회 실패도 `null`. **몰 이름을 못 읽었으면 추측하지 않는다**(잘못된 가게 이름이 결제 화면에
 *   뜨는 것이 아무것도 없는 것보다 나쁘다).
 * - 🔴 **판정에 쓰지 않는다** — 가격·결제·상품 표시는 이 배너와 무관하다. 여기서 하는 일은
 *   *간판*과 *되돌아갈 문* 둘뿐이다(`shared/mall/origin.ts` 의 허용 용도).
 */
interface MallBrand { slug: string; name: string; logoUrl: string | null; initial: string; colorLight: string }
interface MallBrandResp { success?: boolean; mall?: Partial<MallBrand> }

export default function MallOriginBanner({ className = '' }: { className?: string }) {
  const navigate = useNavigate()
  const [brand, setBrand] = useState<MallBrand | null>(null)

  useEffect(() => {
    const slug = readMallOrigin()
    if (!slug) return
    let alive = true
    fetch(`/api/mall/${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? (r.json() as Promise<MallBrandResp>) : null))
      .then((j) => {
        // 이름을 **먼저 정규화하고 그 값으로 판정**한다. 예전엔 아래에서 `name.slice(0,1)` 이
        // 이름 없는 응답에 TypeError 를 내 결과적으로 막혔는데, 그건 가드가 일한 게 아니라
        // **우연히 안전했던 것**이다(되돌려-검증에서 드러났다). 우연에 기대지 않는다.
        const name = String(j?.mall?.name ?? '').trim()
        if (!alive || !j?.success || !name) return
        setBrand({
          slug,
          name,
          logoUrl: j.mall?.logoUrl ?? null,
          initial: String(j.mall?.initial || name.slice(0, 1)),
          colorLight: String(j.mall?.colorLight || '#1F2937'),
        })
      })
      .catch(() => { /* 몰 정보를 못 읽으면 간판을 안 건다 — 추측 금지 */ })
    return () => { alive = false }
  }, [])

  if (!brand) return null

  return (
    <div className={`flex items-center gap-3 rounded-xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#161616] px-3.5 py-3 ${className}`}>
      {brand.logoUrl ? (
        <img src={brand.logoUrl} alt="" className="h-9 w-9 rounded-lg object-cover" width={36} height={36} />
      ) : (
        <span
          className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white"
          style={{ backgroundColor: brand.colorLight }}
          aria-hidden="true"
        >
          {brand.initial}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold text-gray-900 dark:text-white">{brand.name}</p>
        <p className="text-[12px] text-gray-500 dark:text-gray-400">이 가게의 공동구매</p>
      </div>
      <button
        type="button"
        onClick={() => navigate(`/${brand.slug}`)}
        className="shrink-0 rounded-lg border border-gray-200 dark:border-[#2A2A2A] px-3 py-2 text-[12px] font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#1F1F1F] transition-colors"
      >
        가게로 →
      </button>
    </div>
  )
}
