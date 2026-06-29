import { useState, useEffect } from 'react'
import { Package, Plus, Clock, CheckCircle, XCircle, Truck, ShieldCheck, BarChart3, Upload, ChevronRight, Receipt } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { formatWon, formatNumber } from '@/utils/format'
import { supplierApi } from '@/lib/supplier-api'
import WholesaleSignupMetaEditor from '@/components/wholesale/WholesaleSignupMetaEditor'
import type { Me, Tab } from './types'

export default function OverviewTab({ me, meError, onRetry, t, onAdd, onGoTab, pendingShipCount }: { me: Me | null; meError: boolean; onRetry: () => void; t: (k: string, o?: Record<string, unknown>) => string; onAdd: () => void; onGoTab: (tab: Tab) => void; pendingShipCount: number }) {
  if (meError) return (
    <div className="py-16 text-center">
      <p className="text-sm text-gray-500 mb-3">{t('supplier.meLoadFailed', { defaultValue: '데이터를 불러오지 못했어요.' })}</p>
      <button onClick={onRetry} className="px-4 py-2 bg-[#FC5424] text-white rounded-xl text-sm font-semibold">{t('common.retry', { defaultValue: '다시 시도' })}</button>
    </div>
  )
  if (!me) return (
    <div className="py-16 text-center text-gray-400 text-sm">{t('common.loading', { defaultValue: '불러오는 중...' })}</div>
  )
  const b = me.balance
  const c = me.product_counts
  const approved = me.profile.status === 'approved'
  const noProducts = (c.total ?? 0) === 0
  const shipN = formatNumber(pendingShipCount)
  const rejectedN = formatNumber(c.rejected ?? 0)
  const pendingN = formatNumber(c.pending ?? 0)
  // '할 일' 카드 — 가용 데이터로 actionable. 발송 대기(primary) > 반려 > 검수 대기 순.
  const todos: { key: string; label: string; count: string; Icon: typeof Package; on: () => void; tone: 'danger' | 'info' }[] = []
  if ((pendingShipCount ?? 0) > 0) todos.push({ key: 'ship', label: t('supplier.todoShip', { defaultValue: '발송 대기 {{n}}건', n: shipN }).replace('{{n}}', shipN), count: shipN, Icon: Truck, on: () => onGoTab('orders'), tone: 'danger' })
  if ((c.rejected ?? 0) > 0) todos.push({ key: 'rejected', label: t('supplier.todoRejected', { defaultValue: '반려된 상품 {{n}}건 · 수정 후 재등록', n: rejectedN }).replace('{{n}}', rejectedN), count: rejectedN, Icon: XCircle, on: () => onGoTab('catalog'), tone: 'danger' })
  if ((c.pending ?? 0) > 0) todos.push({ key: 'pending', label: t('supplier.todoPending', { defaultValue: '검수 대기 {{n}}건 (관리자 승인 중)', n: pendingN }).replace('{{n}}', pendingN), count: pendingN, Icon: Clock, on: () => onGoTab('catalog'), tone: 'info' })
  const cards = [
    { label: t('supplier.balPending', { defaultValue: '정산 대기' }), value: b.pending_amount, cls: 'text-amber-600' },
    { label: t('supplier.balAvailable', { defaultValue: '출금 가능' }), value: Math.max(0, (b.available_amount ?? 0) - (b.reserved_amount ?? 0)), cls: 'text-blue-600' },
    { label: t('supplier.balPaid', { defaultValue: '지급 완료(누적)' }), value: b.paid_amount, cls: 'text-green-600' },
  ]
  const actions: { label: string; desc: string; Icon: typeof Package; on: () => void; primary?: boolean; disabled?: boolean }[] = [
    { label: t('supplier.qaAddProduct', { defaultValue: '상품 등록' }), desc: t('supplier.qaAddProductDesc', { defaultValue: '도매몰에 올릴 공급상품' }), Icon: Plus, on: onAdd, primary: true, disabled: !approved },
    { label: t('supplier.qaBulk', { defaultValue: '대량 등록' }), desc: t('supplier.qaBulkDesc', { defaultValue: 'CSV로 한번에' }), Icon: Upload, on: () => onGoTab('catalog'), disabled: !approved },
    { label: t('supplier.qaCatalog', { defaultValue: '내 카탈로그' }), desc: t('supplier.qaCatalogDesc', { defaultValue: '등록 상품 관리' }), Icon: Package, on: () => onGoTab('catalog') },
    { label: t('supplier.qaShip', { defaultValue: '발송 관리' }), desc: t('supplier.qaShipDesc', { defaultValue: '주문 송장 입력' }), Icon: Truck, on: () => onGoTab('orders') },
    { label: t('supplier.qaSettle', { defaultValue: '정산 내역' }), desc: t('supplier.qaSettleDesc', { defaultValue: '매출·지급 내역' }), Icon: Receipt, on: () => onGoTab('settlements') },
    { label: t('supplier.qaSalesSettle', { defaultValue: '매출·정산' }), desc: t('supplier.qaSalesSettleDesc', { defaultValue: '추이·베스트셀러' }), Icon: BarChart3, on: () => onGoTab('settlements') },
  ]
  return (
    <div className="space-y-6">
      {/* 승인 상태 */}
      {!approved ? (
        <div className="px-4 py-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-900">{t('supplier.pendingTitle', { defaultValue: '승인 대기 중' })}</p>
            <p className="text-xs text-amber-700 mt-0.5">{t('supplier.pendingDesc', { defaultValue: '관리자 승인 후 상품 등록·정산이 활성화됩니다. 보통 1영업일 이내 처리돼요.' })}</p>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3.5 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-green-600 shrink-0" />
          <p className="text-sm font-semibold text-green-800">{t('supplier.approvedDesc', { defaultValue: '승인 완료 — 등록한 상품은 검수 후 전국 판매사에게 노출됩니다.' })}</p>
        </div>
      )}

      {/* 빈 상태 히어로 or 상단 등록 CTA */}
      {approved && noProducts ? (
        <div className="rounded-2xl p-6 text-white" style={{ background: 'linear-gradient(135deg,#FC5424,#FF4D77)' }}>
          <h3 className="text-lg font-bold">{t('supplier.emptyHeroTitle', { defaultValue: '첫 공급상품을 등록하세요' })}</h3>
          <p className="text-sm text-white/85 mt-1 mb-4">{t('supplier.emptyHeroDesc', { defaultValue: '등록 → 관리자 검수 → 도매몰 노출. 전국 판매사가 내 등급 공급가로 사입합니다.' })}</p>
          <button onClick={onAdd} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white text-[#FC5424] font-bold text-sm">
            <Plus className="w-4 h-4" /> {t('supplier.addProductBtn', { defaultValue: '상품 등록하기' })}
          </button>
        </div>
      ) : approved ? (
        <button onClick={onAdd} className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-[#FC5424] text-white font-bold text-sm">
          <Plus className="w-4 h-4" /> {t('supplier.addProductNew', { defaultValue: '새 상품 등록' })}
        </button>
      ) : null}

      {/* 🧭 2026-06-12 (감사 개선 ⑥): 온보딩 마일스톤 — 첫 정산까지의 여정을 보여줘 "올렸는데 안 팔린다" 이탈 방지.
          전부 달성하면 표시하지 않음(졸업 — 화면 소음 0). */}
      {approved && (() => {
        const ms = me.milestones
        const steps: Array<{ label: string; done: boolean; hint: string }> = [
          { label: t('supplier.msApproved', { defaultValue: '가입 승인' }), done: true, hint: '' },
          { label: t('supplier.msFirstProduct', { defaultValue: '첫 상품 등록' }), done: me.product_counts.total > 0, hint: t('supplier.msFirstProductHint', { defaultValue: '위 버튼으로 1분 — 엑셀로 여러 개도 OK' }) },
          { label: t('supplier.msFirstApproved', { defaultValue: '첫 상품 승인' }), done: me.product_counts.approved > 0, hint: t('supplier.msFirstApprovedHint', { defaultValue: '검수 통과 시 전국 판매사에게 노출' }) },
          { label: t('supplier.msFirstOrder', { defaultValue: '첫 주문' }), done: (ms?.orders ?? 0) > 0, hint: t('supplier.msFirstOrderHint', { defaultValue: '판매사가 사입하면 벨 알림으로 알려드려요' }) },
          { label: t('supplier.msFirstSettle', { defaultValue: '첫 정산 적립' }), done: (ms?.settlements ?? 0) > 0, hint: t('supplier.msFirstSettleHint', { defaultValue: '결제 즉시 적립 — 정산 탭에서 출금 신청' }) },
        ]
        const remaining = steps.filter(s => !s.done)
        if (remaining.length === 0) return null
        const next = remaining[0]
        return (
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">{t('supplier.msTitle', { defaultValue: '첫 정산까지' })} <span className="text-xs font-medium text-gray-400">({steps.filter(s => s.done).length}/{steps.length})</span></p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {steps.map((s, i) => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-bold ${s.done ? 'bg-green-50 text-green-700' : s === next ? 'bg-[#FFF0F2] text-[#FC5424]' : 'bg-gray-50 text-gray-400'}`}>
                    {s.done ? <CheckCircle className="w-3 h-3" /> : null}{s.label}
                  </span>
                  {i < steps.length - 1 && <span className="text-gray-300 text-[10px]">→</span>}
                </div>
              ))}
            </div>
            {next?.hint && <p className="text-[11.5px] text-gray-500 mt-2.5">👉 {t('supplier.msNext', { defaultValue: '다음' })}: <b className="text-gray-700">{next.label}</b> — {next.hint}</p>}
          </div>
        )
      })()}

      {/* 할 일 — actionable. 발송 대기 / 반려 / 검수 대기. 빈 상태 히어로(첫 상품 등록)는 위에서 별도 처리. */}
      {approved && !noProducts && (
        <div>
          <p className="text-sm font-semibold text-gray-900 mb-3">{t('supplier.todoTitle', { defaultValue: '할 일' })}</p>
          {todos.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 px-4 py-4 flex items-center gap-2 text-sm text-gray-500">
              <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
              {t('supplier.todoClear', { defaultValue: '✓ 처리할 일이 없어요' })}
            </div>
          ) : (
            <div className="space-y-2">
              {todos.map(td => (
                <button key={td.key} onClick={td.on}
                  className={`w-full text-left rounded-2xl border px-4 py-3.5 flex items-center gap-3 transition-colors ${td.tone === 'danger' ? 'border-amber-200 bg-amber-50 hover:bg-amber-100' : 'border-blue-200 bg-blue-50 hover:bg-blue-100'}`}>
                  <td.Icon className={`w-5 h-5 shrink-0 ${td.tone === 'danger' ? 'text-amber-600' : 'text-blue-600'}`} />
                  <p className={`flex-1 min-w-0 text-sm font-semibold ${td.tone === 'danger' ? 'text-amber-900' : 'text-blue-900'}`}>{td.label}</p>
                  <ChevronRight className={`w-4 h-4 shrink-0 ${td.tone === 'danger' ? 'text-amber-500' : 'text-blue-500'}`} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 빠른 작업 */}
      <div>
        <p className="text-sm font-semibold text-gray-900 mb-3">{t('supplier.quickActions', { defaultValue: '빠른 작업' })}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {actions.map(a => (
            <button key={a.label} onClick={a.disabled ? undefined : a.on} disabled={a.disabled}
              className={`text-left rounded-2xl border p-4 transition-colors ${a.disabled ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed' : a.primary ? 'border-[#FC5424]/30 bg-[#FC5424]/5 hover:bg-[#FC5424]/10' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
              <a.Icon className={`w-5 h-5 mb-2 ${a.primary ? 'text-[#FC5424]' : 'text-gray-500'}`} />
              <p className="text-sm font-bold text-gray-900">{a.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{a.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 정산 요약 */}
      <div>
        <p className="text-sm font-semibold text-gray-900 mb-3">{t('supplier.settleSummary', { defaultValue: '정산 요약' })}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {cards.map(card => (
            <div key={card.label} className="bg-white rounded-2xl border border-gray-200 p-5">
              <p className="text-xs text-gray-500 mb-1">{card.label}</p>
              <p className={`text-2xl font-bold ${card.cls}`}>{formatWon(card.value)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 공급상품 현황 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-gray-900">{t('supplier.productSummary', { defaultValue: '공급상품 현황' })}</p>
          <button onClick={() => onGoTab('catalog')} className="text-xs font-bold text-[#FC5424]">{t('supplier.viewAll', { defaultValue: '전체 보기 →' })}</button>
        </div>
        <div className="grid grid-cols-4 gap-3 text-center">
          {[
            { label: t('supplier.cntTotal', { defaultValue: '전체' }), v: c.total, cls: 'text-gray-900' },
            { label: t('supplier.cntPending', { defaultValue: '대기' }), v: c.pending, cls: 'text-amber-600' },
            { label: t('supplier.cntApproved', { defaultValue: '승인' }), v: c.approved, cls: 'text-green-600' },
            { label: t('supplier.cntRejected', { defaultValue: '거부' }), v: c.rejected, cls: 'text-red-500' },
          ].map(x => (
            <div key={x.label}>
              <p className={`text-xl font-bold ${x.cls}`}>{x.v}</p>
              <p className="text-xs text-gray-500 mt-0.5">{x.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 🚚 배송/주문 정책 — 제조사별 최소주문금액 + 배송비 + 무료배송 기준 */}
      <ShippingPolicyCard t={t} />

      {/* 🏭 2026-06-29 (E): 가입 시 입력한 공급 카테고리·희망 유통채널 사후 수정 */}
      <WholesaleSignupMetaEditor kind="supplier" />
    </div>
  )
}

// ── 🚚 2026-06-09 배송/주문 정책 설정 카드 (self-contained 로드/저장) ──────────────
//   min_order_amount(최소주문금액) / shipping_fee(배송비) / free_ship_threshold(무료배송 기준).
//   판매사 장바구니에서 이 제조사 라인 합이 최소주문금액 미만이면 주문 불가 + 배송비 자동 합산.
function ShippingPolicyCard({ t }: { t: (k: string, o?: Record<string, unknown>) => string }) {
  const [minOrder, setMinOrder] = useState('')
  const [shipFee, setShipFee] = useState('')
  const [freeShip, setFreeShip] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    supplierApi.get<{ data: { min_order_amount: number; shipping_fee: number; free_ship_threshold: number } }>('/api/supplier/shipping-policy')
      .then(r => {
        if (!alive) return
        setMinOrder(String(r.data?.min_order_amount ?? 0))
        setShipFee(String(r.data?.shipping_fee ?? 0))
        setFreeShip(String(r.data?.free_ship_threshold ?? 0))
      })
      .catch(err => { if (import.meta.env.DEV) console.error(err) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const save = async () => {
    const toNum = (v: string) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0 }
    setSaving(true)
    try {
      await supplierApi.patch('/api/supplier/shipping-policy', {
        min_order_amount: toNum(minOrder),
        shipping_fee: toNum(shipFee),
        free_ship_threshold: toNum(freeShip),
      })
      toast.success(t('supplier.shipPolicySaved', { defaultValue: '배송 정책이 저장되었습니다' }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('supplier.shipPolicySaveErr', { defaultValue: '저장에 실패했습니다' }))
    } finally { setSaving(false) }
  }

  const inputCls = 'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-[#FC5424]/30 focus:border-[#FC5424] outline-none'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1'
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-1">
        <Truck className="w-4 h-4 text-[#FC5424]" />
        <p className="text-sm font-semibold text-gray-900">{t('supplier.shipPolicyTitle', { defaultValue: '배송/주문 정책' })}</p>
      </div>
      <p className="text-xs text-gray-500 mb-4">{t('supplier.shipPolicyDesc', { defaultValue: '판매사 장바구니에서 우리 상품 합계가 최소주문금액 미만이면 주문할 수 없어요. 배송비는 주문 시 자동 합산됩니다. (0 = 제한/배송비/무료배송 없음)' })}</p>
      {loading ? (
        <div className="py-6 text-center text-gray-400 text-sm">{t('common.loading', { defaultValue: '불러오는 중...' })}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>{t('supplier.minOrderAmount', { defaultValue: '최소 주문 금액(원)' })}</label>
              <input type="number" min={0} value={minOrder} disabled={saving} onChange={e => setMinOrder(e.target.value)} className={inputCls} placeholder="0" />
            </div>
            <div>
              <label className={labelCls}>{t('supplier.shippingFee', { defaultValue: '배송비(원)' })}</label>
              <input type="number" min={0} value={shipFee} disabled={saving} onChange={e => setShipFee(e.target.value)} className={inputCls} placeholder="0" />
            </div>
            <div>
              <label className={labelCls}>{t('supplier.freeShipThreshold', { defaultValue: '무료배송 기준(원)' })}</label>
              <input type="number" min={0} value={freeShip} disabled={saving} onChange={e => setFreeShip(e.target.value)} className={inputCls} placeholder="0" />
            </div>
          </div>
          <button onClick={save} disabled={saving} className="mt-4 w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#FC5424] text-white font-semibold text-sm disabled:opacity-60">
            {saving ? t('common.loading', { defaultValue: '저장 중...' }) : t('supplier.savePolicy', { defaultValue: '정책 저장' })}
          </button>
        </>
      )}
    </div>
  )
}
