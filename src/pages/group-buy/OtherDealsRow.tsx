/**
 * 🖥️ 2026-07-19 (그루폰식 상세 개편 — 파일크기 래칫): GroupBuyDetailPage 의 '이 셀러의 다른 공구'
 *   가로 스크롤 섹션 추출 — 렌더 로직 byte-동일(otherDeals fetch/IO 게이팅은 부모 소유).
 *
 * ■ 2026-09-01 — 할인율을 사진 밖으로 (대표 2026-08-31 *"할인율이 사진 안으로 들어가면 안돼"*)
 *   이 파일은 **같은 규칙을 어긴 세 번째 카드 구현**이었다. 08-31 에 동네딜 카드
 *   (`GroupBuyFeedCard`)를, 09-01 에 교환권 카드/행(`vouchers/shared.tsx`)을 고쳤는데
 *   상세 페이지의 '이 셀러의 다른 공구' 는 **또 다른 구현**이라 둘 다 비껴갔다.
 *   ⚠️ 게다가 이 파일은 Tailwind 가 아니라 **인라인 스타일**이라 className 을 보는 검사엔
 *      애초에 안 잡힌다 — 그래서 가드도 함께 넓혔다(`check-discount-not-on-photo`).
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
        <div className="scrollbar-hide" style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '14px 18px 2px', scrollSnapType: 'x proximity' }}>
          {deals.map((o) => {
            const pct = o.discount_pct || (o.original_price && o.original_price > o.price ? Math.round((1 - o.price / o.original_price) * 100) : 0)
            return (
              <a key={o.id} href={`/group-buy/${o.id}`} style={{ flex: '0 0 152px', textDecoration: 'none', scrollSnapAlign: 'start' }}>
                <div style={{ position: 'relative', width: 152, height: 152, borderRadius: 14, overflow: 'hidden', backgroundColor: 'var(--gbd-chip)', backgroundImage: o.image_url ? `url("${cfImage(o.image_url, { width: 300, format: 'auto' }) || o.image_url}")` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                </div>
                <div style={{ marginTop: 9, fontSize: 13, fontWeight: 600, color: 'var(--gbd-ink)', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 4 }}>
                  {pct > 0 && <span style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--gbd-danger)' }}>{pct}%</span>}
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
