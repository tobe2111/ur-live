/**
 * 🏬 운영자 몰 **상품 상세** — `urdeal.kr/{슬러그}/p/{상품id}` 〔대표 지시 2026-08-11 "철저히 분리"〕
 *
 * ## 왜 이 화면이 새로 필요했나 (실측)
 *
 * 그전까지 몰 카드는 본진 `/products/:id` 로 나갔다. 그래서 몰 손님의 여정이 이렇게 갈렸다:
 *
 * | 화면 | 브랜드 | 가격 |
 * |---|---|---|
 * | 몰 홈 `/{슬러그}` | 운영자 | **공구가** (`resolveGbPricing`) |
 * | 본진 상세 `/products/:id` | **유어딜**(탭바·배너·추천) | **상시가** — 본진 상세는 공구가를 모른다 |
 * | 결제 | 유어딜 | 공구가 (`order.routes` 가 서버 권위로 다시 계산) |
 *
 * 즉 **살지 말지 정하는 화면에서만 가격이 올라가** 있었다. 브랜드도 거기서 바뀌었다.
 * 두 증상의 원인이 하나였다 — 몰 표면이 **홈 한 장뿐**이었던 것.
 *
 * ## 이 파일이 지키는 것
 * ① **가격은 목록과 같은 함수** — 서버(`/api/mall/:slug/products/:id`)가 목록과 같은
 *    `resolveGbPricing` 을 쓴다. 이 화면은 그 값을 **표시만** 한다(자체 계산 금지).
 * ② **유어딜로 나가는 링크 0** — 대표 UX 기준 ⑤. 되돌아갈 곳은 **그 가게**뿐이다.
 *    (`isMallSurfacePath` 가 이 경로를 포함하므로 탭바·사이드배너는 App 셸이 이미 안 그린다.)
 * ③ **몰 브랜딩 승계** — `--mall` 변수·안전결제 띠·`powered by`. 홈과 같은 규칙이라
 *    색 역할·다크 대비 판단도 `MallHomePage` 헤더 주석의 결정을 그대로 따른다.
 *
 * ⚠️ **결제 레일은 본진 공유가 의도된 설계다** 〔2026-08-11 대표 동의: "표면은 분리, 레일은 공유"〕.
 *   그래서 구매는 기존 `/checkout` 으로 간다 — 여기서 병렬 결제 경로를 만들지 않는다.
 *   (유어딜 공구의 `/confirm-toss` 가 그렇게 갈라져 나가 가상계좌 가드·웹훅 연결을 못 받은 선례가 있다.)
 *
 * ✅ **2026-08-11 후속 완료** — 이 주석에 *"아직 안 고쳐졌다"* 고 적혀 있던 두 가지는 같은 날 수리됐다:
 *   ① `/checkout` 견적이 상시가를 보여주던 것 → 견적도 `loadGbOrderPricing`(주문 생성과 같은 헬퍼)
 *   ② 픽업 상품에 배송비 3,000원이 붙던 것 → 비배송 판정 SSOT(`allItemsNoShipping`)에 `has_pickup` 축 추가
 *   그래서 아래 `shipping_fee: 0` 은 이제 **서버 판정과 같은 방향**이다(여전히 서버가 권위).
 *   ⚠️ 다만 **실제 청구액은 staging 실결제로만 판정된다** — 테스트는 판정·배선까지만 본다.
 */
import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Clock, Package, Lock, ChevronLeft } from 'lucide-react'
import SEO from '@/components/SEO'
import BrandLoader from '@/components/brand/BrandLoader'
import NotFoundPage from '@/pages/NotFoundPage'
import { POWERED_BY, PAYMENT_TRUST_NOTE, resolveMallBranding } from '@/shared/mall/branding'
import { STORAGE_LABEL, STORAGE_NOTICE, type PickupInfo } from '@/shared/pickup'
import { hasConsumerSession } from '@/utils/auth'
import { rememberMallOrigin } from '@/shared/mall/origin'
import { toast } from '@/hooks/useToast'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { parseUTCDate } from '@/utils/date'
import { formatNumber } from '@/utils/format'

