import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
 *
 * ## 🔴 판정 출처는 둘이고, **서버가 이긴다** (2026-08-12 후속)
 *
 * 세션 흔적은 *"이번 세션에 몰을 지나갔다"* 만 안다 — **양방향으로 틀릴 수 있다**:
 * 새 탭·복귀면 몰 손님인데 흔적이 없고, 구경만 하고 본진 상품을 산 손님에겐 흔적이 남는다.
 * ⇒ 주문번호가 있으면(`?orderId=`, 결제 완료 화면) **그 주문 자체**를 서버에 묻고, 서버가 답하면
 *   그 답을 쓴다. **"이 주문은 몰 주문이 아니다" 라는 답도 그대로 존중해 아무것도 안 그린다.**
 *   서버가 모르면(비로그인·조회 실패) 흔적으로 폴백한다 — 종전 동작과 같다.
 *
 * 🔒 이 판정이 전부 **여기 안에** 있는 것이 요점이다. 호출부인 `PaymentSuccessPage` 는 Toss 감사
 *   잠금 파일이라 **렌더 1줄 말고는 아무것도 없어야** 하고, 그 무접촉을 테스트가 고정한다.
 *   판정을 잠금 파일로 올리면 다음 세션이 거기에 조건을 얹기 시작하고 승인 절차가 이름만 남는다.
 */
interface MallBrand { slug: string; name: string; logoUrl: string | null; initial: string; colorLight: string }
interface MallBrandResp { success?: boolean; mall?: Partial<MallBrand> }
interface OrderMallResp { success?: boolean; mall?: { slug?: string; name?: string } | null }

export default function MallOriginBanner({ className = '' }: { className?: string }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('orderId')
  const [brand, setBrand] = useState<MallBrand | null>(null)

  useEffect(() => {
    let alive = true

    /** 슬러그가 정해진 뒤의 공통 경로 — 브랜딩(로고·색)은 어느 출처든 몰 API 에서 읽는다. */
    const paint = (slug: string) => {
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
    }

    if (!orderId) { const s = readMallOrigin(); if (s) paint(s); return () => { alive = false } }

    // 주문번호가 있으면 **서버에 먼저 묻는다**. 서버의 "몰 주문 아님"(mall === null)은 흔적보다 세다.
    fetch(`/api/mall/of-order/${encodeURIComponent(orderId)}`, { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<OrderMallResp>) : null))
      .then((j) => {
        if (!alive) return
        if (j?.success) {
          const slug = String(j.mall?.slug ?? '').trim()
          if (slug) paint(slug)     // 서버가 가게를 지목 — 이게 정답이다
          return                    // 지목이 없으면 **본진 주문** — 흔적이 있어도 안 그린다
        }
        const s = readMallOrigin(); if (s) paint(s)   // 서버가 모른다(비로그인 등) → 종전 폴백
      })
      .catch(() => { if (alive) { const s = readMallOrigin(); if (s) paint(s) } })

    return () => { alive = false }
  }, [orderId])

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
