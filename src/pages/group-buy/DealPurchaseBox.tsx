/**
 * 🖥️ 2026-07-19 (대표 승인 — 그루폰식 이용권 상세): PC(lg+) 우측 sticky 구매 박스.
 *   그루폰 딜 상세의 우측 purchase panel 을 유어딜 즉시판매 단일가 모델로 이식 —
 *   [옵션 카드(단일가 1개) + 수량 스테퍼 + 구매 CTA + 안심 배지]. 모바일(<lg)은 기존 하단 고정
 *   구매바가 담당(이 컴포넌트는 lg+ 전용 — 부모가 hidden lg:block 게이트).
 *   상태/핸들러는 전부 GroupBuyDetailPage 소유(controlled) — 결제 로직(handleJoin) 무수정 재사용.
 *   색은 .gbd CSS 변수(테마 자동) — 상세 표면과 동톤.
 */
import { formatNumber } from '@/utils/format'

interface Props {
  name: string
  discountPct: number
  unitPrice: number
  refPrice: number
  unitSaving: number
  totalSaving: number
  total: number
  quantity: number
  setQuantity: (updater: (q: number) => number) => void
  maxQty: number
  maxPerPerson?: number | null
  buyable: boolean
  isJoinable: boolean
  isPrelaunch: boolean
  /** 🎭 데모 상품 — 소비자에겐 '구매'가 아니라 '응모'로 보여야 한다(대표 2026-08-08). */
  isDemo?: boolean
  joining: boolean
  onBuy: () => void
  onPrelaunchApply: () => void
}

export default function DealPurchaseBox({
  name, discountPct, unitPrice, refPrice, unitSaving, totalSaving, total,
  quantity, setQuantity, maxQty, maxPerPerson,
  buyable, isJoinable, isPrelaunch, isDemo, joining, onBuy, onPrelaunchApply,
}: Props) {
  // 🎭 2026-08-08 (대표 "데모 상품들만 상품페이지에 구매하기 버튼 대신 응모하기로"): 데모는 추첨이라
  //   '구매하기'가 거짓말이 된다(결제가 아니라 응모다). 문구만 바꾼다 — 동작(onBuy)은 그대로.
  const ctaLabel = isDemo ? '응모하기' : '구매하기'
  return (
    <div style={{ border: '1px solid var(--gbd-line2)', borderRadius: 18, padding: 18, background: 'var(--gbd-card)', boxShadow: '0 6px 24px rgba(0,0,0,.06)' }}>
      {/* 옵션(단일가) 카드 — 그루폰 옵션 패널의 유어딜 버전(즉시판매 단일가 모델) */}
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gbd-sub)', marginBottom: 10 }}>구매 옵션</div>
      <div style={{ border: '1.5px solid var(--gbd-accent)', borderRadius: 12, padding: '12px 14px', background: 'var(--gbd-accent-soft, transparent)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--gbd-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{name}</span>
          <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
            {unitSaving > 0 && <s style={{ fontSize: 12, color: 'var(--gbd-sub2)', fontWeight: 600, marginRight: 5 }}>{formatNumber(refPrice)}</s>}
            <b style={{ fontSize: 18, fontWeight: 900, color: 'var(--gbd-ink)' }}>{formatNumber(unitPrice)}원</b>
          </span>
        </div>
        {(discountPct > 0 || unitSaving > 0) && (
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--gbd-danger)', marginTop: 4 }}>
            {discountPct > 0 && <>{discountPct}% 할인</>}
            {unitSaving > 0 && <> · 1매당 {formatNumber(unitSaving)}원 저렴</>}
          </div>
        )}
      </div>

      {/* 수량 스테퍼 — 하단 바와 동일 state 공유 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--gbd-line2)', borderRadius: 10, padding: '8px 12px', margin: '12px 0' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gbd-ink)' }}>
          수량{maxPerPerson && maxPerPerson > 0 ? <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gbd-sub)', marginLeft: 6 }}>1인당 최대 {maxPerPerson}개</span> : null}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 2 }} role="group" aria-label="수량 조절">
          <button onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={!buyable || quantity <= 1} aria-label="수량 감소" style={{ width: 30, height: 30, border: 'none', background: 'transparent', color: 'var(--gbd-ink)', fontSize: 18, cursor: 'pointer', opacity: (!buyable || quantity <= 1) ? .35 : 1 }}>−</button>
          <span style={{ minWidth: 28, textAlign: 'center', fontSize: 14, fontWeight: 800, color: 'var(--gbd-ink)' }} aria-live="polite">{quantity}</span>
          <button onClick={() => setQuantity(q => Math.min(maxQty, q + 1))} disabled={!buyable || quantity >= maxQty} aria-label="수량 증가" style={{ width: 30, height: 30, border: 'none', background: 'transparent', color: 'var(--gbd-ink)', fontSize: 18, cursor: 'pointer', opacity: (!buyable || quantity >= maxQty) ? .35 : 1 }}>+</button>
        </span>
      </div>

      {isJoinable && totalSaving > 0 && (
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gbd-danger)', textAlign: 'center', marginBottom: 8 }}>
          {quantity > 1 ? `총 ${formatNumber(totalSaving)}원 할인 중` : `${formatNumber(unitSaving)}원 할인 중`}
        </div>
      )}

      {/* CTA — 하단 바와 동일 핸들러(결제 로직 무수정) */}
      <button
        onClick={isPrelaunch ? onPrelaunchApply : onBuy}
        disabled={(!isJoinable && !isPrelaunch) || joining}
        aria-label={isPrelaunch ? '사전 응모하기' : isJoinable ? `${formatNumber(total)}원 ${ctaLabel}` : isDemo ? '응모 불가' : '구매 불가'}
        style={{ width: '100%', height: 50, border: 'none', borderRadius: 14, background: (buyable || isPrelaunch) ? 'var(--gbd-cta-bg)' : 'var(--gbd-sub2)', color: 'var(--gbd-cta-fg)', fontSize: 16, fontWeight: 800, letterSpacing: '-.01em', cursor: (buyable || isPrelaunch) ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
      >
        {joining ? '처리 중…' : isPrelaunch ? '🔔 오픈 예정 — 사전 응모하기' : !isJoinable ? (isDemo ? '응모 불가' : '구매 불가') : <>{formatNumber(total)}원 {ctaLabel}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></>}
      </button>

      {/* 안심 배지 — 그루폰 trust rows */}
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--gbd-line2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          '🛡️ 미사용 시 100% 자동환불',
          '⚡ 결제 즉시 교환권(QR) 발급',
          '🔒 토스페이먼츠 3초 안전결제',
        ].map((tr) => (
          <div key={tr} style={{ fontSize: 12.5, color: 'var(--gbd-sub)', fontWeight: 600 }}>{tr}</div>
        ))}
        {isPrelaunch && (
          <div style={{ fontSize: 11.5, color: 'var(--gbd-sub)' }}>오픈 협의 중 매장 · 응모는 무료, 오픈 시 알림을 드려요</div>
        )}
      </div>
    </div>
  )
}
