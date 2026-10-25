/**
 * 💰 이용권 마진 계산기 — 이용권 등록 폼 상시 표시
 *   2026-08-20 대표 확정(실수령가 카드): "하나 판매 당 얼마인지 결과도 나와야겠지? 플랫폼 수수료와 인플루언서 수수료를 제한 금액으로."
 *   2026-10-24 대표: *"이용권 등록할 때 이용권 마진 계산기 간단하게 있으면 좋겠네. 유어딜 수수료, 인플루언서 수수료,
 *   할인금액 이렇게 빼고 최종 마진"* → 정가에서 **할인 · 유어딜 수수료 · 인플루언서 수수료**를 차례로 빼 최종 마진을 보인다.
 *
 * 수수료율은 서버 `/api/seller/fee-context` 에서 받는다. 그 값은 **결제가 부르는 그 함수**
 * (`getSellerCommissionRate`)를 거쳐 나온 **지금 실제로 떼이는 %** 다(생활 파트너 20% 처럼 매장별로 다른 요율도 그대로).
 *
 * 🩸 2026-08-27 정정: 여기 있던 주석은 *"같은 값을 읽으므로 갈릴 수 없다"* 였는데 **틀렸다.**
 *   `loadFeeRates` 와 같은 값이었을 뿐, **그 값이 결제 분배에 안 쓰였다** — 직접(10%)을 고른 매장이
 *   이 카드에서 10% 를 빼고 봤지만 실제로는 5% 만 떼였다. 매장 입장에선 더 받는 쪽이라 신고가
 *   안 들어왔고, 그래서 **아무도 몰랐다.**
 *
 * ⚠️ 그러니 이 카드는 **서버가 준 값만** 쓴다. 채널(직접/중개)로 화면에서 다시 계산하지 말 것 —
 *   그 순간 다시 갈린다.
 *
 * 🧮 인플루언서 수수료는 **계산용 입력**이다(저장하지 않는다). 소개비를 이용권에 저장하는 칸은
 *   `SELLER_PROMO_FIELD_ENABLED` 뒤에 있고 꺼져 있다(그 값이 라이브 적립을 바꾸는 머니 경로라서).
 *   그 칸이 켜져 값이 넘어오면(`promoPct`) 그 값을 쓰고 입력칸은 잠근다 — 두 숫자가 갈리지 않게.
 *   소개비는 소개 링크로 팔렸을 때만, 매장 몫에서 나간다(2026-10-16 대표 확정).
 *
 * 셀러 대시보드 = 라이트 고정(dark: 금지).
 */
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { formatNumber } from '@/utils/format'

/** 정가 → 할인 → 유어딜 수수료 → 인플루언서 수수료 → 최종 마진. 화면과 시험이 같은 함수를 쓴다. */
export function voucherMargin(input: { price: number; originalPrice?: number; platformFeePct: number; influencerPct: number }) {
  const price = Number.isFinite(input.price) && input.price > 0 ? Math.floor(input.price) : 0
  const list = Number(input.originalPrice) > price ? Math.floor(Number(input.originalPrice)) : price
  const discount = list - price
  const platformCut = Math.round((price * Math.max(0, Number(input.platformFeePct) || 0)) / 100)
  const influencerPct = Math.max(0, Math.min(50, Number(input.influencerPct) || 0))
  const influencerCut = Math.round((price * influencerPct) / 100)
  const net = price - platformCut - influencerCut
  return {
    list, discount, price, platformCut, influencerPct, influencerCut, net,
    discountPct: list > 0 ? Math.round((discount / list) * 100) : 0,
    marginPct: list > 0 ? Math.round((net / list) * 100) : 0,
  }
}

export default function NetProceedsCard({ price, originalPrice, promoPct }: { price: number; originalPrice?: number; promoPct?: number }) {
  const [fee, setFee] = useState<{ channel: string | null; platform_fee_pct: number; channel_rates_active?: boolean } | null>(null)
  const [influencerInput, setInfluencerInput] = useState('')
  useEffect(() => {
    api.get('/api/seller/fee-context')
      .then(r => { if (r.data?.success) setFee(r.data.data) })
      .catch(() => { /* 미로그인/일시 오류 — 카드 자체를 숨긴다 */ })
  }, [])

  if (!fee || !(price > 0)) return null
  const savedPromo = Number(promoPct) > 0
  const m = voucherMargin({
    price,
    originalPrice,
    platformFeePct: fee.platform_fee_pct,
    influencerPct: savedPromo ? Number(promoPct) : Number(influencerInput),
  })
  const platformCut = m.platformCut
  const net = m.net
  const channelLabel = fee.channel === 'direct' ? ' · 직접 운영' : fee.channel === 'brokered' ? ' · 중개 운영' : ' · 운영 방식 미선택'

  return (
    <div className="mt-3 rounded-xl border border-rule bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <p className="text-[15px] font-bold text-gray-900">마진 계산기</p>
        <span className="text-[12px] text-gray-400">1장 팔면</span>
      </div>
      <div className="space-y-2 text-[13px]">
        <div className="flex justify-between text-gray-700"><span>{m.discount > 0 ? '정가' : '판매가'}</span><span className="tabular-nums">{formatNumber(m.list)}원</span></div>
        {m.discount > 0 && (
          <div className="flex justify-between text-gray-500">
            <span>할인 ({m.discountPct}%) → 판매가 {formatNumber(m.price)}원</span>
            <span className="tabular-nums">−{formatNumber(m.discount)}원</span>
          </div>
        )}
        <div className="flex justify-between text-gray-500">
          <span>유어딜 수수료 ({fee.platform_fee_pct}%{channelLabel})</span>
          <span className="tabular-nums">−{formatNumber(platformCut)}원</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-gray-500">
          <label htmlFor="voucher-margin-influencer" className="flex items-center gap-2">
            <span>인플루언서 수수료</span>
            <span className="relative">
              <input
                id="voucher-margin-influencer"
                type="number" inputMode="numeric" min={0} max={50} step={1}
                value={savedPromo ? String(m.influencerPct) : influencerInput}
                disabled={savedPromo}
                onChange={e => setInfluencerInput(e.target.value === '' ? '' : String(Math.max(0, Math.min(50, Number(e.target.value) || 0))))}
                placeholder="0"
                className="h-8 w-16 rounded-lg border border-gray-300 pl-2 pr-6 text-right text-[13px] text-gray-900 tabular-nums focus:border-brand focus:outline-none disabled:bg-gray-50"
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-gray-400">%</span>
            </span>
          </label>
          <span className="tabular-nums">−{formatNumber(m.influencerCut)}원</span>
        </div>
        <div className="flex justify-between border-t border-rule pt-2 text-[15px] font-extrabold text-tone-ok">
          <span>최종 마진</span>
          <span className="tabular-nums">{formatNumber(net)}원{m.discount > 0 && <span className="ml-1 text-[12px] font-bold">(정가의 {m.marginPct}%)</span>}</span>
        </div>
      </div>
      <p className="mt-2 text-[12px] leading-[1.55] text-gray-500">
        {m.influencerCut > 0
          ? `인플루언서 수수료는 소개 링크로 팔렸을 때만 빠져요. 직접 팔리면 ${formatNumber(price - platformCut)}원이에요.`
          : '인플루언서와 수수료를 약속했다면 그 %를 넣어 보세요. 계산용이라 저장되지 않아요.'}
      </p>
    </div>
  )
}
