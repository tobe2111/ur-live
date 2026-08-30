import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import PanelError from './PanelError'
import { readServicesCache, warmServices } from './services-warm'
const AdsTossPayModal = lazy(() => import('./AdsTossPayModal')) // 💳 열 때만 SDK 청크 로드

/**
 * 🆕 2026-07-02 유어애즈 — 마케팅 서비스몰(카탈로그 + 주문요청, 무결제).
 *   이행은 정당한 마케팅 실행(광고/콘텐츠/인플루언서). 봇/가짜 없음.
 */
const authHeader = () => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('ads_token') : null
  return t ? { Authorization: `Bearer ${t}` } : undefined
}
const card = 'rounded-2xl border border-gray-200 dark:border-[#2C2F35] bg-white dark:bg-[#1A1C21] p-4'
const input = 'w-full h-9 rounded-lg border border-gray-200 dark:border-[#2C2F35] bg-white dark:bg-[#0D0F12] px-3 text-[13px] text-gray-900 dark:text-white placeholder:text-gray-400'

interface Pricing { unit: string; unitPrice: number; minQty: number; maxQty: number; presets?: Array<{ label: string; qty: number }>; qtyDiscounts?: Array<{ min: number; pct: number }>; options?: Array<{ key: string; label: string; price: number }> }
interface Service { id: number; category: string; name: string; subtitle: string | null; description: string | null; pricing: Pricing }
interface Price { unitPrice: number; quantity: number; subtotal: number; discountPct: number; discounted: number; optionsTotal: number; total: number }
interface Order { id: number; service_name: string; preset_label: string | null; quantity: number; total_amount: number; status: string; payment_status: string; fulfillment_method: string | null; admin_note: string | null; created_at: string }
const PAY_KO: Record<string, string> = { unpaid: '입금 대기', paid: '입금 확인', refunded: '환불' }
const PAY_CLS: Record<string, string> = { unpaid: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400', paid: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', refunded: 'bg-gray-100 dark:bg-[#1A1C21] text-gray-500 dark:text-gray-400' }
interface Review { id: number; rating: number; title: string; body: string; author_masked: string; created_at: string }
const Stars = ({ n }: { n: number }) => <span className="text-amber-400 text-[12px] tracking-tight">{'★'.repeat(Math.round(n))}<span className="text-gray-300 dark:text-gray-600">{'★'.repeat(Math.max(0, 5 - Math.round(n)))}</span></span>
const STATUS_KO: Record<string, string> = { requested: '접수됨', confirmed: '확인됨', in_progress: '진행 중', done: '완료', cancelled: '취소' }
const STATUS_CLS: Record<string, string> = { requested: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400', confirmed: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400', in_progress: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400', done: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', cancelled: 'bg-gray-100 dark:bg-[#1A1C21] text-gray-500 dark:text-gray-400' }

