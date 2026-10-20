// 🚀 SSR 파일럿 — 동네딜(/group-buy) 리스트. 본 사이트 GroupBuyListPage 실디자인 이식:
//   메인 탭(동네 공구/같이 모으기) + 카테고리 칩 + GroupBuyGridCard
//   (대표색 그라데이션, 최대 -N% 핑크 뱃지, 달성 뱃지, 업장명/주소/판매자/남은시간).
import type { LoaderFunctionArgs } from 'react-router'
import { useLoaderData, Link } from 'react-router'
import { cardGradient } from '../lib/card-gradient'
import {
  API, img, formatNumber, formatTimeLeft,
  TopBar, BottomNav, IconMapPin, IconClock, IconStore, IconBell, IconCheck,
} from '../lib/ui'

type Item = {
  id: number; name: string; price: number; original_price?: number | null
  image_url?: string | null; category?: string | null; dominant_color?: string | null
  seller_name?: string | null; restaurant_name?: string | null; restaurant_address?: string | null
  group_buy_target?: number; group_buy_current?: number; group_buy_deadline?: string | null
}

// 본 사이트 카테고리 칩 1:1 (숙소는 본 사이트 /stays 전담).
const CATEGORIES = [
  { key: 'all', label: '전체' },
  { key: 'meal_voucher', label: '🍽️ 식사권' },
  { key: 'beauty_voucher', label: '💇 미용' },
  { key: 'stay_voucher', label: '🏨 숙소' },
  { key: 'etc_voucher', label: '🎯 기타' },
] as const

export function meta() {
  return [
    { title: '동네딜 — 유어딜' },
    { name: 'description', content: '우리 동네 오프라인 공구 — 같이 사면 더 싸다 (SSR 파일럿)' },
  ]
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const raw = url.searchParams.get('category') || 'all'
  const category = CATEGORIES.some(c => c.key === raw) ? raw : 'all'
  // ⚠️ 예열 키와 byte-identical:
  //   전체   → /api/group-buy/products?status=active            (HOT_PATHS — SSR 슬롯 키)
  //   카테고리 → /api/group-buy/products?status=active&category=X (HOT_PATHS — 칩 prewarm 4종)
  const key = category === 'all'
    ? '/api/group-buy/products?status=active'
    : `/api/group-buy/products?status=active&category=${category}`
  const res = await fetch(`${API}${key}`, { headers: { accept: 'application/json' } })
  const data = (await res.json().catch(() => null)) as { success?: boolean; data?: Item[] } | null
  return { items: data?.success ? (data.data || []) : [], category }
}

function calcDiscountRate(p: Item): number {
  if (!p.original_price || p.original_price <= p.price) return 0
  return Math.round((1 - p.price / p.original_price) * 100)
}

function GroupBuyGridCard({ p, idx }: { p: Item; idx: number }) {
  const grad = cardGradient(p.dominant_color)
  const discount = calcDiscountRate(p)
  const target = p.group_buy_target || 0
  const current = p.group_buy_current || 0
  const achieved = target > 0 && current >= target
  const timeLeft = formatTimeLeft(p.group_buy_deadline)
  return (
    <a className="card" href={`/group-buy/${p.id}`} style={{ backgroundColor: grad.base }}>
      <div className="thumb-box" style={{ backgroundColor: grad.base }}>
        {p.image_url ? (
          <img className="thumb" src={img(p.image_url, 400)} alt={p.name} width={400} height={400}
            loading={idx < 4 ? 'eager' : 'lazy'} fetchPriority={idx < 2 ? 'high' : 'auto'} decoding="async" />
        ) : (
          <div className="thumb-fallback" style={{ color: grad.sub }}>🍽️</div>
        )}
        <div className="img-fade" style={{ background: grad.imageFade }} />
        {discount > 0 && <span className="badge-discount">최대 -{discount}%</span>}
        {achieved && <span className="badge-achieved"><IconCheck /> 달성</span>}
        <span className="bell-fab" aria-hidden><IconBell /></span>
      </div>
      <div className="card-meta" style={{ color: grad.text }}>
        <p className="card-name" style={{ fontSize: 12 }}>{p.name}</p>
        {p.restaurant_name && <p className="card-line" style={{ color: grad.sub, fontWeight: 500 }}><span className="txt">{p.restaurant_name}</span></p>}
        {p.restaurant_address && (
          <p className="card-line" style={{ color: grad.sub }}><IconMapPin style={{ flexShrink: 0, width: 12, height: 12 }} /><span className="txt">{p.restaurant_address}</span></p>
        )}
        {!!p.original_price && p.original_price > p.price && (
          <p className="card-strike" style={{ color: grad.sub, marginTop: 4 }}>{formatNumber(p.original_price)}원</p>
        )}
        <div className="card-price-row">
          {discount > 0 && <span className="card-pct" style={{ color: grad.accent, fontSize: 13 }}>{discount}%</span>}
          <span className="card-price" style={{ fontSize: 13 }}>{formatNumber(p.price)}원</span>
        </div>
        {p.seller_name && (
          <p className="card-line" style={{ color: grad.sub, marginTop: 6 }}><IconStore style={{ flexShrink: 0, width: 12, height: 12 }} /><span className="txt">판매자 · {p.seller_name}</span></p>
        )}
        {timeLeft && (
          <p className="card-line" style={{ color: grad.sub, marginTop: 4 }}><IconClock style={{ flexShrink: 0, width: 12, height: 12 }} />{timeLeft}</p>
        )}
      </div>
    </a>
  )
}

export default function GroupBuyList() {
  const { items, category } = useLoaderData<typeof loader>()
  return (
    <div className="dark-page">
      <TopBar />
      <div className="wrap">
        <h1 className="page-title">동네딜</h1>
        <p className="page-sub">우리 동네 매장 공구 — 같이 사면 더 싸다</p>
        <div className="main-tabs">
          <span className="main-tab is-active">동네 공구</span>
          <a className="main-tab" href={`${API}/group-buy`}>같이 모으기</a>
        </div>
        <div className="chips">
          {CATEGORIES.map(c => (
            <Link key={c.key} className={`chip${category === c.key ? ' is-active' : ''}`}
              to={c.key === 'all' ? '/group-buy' : `/group-buy?category=${c.key}`}>
              {c.label}
            </Link>
          ))}
        </div>
        {items.length === 0 ? (
          <p className="notice">진행 중인 공구가 없어요</p>
        ) : (
          <div className="grid">
            {items.map((p, i) => <GroupBuyGridCard key={p.id} p={p} idx={i} />)}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
