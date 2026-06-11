// 🚀 SSR 파일럿 — 도매몰 카탈로그 (비로그인 공개 뷰).
import type { LoaderFunctionArgs } from 'react-router'
import { useLoaderData, Link } from 'react-router'

const API = 'https://live.ur-team.com'

type Item = {
  id: number; name: string; image_url?: string | null; category?: string | null
  stock: number; brand_name?: string | null; sold_count?: number
}

export function meta() {
  return [{ title: '유통스타트 도매몰 — SSR 파일럿' }]
}

export async function loader(_args: LoaderFunctionArgs) {
  const res = await fetch(`${API}/api/wholesale/catalog?limit=24`, { headers: { accept: 'application/json' } })
  const data = (await res.json().catch(() => null)) as { success?: boolean; items?: Item[] } | null
  return { items: data?.success ? (data.items || []) : [] }
}

function img(u?: string | null): string {
  if (!u) return ''
  return u.startsWith('/') ? `${API}${u}` : u
}

export default function Wholesale() {
  const { items } = useLoaderData<typeof loader>()
  return (
    <div className="light-page">
      <div className="wrap">
        <div className="page-title">🏭 유통스타트 도매몰 <span style={{ fontSize: 11, fontWeight: 600, color: '#FF0033' }}>SSR 파일럿</span></div>
        <div className="page-sub">검증된 제조사 직거래 — 서버 렌더링 검증 페이지 (<Link to="/" style={{ color: '#8A929E' }}>교환권 보기 →</Link>)</div>
        {items.length === 0 ? (
          <p className="notice">상품을 불러오지 못했어요 — API 응답 확인 필요</p>
        ) : (
          <div className="grid">
            {items.map((p) => (
              <a key={p.id} className="card card-light" href={`https://live.ur-team.com/wholesale/product/${p.id}`}>
                {p.image_url ? <img className="thumb" src={img(p.image_url)} alt={p.name} loading="lazy" /> : <div className="thumb" />}
                <div className="meta">
                  <div className="name">{p.name}</div>
                  <div className="price" style={{ fontSize: 12, color: '#8A929E', fontWeight: 700 }}>🔒 로그인하고 공급가 확인</div>
                  <div className="sub">{p.category || ''}{(p.sold_count ?? 0) > 0 ? ` · 판매 ${p.sold_count}` : ''}</div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
