// 🚀 SSR Phase 2 — 상품 상세(/products/:id). 본 사이트 ProductDetailPage 화이트 테마 이식:
//   이미지 + 셀러 + 가격/할인 + 배송 안내(5만원 이상 무료) + 상세 설명 + sticky 구매 CTA.
//   데이터: GET /api/products/:id (본 사이트 KV 캐시 60s). deal_only(교환권)는 본 사이트가
//   /vouchers/:id 로 흐름 분리하므로 CTA 도 동일하게 분기.
import type { LoaderFunctionArgs } from 'react-router'
import { useLoaderData, Link } from 'react-router'
import { API, img, formatNumber } from '../lib/ui'

type Detail = {
  id: number; name: string; description?: string | null; long_description?: string | null
  price: number; original_price?: number | null; discount_rate?: number | null
  image_url?: string | null; category?: string | null
  seller_name?: string | null; seller_username?: string | null
  sold_count?: number; stock?: number; deal_only?: number
  avg_rating?: number; review_count?: number
  restaurant_name?: string | null; restaurant_address?: string | null
  voucher_terms?: string | null; voucher_expiry?: string | null
}

export function meta({ data }: { data?: Awaited<ReturnType<typeof loader>> }) {
  const d = data?.detail
  return [
    { title: d ? `${d.name} — 유어딜` : '상품 상세 — 유어딜' },
    { name: 'description', content: d?.description || (d ? `${d.name} — 유어딜에서 구매하세요` : '유어딜 상품') },
  ]
}

export async function loader({ params }: LoaderFunctionArgs) {
  const id = Number(params.id)
  if (!Number.isFinite(id) || id <= 0) return { detail: null }
  const res = await fetch(`${API}/api/products/${id}`, { headers: { accept: 'application/json' } })
  const data = (await res.json().catch(() => null)) as { success?: boolean; data?: Detail } | null
  return { detail: data?.success ? (data.data || null) : null }
}

export default function ProductDetail() {
  const { detail } = useLoaderData<typeof loader>()
  if (!detail) {
    return (
      <div className="white-page">
        <div className="center-screen" style={{ color: '#111827' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>상품을 찾을 수 없어요</h1>
          <Link to="/" style={{ marginTop: 16, padding: '12px 24px', background: '#111827', color: '#fff', borderRadius: 12, fontWeight: 700, fontSize: 14 }}>홈으로</Link>
        </div>
      </div>
    )
  }

  const isVoucher = detail.deal_only === 1
  const unit = isVoucher ? '딜' : '원'
  const liveHref = `${API}/${isVoucher ? 'vouchers' : 'products'}/${detail.id}`
  const hasStrike = !!detail.original_price && detail.original_price > detail.price
  const discountRate = hasStrike
    ? Math.round(((detail.original_price! - detail.price) / detail.original_price!) * 100)
    : (detail.discount_rate || 0)
  const rating = Number(detail.avg_rating || 0)
  const reviewCount = Number(detail.review_count || 0)
  const soldOut = (detail.stock ?? 1) <= 0

  return (
    <div className="white-page detail-page-light">
      <div className="hero hero-light">
        {detail.image_url ? (
          <img src={img(detail.image_url, 800)} alt={detail.name} width={800} height={800}
            loading="eager" fetchPriority="high" decoding="async" />
        ) : (
          <div className="hero-fallback hero-fallback-light">🎁</div>
        )}
        <Link to="/" className="hero-back" aria-label="뒤로">‹</Link>
      </div>

      <main className="detail-main">
        <section className="panel panel-light">
          {detail.seller_name && <p className="seller-line">{detail.seller_name}</p>}
          <h1 className="detail-title" style={{ color: '#111827' }}>{detail.name}</h1>
          {(rating > 0 || reviewCount > 0) && (
            <p className="rating-line"><span className="star">★</span> {rating > 0 ? rating.toFixed(1) : '신규'}{reviewCount > 0 ? ` 리뷰 ${reviewCount}` : ''}{(detail.sold_count ?? 0) > 0 ? ` · 구매 ${formatNumber(detail.sold_count)}` : ''}</p>
          )}
          <div className="price-block" style={{ borderTopColor: '#f3f4f6' }}>
            {hasStrike && <p className="price-strike" style={{ color: '#9ca3af' }}>{formatNumber(detail.original_price)}{unit}</p>}
            <div className="price-row">
              {discountRate > 0 && <span className="price-pct-light">{discountRate}%</span>}
              <span className="price-main" style={{ color: '#111827' }}>{formatNumber(detail.price)}</span>
              <span className="price-unit" style={{ color: '#111827' }}>{unit}</span>
            </div>
            {soldOut && <p style={{ fontSize: 12.5, color: '#ef4444', fontWeight: 700, marginTop: 6 }}>품절</p>}
          </div>
        </section>

        {!isVoucher && (
          <section className="panel panel-light">
            <p className="panel-title" style={{ color: '#111827' }}>배송 안내</p>
            <p className="panel-body" style={{ color: '#4b5563' }}>🚚 5만원 이상 구매 시 무료배송</p>
          </section>
        )}

        {isVoucher && (detail.voucher_terms || detail.voucher_expiry || detail.restaurant_name) && (
          <section className="panel panel-light">
            <p className="panel-title" style={{ color: '#111827' }}>사용 안내</p>
            {detail.restaurant_name && <p className="panel-body" style={{ color: '#4b5563', marginBottom: 4 }}>🏪 {detail.restaurant_name}{detail.restaurant_address ? ` · ${detail.restaurant_address}` : ''}</p>}
            {detail.voucher_expiry && <p className="panel-body" style={{ color: '#4b5563', marginBottom: 4 }}>유효기간: {detail.voucher_expiry}</p>}
            {detail.voucher_terms && <p className="panel-body" style={{ color: '#4b5563' }}>{detail.voucher_terms}</p>}
          </section>
        )}

        {(detail.description || detail.long_description) && (
          <section className="panel panel-light">
            <p className="panel-title" style={{ color: '#111827' }}>상품 설명</p>
            <p className="panel-body" style={{ color: '#4b5563' }}>{detail.long_description || detail.description}</p>
          </section>
        )}
      </main>

      {/* sticky 구매 CTA — 옵션/장바구니/결제는 본 사이트 */}
      <div className="cta-bar cta-bar-light">
        <a className={`cta-btn${soldOut ? ' is-disabled' : ''}`} href={liveHref}>
          {soldOut ? '품절된 상품이에요' : isVoucher ? `${formatNumber(detail.price)}딜 — 교환권 구매` : `${formatNumber(detail.price)}원 — 구매하기`}
        </a>
      </div>
    </div>
  )
}
