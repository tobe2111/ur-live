import { useState, useMemo } from 'react'
import { Calculator, ChevronDown, ChevronUp } from 'lucide-react'

/**
 * 에이전시 PL (Profit & Loss) 시뮬레이터 — Phase 2-2
 *
 * 컨셉: 에이전시 사업자가 매출/비용 시나리오를 입력하면 순이익 추정.
 * TikTok Backstage 의 "LIVE사업의 PL 예시" 자료 적응.
 *
 * 입력:
 *   - 셀러 수
 *   - 셀러당 평균 월 매출(딜)
 *   - 평균 수수료율 (%)
 *   - 운영 비용 (인건비/마케팅/도구/기타)
 *
 * 출력:
 *   - 총 매출
 *   - 에이전시 수수료 수익
 *   - 운영 비용
 *   - 순이익 (월/연)
 *   - 영업이익률
 */

export default function PLSimulator() {
  const [open, setOpen] = useState(false)

  // 입력
  const [sellerCount, setSellerCount] = useState(10)
  const [avgRevenuePerSeller, setAvgRevenuePerSeller] = useState(1_000_000) // 셀러당 월 100만원
  const [commissionRate, setCommissionRate] = useState(10) // %
  const [staffCost, setStaffCost] = useState(2_000_000)      // 인건비
  const [marketingCost, setMarketingCost] = useState(500_000) // 마케팅
  const [toolsCost, setToolsCost] = useState(200_000)        // 도구/구독
  const [otherCost, setOtherCost] = useState(0)              // 기타

  const calc = useMemo(() => {
    const totalRevenue = sellerCount * avgRevenuePerSeller
    const commissionRevenue = Math.floor(totalRevenue * (commissionRate / 100))
    const totalCost = staffCost + marketingCost + toolsCost + otherCost
    const monthlyProfit = commissionRevenue - totalCost
    const yearlyProfit = monthlyProfit * 12
    const operatingMargin = commissionRevenue > 0
      ? (monthlyProfit / commissionRevenue) * 100
      : 0
    return {
      totalRevenue,
      commissionRevenue,
      totalCost,
      monthlyProfit,
      yearlyProfit,
      operatingMargin,
    }
  }, [sellerCount, avgRevenuePerSeller, commissionRate, staffCost, marketingCost, toolsCost, otherCost])

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between hover:from-emerald-100 hover:to-teal-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Calculator className="w-5 h-5 text-emerald-600" />
          <div className="text-left">
            <div className="text-sm font-bold text-gray-900">📊 PL 시뮬레이터</div>
            <div className="text-xs text-gray-500">월 매출 / 비용 입력해서 순이익 추정</div>
          </div>
        </div>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-emerald-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-emerald-600" />
          <h3 className="text-sm font-bold text-gray-900">PL 시뮬레이터</h3>
        </div>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 입력 섹션 */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">📥 입력</h4>

          <Field label="활성 셀러 수" value={sellerCount} onChange={setSellerCount} suffix="명" />
          <Field label="셀러당 월 매출" value={avgRevenuePerSeller} onChange={setAvgRevenuePerSeller} suffix="딜" />
          <Field label="평균 수수료율" value={commissionRate} onChange={setCommissionRate} suffix="%" max={100} />

          <div className="pt-2 border-t border-gray-100">
            <div className="text-xs font-bold text-gray-500 mb-2">월 운영 비용</div>
            <Field label="인건비" value={staffCost} onChange={setStaffCost} suffix="원" />
            <Field label="마케팅" value={marketingCost} onChange={setMarketingCost} suffix="원" />
            <Field label="도구/구독" value={toolsCost} onChange={setToolsCost} suffix="원" />
            <Field label="기타" value={otherCost} onChange={setOtherCost} suffix="원" />
          </div>
        </div>

        {/* 결과 섹션 */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg p-4">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">📤 추정 결과</h4>

          <ResultRow label="총 매출" value={calc.totalRevenue} unit="딜" highlight={false} />
          <ResultRow label={`수수료 수익 (${commissionRate}%)`} value={calc.commissionRevenue} unit="원" highlight={false} />
          <ResultRow label="운영 비용" value={-calc.totalCost} unit="원" highlight={false} negative />

          <div className="border-t border-emerald-200 my-2" />

          <ResultRow label="월 순이익" value={calc.monthlyProfit} unit="원" highlight />
          <ResultRow label="연 순이익" value={calc.yearlyProfit} unit="원" highlight={false} />

          <div className="mt-3 pt-3 border-t border-emerald-200">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">영업이익률</span>
              <span className={`font-bold ${calc.operatingMargin >= 20 ? 'text-emerald-600' : calc.operatingMargin >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                {calc.operatingMargin.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="mt-3 text-[10px] text-gray-500 italic">
            ⚠️ 실제 매출/비용은 본 시뮬레이터와 다를 수 있습니다. 사업 계획용 참고만.
          </div>
        </div>
      </div>
    </div>
  )
}

function Field(props: { label: string; value: number; onChange: (v: number) => void; suffix: string; max?: number }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-600">{props.label}</span>
      <div className="mt-1 flex items-center gap-1.5">
        <input
          type="number"
          value={props.value}
          onChange={(e) => props.onChange(Math.max(0, Math.min(props.max ?? Infinity, Number(e.target.value) || 0)))}
          className="flex-1 text-sm bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-gray-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <span className="text-xs text-gray-500 w-8">{props.suffix}</span>
      </div>
    </label>
  )
}

function ResultRow(props: { label: string; value: number; unit: string; highlight?: boolean; negative?: boolean }) {
  const colorClass = props.highlight
    ? props.value >= 0 ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'
    : props.negative ? 'text-red-500' : 'text-gray-900'
  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <span className="text-gray-600">{props.label}</span>
      <span className={colorClass}>
        {props.value.toLocaleString()} <span className="text-[10px] text-gray-500">{props.unit}</span>
      </span>
    </div>
  )
}