export default function ServiceMarketplacePanel() {
  // ⚡ 세션 캐시 즉시 페인트(services-warm) — 탭 열자마자 카드 표시, 신선분은 load()가 교체.
  const [services, setServices] = useState<Service[]>(() => (readServicesCache() as Service[] | null) || [])
  const [orders, setOrders] = useState<Order[]>([])
  const [bankInfo, setBankInfo] = useState<string | null>(null)
  const [tossEnabled, setTossEnabled] = useState(false) // 💳 서버 게이트(ADS_TOSS_ENABLED) — OFF 면 버튼 미노출
  const [payOrder, setPayOrder] = useState<Order | null>(null) // 결제 모달 대상
  const [sel, setSel] = useState<Service | null>(null)
  const [qty, setQty] = useState(1)
  const [preset, setPreset] = useState<string | null>(null)
  const [opts, setOpts] = useState<Set<string>>(new Set())
  const [price, setPrice] = useState<Price | null>(null)
  const [kakao, setKakao] = useState('')
  const [phone, setPhone] = useState('')
  const [target, setTarget] = useState('')
  const [memo, setMemo] = useState('')
  const [bizRegion, setBizRegion] = useState('') // 🎯 매칭/아웃리치 상품 — 타겟 지역(선별 기준)
  const [bizCategory, setBizCategory] = useState('') // 🎯 타겟 업종
  const [bizStore, setBizStore] = useState('') // 🎯 매장/회사명 — 발송 시 "의뢰: ○○" 병기(명의 규칙)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(false)
  // 리뷰
  const [reviews, setReviews] = useState<Review[]>([])
  const [rvSummary, setRvSummary] = useState<{ count: number; avg: number }>({ count: 0, avg: 0 })
  const [rvPage, setRvPage] = useState(1)
  const [rvPages, setRvPages] = useState(1)
  const [canWrite, setCanWrite] = useState(false)
  const [rvForm, setRvForm] = useState<{ rating: number; title: string; body: string } | null>(null)

  const load = useCallback(async () => {
    setErr(false)
    try {
      // ⚡ 서비스 목록은 워밍 in-flight 이어받기(대시보드 진입 시 선요청) — 탭 클릭 시 왕복 0에 수렴.
      const [s, o, pc] = await Promise.all([
        warmServices(),
        api.get('/api/ads/services/order-history', { headers: authHeader() }),
        api.get('/api/ads-pay/config', { headers: authHeader() }).catch(() => null),
      ])
      if (pc?.data?.success) setTossEnabled(!!pc.data.enabled)
      if (s) setServices(s as Service[]); else if (!readServicesCache()) setErr(true)
      if (o.data?.success) { setOrders(o.data.orders || []); setBankInfo(o.data.bank_info || null) }
    } catch { setErr(true) }
  }, [])
  useEffect(() => { load() }, [load])

  // 💳 토스 리다이렉트 복귀 — 서버 confirm(금액은 서버 DB 권위) 후 쿼리 청소. 실패 복귀는 안내만.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    // 탭 재편(2026-07-27): 결제 파라미터만 청소하고 서비스몰 탭 유지(?tab=services) — 홈으로 튕김 방지.
    const clean = () => window.history.replaceState({}, '', `${window.location.pathname}?tab=services`)
    if (sp.get('adsPayFail')) { toast.error(sp.get('message') || '결제가 취소되었거나 실패했습니다'); clean(); return }
    const svcOrder = sp.get('adsPaySvc')
    if (!svcOrder) return
    const paymentKey = sp.get('paymentKey'), tossOrderId = sp.get('orderId')
    clean()
    if (!paymentKey || !tossOrderId) return
    ;(async () => {
      try {
        const r = await api.post('/api/ads-pay/confirm', { order_id: Number(svcOrder), payment_key: paymentKey, toss_order_id: tossOrderId }, { headers: authHeader() })
        if (r.data?.success) { toast.success('결제가 완료되었습니다. 담당자가 확인 후 진행합니다!'); await load() }
        else toast.error(r.data?.error || '결제 확인에 실패했습니다')
      } catch (e) { toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '결제 확인에 실패했습니다') }
    })()
  }, [load])

  const loadReviews = useCallback(async (serviceId: number, page = 1) => {
    try {
      const r = await api.get(`/api/ads/services/${serviceId}/reviews?page=${page}`, { headers: authHeader() })
      if (r.data?.success) { setReviews(r.data.reviews || []); setRvSummary(r.data.summary || { count: 0, avg: 0 }); setRvPage(r.data.page || 1); setRvPages(r.data.pages || 1); setCanWrite(!!r.data.can_write) }
    } catch { /* 리뷰 로드 실패 무시 */ }
  }, [])
  const openDetail = (svc: Service) => {
    setSel(svc); setPrice(null); setOpts(new Set()); setRvForm(null)
    const first = svc.pricing.presets?.[0]
    setPreset(first?.label || null); setQty(first?.qty || svc.pricing.minQty || 1)
    loadReviews(svc.id, 1)
  }
  async function submitReview() {
    if (!sel || !rvForm) return
    setBusy(true)
    try {
      const r = await api.post(`/api/ads/services/${sel.id}/review`, rvForm, { headers: authHeader() })
      if (r.data?.success) { toast.success('후기가 등록되었습니다. 감사합니다!'); setRvForm(null); await loadReviews(sel.id, 1) }
      else toast.error(r.data?.error || '등록 실패')
    } catch (e) { toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '등록 실패') } finally { setBusy(false) }
  }
  // 가격 미리보기(서버 권위) — 선택 변경 시.
  useEffect(() => {
    if (!sel) return
    let cancelled = false
    api.post('/api/ads/services/quote', { service_id: sel.id, quantity: qty, option_keys: [...opts] }, { headers: authHeader() })
      .then(r => { if (!cancelled && r.data?.success) setPrice(r.data.price) }).catch(() => {})
    return () => { cancelled = true }
  }, [sel, qty, opts])

  // 🎯 매칭/아웃리치 상품 — 지역·업종이 선별 기준이라 필수 입력. 메모에 [지역:][업종:] 로 구조화(어드민 이행 버튼이 파싱).
  const isTargeted = !!sel && (sel.category === '매칭' || sel.category === '아웃리치')
  async function submit() {
    if (!sel) return
    if (!kakao.trim() && !phone.trim()) { toast.error('연락처(카카오 ID 또는 전화)를 입력해주세요'); return }
    if (isTargeted && (!bizRegion.trim() || !bizCategory.trim() || !bizStore.trim())) { toast.error('매장/회사명·타겟 지역·업종을 입력해주세요 (선별·발송 명의 기준)'); return }
    setBusy(true)
    try {
      const memoOut = isTargeted ? `[매장:${bizStore.trim()}] [지역:${bizRegion.trim()}] [업종:${bizCategory.trim()}]${memo.trim() ? ' ' + memo.trim() : ''}` : memo
      const r = await api.post('/api/ads/services/order', { service_id: sel.id, quantity: qty, preset_label: preset, option_keys: [...opts], contact_kakao: kakao, contact_phone: phone, target_url: target, memo: memoOut }, { headers: authHeader() })
      if (r.data?.success) { toast.success(r.data.bank_info ? `주문 접수 완료 — 입금 계좌: ${r.data.bank_info}` : '주문이 접수되었습니다. 담당자가 확인 후 연락드립니다.'); setSel(null); setKakao(''); setPhone(''); setTarget(''); setMemo(''); setBizRegion(''); setBizCategory(''); setBizStore(''); await load() }
      else toast.error(r.data?.error || '접수 실패')
    } catch (e) { toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '접수 실패') } finally { setBusy(false) }
  }

  const toggleOpt = (k: string) => setOpts(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })

  const payModal = payOrder ? (
    <Suspense fallback={null}>
      <AdsTossPayModal order={payOrder} authHeader={() => authHeader() || {}} onClose={() => setPayOrder(null)} />
    </Suspense>
  ) : null

  return (
    <div className={`mt-3 ${card}`}>
      {payModal}
      <div className="text-[14px] font-bold text-gray-900 dark:text-white">마케팅 서비스몰</div>
      <p className="mt-0.5 text-[11.5px] text-gray-400 dark:text-gray-500">SNS 성장·상위노출·체험단 등 마케팅 실행을 패키지로 주문하세요. 봇/가짜 없이 실제 광고·콘텐츠로 진행합니다. (결제 없이 요청 접수 → 담당자 확인)</p>

      {err ? <PanelError onRetry={load} /> : !sel ? (
        <>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {services.map(s => (
              <button key={s.id} onClick={() => openDetail(s)} className="text-left rounded-xl border border-gray-100 dark:border-[#2C2F35] p-3 hover:border-blue-300 dark:hover:border-blue-500/40 transition">
                <span className="text-[10.5px] font-bold text-blue-600 dark:text-blue-400">{s.category}</span>
                <div className="mt-0.5 text-[13px] font-bold text-gray-900 dark:text-white">{s.name}</div>
                <div className="mt-0.5 text-[11.5px] text-gray-500 dark:text-gray-400 line-clamp-2">{s.subtitle}</div>
                <div className="mt-1.5 text-[12px] font-bold text-gray-900 dark:text-white">{formatNumber(s.pricing.unitPrice)}원<span className="text-gray-400 dark:text-gray-500 font-medium"> / {s.pricing.unit}~</span></div>
              </button>
            ))}
          </div>

          {orders.length > 0 && (
            <div className="mt-4">
              <div className="text-[12px] font-bold text-gray-700 dark:text-gray-200 mb-1.5">내 주문</div>
              {bankInfo && orders.some(o => o.payment_status === 'unpaid' && o.status !== 'cancelled') && (
                <div className="mb-2 rounded-lg border border-amber-200 dark:border-amber-500/25 bg-amber-50/60 dark:bg-amber-500/5 p-2.5 text-[12px] text-amber-700 dark:text-amber-400">
                  <b>입금 안내</b> · {bankInfo} — 주문 금액을 입금해주시면 확인 후 진행됩니다.{tossEnabled ? ' 카드 결제도 가능합니다(주문의 💳 버튼).' : ''}
                </div>
              )}
              <div className="space-y-1.5">
                {orders.slice(0, 10).map(o => (
                  <div key={o.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 dark:border-[#2C2F35] p-2.5 text-[12px]">
                    <div className="min-w-0"><div className="font-medium text-gray-900 dark:text-white truncate">{o.service_name} {o.preset_label && <span className="text-gray-400">· {o.preset_label}</span>}</div><div className="text-[10.5px] text-gray-400 dark:text-gray-500">{o.quantity}개 · {formatNumber(o.total_amount)}원 · {(o.created_at || '').slice(0, 10)}{o.fulfillment_method ? ` · ${o.fulfillment_method}` : ''}</div>{o.admin_note && <div className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-0.5">메모: {o.admin_note}</div>}</div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span className={`px-1.5 py-0.5 rounded text-[10.5px] font-bold ${STATUS_CLS[o.status] || STATUS_CLS.requested}`}>{STATUS_KO[o.status] || o.status}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10.5px] font-bold ${PAY_CLS[o.payment_status] || PAY_CLS.unpaid}`}>{PAY_KO[o.payment_status] || o.payment_status}</span>
                      {tossEnabled && o.payment_status === 'unpaid' && o.status !== 'cancelled' && (
                        <button onClick={() => setPayOrder(o)} className="px-1.5 py-0.5 rounded bg-gray-900 dark:bg-white text-[10.5px] font-bold text-white dark:text-[#0D0F12]">💳 카드 결제</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="mt-3">
          <button onClick={() => setSel(null)} className="text-[11.5px] text-gray-500 dark:text-gray-400">← 목록</button>
          <div className="mt-1.5 text-[15px] font-bold text-gray-900 dark:text-white">{sel.name}</div>
          <div className="text-[12px] text-gray-500 dark:text-gray-400">{sel.subtitle}</div>

          {/* 티어(프리셋) + 수량 */}
          {sel.pricing.presets && sel.pricing.presets.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {sel.pricing.presets.map(p => (
                <button key={p.label} onClick={() => { setPreset(p.label); setQty(p.qty) }} className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold ${preset === p.label ? 'bg-gray-900 dark:bg-white text-white dark:text-[#0D0F12]' : 'border border-gray-200 dark:border-[#2C2F35] text-gray-600 dark:text-gray-300'}`}>{p.label}</button>
              ))}
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[12px] text-gray-500 dark:text-gray-400">수량({sel.pricing.unit})</span>
            <input type="number" min={sel.pricing.minQty} max={sel.pricing.maxQty} value={qty} onChange={e => { setQty(Number(e.target.value) || sel.pricing.minQty); setPreset(null) }} className="w-24 h-8 rounded-lg border border-gray-200 dark:border-[#2C2F35] bg-white dark:bg-[#0D0F12] px-2 text-[13px] text-gray-900 dark:text-white" />
          </div>

          {/* 옵션 */}
          {sel.pricing.options && sel.pricing.options.length > 0 && (
            <div className="mt-2 space-y-1">
              {sel.pricing.options.map(o => (
                <label key={o.key} className="flex items-center gap-2 text-[12px] text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={opts.has(o.key)} onChange={() => toggleOpt(o.key)} />
                  {o.label} <span className="text-gray-400 dark:text-gray-500">+{formatNumber(o.price)}원</span>
                </label>
              ))}
            </div>
          )}

          {/* 가격 */}
          {price && (
            <div className="mt-2.5 rounded-xl border border-gray-100 dark:border-[#2C2F35] p-3 text-[12px]">
              <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>{formatNumber(price.unitPrice)}원 × {price.quantity}{sel.pricing.unit}</span><span>{formatNumber(price.subtotal)}원</span></div>
              {price.discountPct > 0 && <div className="flex justify-between text-emerald-600 dark:text-emerald-400"><span>수량 할인 {price.discountPct}%</span><span>-{formatNumber(price.subtotal - price.discounted)}원</span></div>}
              {price.optionsTotal > 0 && <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>옵션</span><span>+{formatNumber(price.optionsTotal)}원</span></div>}
              <div className="flex justify-between mt-1 pt-1 border-t border-gray-100 dark:border-[#2C2F35] text-[14px] font-bold text-gray-900 dark:text-white"><span>합계</span><span>{formatNumber(price.total)}원</span></div>
            </div>
          )}

          {/* 연락처 + 주문 */}
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <input className={input} placeholder="카카오톡 ID" value={kakao} onChange={e => setKakao(e.target.value)} />
            <input className={input} placeholder="전화번호" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <input className={`${input} mt-2`} placeholder="대상 URL/계정 (선택, 예: 인스타 주소)" value={target} onChange={e => setTarget(e.target.value)} />
          {isTargeted && (
            <>
              <div className="mt-2 flex gap-2">
                <input className="flex-1 rounded-lg border border-gray-200 dark:border-[#2C2F35] bg-white dark:bg-[#0D0F12] p-2.5 text-[13px] text-gray-900 dark:text-white" placeholder="매장/회사명 * (제안서에 '의뢰: ○○' 로 표기)" value={bizStore} onChange={e => setBizStore(e.target.value)} />
              </div>
              <div className="mt-2 flex gap-2">
                <input className="flex-1 rounded-lg border border-gray-200 dark:border-[#2C2F35] bg-white dark:bg-[#0D0F12] p-2.5 text-[13px] text-gray-900 dark:text-white" placeholder="타겟 지역 * (예: 방배동)" value={bizRegion} onChange={e => setBizRegion(e.target.value)} />
                <input className="flex-1 rounded-lg border border-gray-200 dark:border-[#2C2F35] bg-white dark:bg-[#0D0F12] p-2.5 text-[13px] text-gray-900 dark:text-white" placeholder="업종 * (예: 맛집·뷰티)" value={bizCategory} onChange={e => setBizCategory(e.target.value)} />
              </div>
              {/* ⚖️ 기대 관리(대표 운영수칙 ②) — 과금 기준·비보장·보정을 주문 시점에 명시(환불 분쟁 예방). */}
              <div className="mt-2 rounded-lg border border-gray-200 dark:border-[#2C2F35] bg-gray-50 dark:bg-[#0D0F12] p-2.5 text-[11.5px] text-gray-500 dark:text-gray-400 leading-relaxed">
                <b className="text-gray-700 dark:text-gray-300">진행 조건</b> · 본 서비스는 <b>제안 발송 대행</b>이며 발송 완료 기준으로 과금됩니다. 회신·성사는 보장되지 않습니다.
                단, <b>회신이 1건도 없으면 동일 규모로 1회 무상 재발송</b>해 드립니다. 발송은 유어애즈 명의(+의뢰 매장 병기)로 나가며, 수신거부 요청자는 즉시 제외됩니다.
              </div>
            </>
          )}
          <textarea className={`mt-2 w-full rounded-lg border border-gray-200 dark:border-[#2C2F35] bg-white dark:bg-[#0D0F12] p-2.5 text-[13px] text-gray-900 dark:text-white`} rows={2} placeholder="요청사항 (선택)" value={memo} onChange={e => setMemo(e.target.value)} />
          <button onClick={submit} disabled={busy} className="mt-2 w-full rounded-lg bg-gray-900 dark:bg-white py-2.5 text-[13px] font-bold text-white dark:text-[#0D0F12] disabled:opacity-40">{busy ? '접수 중…' : '주문 요청하기 (결제 없음)'}</button>

          {sel.description && (
            <div className="mt-3 rounded-xl border border-gray-100 dark:border-[#2C2F35] p-3">
              <pre className="text-[12px] text-gray-600 dark:text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">{sel.description}</pre>
            </div>
          )}

          {/* 고객 리뷰(구매 검증형 — 완료 주문 고객만 작성) */}
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <div className="text-[13px] font-bold text-gray-900 dark:text-white">고객 리뷰 {rvSummary.count > 0 && <span className="ml-1 font-medium text-gray-400 dark:text-gray-500"><Stars n={rvSummary.avg} /> {rvSummary.avg} ({rvSummary.count})</span>}</div>
              {canWrite && !rvForm && <button onClick={() => setRvForm({ rating: 5, title: '', body: '' })} className="rounded-lg border border-gray-200 dark:border-[#2C2F35] px-2.5 py-1 text-[11px] font-bold text-gray-700 dark:text-gray-200">후기 쓰기</button>}
            </div>

            {rvForm && (
              <div className="mt-2 rounded-xl border border-gray-100 dark:border-[#2C2F35] p-3">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(n => <button key={n} onClick={() => setRvForm(f => f && { ...f, rating: n })} className={`text-[18px] ${n <= rvForm.rating ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'}`}>★</button>)}
                </div>
                <input className={`${input} mt-2`} placeholder="제목 (2~60자)" maxLength={60} value={rvForm.title} onChange={e => setRvForm(f => f && { ...f, title: e.target.value })} />
                <textarea className="mt-2 w-full rounded-lg border border-gray-200 dark:border-[#2C2F35] bg-white dark:bg-[#0D0F12] p-2.5 text-[13px] text-gray-900 dark:text-white" rows={3} placeholder="이용 후기를 남겨주세요 (5~1000자)" maxLength={1000} value={rvForm.body} onChange={e => setRvForm(f => f && { ...f, body: e.target.value })} />
                <div className="mt-1.5 flex justify-end gap-1.5">
                  <button onClick={() => setRvForm(null)} className="rounded-lg px-2.5 py-1 text-[11.5px] text-gray-500 dark:text-gray-400">취소</button>
                  <button onClick={submitReview} disabled={busy} className="rounded-lg bg-gray-900 dark:bg-white px-2.5 py-1 text-[11.5px] font-bold text-white dark:text-[#0D0F12] disabled:opacity-40">{busy ? '등록 중…' : '등록'}</button>
                </div>
              </div>
            )}

            {reviews.length === 0 ? (
              <p className="mt-2 text-[11.5px] text-gray-400 dark:text-gray-500">아직 후기가 없습니다. {canWrite ? '첫 후기를 남겨보세요.' : '이용 완료 후 후기를 남길 수 있습니다.'}</p>
            ) : (
              <>
                <div className="mt-2 divide-y divide-gray-100 dark:divide-[#2C2F35]">
                  {reviews.map(r => (
                    <div key={r.id} className="py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12.5px] font-semibold text-gray-900 dark:text-white truncate">{r.title}</span>
                        <Stars n={r.rating} />
                      </div>
                      <p className="mt-0.5 text-[12px] text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{r.body}</p>
                      <div className="mt-0.5 text-[10.5px] text-gray-400 dark:text-gray-500">{r.author_masked} · {(r.created_at || '').slice(0, 10)}</div>
                    </div>
                  ))}
                </div>
                {rvPages > 1 && (
                  <div className="mt-2 flex items-center justify-center gap-2 text-[12px]">
                    <button disabled={rvPage <= 1} onClick={() => loadReviews(sel.id, rvPage - 1)} className="text-gray-500 dark:text-gray-400 disabled:opacity-30">‹</button>
                    <span className="text-gray-500 dark:text-gray-400">{rvPage} / {rvPages}</span>
                    <button disabled={rvPage >= rvPages} onClick={() => loadReviews(sel.id, rvPage + 1)} className="text-gray-500 dark:text-gray-400 disabled:opacity-30">›</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
