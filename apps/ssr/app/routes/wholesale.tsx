// 🚀 SSR 파일럿 — 도매몰 카탈로그 (비로그인 공개 뷰). 본 사이트 WholesaleCatalogPage 실디자인 이식:
//   WT 토큰(무채색 + #FF0033 1포인트, 라이트 고정) — 헤더/히어로/카드/가격 잠금 pill.
import { useLoaderData, Link } from 'react-router'
import { API, img } from '../lib/ui'

// 본 사이트 wholesale-theme.ts WT 토큰 1:1.
const WT = {
  ink: '#17181C', ink2: '#4E5560', ink3: '#8A929E',
  line: '#ECEEF1', fill: '#F4F5F7', brand: '#FF0033', brandSoft: '#FFF0F2',
}

type Item = {
  id: number; name: string; image_url?: string | null; category?: string | null
  stock: number; brand_name?: string | null; sold_count?: number
  distributor_price?: number | null; retail_price?: number | null
}

export function meta() {
  return [
    { title: '유통스타트 — 검증된 제조사 직거래 도매몰' },
    { name: 'description', content: '등급별 공급가로 사입하는 B2B 도매몰 (SSR 파일럿)' },
  ]
}

export async function loader({ request }: { request: Request }) {
  // 🔐 Phase 2-F: 브라우저 쿠키(ud_seller_token — beta↔live 는 .ur-team.com 공유)를 API 로 forward
  //   → 본체 미들웨어 GET 쿠키 fallback 이 셀러 인증 → 등급 공급가 포함 응답.
  //   비로그인은 기존 guest 호출 byte-identical (예열 키 적중 유지).
  const cookie = request.headers.get('cookie') || ''
  const authed = /(?:^|;\s*)ud_(?:seller|agency)_token=/.test(cookie)
  const res = await fetch(`${API}/api/wholesale/catalog`, {
    headers: { accept: 'application/json', ...(authed ? { cookie } : {}) },
  })
  const data = (await res.json().catch(() => null)) as { success?: boolean; items?: Item[]; grade?: string | null } | null
  return { items: data?.success ? (data.items || []).slice(0, 24) : [], grade: (authed && data?.grade) || null }
}

export default function Wholesale() {
  const { items, grade } = useLoaderData<typeof loader>()
  return (
    <div className="light-page">
      <div className="wt-topbar">
        <span className="wt-logo">유통스타트<span className="dot">.</span></span>
        {grade ? (
          <span className="wt-login" style={{ background: '#FFF0F2', color: '#FF0033', border: 'none' }}>내 등급 {grade}</span>
        ) : (
          <a className="wt-login" href={`${API}/wholesale/login`}>유통회원 로그인</a>
        )}
      </div>
      <div className="wrap">
        <div className="wt-hero">
          <span className="wt-hero-badge">B2B 도매</span>
          <p className="wt-hero-title">검증된 제조사 직거래,<br />등급별 공급가로 사입하세요</p>
          <p className="wt-hero-sub">사업자 가입 승인 후 공급가·마진이 공개됩니다 (<Link to="/" style={{ color: '#B6BCC4', textDecoration: 'underline' }}>소비자몰 보기</Link>)</p>
        </div>
        <h2 className="wt-sec-title">전체 상품</h2>
        {items.length === 0 ? (
          <p className="notice">상품을 불러오지 못했어요 — 잠시 후 다시 시도해주세요</p>
        ) : (
          <div className="grid">
            {items.map((p, i) => (
              <a key={p.id} className="wt-card" href={`/wholesale/product/${p.id}`}>
                {p.image_url ? (
                  <img className="wt-thumb" src={img(p.image_url, 300)} alt={p.name} width={300} height={300}
                    loading={i < 4 ? 'eager' : 'lazy'} fetchPriority={i < 4 ? 'high' : 'auto'} decoding="async" />
                ) : <div className="wt-thumb" />}
                <div className="wt-meta">
                  <p className="wt-name">{p.name}</p>
                  {p.distributor_price != null ? (
                    <p className="wt-price">
                      <strong>{p.distributor_price.toLocaleString('ko-KR')}원</strong>
                      {p.retail_price ? <span className="wt-retail"> 권장 {p.retail_price.toLocaleString('ko-KR')}원</span> : null}
                    </p>
                  ) : (
                    <span className="wt-lock">🔒 로그인하고 공급가 확인</span>
                  )}
                  <p className="wt-sub">{p.category || ''}{(p.sold_count ?? 0) > 0 ? ` · 판매 ${p.sold_count}` : ''}</p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
