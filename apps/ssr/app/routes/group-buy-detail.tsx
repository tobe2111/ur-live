// 🚀 SSR Phase 2 — 공구 상세(/group-buy/:id). 본 사이트 GroupBuyDetailPage 실디자인 이식:
//   full-bleed 히어로 + 카테고리/상태 뱃지 + 즉시판매 단일가 블록(절약액 강조, 핑크) +
//   매장 정보 + 공구 안내 + trust 뱃지 3종 + sticky 참여 CTA.
//   데이터: GET /api/group-buy/products/:id — 본 사이트와 동일 키
//   (브라우저 60s + CDN 900s 캐시 — SSR 워커 HTML 캐시 60s 와 정합).
import type { LoaderFunctionArgs } from 'react-router'
import { useLoaderData, Link } from 'react-router'
import { API, img, formatNumber, formatTimeLeft, IconMapPin, IconClock, IconCheck } from '../lib/ui'

type Detail = {
  id: number; name: string; description?: string | null; image_url?: string | null
  price: number; original_price?: number | null; category: string
  restaurant_name?: string | null; restaurant_address?: string | null; restaurant_phone?: string | null
  voucher_expiry?: string | null; voucher_terms?: string | null
  group_buy_target: number; group_buy_current: number; group_buy_deadline?: string | null
  group_buy_status: 'active' | 'achieved' | 'expired' | 'cancelled'
  current_discount_pct: number
  seller_name?: string | null; seller_username?: string | null; seller_avatar?: string | null
}

const CATEGORY_EMOJI: Record<string, string> = {
  meal_voucher: '🍽️', beauty_voucher: '💇', stay_voucher: '🏨', etc_voucher: '🎯',
}

export function meta({ data }: { data?: Awaited<ReturnType<typeof loader>> }) {
  const d = data?.detail
  return [
    { title: d ? `${d.name} — 동네딜 공구 | 유어딜` : '공구 상세 — 유어딜' },
    { name: 'description', content: d ? `${d.restaurant_name || ''} ${d.name} — ${d.current_discount_pct > 0 ? `${d.current_discount_pct}% 할인 ` : ''}동네 공동구매` : '유어딜 동네 공동구매' },
  ]
}

export async function loader({ params }: LoaderFunctionArgs) {
  const id = Number(params.id)
  if (!Number.isFinite(id) || id <= 0) return { detail: null }
  const res = await fetch(`${API}/api/group-buy/products/${id}`, { headers: { accept: 'application/json' } })
  const data = (await res.json().catch(() => null)) as { success?: boolean; data?: Detail } | null
  return { detail: data?.success ? (data.data || null) : null }
}

