// 🚀 SSR Phase 2 — 검색(/search) 공개 뷰. GET form 이라 JS 없이도 동작(SSR 본령).
//   데이터: q 있으면 GET /api/products?search=q&sort=… (서버가 search 시 private 캐시 —
//   SSR 워커 HTML 캐시 60s 가 같은 질의 반복을 흡수), q 없으면 인기 검색어(/api/search/popular).
//   디자인: 본 사이트 SearchPage — 다크, 검색바 + 결과 그리드(교환권=딜/일반=원) + 오타 보정 제안.
import type { LoaderFunctionArgs } from 'react-router'
import { useLoaderData, Link } from 'react-router'
import { cardGradient } from '../lib/card-gradient'
import { API, img, formatNumber, soldLabel, TopBar, BottomNav, IconSearch } from '../lib/ui'

type Item = {
  id: number; name: string; price: number; original_price?: number | null
  discount_rate?: number | null; image_url?: string | null; seller_name?: string | null
  brand_name?: string | null; deal_only?: number; dominant_color?: string | null
  avg_rating?: number; review_count?: number; sold_count?: number
}

const SORTS = [
  { key: 'popular', label: '인기순' },
  { key: 'price_low', label: '낮은 가격순' },
  { key: 'price_high', label: '높은 가격순' },
  { key: 'newest', label: '최신순' },
] as const

export function meta({ data }: { data?: Awaited<ReturnType<typeof loader>> }) {
  const q = data?.q
  return [
    { title: q ? `'${q}' 검색 결과 — 유어딜` : '검색 — 유어딜' },
    { name: 'description', content: '유어딜에서 동네 교환권·공구·상품을 검색하세요' },
  ]
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const q = (url.searchParams.get('q') || '').trim().slice(0, 200)
  const rawSort = url.searchParams.get('sort') || 'popular'
  const sort = SORTS.some(s => s.key === rawSort) ? rawSort : 'popular'

  if (!q) {
    // 인기 검색어 (공개 endpoint) — 검색 전 화면.
    const res = await fetch(`${API}/api/search/popular`, { headers: { accept: 'application/json' } })
    const data = (await res.json().catch(() => null)) as { success?: boolean; data?: Array<{ keyword: string }> } | null
    return { q: '', sort, items: [] as Item[], suggested: null as string | null, popular: data?.success ? (data.data || []).map(k => k.keyword).slice(0, 10) : [] }
  }

  const qs = new URLSearchParams({ search: q, sort, page: '1', limit: '40' })
  const res = await fetch(`${API}/api/products?${qs.toString()}`, { headers: { accept: 'application/json' } })
  const data = (await res.json().catch(() => null)) as { success?: boolean; data?: Item[]; suggested_query?: string } | null
  return {
    q, sort,
    items: data?.success ? (data.data || []) : [],
    suggested: data?.suggested_query || null,
    popular: [] as string[],
  }
}

function ResultCard({ p, aboveFold }: { p: Item; aboveFold: boolean }) {
  const grad = cardGradient(p.dominant_color)
  const isVoucher = p.deal_only === 1
  const unit = isVoucher ? '딜' : '원'
  const href = `${API}/${isVoucher ? 'vouchers' : 'products'}/${p.id}`
  const hasStrike = !!p.original_price && p.original_price > p.price
  const discountRate = hasStrike
    ? Math.round(((p.original_price! - p.price) / p.original_price!) * 100)
    : (p.discount_rate || 0)
  const rating = Number(p.avg_rating || 0)
  const soldCount = Number(p.sold_count || 0)
  return (
    <a className="card" href={href} style={{ backgroundColor: grad.base }}>
      <div className="thumb-box" style={{ backgroundColor: grad.base }}>
        {p.image_url ? (
          <img className="thumb" src={img(p.image_url, 300)} alt={p.name} width={300} height={300}
            loading={aboveFold ? 'eager' : 'lazy'} fetchPriority={aboveFold ? 'high' : 'auto'} decoding="async" />
        ) : <div className="thumb-fallback" style={{ color: grad.sub }}>{isVoucher ? '🎟️' : '🛍️'}</div>}
        <div className="img-fade" style={{ background: grad.imageFade }} />
        {isVoucher && <span className="badge-rank" style={{ left: 'auto', right: 6 }}>교환권</span>}
      </div>
      <div className="card-meta" style={{ color: grad.text }}>
        {(p.brand_name || p.seller_name) && <p className="card-brand" style={{ color: grad.sub }}>{p.brand_name ? `[${p.brand_name}]` : p.seller_name}</p>}
        <p className="card-name">{p.name}</p>
        {hasStrike && <p className="card-strike" style={{ color: grad.sub }}>{formatNumber(p.original_price)}{unit}</p>}
        <div className="card-price-row">
          {discountRate > 0 && <span className="card-pct" style={{ color: grad.accent }}>{discountRate}%</span>}
          <span className="card-price">{formatNumber(p.price)}{unit}</span>
        </div>
        {(rating > 0 || soldCount > 0) && (
          <div className="card-sub-row" style={{ color: grad.sub }}>
            {rating > 0 && <span><span className="star">★</span> <b style={{ color: grad.text }}>{rating.toFixed(1)}</b>{(p.review_count ?? 0) > 0 ? ` (${p.review_count})` : ''}</span>}
            {soldCount > 0 && <span>구매 {soldLabel(soldCount)}</span>}
          </div>
        )}
      </div>
    </a>
  )
}

export default function Search() {
  const { q, sort, items, suggested, popular } = useLoaderData<typeof loader>()
  return (
    <div className="dark-page">
      <TopBar />
      <div className="wrap">
        {/* GET form — JS 없이 동작. */}
        <form className="search-form" action="/search" method="get" role="search">
          <IconSearch style={{ color: '#6b7280', flexShrink: 0 }} />
          <input className="search-input" type="search" name="q" defaultValue={q}
            placeholder="교환권·공구·상품 검색" maxLength={200} autoComplete="off" />
          <button className="search-btn" type="submit">검색</button>
        </form>

        {!q ? (
          popular.length > 0 && (
            <section>
              <div className="sec-head"><h2 className="sec-title">🔥 인기 검색어</h2></div>
              <div className="chips" style={{ flexWrap: 'wrap' }}>
                {popular.map((k, i) => (
                  <Link key={k} className="chip" to={`/search?q=${encodeURIComponent(k)}`}>{i + 1}. {k}</Link>
                ))}
              </div>
            </section>
          )
        ) : (
          <>
            <div className="chips">
              {SORTS.map(s => (
                <Link key={s.key} className={`chip${sort === s.key ? ' is-active' : ''}`}
                  to={`/search?q=${encodeURIComponent(q)}&sort=${s.key}`}>{s.label}</Link>
              ))}
            </div>
            {items.length === 0 ? (
              <div className="notice">
                <p>'{q}' 검색 결과가 없어요</p>
                {suggested && (
                  <p style={{ marginTop: 10 }}>
                    혹시 <Link to={`/search?q=${encodeURIComponent(suggested)}`} style={{ color: '#fff', fontWeight: 700, textDecoration: 'underline' }}>'{suggested}'</Link> 를 찾으세요?
                  </p>
                )}
              </div>
            ) : (
              <div className="grid">
                {items.map((p, i) => <ResultCard key={p.id} p={p} aboveFold={i < 4} />)}
              </div>
            )}
          </>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
