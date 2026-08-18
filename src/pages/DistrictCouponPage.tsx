/**
 * 🧾 2026-07-13 상권 쿠폰(영수증 페이백) — 소비자 페이지.
 *   /district/:slug      캠페인 랜딩: 안내 + 참여 점포 + 영수증 등록 폼
 *   /district/my         내 영수증·쿠폰 지갑(PIN 사용처리) — 라우트는 App.tsx 에서 두 경로 모두 이 컴포넌트.
 *
 * 테마: 화이트(쇼핑 플로우) + dark: variant. 백엔드: features/district/api/district-coupon.routes.ts.
 * 머니: 무상 쿠폰 — 결제/딜과 무관(병렬 엔티티). 사용 = 매장 선택 + 매장 확인코드(PIN) self-redeem.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import SEO from '@/components/SEO'
import BrandLoader from '@/components/brand/BrandLoader'
import { formatWon } from '@/utils/format'
import { ArrowLeft, Camera, MapPin, Receipt, Store, TicketPercent, Wallet } from 'lucide-react'
import { formatKSTDate } from '@/utils/date'

interface Tier { min_amount: number; face_value: number }
interface Campaign { id: number; slug: string; name: string; description?: string | null; status: string; reward_tiers: Tier[]; coupon_expires_days: number }
interface StoreRow { id: number; name: string; address?: string | null; deal_count?: number; deal_product_id?: number; deal_name?: string }
interface MyReceipt { id: number; amount: number; status: string; reject_reason?: string | null; created_at: string; store_name?: string | null; campaign_slug: string }
interface MyCoupon { id: number; code: string; face_value: number; status: string; expires_at: string; redeemed_at?: string | null; redeemed_store_name?: string | null; campaign_name: string; campaign_slug: string; source?: string }

const RECEIPT_STATUS: Record<string, { label: string; cls: string }> = {
  submitted: { label: '검수 중', cls: 'bg-amber-100 text-amber-700' },
  approved: { label: '지급 완료', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: '반려됨', cls: 'bg-red-100 text-red-600' },
}

function isLoggedIn(): boolean {
  try { return !!localStorage.getItem('user_id') } catch { return false }
}

// ── 영수증 등록 폼 ────────────────────────────────────────────────────────────
function ReceiptForm({ campaign, stores, onDone }: { campaign: Campaign; stores: StoreRow[]; onDone: () => void }) {
  const [storeId, setStoreId] = useState('')
  const [amount, setAmount] = useState('')
  const [approvalNo, setApprovalNo] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const minTier = campaign.reward_tiers.length ? campaign.reward_tiers[campaign.reward_tiers.length - 1].min_amount : 0

  const submit = async () => {
    if (!isLoggedIn()) { window.location.href = `/login?returnUrl=${encodeURIComponent(`/district/${campaign.slug}`)}`; return }
    if (!storeId) { toast.error('구매한 매장을 선택해주세요'); return }
    const amt = Number(amount.replace(/[^0-9]/g, ''))
    if (!amt || amt < minTier) { toast.error(`최소 ${formatWon(minTier)} 이상 결제 영수증만 등록할 수 있어요`); return }
    if (approvalNo.replace(/[^0-9a-zA-Z]/g, '').length < 4) { toast.error('영수증의 카드 승인번호를 입력해주세요'); return }
    if (!file) { toast.error('영수증 사진을 첨부해주세요'); return }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.set('store_id', storeId); fd.set('amount', String(amt)); fd.set('card_approval_no', approvalNo); fd.set('image', file)
      const r = await api.post(`/api/district/campaigns/${campaign.slug}/receipts`, fd)
      if (r.data?.success) {
        toast.success(r.data.message || '접수되었습니다 — 검수 후 쿠폰이 지급돼요')
        setStoreId(''); setAmount(''); setApprovalNo(''); setFile(null)
        onDone()
      } else toast.error(r.data?.error || '접수에 실패했습니다')
    } catch (e) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '접수에 실패했습니다')
    } finally { setBusy(false) }
  }

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-[#2A3446] bg-white dark:bg-[#0F151D] p-4 space-y-3">
      <h2 className="flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-white"><Receipt className="w-4 h-4" />영수증 등록</h2>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-200">구매 매장</label>
        <select value={storeId} onChange={(e) => setStoreId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 dark:border-[#2A3446] bg-white dark:bg-[#1A2334] px-3 py-2.5 text-sm text-gray-900 dark:text-white">
          <option value="">매장 선택</option>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-200">결제 금액 (원)</label>
        <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder={`최소 ${minTier.toLocaleString()}원`}
          className="w-full rounded-lg border border-gray-300 dark:border-[#2A3446] bg-white dark:bg-[#1A2334] px-3 py-2.5 text-sm text-gray-900 dark:text-white" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-200">카드 승인번호</label>
        <input value={approvalNo} onChange={(e) => setApprovalNo(e.target.value)} placeholder="영수증에 표기된 승인번호"
          className="w-full rounded-lg border border-gray-300 dark:border-[#2A3446] bg-white dark:bg-[#1A2334] px-3 py-2.5 font-mono text-sm text-gray-900 dark:text-white" />
        <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">같은 영수증은 한 번만 등록할 수 있어요</p>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-200">영수증 사진</label>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 dark:border-[#2A3446] px-3 py-5 text-sm text-gray-500 dark:text-gray-400">
          <Camera className="w-4 h-4" />
          {file ? <span className="truncate max-w-[220px] text-gray-900 dark:text-white font-medium">{file.name}</span> : '사진 촬영 또는 선택 (JPG/PNG)'}
          <input type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
      </div>
      <button type="button" disabled={busy} onClick={submit}
        className="w-full rounded-2xl bg-gray-900 dark:bg-white py-3.5 text-[15px] font-extrabold text-white dark:text-gray-900 disabled:opacity-50 active:scale-[0.98] transition-transform">
        {busy ? '접수 중…' : '영수증 등록하고 쿠폰 받기'}
      </button>
    </div>
  )
}

// ── 쿠폰 사용(PIN) 모달 ──────────────────────────────────────────────────────
function RedeemModal({ coupon, stores, onClose, onRedeemed }: { coupon: MyCoupon; stores: StoreRow[]; onClose: () => void; onRedeemed: () => void }) {
  const navigate = useNavigate()
  const [storeId, setStoreId] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  // 🔗 전환 다리(게이트 ON 시 서버가 bridge 동봉): 사용 완료 화면에 상권 딜 추천 1줄.
  const [doneBridge, setDoneBridge] = useState<{ product_id: number; name: string } | null>(null)
  const redeem = async () => {
    if (!storeId) { toast.error('사용할 매장을 선택해주세요'); return }
    if (!/^\d{4,8}$/.test(pin)) { toast.error('매장 카운터의 확인코드(숫자)를 입력해주세요'); return }
    setBusy(true)
    try {
      const r = await api.post(`/api/district/coupons/${coupon.code}/redeem`, { store_id: Number(storeId), store_code: pin })
      if (r.data?.success) {
        onRedeemed()
        if (r.data.bridge?.product_id) { setDoneBridge(r.data.bridge) }  // 추천 있으면 완료 화면 유지
        else { toast.success(r.data.message || '사용 완료!'); onClose() }
      }
      else toast.error(r.data?.error || '사용 처리에 실패했습니다')
    } catch (e) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '사용 처리에 실패했습니다')
    } finally { setBusy(false) }
  }
  if (doneBridge) {
    return (
      <div className="fixed inset-0 z-[10600] flex items-end sm:items-center justify-center bg-black/60" onClick={onClose} role="presentation">
        <div className="w-full sm:max-w-xs sm:mx-4 rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#0F151D] p-6 text-center" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
          <p className="text-3xl" aria-hidden>✅</p>
          <p className="mt-2 text-[17px] font-extrabold text-gray-900 dark:text-white">사용 완료!</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">결제 금액에서 쿠폰 금액을 빼고 결제하세요</p>
          <button type="button" onClick={() => navigate(`/pass/${doneBridge.product_id}`)}
            className="mt-4 w-full rounded-2xl border border-gray-200 dark:border-[#2A3446] px-3 py-3 text-left active:scale-[0.98] transition-transform">
            <span className="block text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400">🎟 이 상권의 동네딜</span>
            <span className="mt-0.5 block truncate text-[13px] font-bold text-gray-900 dark:text-white">{doneBridge.name} 보러가기 →</span>
          </button>
          <button type="button" onClick={onClose} className="mt-2 w-full py-2 text-sm font-bold text-gray-500 dark:text-gray-400">닫기</button>
        </div>
      </div>
    )
  }
  return (
    <div className="fixed inset-0 z-[10600] flex items-end sm:items-center justify-center bg-black/60" onClick={onClose} role="presentation">
      <div className="w-full sm:max-w-xs sm:mx-4 rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#0F151D] p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <p className="text-center text-[17px] font-extrabold text-gray-900 dark:text-white">{formatWon(coupon.face_value)} 상권 쿠폰</p>
        <p className="mt-1 text-center font-mono text-sm font-bold tracking-widest text-gray-500 dark:text-gray-400">{coupon.code}</p>
        <div className="mt-4 space-y-3">
          <select value={storeId} onChange={(e) => setStoreId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-[#2A3446] bg-white dark:bg-[#1A2334] px-3 py-2.5 text-sm text-gray-900 dark:text-white">
            <option value="">사용 매장 선택</option>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
            placeholder="매장 확인코드 (직원에게 문의)"
            className="w-full rounded-lg border border-gray-300 dark:border-[#2A3446] bg-white dark:bg-[#1A2334] px-3 py-2.5 text-center font-mono text-lg tracking-[0.3em] text-gray-900 dark:text-white" />
          <p className="text-[10.5px] leading-relaxed text-gray-400 dark:text-gray-500">
            직원 앞에서 눌러주세요 — 사용 즉시 이 매장으로 정산돼요. 결제 금액에서 쿠폰 금액을 빼고 결제하세요.
          </p>
          <button type="button" disabled={busy} onClick={redeem}
            className="w-full rounded-2xl bg-gray-900 dark:bg-white py-3.5 text-[15px] font-extrabold text-white dark:text-gray-900 disabled:opacity-50">
            {busy ? '처리 중…' : '이 매장에서 사용하기'}
          </button>
          <button type="button" onClick={onClose} className="w-full py-2 text-sm font-bold text-gray-500 dark:text-gray-400">닫기</button>
        </div>
      </div>
    </div>
  )
}

// ── 페이지 본체 ──────────────────────────────────────────────────────────────
export default function DistrictCouponPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const isMy = !slug || slug === 'my'
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [stores, setStores] = useState<StoreRow[]>([])
  const [receipts, setReceipts] = useState<MyReceipt[]>([])
  const [coupons, setCoupons] = useState<MyCoupon[]>([])
  const [loading, setLoading] = useState(true)
  const [redeemTarget, setRedeemTarget] = useState<MyCoupon | null>(null)
  const [redeemStores, setRedeemStores] = useState<StoreRow[]>([])

  const loadCampaign = useCallback(async (s: string) => {
    const r = await api.get(`/api/district/campaigns/${encodeURIComponent(s)}`).catch(() => null)
    if (r?.data?.success) { setCampaign(r.data.campaign); setStores(r.data.stores || []) }
  }, [])
  const loadMy = useCallback(async () => {
    if (!isLoggedIn()) return
    const r = await api.get('/api/district/my').catch(() => null)
    if (r?.data?.success) { setReceipts(r.data.receipts || []); setCoupons(r.data.coupons || []) }
  }, [])

  useEffect(() => {
    setLoading(true)
    const jobs: Promise<unknown>[] = [loadMy()]
    if (!isMy && slug) jobs.push(loadCampaign(slug))
    Promise.all(jobs).finally(() => setLoading(false))
  }, [slug, isMy, loadCampaign, loadMy])

  // 사용 모달 열 때 그 캠페인 점포 목록 확보(랜딩에서 왔으면 재사용)
  const openRedeem = useCallback(async (cp: MyCoupon) => {
    if (campaign && campaign.slug === cp.campaign_slug && stores.length) { setRedeemStores(stores); setRedeemTarget(cp); return }
    const r = await api.get(`/api/district/campaigns/${encodeURIComponent(cp.campaign_slug)}`).catch(() => null)
    setRedeemStores(r?.data?.stores || [])
    setRedeemTarget(cp)
  }, [campaign, stores])

  const unusedCoupons = useMemo(() => coupons.filter((c) => c.status === 'unused'), [coupons])
  const pastCoupons = useMemo(() => coupons.filter((c) => c.status !== 'unused'), [coupons])

  if (loading) return <BrandLoader fullScreen />

  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-[#1A2334] pb-24">
      <SEO title={`${campaign ? campaign.name : '상권 쿠폰'} - 유어딜`} description="영수증 등록하고 상권 쿠폰 받기 — 참여 점포 어디서든 사용" url={isMy ? '/district/my' : `/district/${slug}`} />
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-gray-100 dark:border-[#2A3446] bg-white dark:bg-[#0F151D] px-4 py-3">
        <button type="button" onClick={() => navigate(-1)} aria-label="뒤로"><ArrowLeft className="h-5 w-5 text-gray-900 dark:text-white" /></button>
        <h1 className="flex-1 text-base font-bold text-gray-900 dark:text-white">{isMy ? '내 상권 쿠폰' : campaign?.name || '상권 쿠폰'}</h1>
        {!isMy && <button type="button" onClick={() => navigate('/district/my')} className="flex items-center gap-1 text-xs font-bold text-gray-500 dark:text-gray-400"><Wallet className="h-4 w-4" />내 쿠폰</button>}
      </header>

      <div className="mx-auto ur-content-narrow space-y-4 px-4 py-4 lg:px-8">
        {/* 캠페인 랜딩 */}
        {!isMy && campaign && (
          <>
            <div className="rounded-2xl border border-gray-200 dark:border-[#2A3446] bg-white dark:bg-[#0F151D] p-4">
              <p className="flex items-center gap-1.5 text-sm font-extrabold text-gray-900 dark:text-white"><TicketPercent className="h-4 w-4" />영수증 페이백</p>
              {campaign.description && <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400 whitespace-pre-wrap">{campaign.description}</p>}
              <ul className="mt-2 space-y-1">
                {campaign.reward_tiers.map((t, i) => (
                  <li key={i} className="text-[13px] font-bold text-gray-900 dark:text-white">
                    {formatWon(t.min_amount)} 이상 구매 → <span className="text-emerald-600 dark:text-emerald-400">{formatWon(t.face_value)} 쿠폰</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10.5px] text-gray-400 dark:text-gray-500">지급된 쿠폰은 참여 점포 {stores.length}곳 어디서든 사용 · 발급 후 {campaign.coupon_expires_days}일 이내</p>
            </div>
            {campaign.status === 'open'
              ? <ReceiptForm campaign={campaign} stores={stores} onDone={loadMy} />
              : <div className="rounded-2xl border border-gray-200 dark:border-[#2A3446] bg-white dark:bg-[#0F151D] p-5 text-center text-sm font-bold text-gray-500 dark:text-gray-400">접수가 종료된 캠페인입니다</div>}
            <div className="rounded-2xl border border-gray-200 dark:border-[#2A3446] bg-white dark:bg-[#0F151D] p-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-white"><Store className="h-4 w-4" />참여 점포 ({stores.length})</p>
              <ul className="max-h-56 space-y-1.5 overflow-y-auto">
                {stores.map((s) => (
                  <li key={s.id} className="text-[12.5px] text-gray-600 dark:text-gray-300">
                    <span className="font-medium text-gray-900 dark:text-white">{s.name}</span>
                    {s.address && <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] text-gray-400 dark:text-gray-500"><MapPin className="h-3 w-3" />{s.address}</span>}
                    {/* 🔗 전환 다리(게이트 ON 시에만 서버가 동봉): 이 매장의 유어딜 동네딜 병기 */}
                    {!!s.deal_product_id && (
                      <button type="button" onClick={() => navigate(`/pass/${s.deal_product_id}`)}
                        className="ml-1.5 inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700 dark:text-emerald-400 active:opacity-70">
                        동네딜 {s.deal_count && s.deal_count > 1 ? `${s.deal_count}개` : ''} →
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
        {!isMy && !campaign && (
          <div className="py-16 text-center text-sm font-bold text-gray-500 dark:text-gray-400">캠페인을 찾을 수 없습니다</div>
        )}

        {/* 내 쿠폰/영수증 (my 뷰 + 랜딩 하단 공용) */}
        {(isMy || unusedCoupons.length > 0) && (
          <div className="space-y-2.5">
            <p className="text-[13px] font-semibold text-gray-500 dark:text-gray-400">사용 가능 쿠폰 <span className="text-gray-400 dark:text-gray-500">{unusedCoupons.length}</span></p>
            {unusedCoupons.length === 0 && isMy && (
              <div className="rounded-2xl border border-gray-200 dark:border-[#2A3446] bg-white dark:bg-[#0F151D] p-6 text-center text-sm text-gray-400 dark:text-gray-500">아직 쿠폰이 없어요 — 영수증을 등록해보세요</div>
            )}
            {unusedCoupons.map((cp) => (
              <button key={cp.id} type="button" onClick={() => void openRedeem(cp)}
                className="flex w-full items-center gap-3 rounded-2xl border border-gray-200 dark:border-[#2A3446] bg-white dark:bg-[#0F151D] p-4 text-left active:scale-[0.99] transition-transform">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/20">
                  <TicketPercent className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-extrabold text-gray-900 dark:text-white">{formatWon(cp.face_value)}
                    {cp.source === 'online' && <span className="ml-1.5 align-middle rounded bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 text-[9.5px] font-semibold text-blue-600 dark:text-blue-300">결제 자동지급</span>}
                  </p>
                  <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{cp.campaign_name} · {formatKSTDate(cp.expires_at)}까지</p>
                </div>
                <span className="shrink-0 rounded-full bg-gray-900 dark:bg-white px-3 py-1.5 text-[11px] font-bold text-white dark:text-gray-900">사용하기</span>
              </button>
            ))}
          </div>
        )}
        {isMy && (receipts.length > 0 || pastCoupons.length > 0) && (
          <div className="space-y-2.5">
            <p className="text-[13px] font-semibold text-gray-500 dark:text-gray-400">등록한 영수증</p>
            {receipts.map((r) => {
              const st = RECEIPT_STATUS[r.status] || { label: r.status, cls: 'bg-gray-100 dark:bg-[#1A2334] text-gray-500 dark:text-gray-400' }
              return (
                <div key={r.id} className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-[#2A3446] bg-white dark:bg-[#0F151D] px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-gray-900 dark:text-white">{formatWon(r.amount)} <span className="font-normal text-gray-400 dark:text-gray-500">· {r.store_name || '매장'}</span></p>
                    <p className="text-[10.5px] text-gray-400 dark:text-gray-500">{formatKSTDate(r.created_at)}{r.status === 'rejected' && r.reject_reason ? ` · ${r.reject_reason}` : ''}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                </div>
              )
            })}
            {pastCoupons.map((cp) => (
              <div key={cp.id} className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-[#2A3446] bg-white dark:bg-[#0F151D] px-4 py-3 opacity-60">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-gray-900 dark:text-white">{formatWon(cp.face_value)} 쿠폰</p>
                  <p className="text-[10.5px] text-gray-400 dark:text-gray-500">
                    {cp.status === 'used' ? `사용 완료 · ${cp.redeemed_store_name || ''}` : '만료됨'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
        {isMy && !isLoggedIn() && (
          <div className="py-10 text-center">
            <p className="mb-3 text-sm font-bold text-gray-900 dark:text-white">로그인하고 내 쿠폰을 확인하세요</p>
            <button type="button" onClick={() => { window.location.href = '/login?returnUrl=%2Fdistrict%2Fmy' }}
              className="rounded-full bg-gray-900 dark:bg-white px-5 py-2.5 text-sm font-bold text-white dark:text-gray-900">로그인</button>
          </div>
        )}
      </div>

      {redeemTarget && (
        <RedeemModal coupon={redeemTarget} stores={redeemStores} onClose={() => setRedeemTarget(null)} onRedeemed={() => void loadMy()} />
      )}
    </div>
  )
}
