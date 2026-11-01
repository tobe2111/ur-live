/**
 * 🎯 2026-07-01 (대표 — 동네딜 추첨 응모): 상세 페이지 추첨 응모 블록.
 *
 *   이 상품이 추첨 대상(fcfs_enabled)일 때만 노출 — 아니면 렌더 0(null). 결제 없음(응모형).
 *   상세 페이지의 --gbd-* CSS 변수로 페이지와 동일 톤. 잠긴 결제(Toss)/SSR 무접촉(독립 컴포넌트).
 */
import { formatNumber } from '@/utils/format'
import { useFcfsDetail } from './useFcfsDetail'


export default function FcfsApplyBlock({ productId }: { productId: number }) {
  // 🎯 2026-10-27: 상태는 `useFcfsDetail` 이 든다 — 하단 버튼(응모하기)과 같은 값을 본다.
  const { info, enabled, applied, isWinner, isPaid, closed, busy, apply } = useFcfsDetail(productId)
  if (!enabled || !info) return null

  return (
    <div style={{ padding: '4px 18px 20px' }}>
      <div style={{ borderRadius: 16, border: '1px solid var(--gbd-line)', background: 'var(--gbd-card)', padding: '15px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--gbd-ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
            추첨 응모 <span style={{ color: 'var(--gbd-sub)', fontWeight: 700 }}>{formatNumber(info.appliedDisplay)}/{formatNumber(info.spots)}명</span>
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--gbd-sub)', lineHeight: 1.5 }}>
            {isPaid ? '🎉 당첨 · 구매 완료' : isWinner ? '🎉 당첨! 아래 구매 버튼으로 결제해주세요 — 미결제 시 예비 당첨자에게 넘어갈 수 있어요' : closed ? '응모가 마감되었어요' : applied ? '응모 완료 · 당첨 시 안내드려요' : '결제 없이 응모하면 추첨으로 선정돼요 · 당첨자만 구매 가능'}
          </p>
        </div>
        <button
          type="button"
          onClick={apply}
          disabled={busy || applied || closed}
          style={{ flex: '0 0 auto', padding: '11px 16px', borderRadius: 12, fontSize: 13, fontWeight: 500, border: 'none', cursor: busy || applied || closed ? 'default' : 'pointer', background: isWinner ? '#16a34a' : 'var(--gbd-ink)', color: isWinner ? '#fff' : 'var(--gbd-card)', opacity: (applied && !isWinner) || closed ? 0.45 : 1 }}
        >
          {isPaid ? '구매 완료' : isWinner ? '🎉 당첨' : applied ? '응모 완료' : closed ? '마감' : busy ? '처리 중…' : '응모하기'}
        </button>
      </div>
    </div>
  )
}
