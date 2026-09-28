/**
 * 🎟️ 이용권 고치기 — 가격·수량·안내 문구 (2026-09-26, 설계 §21)
 *
 * ## 왜 이 넷인가
 * 사장님이 실제로 자주 바꾸는 값이다. 사진·옵션·매장 정보는 **전체화면 폼**이 맡는다 —
 * 같은 폼을 두 벌 만들면 반드시 한쪽만 고쳐지고, 그때부터 두 화면이 다른 값을 저장한다.
 *
 * ## 🔴 가격은 손님이 보는 값이다 — 한 번 더 묻는다
 * 시트는 한 손으로 쓰는 물건이라 **실수도 한 손으로 난다**. 저장 버튼을 누르면 곧장 보내지 않고
 * "얼마 → 얼마" 를 문장으로 보여 주고 다시 누르게 한다. 가격을 **안 바꿨으면 이 단계는 없다**
 * (안내 문구만 고치는데 매번 확인을 물으면 확인은 곧 무의미해진다).
 * ⚠️ 대표 판단 대기 항목이라 **기본값을 보수적인 쪽으로** 둔 것이다 — 빼라는 결정이 나오면 그때 뺀다.
 *
 * ## 🪑 좌석
 * 읽기도 쓰기도 좌석 토큰으로 스코프된다. 열 때 좌석이 어긋나면 **부르지 않고**,
 * 보내기 직전에 `assertSeat` 으로 다시 확인한다(§15-3 규칙 ②).
 */
import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { formatNumber } from '@/utils/format'
import { assertSeat, currentSeatId, SeatMismatchError } from '@/lib/seller-seat'
import { toast } from '@/hooks/useToast'
import Sheet from './Sheet'
import type { WorkProduct } from './useSellerWork'

const MAX_PRICE = 100_000_000
const MAX_STOCK = 1_000_000

function digits(v: string, cap: number): string {
  const n = v.replace(/\D/g, '').slice(0, 12)
  if (n === '') return ''
  return String(Math.min(Number(n), cap))
}

