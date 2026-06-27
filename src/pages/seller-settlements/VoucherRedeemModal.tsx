import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { confirmDialog } from '@/components/ui/confirm-dialog'

// 🛡️ 2026-06-10: SellerSettlementsPage 분해 — 순수 이동 (동작 변화 0).
// 🛡️ 2026-05-19: 교환권 (KT Alpha) 발송 모달 — 비사업자 셀러 핵심 흐름.
interface CatalogItem {
  gift_code: string
  name: string
  brand_name: string
  brand_icon_url?: string
  sale_price: number
  real_price: number
  discount_rate: number
  image_url_small?: string
  valid_period_type?: string
  valid_period_days?: number
  goods_type_detail?: string
}

export default function VoucherRedeemModal({ totalBalance, onClose, onSuccess }: {
  totalBalance: number; onClose: () => void; onSuccess: () => void
}) {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [markupPct, setMarkupPct] = useState(5)
  const [withholdingRate, setWithholdingRate] = useState(0)
  const [isBusinessVerified, setIsBusinessVerified] = useState(false)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<CatalogItem | null>(null)
  const [qty, setQty] = useState(1)
  // 🛡️ KT Alpha 가이드라인: 본인 명의 휴대폰 강제 — 셀러 회원가입 시 등록한 phone 만 허용.
  const [sellerPhone, setSellerPhone] = useState('')
  // 🛡️ KT Alpha 가이드라인: 발송 전 두 가지 동의 강제.
  const [acceptExpiry, setAcceptExpiry] = useState(false)
  const [acceptB2B, setAcceptB2B] = useState(false)
  // 🛡️ 원천징수 동의 (비사업자만).
  const [acceptTax, setAcceptTax] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { load() }, []) // eslint-disable-line

  async function load() {
    setLoading(true)
    try {
      const token = localStorage.getItem('seller_token')
      const r = await api.get(`/api/seller/voucher-catalog?q=${encodeURIComponent(q)}`,
        { headers: { Authorization: `Bearer ${token}` } })
      if (r.data?.success) {
        setItems(r.data.data.items || [])
        setMarkupPct(Number(r.data.data.markup_pct) || 5)
        setSellerPhone(String(r.data.data.seller_phone || ''))
        setWithholdingRate(Number(r.data.data.withholding_rate) || 0)
        setIsBusinessVerified(Boolean(r.data.data.is_business_verified))
      }
    } catch { /* fail-soft */ } finally { setLoading(false) }
  }

  function unitDeduct(item: CatalogItem) {
    return Math.floor(item.real_price * (1 + markupPct / 100))
  }
  const totalDeduct = selected ? unitDeduct(selected) * qty : 0
  // 원천징수 (비사업자만) — 액면가 기준 8.8%.
  const grossForTax = selected ? selected.real_price * qty : 0
  const withholdingAmount = !isBusinessVerified ? Math.floor(grossForTax * withholdingRate / 100) : 0
  const totalDeductWithTax = totalDeduct + withholdingAmount

  const hasPhone = /^01\d{8,9}$/.test(sellerPhone)
  const needTaxConsent = !isBusinessVerified && withholdingAmount > 0
  const canSubmit = selected && totalDeductWithTax > 0 && totalDeductWithTax <= totalBalance
    && hasPhone && acceptExpiry && acceptB2B && (!needTaxConsent || acceptTax)

  const phoneMasked = hasPhone
    ? sellerPhone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3')
    : ''

  async function submit() {
    if (!selected) return
    if (!acceptExpiry || !acceptB2B) { toast.error('약관 동의 필요'); return }
    if (needTaxConsent && !acceptTax) { toast.error('원천징수 동의 필요'); return }
    const taxLine = needTaxConsent ? `\n원천징수: ₩${withholdingAmount.toLocaleString()}` : ''
    if (!(await confirmDialog({ message: `${selected.name} × ${qty} → ${phoneMasked}\n총 차감: ₩${totalDeductWithTax.toLocaleString()}${taxLine}\n\n⚠️ 30일 유효기간 / 환불 불가 동의하신 것 맞나요?`, danger: true }))) return
    setSubmitting(true)
    try {
      const token = localStorage.getItem('seller_token')
      const r = await api.post('/api/seller/voucher-redeem', {
        gift_code: selected.gift_code,
        qty,
        phone: sellerPhone,
        terms_accepted_expiry: acceptExpiry,
        terms_accepted_b2b: acceptB2B,
      }, { headers: { Authorization: `Bearer ${token}` } })
      if (r.data?.success) {
        const d = r.data.data
        const totalShown = d.total_deduct_with_tax || d.total_deduct
        toast.success(`✅ 발송 완료 (${d.qty}건, 차감 ₩${totalShown.toLocaleString()})`)
        onSuccess()
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '발송 실패')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 z-[10500] bg-black/50 backdrop-blur-sm p-4 flex items-center justify-center"
      onClick={() => !submitting && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">🎁 교환권으로 받기</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              잔액 ₩{totalBalance.toLocaleString()} 에서 차감 · KT Alpha (기프티쇼) B2B 정산
            </p>
          </div>
          <button onClick={onClose} disabled={submitting} aria-label="모달 닫기" className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        {/* 🛡️ KT Alpha 가이드라인 — 30일 유효기간 / 환불 불가 / B2B 사전 고지 */}
        <div className="mx-5 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 space-y-1">
          <p className="font-bold flex items-center gap-1">⚠️ 발송 전 반드시 확인하세요</p>
          <ul className="list-disc list-inside space-y-0.5 ml-1">
            <li><b>유효기간 30일 고정</b> — 연장 불가</li>
            <li><b>발송 후 환불 / 취소 불가</b> (KT Alpha B2B 쿠폰 정책)</li>
            <li><b>본인 명의 휴대폰만 발송 가능</b> — 회원가입 시 등록한 번호로 강제 발송</li>
            <li>발송 = 셀러 적립금에서 즉시 차감 (현금 정산 대체)</li>
          </ul>
        </div>

        {/* 검색 + 카탈로그 */}
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="flex gap-2">
            <input type="text" value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
              placeholder="브랜드명 / 상품명 검색"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <button onClick={load} className="text-xs px-3 py-2 bg-gray-100 rounded-lg">검색</button>
          </div>
        </div>

        {/* 카탈로그 그리드 */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <p className="text-xs text-gray-500 text-center py-8">로딩 중...</p>
          ) : items.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-8">
              카탈로그 비어있음 — 어드민이 sync 후 다시 시도해주세요
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {items.map((item) => {
                const deduct = unitDeduct(item)
                const isSel = selected?.gift_code === item.gift_code
                return (
                  <button key={item.gift_code} type="button"
                    onClick={() => setSelected(item)}
                    className={`border-2 rounded-lg overflow-hidden text-left ${
                      isSel ? 'border-pink-500 bg-pink-50' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}>
                    <div className="aspect-square bg-gray-100">
                      {item.image_url_small && <img src={item.image_url_small} alt={item.name} className="w-full h-full object-cover" loading="lazy" />}
                    </div>
                    <div className="p-2">
                      <p className="text-[10px] text-gray-500 font-semibold">{item.brand_name}</p>
                      <p className="text-xs font-bold text-gray-900 line-clamp-2">{item.name}</p>
                      <div className="mt-1.5">
                        <p className="text-[10px] text-gray-400 line-through">₩{item.sale_price.toLocaleString()}</p>
                        <p className="text-xs font-extrabold text-pink-600">차감 ₩{deduct.toLocaleString()}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* 선택 요약 + 발송 */}
        {selected && (
          <div className="px-5 py-4 border-t border-gray-200 bg-gray-50">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">수량</label>
                <input type="number" min={1} max={10} value={qty}
                  onChange={(e) => setQty(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">받을 휴대폰 (본인 명의 강제)</label>
                {hasPhone ? (
                  <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm font-mono text-gray-700 flex items-center gap-2">
                    🔒 {phoneMasked}
                  </div>
                ) : (
                  <div className="px-3 py-2 bg-red-50 border border-red-300 rounded-lg text-xs text-red-700">
                    셀러 본인 휴대폰 미등록 — <a href="/seller/profile" className="underline font-bold">설정에서 등록</a>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded p-3 text-xs mb-3 space-y-0.5">
              <p className="flex justify-between"><span className="text-gray-500">선택 상품</span><span className="font-semibold">{selected.name} × {qty}</span></p>
              <p className="flex justify-between"><span className="text-gray-500">단가 (markup {markupPct}% 포함)</span><span>₩{unitDeduct(selected).toLocaleString()}</span></p>
              <p className="flex justify-between"><span className="text-gray-500">교환권 차감</span><span>₩{totalDeduct.toLocaleString()}</span></p>
              {needTaxConsent && (
                <p className="flex justify-between text-amber-700">
                  <span>+ 원천징수 ({withholdingRate}%, 비사업자)</span>
                  <span>₩{withholdingAmount.toLocaleString()}</span>
                </p>
              )}
              <p className="flex justify-between pt-1 border-t border-gray-200"><span className="text-gray-700 font-bold">총 차감액</span><span className="text-base font-extrabold text-pink-600">₩{totalDeductWithTax.toLocaleString()}</span></p>
              {totalDeductWithTax > totalBalance && (
                <p className="text-red-600 text-[11px] font-bold mt-1">⚠️ 잔액 부족 (보유 ₩{totalBalance.toLocaleString()})</p>
              )}
            </div>

            {/* 🛡️ KT Alpha 가이드라인 — 발송 전 동의 체크박스 강제 */}
            <div className="bg-white border border-amber-200 rounded p-3 mb-3 space-y-2">
              <label className="flex items-start gap-2 text-[11px] text-gray-700 cursor-pointer">
                <input type="checkbox" checked={acceptExpiry} onChange={(e) => setAcceptExpiry(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-pink-500 flex-shrink-0" />
                <span>
                  <b className="text-amber-700">[필수]</b> 본 교환권은 <b>발행일로부터 30일 유효</b>하며,
                  발송 후 <b>환불 / 취소 / 유효기간 연장이 불가</b>함을 확인했습니다 (KT Alpha B2B 쿠폰 정책).
                </span>
              </label>
              <label className="flex items-start gap-2 text-[11px] text-gray-700 cursor-pointer">
                <input type="checkbox" checked={acceptB2B} onChange={(e) => setAcceptB2B(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-pink-500 flex-shrink-0" />
                <span>
                  <b className="text-amber-700">[필수]</b> 본 교환권은 <b>유어딜이 자사 셀러(본인)에게 지급하는 B2B 정산 수단</b>이며,
                  최종 소비자 판매 목적이 아님을 확인했습니다. 본인 명의 휴대폰으로만 발송됩니다.
                </span>
              </label>
              {needTaxConsent && (
                <label className="flex items-start gap-2 text-[11px] text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={acceptTax} onChange={(e) => setAcceptTax(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-pink-500 flex-shrink-0" />
                  <span>
                    <b className="text-amber-700">[비사업자 필수]</b> 본인은 사업자등록증을 보유하지 않은 개인이며,
                    소득세법 §21 기타소득에 따라 <b>액면가의 {withholdingRate}% (₩{withholdingAmount.toLocaleString()}) 원천징수</b> 후
                    교환권을 수령함에 동의합니다. 연 누계 300만원 초과 시 종합소득 합산 신고 의무가 본인에게 있습니다.
                  </span>
                </label>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={onClose} disabled={submitting}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg disabled:opacity-50">
                취소
              </button>
              <button onClick={submit} disabled={submitting || !canSubmit}
                className="flex-1 px-4 py-2 bg-pink-500 text-white text-sm font-bold rounded-lg hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed">
                {submitting ? '발송 중...' : `🎁 ₩${totalDeduct.toLocaleString()} 차감 후 발송`}
              </button>
            </div>
            {!canSubmit && selected && (
              <p className="text-[10px] text-amber-600 mt-2 text-center">
                {!hasPhone && '· 셀러 본인 휴대폰 등록 필요 '}
                {(!acceptExpiry || !acceptB2B) && '· 약관 2종 동의 필요 '}
                {needTaxConsent && !acceptTax && '· 원천징수 동의 필요 '}
                {totalDeductWithTax > totalBalance && '· 잔액 부족'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
