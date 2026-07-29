/**
 * 💰 공구 3분할 계산기 (2026-07-06 공구 엔진 완결 스펙 §3 — 핵심 UI)
 *
 * 정가를 앵커로: [할인율]→소비자가, [promo%]→인플루언서 몫. 소비자가가 promo(인플)/플랫폼5%/
 *   매장 실수령으로 3분할되는 걸 실시간 표시. 매장이 "할인+소개비"를 하나의 마케팅 예산으로 설계.
 * 산술 SSOT = resolveOrderFees(owner-funded). 표시 전용(돈 무영향).
 *
 * 셀러 대시보드 = 라이트 테마 고정(dark: variant 금지).
 */
import { resolveOrderFees } from '@/worker/utils/fee-resolver'
import { formatNumber } from '@/utils/format'
import { promoGuideFor } from './PromoMarginCalculator'

interface Props {
  /** 정가(원) — 앵커. */
  originalPrice: number
  /** 할인율 %(0~90) — 소비자가 = 정가 × (1-할인/100). */
  discountPct: number
  onDiscountChange: (v: number) => void
  /** 소개비율 %(0~50). */
  promoPct: number
  onPromoChange: (v: number) => void
  category: string
}

export default function ThreeWaySplitCalculator({
  originalPrice, discountPct, onDiscountChange, promoPct, onPromoChange, category,
}: Props) {
  const orig = Number.isFinite(originalPrice) && originalPrice > 0 ? Math.floor(originalPrice) : 0
  const guide = promoGuideFor(category)
  const consumer = Math.round(orig * (1 - Math.max(0, Math.min(90, discountPct)) / 100))

  // 소비자가 → promo(인플) / 플랫폼 5% / 매장 실수령 3분할.
  const b = resolveOrderFees({
    amount: consumer,
    ownership: '3P',
    productKind: 'voucher',
    promo: promoPct > 0 ? { promoterId: 'preview', pct: promoPct } : null,
  })

  const belowGuide = promoPct > 0 && promoPct < guide.min
  const capacityVertical = guide.max >= 30 // 숙소·헬스 등 한계비용 0

  const pct = (v: number) => (consumer > 0 ? Math.round((v / consumer) * 100) : 0)

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-900">💰 공구 3분할 계산기</p>
        <span className="text-[11px] text-gray-400">정가 {formatNumber(orig)}원 기준 · 건당</span>
      </div>

      {/* 할인율 슬라이더 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[12px] font-semibold text-gray-700">소비자 할인율</label>
          <span className="text-[12px] font-mono text-gray-900">{discountPct}% → {formatNumber(consumer)}원</span>
        </div>
        <input type="range" min={0} max={80} step={1} value={discountPct}
          onChange={e => onDiscountChange(Number(e.target.value))}
          className="w-full accent-gray-900" />
      </div>

      {/* promo 슬라이더 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[12px] font-semibold text-gray-700">인플루언서 소개비</label>
          <span className="text-[12px] font-mono text-gray-900">{promoPct}% → {formatNumber(b.promo)}원</span>
        </div>
        <input type="range" min={0} max={50} step={1} value={promoPct}
          onChange={e => onPromoChange(Number(e.target.value))}
          className="w-full accent-emerald-600" />
        <p className="text-[11px] text-gray-500 mt-1">{guide.label} 권장 {guide.min}~{guide.max}% · {guide.note}</p>
        {belowGuide && (
          <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5 mt-1.5">
            ⚠️ 이 소개비 수준({promoPct}%)에서는 인플루언서 참여가 저조할 수 있습니다. (권장 {guide.min}% 이상)
          </p>
        )}
        {capacityVertical && (
          <p className="text-[11px] text-emerald-700 mt-1">
            💡 {guide.label}는 빈 자리를 채우는 것이라 높은 소개비도 남습니다(한계비용 낮음).
          </p>
        )}
      </div>

      {/* 3분할 막대 */}
      {consumer > 0 && (
        <div>
          <div className="flex h-3 rounded-full overflow-hidden">
            <div className="bg-emerald-500" style={{ width: `${pct(b.promo)}%` }} title="인플루언서 소개비" />
            <div className="bg-gray-400" style={{ width: `${pct(b.platform)}%` }} title="유어딜 수수료" />
            <div className="bg-gray-900" style={{ width: `${pct(b.ownerNet)}%` }} title="매장 실수령" />
          </div>
          <div className="mt-3 space-y-1.5">
            <SplitRow color="bg-emerald-500" label={`인플루언서 소개비 (${promoPct}%)`} value={b.promo} />
            <SplitRow color="bg-gray-400" label="유어딜 수수료 (5%)" value={b.platform} />
            <SplitRow color="bg-gray-900" label="매장 실수령" value={b.ownerNet} strong />
          </div>
          <p className="text-[11px] text-gray-500 mt-2.5 leading-relaxed">
            소비자 <strong className="text-gray-700">{formatNumber(consumer)}원</strong> 결제 시:
            추천 판매 1건당 인플루언서에게 <strong className="text-emerald-700">{formatNumber(b.promo)}원</strong> 지급 ·
            소개비는 소비자 결제액에 추가되지 않고 매장 몫에서 나갑니다.
          </p>
        </div>
      )}
    </div>
  )
}

function SplitRow({ color, label, value, strong }: { color: string; label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-[12px] text-gray-700">
        <span className={`inline-block w-2.5 h-2.5 rounded-sm ${color}`} /> {label}
      </span>
      <span className={`font-mono text-[12px] ${strong ? 'font-bold text-gray-900' : 'text-gray-700'}`}>{formatNumber(value)}원</span>
    </div>
  )
}