export default function GroupBuyDetail() {
  const { detail } = useLoaderData<typeof loader>()
  if (!detail) {
    return (
      <div className="dark-page">
        <div className="center-screen">
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>상품을 찾을 수 없어요</h1>
          <Link to="/group-buy" style={{ marginTop: 16, padding: '12px 24px', background: '#fff', color: '#020202', borderRadius: 12, fontWeight: 700, fontSize: 14 }}>동네딜로</Link>
        </div>
      </div>
    )
  }

  // 본 사이트 단일가 계산 1:1 — unitPrice = price × (1 - 고정 할인%), 절약액 = 정가 대비.
  const unitPrice = Math.round(detail.price * (1 - (detail.current_discount_pct || 0) / 100))
  const refPrice = detail.original_price && detail.original_price > unitPrice ? detail.original_price : detail.price
  const unitSaving = Math.max(0, refPrice - unitPrice)
  const timeLeft = formatTimeLeft(detail.group_buy_deadline)
  const emoji = CATEGORY_EMOJI[detail.category] || '🛍️'
  const active = detail.group_buy_status === 'active' || detail.group_buy_status === 'achieved'

  return (
    <div className="detail-page">
      {/* full-bleed 히어로 (당근 스타일 — 최상단까지) */}
      <div className="hero">
        {detail.image_url ? (
          <img src={img(detail.image_url, 800)} alt={detail.name} width={800} height={800}
            loading="eager" fetchPriority="high" decoding="async" />
        ) : (
          <div className="hero-fallback">{emoji}</div>
        )}
        <div className="hero-scrim" />
        <Link to="/group-buy" className="hero-back" aria-label="뒤로">‹</Link>
        <div className="hero-badges">
          <span className="hero-badge dark">{emoji} {detail.category.replace('_voucher', '')}</span>
          {detail.group_buy_status === 'achieved' && <span className="hero-badge green"><IconCheck /> 달성</span>}
          {detail.group_buy_status === 'expired' && <span className="hero-badge gray">마감</span>}
          {detail.group_buy_status === 'cancelled' && <span className="hero-badge red">취소</span>}
        </div>
      </div>

      <main className="detail-main">
        {/* 제품 정보 + 가격 (즉시판매 단일가) */}
        <section className="panel">
          <h1 className="detail-title">{detail.name}</h1>
          {detail.restaurant_name && (
            <div className="detail-place">
              <IconMapPin style={{ flexShrink: 0, marginTop: 2, color: '#9ca3af' }} />
              <div>
                <p className="place-name">{detail.restaurant_name}</p>
                {detail.restaurant_address && <p className="place-addr">{detail.restaurant_address}</p>}
              </div>
            </div>
          )}
          {detail.restaurant_phone && (
            <a className="detail-phone" href={`tel:${detail.restaurant_phone}`}>📞 {detail.restaurant_phone}</a>
          )}
          <div className="price-block">
            <div className="price-row">
              {unitSaving > 0 && <span className="price-strike">{formatNumber(refPrice)}원</span>}
              <span className="price-main">{formatNumber(unitPrice)}</span>
              <span className="price-unit">원</span>
              {detail.current_discount_pct > 0 && <span className="price-off">🎉 {detail.current_discount_pct}% OFF</span>}
            </div>
            {unitSaving > 0 && (
              <div className="saving-pill">✨ 정가보다 <b>{formatNumber(unitSaving)}원</b> 절약</div>
            )}
            {timeLeft && <p className="deadline-row"><IconClock style={{ color: '#9ca3af' }} /> {timeLeft}</p>}
          </div>
        </section>

        {/* 공구 안내 (셀러 작성) */}
        {detail.description && (
          <section className="panel">
            <p className="panel-title">공구 안내</p>
            <p className="panel-body">{detail.description}</p>
          </section>
        )}

        {/* trust 뱃지 3종 (본 사이트 정적 줄 1:1) */}
        <div className="trust-row">
          {[['🛡️', '안전결제', '토스페이먼츠'], ['✅', '정식 판매', '검증 셀러'], ['🔄', '안심 거래', '환불 정책 보장']].map(([ic, label, sub]) => (
            <div key={label} className="trust-item"><span>{ic}</span><b>{label}</b><small>{sub}</small></div>
          ))}
        </div>

        {/* 교환권 조건 */}
        {(detail.voucher_terms || detail.voucher_expiry) && (
          <section className="panel">
            <p className="panel-title">사용 안내</p>
            {detail.voucher_expiry && <p className="panel-body" style={{ marginBottom: 6 }}>유효기간: {detail.voucher_expiry}</p>}
            {detail.voucher_terms && <p className="panel-body">{detail.voucher_terms}</p>}
          </section>
        )}

        {/* 판매자 */}
        {detail.seller_name && (
          <section className="panel seller-row">
            {detail.seller_avatar
              ? <img className="seller-avatar" src={img(detail.seller_avatar, 80)} alt="" width={40} height={40} loading="lazy" decoding="async" />
              : <div className="seller-avatar seller-avatar-fallback">{detail.seller_name.slice(0, 1)}</div>}
            <div>
              <p className="place-name">{detail.seller_name}</p>
              <p className="place-addr">판매자</p>
            </div>
          </section>
        )}
      </main>

      {/* sticky 참여 CTA — 결제/수량은 본 사이트(파일럿은 공개 뷰) */}
      <div className="cta-bar">
        <a className={`cta-btn${active ? '' : ' is-disabled'}`} href={`${API}/group-buy/${detail.id}`}>
          {active ? `${formatNumber(unitPrice)}원 — 참여하기` : '마감된 공구예요'}
        </a>
      </div>
    </div>
  )
}
