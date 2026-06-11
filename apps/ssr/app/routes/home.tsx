// 🚀 SSR 파일럿 — 홈(교환권 그리드). 서버(loader)가 본 사이트 API 를 호출해
// 완성된 HTML 로 응답 → 접속 즉시 상품이 보임 (JS 부팅 대기 0).
import type { LoaderFunctionArgs } from 'react-router'
import { useLoaderData, Link } from 'react-router'

const API = 'https://live.ur-team.com'

type Item = {
  id: number; name: string; price: number; original_price?: number | null
  image_url?: string | null; brand_name?: string | null; dominant_color?: string | null
  avg_rating?: number; review_count?: number
}

export function meta() {
  return [{ title: '유어딜 — SSR 파일럿' }]
}

export async function loader(_args: LoaderFunctionArgs) {
  const qs = new URLSearchParams({ page: '1', limit: '24', deal_only: '1', sort: 'price_low', category: '커피/음료' })
  const res = await fetch(`${API}/api/products?${qs.toString()}`, {
    headers: { accept: 'application/json' },
    // 본 사이트 API 는 엣지캐시(60~900s) — SSR 호출도 그 캐시를 그대로 적중.
    cf: { cacheTtl: 60, cacheEverything: false },
  } as RequestInit)
  const data = (await res.json().catch(() => null)) as { success?: boolean; data?: Item[] } | null
  return { items: data?.success ? (data.data || []) : [] }
}

function img(u?: string | null): string {
  if (!u) return ''
  if (u.startsWith('/')) return `${API}${u}`
  return u
}

export default function Home() {
  const { items } = useLoaderData<typeof loader>()
  return (
    <div className="dark-page">
      <div className="wrap">
        <div className="page-title">🎟️ 교환권 <span style={{ fontSize: 11, fontWeight: 600, color: '#34d399' }}>SSR 파일럿</span></div>
        <div className="page-sub">우리 동네 맛집·교환권, 같이 사면 더 싸다 — 서버 렌더링 검증 페이지 (<Link to="/wholesale" style={{ color: '#9ca3af' }}>도매몰 보기 →</Link>)</div>
        {items.length === 0 ? (
          <p className="notice">상품을 불러오지 못했어요 — API 응답 확인 필요</p>
        ) : (
          <div className="grid">
            {items.map((p) => {
              const strike = p.original_price && p.original_price > p.price
              const pct = strike ? Math.round((1 - p.price / (p.original_price as number)) * 100) : 0
              return (
                <a key={p.id} className="card card-dark" href={`https://live.ur-team.com/group-buy/${p.id}`} style={p.dominant_color ? { background: p.dominant_color } : undefined}>
                  {p.image_url ? <img className="thumb" src={img(p.image_url)} alt={p.name} loading="lazy" /> : <div className="thumb" />}
                  <div className="meta">
                    <div className="name">{p.brand_name ? `[${p.brand_name}] ` : ''}{p.name}</div>
                    <div className="price">{pct > 0 && <span className="pct">{pct}%</span>}{(p.price || 0).toLocaleString('ko-KR')}원</div>
                    {(p.avg_rating ?? 0) > 0 && <div className="sub">★ {(p.avg_rating as number).toFixed(1)}{(p.review_count ?? 0) > 0 ? ` (${p.review_count})` : ''}</div>}
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
