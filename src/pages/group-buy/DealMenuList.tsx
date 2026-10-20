/**
 * 🖥️ 2026-07-19 (그루폰식 상세 개편 — 파일크기 래칫): GroupBuyDetailPage 의 '대표 메뉴' 섹션 추출.
 *   data-gate(백엔드 menu 있을 때만) 포함 이동 — 렌더 로직 byte-동일(설계: docs/design/group-buy-detail.md).
 */
import { cfImage } from '@/utils/cf-image'

export interface DealMenuItem { name: string; desc?: string; price?: string; image?: string; hot?: boolean }

export default function DealMenuList({ menuItems }: { menuItems: DealMenuItem[] }) {
  if (!menuItems.length) return null
  return (
    <>
      <div style={{ height: 8, background: 'var(--gbd-bg)' }} />
      <div style={{ padding: '22px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gbd-ink)', letterSpacing: '-.02em' }}>대표 메뉴</div>
          <span style={{ fontSize: 12, color: 'var(--gbd-sub)' }}>교환권으로 주문 가능</span>
        </div>
        <div style={{ marginTop: 8, borderBottom: '1px solid var(--gbd-line2)' }}>
          {menuItems.map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 0', borderTop: '1px solid var(--gbd-line2)' }}>
              <div style={{ width: 56, height: 56, borderRadius: 11, flex: '0 0 auto', backgroundColor: 'var(--gbd-chip)', backgroundImage: m.image ? `url("${cfImage(m.image, { width: 120, format: 'auto' }) || m.image}")` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--gbd-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                  {m.hot && <span style={{ flex: '0 0 auto', padding: '2px 6px', borderRadius: 5, background: 'var(--gbd-danger-soft)', color: 'var(--gbd-danger)', fontSize: 10.5, fontWeight: 800 }}>인기</span>}
                </div>
                {m.desc && <div style={{ fontSize: 12.5, color: 'var(--gbd-sub)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.desc}</div>}
              </div>
              {m.price && <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--gbd-ink)', whiteSpace: 'nowrap' }}>{m.price}</span>}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
