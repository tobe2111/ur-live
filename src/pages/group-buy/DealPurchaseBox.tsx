/**
 * 🖥️ 2026-07-19 (대표 승인 — 그루폰식 이용권 상세): PC(lg+) 우측 sticky 구매 박스.
 *   그루폰 딜 상세의 우측 purchase panel 을 유어딜 즉시판매 단일가 모델로 이식 —
 *   [옵션 카드(단일가 1개) + 수량 스테퍼 + 구매 CTA + 안심 배지]. 모바일(<lg)은 기존 하단 고정
 *   구매바가 담당(이 컴포넌트는 lg+ 전용 — 부모가 hidden lg:block 게이트).
 *   상태/핸들러는 전부 GroupBuyDetailPage 소유(controlled) — 결제 로직(handleJoin) 무수정 재사용.
 *   색은 .gbd CSS 변수(테마 자동) — 상세 표면과 동톤.
 */
import type { ReactNode } from 'react'
import { BellIcon } from '@/components/icons/urdeal-icons'
import { FieldCard, FieldRow } from '@/components/ticket/FieldCard'
import { formatNumber } from '@/utils/format'

interface Props {
  /** 2026-10-11 D안: '구매 옵션' 상자를 걷어 더는 안 쓴다(호출부 호환을 위해 남김). */
  name?: string
  discountPct: number
  unitPrice: number
  refPrice: number
  unitSaving: number
  totalSaving?: number
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
  /** 🪙 CTA 바로 위 슬롯 — 지금은 딜 사용 선택(`DealUseChooser`). 모바일 결제 바와 같은 자리·같은 순서. */
  dealSlot?: ReactNode
  /** 🪙 2026-10-06: 고른 딜이 총액을 다 덮는다 → 카드를 안 타는 흐름. 버튼이 "N딜로 결제하기" 라고 말한다. */
  allDeal?: boolean
}