interface MallInfo {
  id: number; slug: string; name: string; initial: string
  logoUrl: string | null; colorLight: string; colorDark: string; intro: string
}
interface MallProduct {
  product_id: number
  name: string
  description: string | null
  image_url: string | null
  detail_images: string[]
  category: string
  seller_id: number | null
  list_price: number
  gb_price: number
  discount_pct: number
  deadline: string | null
  stock: number | null
  pickup: PickupInfo | null
}

const won = (n: number) => `${formatNumber(n)}원`

/** 마감까지 남은 시간 — 홈 카드와 같은 표기 규칙(짧게, 급한 것만). */
function remainLabel(deadline: string | null): string | null {
  if (!deadline) return null
  const end = parseUTCDate(deadline)?.getTime()
  if (!end || !Number.isFinite(end)) return null
  const ms = end - Date.now()
  if (ms <= 0) return '마감'
  const h = Math.floor(ms / 3_600_000)
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60_000))}분 남음`
  if (h < 48) return `${h}시간 남음`
  return `${Math.floor(h / 24)}일 남음`
}

function pickupDayLabel(date: string | null | undefined): string | null {
  if (!date) return null
  const d = parseUTCDate(date)
  if (!d) return null
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

export default function MallProductPage() {
  const { mallSlug, id } = useParams<{ mallSlug: string; id: string }>()
  const navigate = useNavigate()
  const [mall, setMall] = useState<MallInfo | null>(null)
  const [product, setProduct] = useState<MallProduct | null>(null)
  const [qty, setQty] = useState(1)
  const [state, setState] = useState<'loading' | 'ready' | 'gone' | 'notfound'>('loading')

  useEffect(() => {
    if (!mallSlug || !id) { setState('notfound'); return }
    let alive = true
    const slug = encodeURIComponent(mallSlug)
    // 몰 정보와 상품을 **병렬로** — 둘 다 있어야 그리므로 직렬로 하면 왕복이 그대로 늘어난다.
    type MallResp = { success?: boolean; mall?: MallInfo }
    type ProdResp = { success?: boolean; data?: MallProduct }
    Promise.all([
      fetch(`/api/mall/${slug}`).then((r) => r.json() as Promise<MallResp>).catch(() => null),
      fetch(`/api/mall/${slug}/products/${encodeURIComponent(id)}`).then((r) => r.json() as Promise<ProdResp>).catch(() => null),
    ]).then(([m, p]) => {
      if (!alive) return
      // 🔴 **몰이 없으면** 404 를 그대로 보여준다(홈과 같은 방침 — 조용히 본진으로 흘리지 않는다).
      if (!m?.success || !m?.mall) { setState('notfound'); return }
      // 🧭 몰은 확인됐다 — 흔적을 남긴다. 카톡에서 **상품 링크로 바로 들어오는 것이 흔한 경로**라
      //   홈에서만 남기면 그 손님에겐 흔적이 없다.
      rememberMallOrigin(m.mall.slug)
      setMall(m.mall)
      // 🔴 **몰은 있는데 상품만 없는 경우**(품절·공구 종료·삭제)는 유어딜 404 가 아니라
      //   **그 가게 화면**으로 안내한다. 단톡방에 링크가 오래 남는 특성상 흔한 상황이고,
      //   여기서 유어딜 404 를 보여주면 `MallHomePage` 주석이 말한 *"몰이 열렸다보다 나쁜 결과"* 가 된다.
      if (!p?.success || !p?.data) { setState('gone'); return }
      setProduct(p.data)
      setState('ready')
    })
    return () => { alive = false }
  }, [mallSlug, id])

  if (state === 'loading') return <BrandLoader fullScreen />
  // 몰 자체가 없으면 유어딜 404 가 맞다(오타·폐점).
  if (state === 'notfound' || !mall) return <NotFoundPage />
  // 🏬 몰은 있고 상품만 없다 — **그 가게의 화면**으로 안내한다(유어딜 404 로 떨구지 않는다).
  if (state === 'gone' || !product) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-8 text-center bg-white dark:bg-[#0D0F12]"
        style={{ ['--mall-l' as string]: mall.colorLight, ['--mall-d' as string]: mall.colorDark }}>
        <p className="text-[15px] font-bold tracking-[-0.03em] text-[#3F383C] dark:text-[#DAD4D7]">지금은 판매하지 않는 상품이에요</p>
        <p className="mt-2 text-[13px] tracking-[-0.02em] text-[#8A8288] dark:text-[#7C7479]">공동구매가 끝났거나 준비된 수량이 모두 나갔어요</p>
        <Link to={`/${mall.slug}`}
          className="mt-6 px-6 py-2.5 rounded-xl text-[14px] font-extrabold tracking-[-0.03em] text-white dark:text-[#1A1719]"
          style={{ backgroundColor: 'var(--mall-l)' }}>
          {mall.name} 둘러보기
        </Link>
      </div>
    )
  }

  const remain = remainLabel(product.deadline)
  const closed = remain === '마감'
  const soldOut = typeof product.stock === 'number' && product.stock <= 0
  const lowStock = typeof product.stock === 'number' && product.stock > 0 && product.stock <= 10
  const maxQty = typeof product.stock === 'number' && product.stock > 0 ? Math.min(99, product.stock) : 99
  const pickupDay = pickupDayLabel(product.pickup?.date)

  function buy() {
    if (!product || !mall) return
    if (!hasConsumerSession()) {
      // 로그인 후 **이 가게의 이 상품으로** 정확히 돌아온다. 본진 홈으로 떨구지 않는다.
      try { localStorage.setItem('loginReturnUrl', window.location.pathname) } catch { /* 사파리 프라이빗 */ }
      navigate('/login')
      return
    }
    if (closed) { toast.error('마감된 공동구매예요'); return }
    if (soldOut) { toast.error('준비된 수량이 모두 나갔어요'); return }
    // 결제 레일은 본진 공유(위 헤더 주석) — 기존 `directPurchase` 계약 그대로 넘긴다.
    // ⚠️ 단가는 **표시용**이다. 실제 청구는 `order.routes` 가 `resolveGbPricing` 으로 서버에서 다시 정한다.
    navigate('/checkout', {
      state: {
        directPurchase: [{
          id: `mall_${product.product_id}_${Date.now()}`,
          product_id: product.product_id,
          product_name: product.name,
          product_price: product.gb_price,
          product_image: product.image_url,
          image_url: product.image_url,
          quantity: qty,
          price_snapshot: product.gb_price,
          price: product.gb_price,
          item_total: product.gb_price * qty,
          seller_id: product.seller_id ?? null,
          category: product.category,
          // 📦 픽업이면 배송이 없다 — 클라 의도를 0 으로 밝힌다.
          //   ⚠️ 서버 견적(`order.routes` 의 quote)이 이기므로 이것만으로는 안 고쳐진다(헤더 주석 🔴).
          shipping_fee: product.pickup ? 0 : 3000,
        }],
        // 돌아갈 가게 — 결제 화면이 나중에 몰 브랜딩을 승계할 때 쓰는 신호(단계 2).
        mallSlug: mall.slug,
      },
    })
  }

  return (
    <div
      className="min-h-[100dvh] bg-white dark:bg-[#0D0F12] [--mall:var(--mall-l)] dark:[--mall:var(--mall-d)]"
      style={{ ['--mall-l' as string]: mall.colorLight, ['--mall-d' as string]: mall.colorDark }}
    >
      <SEO title={`${product.name} - ${mall.name}`} description={product.description || mall.intro} url={`/${mall.slug}/p/${product.product_id}`} />

      {/* 헤더 — 돌아갈 곳은 **그 가게**다(유어딜 아님, 기준 ⑤). */}
      <header className="ur-content-wide mx-auto px-5 pt-5 pb-3 flex items-center gap-2.5">
        <Link to={`/${mall.slug}`} aria-label={`${mall.name} 홈으로`}
          className="flex-none -ml-1.5 p-1.5 rounded-full text-[#524B4F] dark:text-[#BDB5BA]">
          <ChevronLeft className="w-[21px] h-[21px]" strokeWidth={2.2} />
        </Link>
        {mall.logoUrl ? (
          <img src={cfImage(mall.logoUrl, { width: 64 })} alt="" width={28} height={28}
            className="w-7 h-7 rounded-lg object-cover flex-none"
            onError={(e) => cfImageOnError(e.currentTarget, mall.logoUrl)}
          />
        ) : (
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[13px] font-extrabold text-white dark:text-[#1A1719] flex-none"
            style={{ backgroundColor: 'var(--mall)' }} aria-hidden>{mall.initial}</div>
        )}
        <p className="min-w-0 truncate text-[14.5px] font-extrabold tracking-[-0.03em] text-[#1A1719] dark:text-[#F3EFF1]">{mall.name}</p>
      </header>

      <main className="ur-content-wide mx-auto px-5 pb-40">
        <div className="relative aspect-square rounded-[16px] overflow-hidden bg-[#F1EDEF] dark:bg-[#221D20]">
          {product.image_url && (
            <img src={cfImage(product.image_url, { width: 900 })} alt="" width={900} height={900}
              className="w-full h-full object-cover"
              onError={(e) => cfImageOnError(e.currentTarget, product.image_url)}
            />
          )}
          {remain && (
            <span className="absolute left-2.5 top-2.5 flex items-center gap-1 px-2.5 py-[6px] rounded-full bg-red-600 text-white text-[12px] font-bold tracking-[-0.02em]">
              <Clock className="w-[12px] h-[12px]" strokeWidth={2.4} />
              {remain}
            </span>
          )}
          {lowStock && (
            <span className="absolute right-2.5 top-2.5 px-2.5 py-[6px] rounded-full bg-[rgba(20,17,19,.74)] backdrop-blur-sm text-white text-[12px] font-bold tracking-[-0.02em]">
              {product.stock}개 남음
            </span>
          )}
        </div>

        <h1 className="mt-5 text-[19px] font-extrabold leading-[1.35] tracking-[-0.035em] text-[#1A1719] dark:text-[#F3EFF1]">{product.name}</h1>

        {/* 🔴 가격 — 목록·카톡 카드와 **같은 값**이어야 한다. 서버가 준 값을 그대로 쓴다. */}
        <p className="mt-2.5 flex items-baseline gap-2 flex-wrap">
          {product.discount_pct > 0 && (
            <span className="text-[24px] font-extrabold tracking-[-0.04em] text-red-600 dark:text-red-400">{product.discount_pct}%</span>
          )}
          <span className="text-[24px] font-extrabold tracking-[-0.04em] text-[#1A1719] dark:text-[#F3EFF1]">{won(product.gb_price)}</span>
          {product.list_price > product.gb_price && (
            <span className="text-[13.5px] line-through text-[#A9A2A6] dark:text-[#7C7479]">{won(product.list_price)}</span>
          )}
        </p>

        {product.pickup && (pickupDay || product.pickup.place || product.pickup.storage) && (
          <div className="mt-4 rounded-xl bg-[#F5F2F3] dark:bg-[#211C1F] px-4 py-3.5">
            <p className="flex items-center gap-2">
              <Package className="w-[15px] h-[15px] flex-none text-[#5C5459] dark:text-[#A69EA3]" strokeWidth={1.9} />
              <span className="text-[13px] font-bold tracking-[-0.025em] text-[#3F383C] dark:text-[#DAD4D7]">
                {pickupDay ? `${pickupDay} 픽업` : '매장 픽업'}
              </span>
              {product.pickup.storage && (
                <span className="ml-auto flex-none px-[6px] py-[3px] rounded-[6px] bg-white dark:bg-[#171317] text-[11px] font-bold tracking-[-0.02em] text-[#3F383C] dark:text-[#DAD4D7]">
                  {STORAGE_LABEL[product.pickup.storage]}
                </span>
              )}
            </p>
            {product.pickup.place && (
              <p className="mt-2 text-[12.5px] leading-[1.6] tracking-[-0.02em] text-[#6B6469] dark:text-[#A29A9F]">{product.pickup.place}</p>
            )}
            {product.pickup.storage && (
              <p className="mt-1.5 text-[11.5px] leading-[1.6] tracking-[-0.02em] text-[#8A8288] dark:text-[#7C7479]">{STORAGE_NOTICE[product.pickup.storage]}</p>
            )}
          </div>
        )}

        <p className="mt-4 flex items-center gap-[7px] rounded-xl px-3.5 py-2.5 text-[12.5px] font-semibold tracking-[-0.02em] text-white dark:text-[#1A1719]"
          style={{ backgroundColor: 'var(--mall)' }}>
          <Lock className="w-[13px] h-[13px] flex-none" strokeWidth={2.2} />
          {PAYMENT_TRUST_NOTE}
        </p>

        {product.description && (
          <p className="mt-6 text-[13.5px] leading-[1.75] tracking-[-0.02em] whitespace-pre-wrap text-[#524B4F] dark:text-[#BDB5BA]">{product.description}</p>
        )}

        {product.detail_images.length > 0 && (
          <div className="mt-6 space-y-2">
            {product.detail_images.map((src, i) => (
              <img key={i} src={cfImage(src, { width: 900 })} alt="" loading="lazy" className="w-full rounded-xl" onError={(e) => cfImageOnError(e.currentTarget, src)} />
            ))}
          </div>
        )}

        <footer className="pt-10 pb-2 text-center">
          <span className="text-[10.5px] font-semibold tracking-[0.06em] text-[#BCB5B9] dark:text-[#5E5559] select-none cursor-default">{POWERED_BY}</span>
        </footer>
      </main>

      {/* 구매 바 — `StickyActionBar` 가 아니라 자체 바인 이유: 본진 컴포넌트는 유어딜 톤을 끌고 온다. */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-[#F1EDEF] dark:border-[#262023] bg-white/95 dark:bg-[#0D0F12]/95 backdrop-blur">
        <div className="ur-content-wide mx-auto px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))] flex items-center gap-3">
          {!closed && !soldOut && (
            <div className="flex-none flex items-center rounded-xl border border-[#EDE9EB] dark:border-[#292327]">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="수량 줄이기"
                className="w-9 h-10 text-[16px] font-bold text-[#6B6469] dark:text-[#A29A9F]">−</button>
              <span className="w-7 text-center text-[14px] font-bold text-[#1A1719] dark:text-[#F3EFF1]">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(maxQty, q + 1))} aria-label="수량 늘리기"
                className="w-9 h-10 text-[16px] font-bold text-[#6B6469] dark:text-[#A29A9F]">+</button>
            </div>
          )}
          <button onClick={buy} disabled={closed || soldOut}
            className="flex-1 h-11 rounded-xl text-[14.5px] font-extrabold tracking-[-0.03em] text-white dark:text-[#1A1719] disabled:opacity-45"
            style={{ backgroundColor: 'var(--mall)' }}>
            {closed ? '마감됐어요' : soldOut ? '수량이 모두 나갔어요' : '구매하기'}
          </button>
        </div>
      </div>
    </div>
  )
}
