// 🚀 SSR 파일럿 — 링크샵(/u/:handle) 비로그인 공개 뷰. 본 사이트 CuratorPage 실디자인 이식:
//   프로필 카드형 헤더(아바타+이름+@handle+소개 가운데 정렬, 2026-06-10 개편) +
//   탭(홈/상품/식사권 — ?tab= 쿼리로 SSR 렌더) + 핀 그리드(순번 뱃지·대표색 그라데이션·💬노트) +
//   하단 "나도 내 링크샵 만들기" CTA.
//   데이터 키 /api/curator/:handle 는 본 사이트 cron dynamic prewarm(top10 큐레이터)과 동일 형태.
import type { LoaderFunctionArgs } from 'react-router'
import { useLoaderData, Link } from 'react-router'
import { cardGradient } from '../lib/card-gradient'
import { API, img, formatWon, TopBar, BottomNav, IconShare } from '../lib/ui'

type Curator = {
  id: number; handle: string; name: string; bio: string | null; profile_image: string | null
}
type Pin = {
  id: number; product_id: number; position: number; note: string | null; click_count: number
  product_name: string; image_url: string | null; thumbnail: string | null
  price: number; original_price: number | null; category?: string | null
  deal_only?: number; dominant_color?: string | null
}
type CuratorResponse = {
  success?: boolean; error?: string
  curator?: Curator; pins?: Pin[]
  linked_seller?: { id: number; username: string; name: string } | null
}

const TABS = [
  { key: 'home', label: '홈' },
  { key: 'vouchers', label: '식사권' },
  { key: 'shop', label: '상품' },
] as const
type TabKey = (typeof TABS)[number]['key']

export function meta({ data }: { data?: Awaited<ReturnType<typeof loader>> }) {
  const c = data?.data?.curator
  return [
    { title: c ? `${c.name} (@${c.handle}) 의 링크샵 — 유어딜` : '링크샵 — 유어딜' },
    { name: 'description', content: c?.bio || (c ? `${c.name} 님이 추천하는 상품` : '유어딜 링크샵') },
  ]
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const handle = params.handle || ''
  const url = new URL(request.url)
  const rawTab = url.searchParams.get('tab') || 'home'
  const tab: TabKey = TABS.some(t => t.key === rawTab) ? (rawTab as TabKey) : 'home'
  // ⚠️ cron dynamic prewarm 키(/api/curator/<handle>)와 동일 — top10 큐레이터는 엣지캐시 적중.
  const res = await fetch(`${API}/api/curator/${encodeURIComponent(handle)}`, { headers: { accept: 'application/json' } })
  const data = (await res.json().catch(() => null)) as CuratorResponse | null
  return { handle, tab, data: data?.success ? data : null }
}

// 본 사이트 분류 1:1 — deal_only 또는 voucher 카테고리 = 식사권(교환권) 핀.
function isVoucherPin(p: Pin): boolean {
  return p.deal_only === 1 || /voucher/i.test(p.category || '')
}

function PinCard({ pin, index, handle, aboveFold }: { pin: Pin; index: number; handle: string; aboveFold: boolean }) {
  const grad = cardGradient(pin.dominant_color)
  const productImg = pin.thumbnail || pin.image_url || ''
  return (
    <a className="pin-card" href={`${API}/u/${handle}/p/${pin.product_id}`} style={{ backgroundColor: grad.base }}>
      <div className="thumb-box" style={{ backgroundColor: grad.base }}>
        <span className="badge-rank">{index + 1}</span>
        {productImg ? (
          <img className="thumb" src={img(productImg, 200)} alt={pin.product_name} width={200} height={200}
            loading={aboveFold ? 'eager' : 'lazy'} fetchPriority={aboveFold ? 'high' : 'auto'} decoding="async" />
        ) : (
          <div className="thumb-fallback" style={{ color: grad.sub, fontSize: 12 }}>no image</div>
        )}
        <div className="img-fade" style={{ background: grad.imageFade }} />
      </div>
      <div className="pin-meta" style={{ color: grad.text }}>
        <p className="pin-name">{pin.product_name}</p>
        <p className="pin-price" style={{ color: grad.accent }}>{formatWon(pin.price)}</p>
        {pin.note && <p className="pin-note" style={{ color: grad.sub }}>💬 {pin.note}</p>}
      </div>
    </a>
  )
}

