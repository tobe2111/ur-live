// 🚀 SSR Phase 2 — 도매 상품 상세(/wholesale/product/:id) 비로그인 공개 뷰.
//   본 사이트 WholesaleProductPage WT 디자인 이식: 이미지 + 가격 잠금 pill + 정보 리스트
//   (재고/누적 사입/박스 단위/배송 정책) + 로그인 유도 CTA.
//   데이터: GET /api/wholesale/catalog/:id — guest 응답은 가격 전부 null(공유캐시 안전,
//   브라우저 60s + edge 300s — SSR 워커 HTML 캐시 60s 와 정합).
import type { LoaderFunctionArgs } from 'react-router'
import { useLoaderData, Link } from 'react-router'
import { API, img, formatNumber } from '../lib/ui'

type Item = {
  id: number; name: string; description?: string | null; image_url?: string | null
  category?: string | null; stock: number; distributor_price: number | null
  retail_price?: number | null; moq?: number; pack_size?: number; order_multiple?: number
  sold_count?: number
  supplier_policy?: { min_order_amount?: number; shipping_fee?: number; free_ship_threshold?: number } | null
}

export function meta({ data }: { data?: Awaited<ReturnType<typeof loader>> }) {
  const it = data?.item
  return [
    { title: it ? `${it.name} — 유통스타트 도매몰` : '도매 상품 — 유통스타트' },
    { name: 'description', content: it ? `${it.name} — 사업자 가입 후 등급별 공급가로 사입하세요` : '유통스타트 B2B 도매몰' },
  ]
}

export async function loader({ params, request }: LoaderFunctionArgs & { request: Request }) {
  const id = Number(params.id)
  if (!Number.isFinite(id) || id <= 0) return { item: null }
  // 🔐 Phase 2-F: wholesale.tsx 와 동일 — ud_seller_token 쿠키 forward → 등급가 포함 응답.
  //   비로그인은 기존 guest 호출 byte-identical(공유캐시 적중 유지).
  const cookie = request.headers.get('cookie') || ''
  const authed = /(?:^|;\s*)ud_(?:seller|agency)_token=/.test(cookie)
  const res = await fetch(`${API}/api/wholesale/catalog/${id}`, {
    headers: { accept: 'application/json', ...(authed ? { cookie } : {}) },
  })
  const data = (await res.json().catch(() => null)) as { success?: boolean; item?: Item } | null
  return { item: data?.success ? (data.item || null) : null }
}

export default function WholesaleProduct() {
  const { item } = useLoaderData<typeof loader>()
  if (!item) {
    return (
      <div className="light-page">
        <div className="wt-topbar">
          <Link to="/wholesale" className="wt-logo">유통스타트<span className="dot">.</span></Link>
        </div>
        <div className="center-screen" style={{ color: '#17181C' }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>상품을 찾을 수 없습니다</h1>
          <Link to="/wholesale" style={{ marginTop: 16, padding: '12px 24px', background: '#17181C', color: '#fff', borderRadius: 12, fontWeight: 700, fontSize: 14 }}>카탈로그로</Link>
        </div>
      </div>
    )
  }

  const moq = Math.max(1, item.moq || 1)
  const pol = item.supplier_policy
  const infoRows: Array<[string, string]> = [
    ['재고', `${formatNumber(item.stock)}개`],
    ...(item.sold_count ? [['누적 사입', `${formatNumber(item.sold_count)}개`] as [string, string]] : []),
    ...(item.category ? [['카테고리', item.category] as [string, string]] : []),
    ...(moq > 1 ? [['최소 주문수량(MOQ)', `${formatNumber(moq)}개`] as [string, string]] : []),
    ...((item.pack_size || 1) > 1 ? [['박스 입수', `${formatNumber(item.pack_size)}개`] as [string, string]] : []),
    ...(pol?.min_order_amount ? [['제조사 최소 주문금액', `${formatNumber(pol.min_order_amount)}원`] as [string, string]] : []),
    ...(pol?.shipping_fee ? [['배송비', `${formatNumber(pol.shipping_fee)}원${pol.free_ship_threshold ? ` (${formatNumber(pol.free_ship_threshold)}원 이상 무료)` : ''}`] as [string, string]] : []),
  ]

  return (
    <div className="light-page" style={{ paddingBottom: 96 }}>
      <div className="wt-topbar">
        <Link to="/wholesale" className="wt-logo">유통스타트<span className="dot">.</span></Link>
        <a className="wt-login" href={`${API}/wholesale/login`}>유통회원 로그인</a>
      </div>
      <div className="wrap-narrow">
        <div className="wt-detail-img">
          {item.image_url ? (
            <img src={img(item.image_url, 800)} alt={item.name} width={800} height={800}
              loading="eager" fetchPriority="high" decoding="async" />
          ) : <div className="wt-detail-img-fallback">📦</div>}
        </div>

        <div className="wt-panel">
          <h1 className="wt-detail-name">{item.name}</h1>
          <div style={{ marginTop: 12 }}>
            <span className="wt-lock">🔒 로그인하고 공급가 확인</span>
            <p className="wt-sub" style={{ marginTop: 8 }}>사업자 가입 승인 후 등급별 공급가·수량 할인·마진이 공개됩니다.</p>
          </div>
        </div>

        {infoRows.length > 0 && (
          <div className="wt-panel">
            <p className="wt-sec-title" style={{ padding: 0, marginBottom: 8 }}>상품 정보</p>
            <dl className="wt-info-list">
              {infoRows.map(([k, v]) => (
                <div key={k} className="wt-info-row"><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
          </div>
        )}

        {item.description && (
          <div className="wt-panel">
            <p className="wt-sec-title" style={{ padding: 0, marginBottom: 8 }}>상세 설명</p>
            <p className="wt-desc">{item.description}</p>
          </div>
        )}
      </div>

      {/* 하단 고정 CTA — 가입/로그인 (주문은 본 사이트) */}
      <div className="cta-bar cta-bar-light">
        <a className="cta-btn cta-btn-wt" href={`${API}/wholesale/join`}>사업자 가입하고 공급가 보기</a>
      </div>
    </div>
  )
}
