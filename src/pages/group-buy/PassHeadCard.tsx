/**
 * 🎟️ 이용권 상세 머리 카드 — 사진 위로 겹쳐 올라오는 [가게 · 제목 · 가격] (2026-10-11 대표 확정 "D안")
 *
 * 대표: *"더 세련되고 심플해져야 해. 지금은 부연설명도 많고 그래."* → 시안 C·D·E 중 **D(카드형)**.
 *
 * ## 종전에서 걷어낸 것 (라이브 /pass/2915 실측)
 * - 주소 줄 — 매장 카드가 지도와 함께 말한다(종전 한 화면에 주소 3번).
 * - *"결제 즉시 교환권 발급"* — 용어도 틀렸고(이 상품은 이용권), 무엇을 알려 주지도 않았다.
 * - 수량 카드 — 구매하기를 누르면 뜨는 창으로 옮겼다(`DealBottomBar`).
 *
 * ## 서버가 먼저 그리는 범위
 * 가게 이름 · 제목(h1) 까지는 워커가 같은 클래스(`PASS_HEAD`)로 미리 그린다. 그 아래(거리 · 가격)는
 * 마운트 뒤 채워지지만 **제목 아래라** 위는 한 픽셀도 안 움직인다(`detail-ssr-body.ts`).
 */
import { formatNumber } from '@/utils/format'
import { PASS_HEAD } from '@/shared/pass-head'

export default function PassHeadCard({
  merchant, onnuri, isPrelaunch, name, distKm, buyers,
  unitPrice, refPrice, discountPct, unitSaving,
}: {
  merchant?: string | null
  onnuri?: boolean
  isPrelaunch: boolean
  name: string
  distKm: string | number | null
  buyers: number
  unitPrice: number
  refPrice: number
  discountPct: number
  unitSaving: number
}) {
  const meta = [distKm != null ? `${distKm}km` : null, buyers > 0 ? `${formatNumber(buyers)}명 구매` : null].filter(Boolean)
  return (
    <div className={PASS_HEAD.card}>
      {merchant && (
        <div className={PASS_HEAD.merchant}>
          {merchant}
          {/* 🏪 2026-07-05 온누리 가맹 뱃지 (B2G — "온누리 사용 가능 표시" 약속) */}
          {onnuri && <span className={PASS_HEAD.onnuri}>온누리 사용 가능</span>}
        </div>
      )}
      {isPrelaunch && <span className={PASS_HEAD.prelaunch}>오픈 예정 · 사전 응모 받는 중</span>}
      <h1 className={PASS_HEAD.h1}>{name}</h1>
      {meta.length > 0 && <div className="mt-1 text-[13px] text-[var(--gbd-sub)]">{meta.join(' · ')}</div>}

      {/* 💰 할인율(빨강 — 2026-09-07 대표 SSOT `--sale`) · 판매가(가장 크게) · 정가(취소선) 한 줄 */}
      <div className="mt-4 flex items-baseline flex-wrap gap-x-2">
        {discountPct > 0 && <span className="text-[24px] font-bold tracking-[-.02em]" style={{ color: 'var(--sale)' }}>{discountPct}%</span>}
        <span className="text-[28px] font-extrabold tracking-[-.03em] text-[var(--gbd-ink)]">{formatNumber(unitPrice)}원</span>
        {unitSaving > 0 && <span className="text-[13px] line-through text-[var(--gbd-sub2)]">{formatNumber(refPrice)}원</span>}
      </div>
      {unitSaving > 0 && (
        <div className="mt-3 rounded-xl px-3 py-2 text-[13px] text-[var(--gbd-ink2)]" style={{ background: 'var(--gbd-accent-soft)' }}>
          1장당 <b className="font-bold text-brand-text">{formatNumber(unitSaving)}원</b> 아껴요
        </div>
      )}
    </div>
  )
}
