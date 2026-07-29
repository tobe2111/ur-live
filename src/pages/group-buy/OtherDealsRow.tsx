/**
 * 🖥️ 2026-07-19 (그루폰식 상세 개편 — 파일크기 래칫): GroupBuyDetailPage 의 '이 셀러의 다른 공구'
 *   가로 스크롤 섹션 추출 — 렌더 로직 byte-동일(otherDeals fetch/IO 게이팅은 부모 소유).
 */
import { cfImage } from '@/utils/cf-image'
import { formatNumber } from '@/utils/format'

export interface OtherDeal { id: number; name: string; price: number; original_price?: number | null; image_url?: string | null; discount_pct?: number | null }

export default function OtherDealsRow({ deals, sellerHandle, sellerUsername }: {
  deals: OtherDeal[]
  sellerHandle?: string | null
  sellerUsername?: string | null
}) {
  if (!deals.length) return null
  return (
    <>
      <div style={{ height: 8, background: 'var(--gbd-bg)' }} />
      <div style={{ padding: '22px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gbd-ink)', letterSpacing: '-.02em' }}>이 셀러의 다른 공구</div>
          {(sellerHandle || sellerUsername) && <a href={sellerHandle ? `/u/${sellerHandle}` : `/profile/${sellerUsername}`} style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gbd-accent)', textDecoration: 'none', whiteSpace: 'nowrap' }}>전체보기</a>}
        </div>
        <div className="noscroll" style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '14px 18px 2px', scrollSnapType: 'x proximity' }}>
          {deals.map((o) => {
            const pct = o.discount_pct || (o.original_price && o.original_price > o.price ? Math.round((1 - o.price / o.original_price) * 100) : 0)
            return (
              <a key={o.id} href={`/group-buy/${o.id}`} style={{ flex: '0 0 152px', textDecoration: 'none', scrollSnapAlign: 'start' }}>
                <div style={{ position: 'relative', width: 152, height: 152, borderRadius: 14, overflow: 'hidden', backgroundColor: 'var(--gbd-chip)', backgroundImage: o.image_url ? `url("${cfImage(o.image_url, { width: 300, format: 'auto' }) || o.image_url}")` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                  {pct > 0 && <span style={{ position: 'absolute', left: 8, top: 8, padding: '3px 7px', borderRadius: 6, background: 'var(--gbd-danger)', color: '#fff', fontSize: 11, fontWeight: 800 }}>{pct}%</span>}
                </div>
                <div style={{ marginTop: 9, fontSize: 13, fontWeight: 600, color: 'var(--gbd-ink)', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 4 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--gbd-ink)' }}>{formatNumber(o.price)}원</span>
                  {o.original_price && o.original_price > o.price && <span style={{ fontSize: 11.5, color: 'var(--gbd-sub2)', textDecoration: 'line-through' }}>{formatNumber(o.original_price)}원</span>}
                </div>
              </a>
            )
          })}
        </div>
      </div>
    </>
  )
}
