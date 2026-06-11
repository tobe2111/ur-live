// 🚀 SSR 파일럿 — 홈(교환권). 본 사이트 홈 v2 실디자인 이식:
//   다크 테마 + VoucherCard(브랜드/취소선 딜가/할인%/별점·리뷰·구매수 + 대표색 그라데이션 번짐).
//   서버(loader)가 본 사이트 API 를 호출해 완성된 HTML 로 응답 → 접속 즉시 상품이 보임.
import { useLoaderData } from 'react-router'
import { cardGradient } from '../lib/card-gradient'
import { API, img, formatNumber, soldLabel, TopBar, BottomNav } from '../lib/ui'

type Item = {
  id: number; name: string; price: number; original_price?: number | null
  image_url?: string | null; brand_name?: string | null; dominant_color?: string | null
  discount_rate?: number | null; avg_rating?: number; review_count?: number; sold_count?: number
}

export function meta() {
  return [
    { title: '유어딜 — 우리 동네 맛집·교환권' },
    { name: 'description', content: '우리 동네 맛집·교환권, 같이 사면 더 싸다 (SSR 파일럿)' },
  ]
}

export async function loader() {
  // ⚠️ 본 사이트 cron 이 예열하는 키와 byte-identical 해야 엣지캐시 적중(콜드 D1 회피).
  //   HOT_PATHS: /api/products?page=1&limit=20&deal_only=1&sort=price_low&category=%EC%BB%A4%ED%94%BC%2F%EC%9D%8C%EB%A3%8C
  const qs = new URLSearchParams({ page: '1', limit: '20', deal_only: '1', sort: 'price_low', category: '커피/음료' })
  const res = await fetch(`${API}/api/products?${qs.toString()}`, { headers: { accept: 'application/json' } })
  const data = (await res.json().catch(() => null)) as { success?: boolean; data?: Item[] } | null
  return { items: data?.success ? (data.data || []) : [] }
}

function VoucherCard({ p, aboveFold }: { p: Item; aboveFold: boolean }) {
  const grad = cardGradient(p.dominant_color)
  const hasStrike = !!p.original_price && p.original_price > p.price
  const discountRate = hasStrike
    ? Math.round(((p.original_price! - p.price) / p.original_price!) * 100)
    : (p.discount_rate || 0)
  const rating = Number(p.avg_rating || 0)
  const reviewCount = Number(p.review_count || 0)
  const soldCount = Number(p.sold_count || 0)
  return (
    <a className="card" href={`${API}/vouchers/${p.id}`} style={{ backgroundColor: grad.base }}>
      <div className="thumb-box" style={{ backgroundColor: grad.base }}>
        {p.image_url ? (
          <img className="thumb" src={img(p.image_url, 300)} alt={p.name} width={300} height={300}
            loading={aboveFold ? 'eager' : 'lazy'} fetchPriority={aboveFold ? 'high' : 'auto'} decoding="async" />
        ) : (
          <div className="thumb-fallback" style={{ color: grad.sub }}>🎁{p.brand_name && <span style={{ fontSize: 11, fontWeight: 700 }}>{p.brand_name}</span>}</div>
        )}
        <div className="img-fade" style={{ background: grad.imageFade }} />
      </div>
      <div className="card-meta" style={{ color: grad.text }}>
        {p.brand_name && <p className="card-brand" style={{ color: grad.sub }}>[{p.brand_name}]</p>}
        <p className="card-name">{p.name}</p>
        {hasStrike && <p className="card-strike" style={{ color: grad.sub }}>{formatNumber(p.original_price)}딜</p>}
        <div className="card-price-row">
          {discountRate > 0 && <span className="card-pct" style={{ color: grad.accent }}>{discountRate}%</span>}
          <span className="card-price">{formatNumber(p.price)}딜</span>
        </div>
        <div className="card-sub-row" style={{ color: grad.sub }}>
          <span><span className="star">★</span> {rating > 0 ? <b style={{ color: grad.text }}>{rating.toFixed(1)}</b> : '신규'}{reviewCount > 0 ? ` (${reviewCount})` : ''}</span>
          {soldCount > 0 && <span>구매 {soldLabel(soldCount)}</span>}
        </div>
      </div>
    </a>
  )
}

export default function Home() {
  const { items } = useLoaderData<typeof loader>()
  return (
    <div className="dark-page">
      <TopBar />
      <div className="wrap">
        <p className="tagline">우리 동네 맛집·교환권, 같이 사면 더 싸다 🍽️</p>
        <div className="sec-head">
          <h2 className="sec-title">🎟️ 교환권</h2>
          <a className="sec-more" href={`${API}/vouchers`}>전체보기 →</a>
        </div>
        {items.length === 0 ? (
          <p className="notice">상품을 불러오지 못했어요 — 잠시 후 다시 시도해주세요</p>
        ) : (
          <>
            <div className="grid">
              {items.map((p, i) => <VoucherCard key={p.id} p={p} aboveFold={i < 4} />)}
            </div>
            <a className="more-btn" href={`${API}/vouchers`}>교환권 더보기</a>
          </>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
