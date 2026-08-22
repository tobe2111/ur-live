/**
 * 💰 판매 1건당 실수령가 카드 — 이용권 등록 폼 상시 표시 (2026-08-20 대표 확정)
 *
 * "하나 판매 당 얼마인지 결과도 나와야겠지? 플랫폼 수수료와 인플루언서 수수료를 제한 금액으로."
 *
 * 수수료율은 서버 `/api/seller/fee-context`(fee-resolver loadFeeRates SSOT)에서 받는다 —
 * 화면의 % 와 정산의 % 가 **같은 값**을 읽으므로 갈릴 수 없다.
 * 채널(최종): 직접 매장 10% · 중개 매장 5%.
 */
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { formatNumber } from '@/utils/format'

export default function NetProceedsCard({ price, promoPct }: { price: number; promoPct?: number }) {
  const [fee, setFee] = useState<{ channel: string; platform_fee_pct: number } | null>(null)
  useEffect(() => {
    api.get('/api/seller/fee-context')
      .then(r => { if (r.data?.success) setFee(r.data.data) })
      .catch(() => { /* 미로그인/일시 오류 — 카드 자체를 숨긴다 */ })
  }, [])

  if (!fee || !(price > 0)) return null
  const platformCut = Math.round((price * fee.platform_fee_pct) / 100)
  const promo = Math.max(0, Math.min(90, Number(promoPct) || 0))
  const promoCut = Math.round((price * promo) / 100)
  const net = price - platformCut - promoCut

  return (
    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5">
      <p className="text-[11px] font-bold text-emerald-800 mb-2">💰 판매 1건당 실수령 (예상)</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between text-gray-600"><span>판매가</span><span>{formatNumber(price)}원</span></div>
        <div className="flex justify-between text-gray-600">
          <span>플랫폼 수수료 ({fee.platform_fee_pct}%{fee.channel === 'direct' ? ' · 직접 운영' : ' · 중개 운영'})</span>
          <span>−{formatNumber(platformCut)}원</span>
        </div>
        {promo > 0 && (
          <div className="flex justify-between text-gray-600">
            <span>인플루언서 소개비 ({promo}% · 추천 판매 시에만)</span>
            <span>−{formatNumber(promoCut)}원</span>
          </div>
        )}
        <div className="flex justify-between font-extrabold text-emerald-800 pt-1.5 border-t border-emerald-200">
          <span>매장 실수령</span><span>{formatNumber(net)}원</span>
        </div>
      </div>
      {promo > 0 && (
        <p className="text-[10px] text-gray-500 mt-1.5">직접 판매(추천 링크 없이)는 소개비가 빠지지 않아 {formatNumber(price - platformCut)}원을 받아요.</p>
      )}
    </div>
  )
}