export default function DealPurchaseBox({
  discountPct, unitPrice, refPrice, unitSaving, total,
  quantity, setQuantity, maxQty, maxPerPerson,
  buyable, isJoinable, isPrelaunch, isDemo, joining, onBuy, onPrelaunchApply, dealSlot, allDeal = false,
}: Props) {
  // 🎭 2026-08-08 (대표 "데모 상품들만 상품페이지에 구매하기 버튼 대신 응모하기로"): 데모는 '구매하기'가
  //   어울리지 않아 문구를 바꿨다. 동작(onBuy)은 그대로.
  // 🔴 2026-08-11 정정 (AB 스윕): 위 주석의 **전제가 틀렸다.** *"데모는 추첨이라 결제가 아니라 응모다"*
  //   라고 적었는데, `onBuy` → `handleJoin` 은 **실제 결제**로 간다(토스 카드 / 딜 차감).
  //   그래서 화면에 이런 상태가 만들어졌다 — 같은 페이지에 `응모하기` 가 **둘**인데 하나는 공짜다:
  //
  //     중간 FcfsApplyBlock : [응모하기]        "결제 없이 응모하면 추첨으로 선정돼요"  ← 진짜 무료
  //     하단 이 버튼        : [36,500원 응모하기]                                    ← 진짜 결제
  //
  //   "결제 없이 응모"를 읽은 사람이 아래 큰 버튼을 누르면 결제창이 뜬다. 문구 불일치가 아니라
  //   **오인 유도**이고, 결제 오인은 환불 분쟁으로 바로 이어진다.
  //   ⇒ 데모에도 **돈이 나간다는 사실**을 라벨에 박는다. '구매하기'(대표가 데모엔 안 맞다고 한 말)
  //     대신 '결제하기' 를 쓴다 — 무료 응모와 확실히 갈리고, 데모라는 정체성도 해치지 않는다.
  const ctaLabel = isDemo ? '결제하기' : '구매하기'
  // 🪟 2026-09-15 안 3 예외 — **이 박스만 안 2(들림)**. 스크롤을 따라다니며 본문 위에 얹히는
  //   물건이라 정말로 떠 있어야 하고, 체계가 그 자리를 위해 `--lift` 를 정의해 뒀다.
  //   ⚠️ 하드코딩 그림자를 쓰면 안 된다 — 다크는 `--lift: none` 이라 그림자가 꺼져야 하는데
  //   `0 6px 24px rgba(0,0,0,.06)` 은 테마를 모른다(그래서 토큰으로 바꿨다).
  return (
    <div style={{ borderRadius: 18, padding: 18, background: 'var(--gbd-card)', boxShadow: 'var(--lift)' }}>
      {/* 💰 2026-10-11 (대표 확정 D안 — PC 포함): 모바일 머리 카드(`PassHeadCard`)와 **같은 위계**.
          [할인율(빨강 글자) · 판매가 · 정가 취소선] 한 줄 + "1장당 N원 아껴요". 걷어낸 것: 빨간 pill ·
          "결제 즉시 교환권 발급"(용어 오류) · 이름·가격을 한 번 더 말하던 '구매 옵션' 상자. */}
      <div className="flex items-baseline flex-wrap gap-x-2">
        {discountPct > 0 && <span className="text-[24px] font-bold tracking-[-.02em]" style={{ color: 'var(--sale)' }}>{discountPct}%</span>}
        <span className="text-[28px] font-extrabold tracking-[-.03em]" style={{ color: 'var(--gbd-ink)' }}>{formatNumber(unitPrice)}원</span>
        {unitSaving > 0 && <s className="text-[13px]" style={{ color: 'var(--gbd-sub2)' }}>{formatNumber(refPrice)}원</s>}
      </div>
      {unitSaving > 0 && (
        <div className="mt-3 rounded-xl px-3 py-2 text-[13px]" style={{ background: 'var(--gbd-accent-soft)', color: 'var(--gbd-ink2)' }}>
          1장당 <b className="font-bold text-brand-text">{formatNumber(unitSaving)}원</b> 아껴요
        </div>
      )}

      {/* 🎫 2026-09-14 대표 확정 *"두 상세가 같은 부품을 쓰도록 해줘"* — 수량 행이 **숙소 상세의 인원 행과
          같은 부품**(`components/ticket/FieldCard`)이 됐다. 종전엔 여기만 1px 테두리 상자였다(티켓 체계
          규칙 ①은 카드 테두리 0). 라벨·값 위계도 그쪽과 같아진다.
          ⚠️ 스테퍼 **동작·state·aria 는 그대로** — 하단 바와 같은 state 를 공유한다(결제 무관, 마크업만). */}
      <div style={{ margin: '16px 0 12px' }}>
        <FieldCard>
          <FieldRow
            label="수량"
            hint={maxPerPerson && maxPerPerson > 0 ? `1인당 최대 ${maxPerPerson}개` : undefined}
            value={`${quantity}장`}
            right={
              <span style={{ display: 'flex', alignItems: 'center', gap: 2 }} role="group" aria-label="수량 조절">
                <button onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={!buyable || quantity <= 1} aria-label="수량 감소" style={{ width: 30, height: 30, border: 'none', background: 'transparent', color: 'var(--gbd-ink)', fontSize: 18, cursor: 'pointer', opacity: (!buyable || quantity <= 1) ? .35 : 1 }}>−</button>
                <span style={{ minWidth: 28, textAlign: 'center', fontSize: 14, fontWeight: 800, color: 'var(--gbd-ink)' }} aria-live="polite">{quantity}</span>
                <button onClick={() => setQuantity(q => Math.min(maxQty, q + 1))} disabled={!buyable || quantity >= maxQty} aria-label="수량 증가" style={{ width: 30, height: 30, border: 'none', background: 'transparent', color: 'var(--gbd-ink)', fontSize: 18, cursor: 'pointer', opacity: (!buyable || quantity >= maxQty) ? .35 : 1 }}>+</button>
              </span>
            }
          />
        </FieldCard>
      </div>

      {dealSlot}

      {/* CTA — 하단 바와 동일 핸들러(결제 로직 무수정) */}
      <button
        onClick={isPrelaunch ? onPrelaunchApply : onBuy}
        disabled={(!isJoinable && !isPrelaunch) || joining}
        aria-label={isPrelaunch ? '사전 응모하기' : isJoinable ? (allDeal ? `${formatNumber(total)}딜로 결제하기` : `${formatNumber(total)}원 ${ctaLabel}`) : isDemo ? '응모 불가' : '구매 불가'}
        style={{ width: '100%', height: 50, border: 'none', borderRadius: 14, background: (buyable || isPrelaunch) ? 'var(--gbd-cta-bg)' : 'var(--gbd-sub2)', color: 'var(--gbd-cta-fg)', fontSize: 16, fontWeight: 800, letterSpacing: '-.01em', cursor: (buyable || isPrelaunch) ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
      >
        {joining ? '처리 중…' : isPrelaunch ? <><BellIcon size={16} aria-hidden="true" />오픈 예정 — 사전 응모하기</> : !isJoinable ? (isDemo ? '응모 불가' : '구매 불가') : <>{allDeal ? `${formatNumber(total)}딜로 결제하기` : `${formatNumber(total)}원 ${ctaLabel}`}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></>}
      </button>

      {/* 🔒 안심 한 줄 — 모바일 구매 창과 같은 문구(2026-10-11 D안). 세 줄 배지는 "결제 즉시 교환권 발급"(용어 오류)을 담고 있었다. */}
      <div className="mt-3 flex items-center justify-center gap-1 text-[12px]" style={{ color: 'var(--gbd-sub)' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
        토스로 3초 안전결제 · 미사용 시 100% 자동환불
      </div>
      {isPrelaunch && (
        <div className="mt-2 text-[12px] text-center" style={{ color: 'var(--gbd-sub)' }}>오픈 협의 중 매장 · 응모는 무료, 오픈 시 알림을 드려요</div>
      )}
    </div>
  )
}
