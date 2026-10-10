/**
 * 🤝 **대행사가 정한 정산 조건 — 사장님 확인·동의** (2026-10-10 대표 "1,2,5번은 해주고").
 *
 * 대행사가 매장을 대신 등록하며 혼자 정한 두 요율이, 사장님이 주인이 된 뒤에도 그대로 남는다.
 * 그래서 소유권 신청 화면에서 **그 숫자를 보여 주고 동의를 받는다**(서버가 같은 조건인지 다시 확인하고
 * 기록한다 — `broker-terms-consent.ts`). 주인이 된 뒤에는 매장 관리에서 바꿀 수 있다는 것도 함께 적는다.
 */
export interface BrokerTerms { broker_share_pct: number; influencer_pct_cap: number | null }

export default function BrokerTermsConsent({ terms, agreed, onChange }: {
  terms: BrokerTerms; agreed: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="rounded-xl bg-brand-tint px-4 py-3">
      <p className="text-[13px] font-bold text-gray-900">대행사가 정한 정산 조건</p>
      <dl className="mt-2 divide-y divide-rule">
        <div className="flex items-center justify-between py-2">
          <dt className="text-[13px] text-gray-600">중개사 몫</dt>
          <dd className="text-[15px] font-bold tabular-nums text-gray-900">{terms.broker_share_pct}%</dd>
        </div>
        <div className="flex items-center justify-between py-2">
          <dt className="text-[13px] text-gray-600">인플루언서 상한</dt>
          <dd className="text-[15px] font-bold tabular-nums text-gray-900">{terms.influencer_pct_cap == null ? '없음' : `${terms.influencer_pct_cap}%`}</dd>
        </div>
      </dl>
      <p className="mt-1 text-[12px] leading-relaxed text-gray-500">
        둘 다 이 매장 매출에서 나가요. 주인이 된 뒤에는 매장 관리에서 바꿀 수 있어요.
      </p>
      <label className="mt-3 flex items-start gap-2 cursor-pointer">
        <input type="checkbox" checked={agreed} onChange={(e) => onChange(e.target.checked)} className="mt-1 w-4 h-4 shrink-0 accent-brand" />
        <span className="text-[13px] font-semibold text-gray-900">위 조건을 확인했고 동의합니다 (필수)</span>
      </label>
    </div>
  )
}
