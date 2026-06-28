import { useEffect, useState, useRef } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Loader2, Wallet, AlertTriangle } from 'lucide-react'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { WT, won, comma } from './wholesale/wholesale-theme'
import { useWholesaleDeposit, useInvalidateWholesaleDeposit } from '@/hooks/queries/useWholesale'
import { useWholesaleCart, groupBySupplier } from './wholesale/useWholesaleCart'
import { useIsWholesaleViewer, ViewerNotice } from './wholesale/ViewerGate'

// 🏦 2026-06-09 유통스타트 도매 — 예치금(선불) 결제 체크아웃.
//   Toss 위젯 흐름을 REPLACE → 주문 확인 + 예치금 결제. (여신/외상 옵션 제거 — 예치금 전용)
//   결제: POST /api/wholesale/orders → status:PAID (paid_by:deposit) | 402 INSUFFICIENT_DEPOSIT.

interface InsufficientInfo { balance: number; required: number; shortfall: number }

export default function WholesaleCheckoutPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const token = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
  const { items, subtotal, totalQty, clear } = useWholesaleCart()
  const depositQ = useWholesaleDeposit()
  const invalidateDeposit = useInvalidateWholesaleDeposit()
  // 👥 2026-06-12 (감사 부채): viewer 직원 — 서버 403 전 UI 사전 안내 (fail-open, 서버가 최종 방어).
  const isViewer = useIsWholesaleViewer()

  const [paying, setPaying] = useState(false)
  const [insufficient, setInsufficient] = useState<InsufficientInfo | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  // 🔁 멱등키 — 이 체크아웃 1회당 고정(더블클릭/네트워크 재시도가 예치금 이중차감·이중주문 안 하도록).
  const idemKeyRef = useRef<string>(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)

  const balance = Number(depositQ.data?.balance) || 0

  // 🚚 제조사별 최소주문금액/배송비 (표시용 — 서버가 청구 시 재계산 = SSOT). 청구액 = 상품합 + 배송비.
  const grouped = groupBySupplier(items)
  const shippingTotal = grouped.shippingTotal
  const grandTotal = subtotal + shippingTotal
  const hasMultiSupplier = grouped.groups.length > 1
  const canOrder = grouped.allMinMet

  // 빈 카트 진입 가드 — 결제 직후 clear 로 인한 리다이렉트는 paying 으로 회피.
  useEffect(() => {
    if (!paying && items.length === 0) navigate('/wholesale/cart', { replace: true })
  }, [items.length, paying, navigate])

  if (!token) return <Navigate to="/wholesale/intro" replace />

  async function payWithDeposit() {
    if (!items.length || paying) return
    if (!canOrder) {
      setErrorMsg(t('wholesale.checkout.minOrderNotMet', { defaultValue: '최소 주문 금액을 채우지 못한 공급처가 있습니다. 장바구니에서 확인해주세요.' }))
      return
    }
    setPaying(true)
    setInsufficient(null)
    setErrorMsg('')
    try {
      const r = await api.post('/api/wholesale/orders', {
        items: items.map((x) => ({ product_id: x.id, qty: x.qty })),
        idempotency_key: idemKeyRef.current,
      }, { headers: { Authorization: `Bearer ${token}` } })
      if (r.data?.success && r.data?.status === 'PAID') {
        clear()
        invalidateDeposit() // 💰 예치금 즉시차감 → 잔액 실시간 갱신(상단 util 바 포함)
        navigate(`/wholesale/success?credit=0&order=${r.data.order_id}`)
      } else {
        setErrorMsg(r.data?.error || t('wholesale.checkout.payFailed', { defaultValue: '결제에 실패했습니다' }))
        setPaying(false)
      }
    } catch (e: unknown) {
      const resp = (e as { response?: { status?: number; data?: Record<string, unknown> } })?.response
      const data = resp?.data || {}
      if (resp?.status === 402 && data.code === 'INSUFFICIENT_DEPOSIT') {
        setInsufficient({
          balance: Number(data.balance) || 0,
          required: Number(data.required) || grandTotal,
          shortfall: Number(data.shortfall) || Math.max(0, (Number(data.required) || grandTotal) - (Number(data.balance) || 0)),
        })
      } else if (resp?.status === 422 && data.code === 'MIN_ORDER_NOT_MET') {
        // 서버 최소주문금액 게이트 — 청구 전 차단됨(돈 미이동). 장바구니로 안내.
        setErrorMsg(String(data.error || t('wholesale.checkout.minOrderNotMet', { defaultValue: '최소 주문 금액을 채우지 못한 공급처가 있습니다.' })))
      } else {
        setErrorMsg(String(data.error || t('wholesale.checkout.payError', { defaultValue: '주문 결제 중 오류가 발생했습니다' })))
      }
      setPaying(false)
    }
  }

  return (
    <div className="min-h-[100dvh] pb-32" style={{ background: '#fff', color: WT.ink }}>
      <SEO title="도매 결제 - 유통스타트" description="예치금으로 도매 주문 결제" url="/wholesale/checkout" noindex />
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur" style={{ borderBottom: '1px solid ' + WT.line }}>
        <div className="ur-content-narrow flex items-center justify-between px-4 lg:px-8 h-[52px]">
          <button onClick={() => navigate(-1)} aria-label={t('common.back', { defaultValue: '뒤로' })}><ArrowLeft className="w-5 h-5" style={{ color: WT.ink }} /></button>
          <h1 className="text-[15px] font-bold" style={{ color: WT.ink }}>{t('wholesale.checkout.title', { defaultValue: '주문 확인' })}</h1>
          <div className="w-9" />
        </div>
      </header>

      <main className="ur-content-narrow px-4 lg:px-8 py-5 space-y-4">
        {/* 주문 상품 요약 */}
        <section className="rounded-2xl bg-white p-4" style={{ border: '1px solid ' + WT.line }}>
          <p className="text-[12px] mb-2 font-bold" style={{ color: WT.ink3 }}>{t('wholesale.checkout.items', { defaultValue: '주문 상품' })}</p>
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-3">
                <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden" style={{ background: WT.fill }}>
                  {it.image_url && <img src={it.image_url} alt={it.name || ''} className="w-full h-full object-cover" loading="lazy" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium line-clamp-1" style={{ color: WT.ink }}>{it.name || `상품 #${it.id}`}</div>
                  <div className="text-[12px] tabular-nums" style={{ color: WT.ink3 }}>{won(it.price || 0)} × {comma(it.qty)}</div>
                </div>
                <span className="text-[13px] font-bold tabular-nums shrink-0" style={{ color: WT.ink }}>{won((it.price || 0) * (it.qty || 0))}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid ' + WT.line }}>
            <span className="text-[13px]" style={{ color: WT.ink3 }}>{t('wholesale.checkout.subtotal', { defaultValue: '총 {{qty}}개 상품 금액', qty: comma(totalQty) })}</span>
            <span className="text-[15px] font-bold tabular-nums" style={{ color: WT.ink }}>{won(subtotal)}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[13px]" style={{ color: WT.ink3 }}>{t('wholesale.checkout.shippingFee', { defaultValue: '배송비' })}</span>
            <span className="text-[14px] font-bold tabular-nums" style={{ color: shippingTotal === 0 ? WT.pos : WT.ink }}>{shippingTotal === 0 ? t('wholesale.checkout.freeShip', { defaultValue: '무료' }) : won(shippingTotal)}</span>
          </div>
          <div className="mt-2 pt-2 flex items-center justify-between" style={{ borderTop: '1px solid ' + WT.line }}>
            <span className="text-[13px] font-bold" style={{ color: WT.ink2 }}>{t('wholesale.checkout.grandTotal', { defaultValue: '총 결제 금액' })}</span>
            <span className="text-[20px] font-extrabold tabular-nums" style={{ color: WT.ink }}>{won(grandTotal)}</span>
          </div>
          <p className="mt-1 text-[11px]" style={{ color: WT.ink4 }}>{t('wholesale.checkout.serverRecalc', { defaultValue: '실제 결제 금액은 주문 시 서버에서 등급 공급가·배송비로 재계산됩니다.' })}</p>
        </section>

        {/* 🚚 제조사별 최소주문금액/배송비 (정책 설정 그룹만 / 다중 공급처 시 분리 표시) */}
        {grouped.groups.some((g) => g.minOrderAmount > 0 || g.shipping > 0 || g.freeShipRemaining > 0) && (
          <section className="rounded-2xl bg-white p-4 space-y-2.5" style={{ border: '1px solid ' + WT.line }}>
            <p className="text-[12px] font-bold" style={{ color: WT.ink3 }}>{t('wholesale.checkout.supplierPolicy', { defaultValue: '공급처별 배송·최소주문' })}</p>
            {grouped.groups.map((g, gi) => {
              if (!(g.minOrderAmount > 0 || g.shipping > 0 || g.freeShipRemaining > 0)) return null
              return (
                <div key={g.group} className="rounded-xl p-3" style={{ background: g.meetsMin ? WT.fill2 : '#FDECEF' }}>
                  {hasMultiSupplier && <div className="text-[12px] font-bold mb-1" style={{ color: WT.ink2 }}>{t('wholesale.checkout.supplierN', { defaultValue: '공급처 {{n}}', n: gi + 1 })} <span className="font-medium" style={{ color: WT.ink4 }}>· {won(g.subtotal)}</span></div>}
                  {!g.meetsMin && <p className="text-[12px] font-bold" style={{ color: '#B3253B' }}>{t('wholesale.checkout.shortBy', { defaultValue: '{{amount}} 더 담아야 주문 가능 (최소 {{min}})', amount: won(g.shortfall), min: won(g.minOrderAmount) })}</p>}
                  <div className="flex items-center justify-between text-[12px]"><span style={{ color: WT.ink3 }}>{t('wholesale.checkout.shippingFee', { defaultValue: '배송비' })}</span><span className="tabular-nums font-semibold" style={{ color: g.shipping === 0 ? WT.pos : WT.ink }}>{g.shipping === 0 ? t('wholesale.checkout.freeShip', { defaultValue: '무료' }) : won(g.shipping)}</span></div>
                  {g.freeShipRemaining > 0 && <p className="text-[11px] mt-0.5" style={{ color: WT.ink4 }}>{t('wholesale.checkout.freeShipRemain', { defaultValue: '{{amount}} 더 담으면 무료배송', amount: won(g.freeShipRemaining) })}</p>}
                </div>
              )
            })}
          </section>
        )}

        {/* 배송지 안내 */}
        <section className="rounded-2xl p-4" style={{ background: WT.fill2 }}>
          <p className="text-[12px] font-bold mb-1" style={{ color: WT.ink2 }}>{t('wholesale.checkout.shipping', { defaultValue: '배송지' })}</p>
          <p className="text-[12px]" style={{ color: WT.ink3 }}>{t('wholesale.checkout.shippingNote', { defaultValue: '사업자 등록 주소지로 배송됩니다. 변경이 필요하면 관리자에게 문의하세요.' })}</p>
        </section>

        {/* 예치금 잔액 vs 주문액 */}
        <section className="rounded-2xl bg-white p-4" style={{ border: '1px solid ' + WT.line }}>
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: WT.ink2 }}>
              <Wallet className="w-4 h-4" style={{ color: WT.brand }} />{t('wholesale.deposit.balanceLabel', { defaultValue: '현재 예치금 잔액' })}
            </span>
            <span className="text-[15px] font-extrabold tabular-nums" style={{ color: balance >= grandTotal ? WT.ink : '#B3253B' }}>{won(balance)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[13px]" style={{ color: WT.ink3 }}>{t('wholesale.checkout.orderAmount', { defaultValue: '주문 금액' })}</span>
            <span className="text-[15px] font-bold tabular-nums" style={{ color: WT.ink }}>{won(grandTotal)}</span>
          </div>
          <div className="mt-2 pt-2 flex items-center justify-between" style={{ borderTop: '1px solid ' + WT.line }}>
            <span className="text-[13px] font-bold" style={{ color: WT.ink2 }}>{t('wholesale.checkout.balanceAfter', { defaultValue: '결제 후 잔액' })}</span>
            <span className="text-[15px] font-extrabold tabular-nums" style={{ color: WT.ink }}>{won(Math.max(0, balance - grandTotal))}</span>
          </div>
        </section>

        {/* 잔액 부족 배너 */}
        {insufficient && (
          <section className="rounded-2xl p-4" style={{ background: '#FDECEF', border: '1px solid #F8C9D2' }}>
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: '#B3253B' }} />
              <div className="min-w-0">
                <p className="text-[14px] font-bold" style={{ color: '#B3253B' }}>
                  {t('wholesale.checkout.insufficient', { defaultValue: '예치금이 {{amount}} 부족합니다', amount: won(insufficient.shortfall) })}
                </p>
                <p className="text-[12px] mt-0.5 tabular-nums" style={{ color: WT.ink3 }}>
                  {t('wholesale.checkout.insufficientDetail', { defaultValue: '필요 {{required}} · 잔액 {{balance}}', required: won(insufficient.required), balance: won(insufficient.balance) })}
                </p>
                <button
                  onClick={() => navigate('/wholesale/deposits')}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 h-10 rounded-xl text-[13px] font-bold text-white"
                  style={{ background: WT.brand }}
                >
                  <Wallet className="w-4 h-4" />{t('wholesale.deposit.charge', { defaultValue: '충전하기' })}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* 👥 2026-06-12 (감사 부채): viewer 직원 사전 안내 — 서버 403 을 누르기 전에 알림. */}
        {isViewer && <ViewerNotice action="주문·결제" />}

        {/* 일반 오류 */}
        {errorMsg && !insufficient && (
          <div className="p-4 rounded-2xl" style={{ background: '#FDECEF', border: '1px solid #F8C9D2' }}>
            <p className="text-[13px] font-medium" style={{ color: '#B3253B' }}>{errorMsg}</p>
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white z-30" style={{ borderTop: '1px solid ' + WT.line, boxShadow: WT.shUp, paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div className="ur-content-narrow px-4 pt-3">
          <button
            onClick={payWithDeposit}
            disabled={paying || items.length === 0 || !canOrder || isViewer}
            className="w-full h-14 text-[16px] font-bold rounded-2xl text-white disabled:opacity-50"
            style={{ background: WT.brand }}
          >
            {paying
              ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{t('wholesale.checkout.paying', { defaultValue: '결제 진행 중...' })}</span>
              : isViewer
                ? t('wholesale.checkout.viewerBlocked', { defaultValue: '조회 전용 계정 — 주문 불가' })
                : !canOrder
                ? t('wholesale.checkout.minOrderShort', { defaultValue: '최소 주문 금액 부족' })
                : t('wholesale.checkout.payWithDeposit', { defaultValue: '{{amount}} 예치금으로 결제', amount: won(grandTotal) })}
          </button>
        </div>
      </div>
    </div>
  )
}