export default function Linkshop() {
  const { handle, tab, data } = useLoaderData<typeof loader>()

  if (!data?.curator) {
    return (
      <div className="dark-page">
        <TopBar />
        <div className="center-screen">
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>😢 링크샵을 찾을 수 없어요</h1>
          <p style={{ color: '#9ca3af', marginBottom: 24 }}>@{handle}</p>
          <Link to="/" style={{ padding: '12px 24px', background: '#fff', color: '#020202', borderRadius: 12, fontWeight: 700, fontSize: 14 }}>홈으로</Link>
        </div>
        <BottomNav />
      </div>
    )
  }

  const { curator, linked_seller } = data
  const pins = data.pins || []
  const voucherPins = pins.filter(isVoucherPin)
  const shopPins = pins.filter(p => !isVoucherPin(p))
  // 홈 탭 = 교환권/공구 핀 우선 (2026-06-10 동네딜 집중 재정향과 동일 정렬).
  const visible = tab === 'vouchers' ? voucherPins : tab === 'shop' ? shopPins : [...voucherPins, ...shopPins]
  const counts: Record<TabKey, number> = { home: pins.length, vouchers: voucherPins.length, shop: shopPins.length }

  return (
    <div className="dark-page">
      <TopBar />

      <header className="profile-head">
        <div className="avatar">
          {curator.profile_image ? (
            <img src={img(curator.profile_image, 192)} alt="" loading="eager" decoding="async" />
          ) : (
            <div className="avatar-initial">{(curator.name || '?').slice(0, 1)}</div>
          )}
        </div>
        <h1 className="profile-name">{curator.name}</h1>
        <p className="profile-handle">@{curator.handle}</p>
        {curator.bio && <p className="profile-bio">{curator.bio}</p>}
        <div className="profile-cta">
          <a className="btn-kakao" href={`${API}/u/${curator.handle}`}>링크샵 둘러보기</a>
          <a className="btn-ghost" href={`${API}/u/${curator.handle}`} aria-label="공유"><IconShare /></a>
        </div>
        {/* 셀러 연동 계정 — 본 사이트는 SellerPublicPage 를 inline 렌더 (파일럿 범위 밖). */}
        {linked_seller?.username && (
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 12 }}>
            🏪 셀러 페이지가 연결된 계정 — <a href={`${API}/u/${curator.handle}`} style={{ color: '#fff', fontWeight: 700 }}>본 사이트에서 전체 보기 →</a>
          </p>
        )}
      </header>

      <div className="curator-tabs">
        {TABS.map(t => (
          <Link key={t.key} className={`main-tab${tab === t.key ? ' is-active' : ''}`}
            to={t.key === 'home' ? `/u/${curator.handle}` : `/u/${curator.handle}?tab=${t.key}`}>
            {t.label}{t.key !== 'home' && counts[t.key] > 0 ? ` ${counts[t.key]}` : ''}
          </Link>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="notice">아직 추천 상품이 없어요</p>
      ) : (
        <div className="pin-grid">
          {visible.map((pin, idx) => (
            <PinCard key={pin.id} pin={pin} index={idx} handle={curator.handle} aboveFold={idx < 4} />
          ))}
        </div>
      )}

      <div className="linkshop-cta">
        <a href={`${API}/u/me`}>✨ 나도 내 링크샵 만들기 — 추천하면 적립</a>
      </div>
      <BottomNav />
    </div>
  )
}