export default function VoucherEditSheet({ sellerId, product, onClose, onSaved }: {
  sellerId: number
  product: WorkProduct
  onClose: () => void
  onSaved: () => void
}) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [price, setPrice] = useState('')
  const [orig, setOrig] = useState('')
  const [stock, setStock] = useState('')
  const [terms, setTerms] = useState('')
  const [basePrice, setBasePrice] = useState(product.price)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  useEffect(() => {
    if (currentSeatId() !== sellerId) { setFailed(true); return }
    import('@/lib/api').then(({ default: api }) => api.get(`/api/seller/products/${product.id}`))
      .then((r) => {
        if (!alive.current) return
        if (!r.data?.success) { setFailed(true); return }
        const d = (r.data.data ?? r.data.product ?? {}) as Record<string, unknown>
        const p = Number(d.price)
        setBasePrice(Number.isFinite(p) ? p : product.price)
        setPrice(String(Number.isFinite(p) ? p : product.price))
        setOrig(d.original_price == null ? '' : String(Number(d.original_price) || 0))
        setStock(d.stock == null ? '' : String(Number(d.stock) || 0))
        setTerms(typeof d.voucher_terms === 'string' ? d.voucher_terms : '')
        setLoaded(true)
      })
      .catch(() => { if (alive.current) setFailed(true) })
  }, [sellerId, product.id, product.price])

  const nextPrice = price === '' ? NaN : Number(price)
  const priceOk = Number.isFinite(nextPrice) && nextPrice >= 0 && nextPrice <= MAX_PRICE
  const priceChanged = priceOk && nextPrice !== basePrice
  const canSend = loaded && priceOk && !busy

  // 값을 되돌리면 확인 단계도 취소된다 — 안 그러면 "확인" 이 옛 금액을 저장한다.
  useEffect(() => { if (!priceChanged) setConfirming(false) }, [priceChanged])

  async function save() {
    if (!canSend) return
    // 🔴 가격이 바뀌었으면 한 번 더 묻는다(위 머리말).
    if (priceChanged && !confirming) { setConfirming(true); return }
    try {
      assertSeat(sellerId)
    } catch (e) {
      if (e instanceof SeatMismatchError) { toast.error('가게가 바뀌었어요. 다시 열어 주세요'); onClose(); return }
      throw e
    }
    setBusy(true)
    try {
      const { default: api } = await import('@/lib/api')
      const body: Record<string, unknown> = { price: nextPrice, voucher_terms: terms.trim() }
      if (orig !== '') body.original_price = Number(orig)
      if (stock !== '') body.stock = Number(stock)
      const r = await api.put(`/api/seller/products/${product.id}`, body)
      if (!r.data?.success) { toast.error(r.data?.error || '고치지 못했습니다'); return }
      toast.success('저장했어요')
      onSaved()
    } catch (err) {
      const res = (err as { response?: { data?: { error?: string } } })?.response?.data
      toast.error(res?.error || '고치지 못했습니다')
    } finally {
      if (alive.current) { setBusy(false); setConfirming(false) }
    }
  }

  const field = 'w-full h-12 rounded-xl border border-rule-strong bg-transparent px-3 text-[16px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500'

  return (
    <Sheet
      title={product.name}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          {confirming && (
            <p className="text-[13px] leading-[1.6] text-gray-900 dark:text-white">
              손님이 보는 가격이 <b className="tabular-nums">{formatNumber(basePrice)}원</b> 에서{' '}
              <b className="tabular-nums">{formatNumber(nextPrice)}원</b> 으로 바뀌어요. 저장할까요?
            </p>
          )}
          <button
            type="button"
            disabled={!canSend}
            onClick={save}
            className="w-full h-12 rounded-xl bg-brand text-white text-[15px] font-bold active:opacity-80 disabled:opacity-40 inline-flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {confirming ? '네, 바꿀게요' : '저장'}
          </button>
        </div>
      }
    >
      {!loaded && !failed && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" aria-hidden="true" />
        </div>
      )}
      {failed && (
        <p className="px-4 py-8 text-center text-[13.5px] text-gray-500 dark:text-gray-400">
          지금은 불러올 수 없어요. 잠시 후 다시 열어 주세요.
        </p>
      )}
      {loaded && (
        <div className="px-4 py-4 space-y-3">
          <label className="block">
            <span className="block text-[13px] font-bold text-gray-900 dark:text-white mb-1.5">판매가</span>
            <input
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(digits(e.target.value, MAX_PRICE))}
              placeholder="0"
              className={`${field} tabular-nums`}
            />
          </label>
          <label className="block">
            <span className="block text-[13px] font-bold text-gray-900 dark:text-white mb-1.5">
              정가 <span className="font-normal text-gray-500 dark:text-gray-400">(할인율 계산에 쓰여요)</span>
            </span>
            <input
              inputMode="numeric"
              value={orig}
              onChange={(e) => setOrig(digits(e.target.value, MAX_PRICE))}
              placeholder="비워 두면 할인 표시 없음"
              className={`${field} tabular-nums`}
            />
          </label>
          <label className="block">
            <span className="block text-[13px] font-bold text-gray-900 dark:text-white mb-1.5">남은 수량</span>
            <input
              inputMode="numeric"
              value={stock}
              onChange={(e) => setStock(digits(e.target.value, MAX_STOCK))}
              placeholder="비워 두면 그대로"
              className={`${field} tabular-nums`}
            />
          </label>
          <label className="block">
            <span className="block text-[13px] font-bold text-gray-900 dark:text-white mb-1.5">이용 안내</span>
            <textarea
              value={terms}
              onChange={(e) => setTerms(e.target.value.slice(0, 1000))}
              rows={4}
              placeholder="예: 점심시간(11~14시) 제외 · 1인 1매"
              className="w-full rounded-xl border border-rule-strong bg-transparent px-3 py-2.5 text-[15px] leading-[1.6] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </label>
          <p className="text-[12px] leading-[1.6] text-gray-500 dark:text-gray-400 pt-1">
            사진 · 옵션 · 매장 정보는 전체 화면에서 바꿔요.
          </p>
        </div>
      )}
    </Sheet>
  )
}
