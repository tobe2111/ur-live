/**
 * 🛡️ 2026-05-25 (migration 0278): 큐레이터 수익 대시보드 (/u/me/earnings).
 *
 * Phase 1-C 핵심 UX — 수익 가시화.
 * 30일 적립 / 클릭 / 구매 / 인기 핀 top 3 / 일별 차트.
 * 출금은 기존 user_withdrawals 시스템 재활용 (Phase 4 에서 본격 통합).
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import { curatorApi, type DashboardStats } from '@/features/curator/api/curator-api'
import { useAuthStore } from '@/client/stores/auth.store'
import { formatWon, formatNumber, safeNum } from '@/utils/format'
import { cfImage } from '@/utils/cf-image'
import { toast } from '@/hooks/useToast'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import ImageUpload from '@/components/ImageUpload'

interface WithdrawalInfo {
  lifetime_earnings: number
  total_withdrawn: number
  available: number
  min_withdrawal: number
  withholding_rate: number
  history: Array<{ id: number; amount: number; withholding_tax: number; net_amount: number; bank_name: string; status: string; requested_at: string }>
  seller_upgrade: { threshold: number; eligible: boolean; offered: boolean }
  // 🛡️ 2026-05-25 신모델: 정산 분기
  payout_mode: 'cash' | 'deal'
  is_business_seller: boolean
  deal_balance: number
}

export default function CuratorEarningsPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s: any) => s.user)
  // 🎨 2026-06-17 (콘솔 @handle 표시 fix): dashboard select 가 handle 을 버려 user.handle(주로 null)에만
  //   의존 → 헤더 @handle 미표시 + '내 링크샵' 이 /u/me 리다이렉트 홉. localStorage.user_handle
  //   (App/UMeRedirect/Kakao 가 기록, BottomNav 와 동일 소스)로 seed → 직접 /u/{handle} 진입.
  const [handle, setHandle] = useState<string | null>(() => {
    const fromUser = (user as any)?.handle
    if (fromUser) return fromUser
    try { return localStorage.getItem('user_handle') || null } catch { return null }
  })
  const [wdInfo, setWdInfo] = useState<WithdrawalInfo | null>(null)
  const [showWithdraw, setShowWithdraw] = useState(false)

  // 🛡️ 2026-05-31: 메인 대시보드 fetch → useApiQuery (RQ — 재방문 캐시/dedup). 인증=인터셉터 자동.
  const dashQ = useApiQuery<DashboardStats | null>(
    ['curator', 'dashboard'],
    '/api/curator/me/dashboard',
    { select: (raw) => ((raw as { success?: boolean; stats?: DashboardStats })?.success ? ((raw as { stats: DashboardStats }).stats) : null) },
  )
  const stats = dashQ.data ?? null
  const loading = dashQ.isLoading
  const error = dashQ.isError ? t('curator.dashboardError', { defaultValue: '대시보드 로딩 실패' }) : null

  useEffect(() => {
    curatorApi.getWithdrawalInfo().then((res) => {
      if (res.success) setWdInfo(res as any)
    }).catch(() => {})
  }, [])

  async function reloadWithdrawal() {
    try {
      const res = await curatorApi.getWithdrawalInfo()
      if (res.success) setWdInfo(res as any)
    } catch {}
  }

  // best-effort: handle 가져오기
  useEffect(() => {
    if (handle || !user) return
    // user store 에 handle 없을 수 있음. /api/curator/me/dashboard 응답에는 없으나 user store sync 가
    // 미반영일 수 있어 굳이 안 받아옴. 핀 추가하면 자동 동기.
  }, [handle, user])

  return (
    <>
      <SEO title={t('curator.console.title', { defaultValue: '크리에이터 콘솔' })} noindex />
      <div className="min-h-screen bg-white dark:bg-[#0A0A0A] text-gray-900 dark:text-white pb-24">
        <header className="sticky top-0 z-20 bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A] px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <h1 className="text-lg font-bold">🎤 {t('curator.console.title', { defaultValue: '크리에이터 콘솔' })}</h1>
            {handle && (
              <Link to={`/u/${handle}`} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                @{handle}
              </Link>
            )}
          </div>
        </header>

        <div className="max-w-3xl mx-auto px-4 py-6">
          {/* 🏁 2026-06-15 (옵션 1 콘솔): 크리에이터 핵심 동선 빠른 진입 — 링크샵/공구 호스팅 */}
          <div className="grid grid-cols-2 gap-2 mb-5">
            <Link to={handle ? `/u/${handle}` : '/u/me'}
              className="rounded-2xl bg-gray-100 dark:bg-white/[0.04] active:bg-gray-200 dark:active:bg-white/[0.08] p-4 transition-colors">
              <p className="text-[13px] font-bold text-gray-900 dark:text-white">🔗 내 링크샵</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">상품 핀 추가·정렬·공유</p>
            </Link>
            <Link to="/host"
              className="rounded-2xl bg-gray-100 dark:bg-white/[0.04] active:bg-gray-200 dark:active:bg-white/[0.08] p-4 transition-colors">
              <p className="text-[13px] font-bold text-gray-900 dark:text-white">✨ 공구 호스팅</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">동네 공구 직접 제안</p>
            </Link>
          </div>
          {loading ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-12">{t('common.loading')}</p>
          ) : error ? (
            <p className="text-center text-red-500 py-12">{error}</p>
          ) : !stats ? null : (
            <>
              <SummaryCards stats={stats} />
              {wdInfo && (
                <WithdrawalCard
                  info={wdInfo}
                  onWithdraw={() => setShowWithdraw(true)}
                  onAckUpgrade={async () => {
                    await curatorApi.acknowledgeUpgradeOffer()
                    setWdInfo({ ...wdInfo, seller_upgrade: { ...wdInfo.seller_upgrade, offered: true } })
                  }}
                />
              )}
              <IntroducedStoresSection />
              <SellOwnProductsCTA />
              <TopPinsSection stats={stats} />
              <RecentEarningsSection stats={stats} />
              <DailyChart stats={stats} />
            </>
          )}
        </div>

        {/* 출금 모달 — 사업자 셀러만 (payout_mode='cash') */}
        {showWithdraw && wdInfo && wdInfo.payout_mode === 'cash' && (
          <WithdrawModal
            info={wdInfo}
            onClose={() => setShowWithdraw(false)}
            onSuccess={() => { setShowWithdraw(false); reloadWithdrawal() }}
          />
        )}
      </div>
    </>
  )
}

function IntroducedStoresSection() {
  const [data, setData] = useState<{ total_commission: number; stores: Array<{ id: number; business_name: string | null; status: string | null; referral_bonus_until: string | null; total_orders: number; total_sales: number }> } | null>(null)
  const [proxyFor, setProxyFor] = useState<{ id: number; name: string } | null>(null)

  useEffect(() => {
    curatorApi.getIntroducedStores().then((r) => { if (r.success) setData(r) }).catch(() => {})
  }, [])

  if (!data || data.stores.length === 0) return null

  return (
    <section className="mb-6 bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-gray-900 dark:text-white">🏪 내가 영입한 매장</p>
        <span className="text-xs text-gray-500 dark:text-gray-400">누적 커미션 {formatWon(data.total_commission)}</span>
      </div>
      <div className="space-y-2">
        {data.stores.map((s) => {
          const expired = s.referral_bonus_until && new Date(s.referral_bonus_until) < new Date()
          return (
            <div key={s.id} className="flex items-center justify-between text-xs border-b border-gray-100 dark:border-[#1A1A1A] pb-2 last:border-0">
              <div>
                <span className="font-bold text-gray-900 dark:text-white">{s.business_name || `매장 #${s.id}`}</span>
                <span className="ml-2 text-gray-400 dark:text-gray-500">{s.total_orders}건 · {formatWon(s.total_sales)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  expired ? 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-500 dark:text-gray-500'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                }`}>
                  {expired ? '커미션 만료' : (s.referral_bonus_until ? `~${s.referral_bonus_until.slice(0, 10)}` : '무기한')}
                </span>
                <button
                  onClick={() => setProxyFor({ id: s.id, name: s.business_name || `매장 #${s.id}` })}
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-500 text-white"
                >
                  공구 대행 등록
                </button>
              </div>
            </div>
          )
        })}
      </div>
      {proxyFor && <ProxyProductModal merchant={proxyFor} onClose={() => setProxyFor(null)} />}
    </section>
  )
}

function ProxyProductModal({ merchant, onClose }: { merchant: { id: number; name: string }; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', description: '', price: '', stock: '', category: '', image_url: '' })
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    if (submitting) return
    if (!form.name.trim() || !form.price) { toast.error('상품명/가격을 입력하세요'); return }
    setSubmitting(true)
    try {
      const r = await curatorApi.createProxyProduct({
        merchant_seller_id: merchant.id,
        name: form.name.trim(),
        description: form.description || undefined,
        price: Number(form.price),
        stock: form.stock ? Number(form.stock) : undefined,
        category: form.category || undefined,
        image_url: form.image_url || undefined,
      })
      if (r.success) { toast.success(r.message || '대행 등록 완료'); onClose() }
      else toast.error(r.error || '등록 실패')
    } catch {
      toast.error('등록 중 오류가 발생했습니다')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white dark:bg-[#121212] rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">공구 대행 등록</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{merchant.name} — 등록 후 매장 승인 시 공개됩니다.</p>
        <div className="space-y-2">
          {([
            ['name', '상품명'],
            ['price', '가격 (원)'],
            ['stock', '재고 (선택)'],
            ['category', '카테고리 (선택)'],
            ['image_url', '대표 이미지 URL (선택)'],
          ] as const).map(([k, label]) => (
            <input
              key={k}
              value={(form as any)[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              placeholder={label}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white"
            />
          ))}
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="설명 (선택)"
            rows={2}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white"
          />
          <div className="flex gap-2 pt-1">
            <button onClick={submit} disabled={submitting} className="flex-1 py-2 bg-pink-500 text-white text-sm font-bold rounded-lg disabled:opacity-50">
              {submitting ? '등록 중…' : '대행 등록'}
            </button>
            <button onClick={onClose} className="px-3 py-2 text-gray-500 dark:text-gray-400 text-sm">취소</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 🏁 2026-06-17 — "사업자 등록 → 사업자 유저" 단일 진입 (사용자 명칭 확정: 유저 / 사업자 유저).
 *   일원화: 과거 BusinessSection(현금정산용 사업자등록)과 본 카드(판매 매장등록)가 분리돼 "사업자
 *   등록"이 2군데였고, 현금 출금 게이트(curator.routes:861)가 이미 '연결 승인 매장'을 요구해
 *   BusinessSection-only 등록은 현금정산이 안 되는 오해유발 UI였음 → BusinessSection 은퇴, 본 카드로 통합.
 *   유저 → [사업자 등록 1번 = 판매 승인] → 사업자 유저 (판매 + 추천수익 현금정산 동시).
 *   기존 검증된 매장 등록(/seller/register/supplier → register-from-user store_owner) + 어드민 승인
 *   재활용. 승인되면 /u/{handle} 가 셀러 상점 + 추천 핀(CuratorPinsSection) 통합 페이지가 됨.
 */
function SellOwnProductsCTA() {
  const navigate = useNavigate()
  const [sellerStatus, setSellerStatus] = useState<{ has_seller?: boolean; status?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)

  useEffect(() => {
    import('@/lib/api').then(({ default: api }) => {
      api.get('/api/seller/my-seller-status')
        .then((r) => { if (r.data?.success) setSellerStatus(r.data.data) })
        .catch((e) => { if (import.meta.env.DEV) console.warn('[curator:sell-cta]', e) })
        .finally(() => setLoading(false))
    })
  }, [])

  if (loading) return null

  const st = sellerStatus?.status
  const hasSeller = !!sellerStatus?.has_seller

  // 승인됨 → (a) 인라인 빠른 상품 등록 (대시보드 안 나감) + (b) 셀러 대시보드(주문·정산 관리)로 전환
  if (hasSeller && (st === 'approved' || st === 'active')) {
    const goDashboard = async () => {
      if (switching) return
      setSwitching(true)
      try {
        const { default: api } = await import('@/lib/api')
        const res = await api.post('/api/seller/switch-to-seller')
        if (res.data?.success) {
          const { accessToken, refreshToken, seller } = res.data.data
          localStorage.setItem('seller_token', accessToken)
          localStorage.setItem('seller_refresh_token', refreshToken)
          localStorage.setItem('seller_id', String(seller.id))
          localStorage.setItem('seller_name', seller.name)
          localStorage.setItem('seller_email', seller.email)
          localStorage.setItem('seller_username', seller.username)
          localStorage.setItem('seller_type', seller.seller_type)
          navigate('/seller')
        } else {
          toast.error('셀러 전환에 실패했습니다')
        }
      } catch {
        toast.error('셀러 전환에 실패했습니다')
      } finally {
        setSwitching(false)
      }
    }
    return (
      <section className="mb-6 bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 rounded-xl p-4">
        <p className="text-sm font-bold text-pink-800 dark:text-pink-200">✅ 사업자 유저 — 판매·현금 정산 활성</p>
        <p className="text-xs text-pink-700 dark:text-pink-300 mt-1 mb-3">
          여기서 바로 상품을 등록하거나, 판매 관리에서 주문·정산을 확인하세요. 등록한 상품은 내 링크샵에 함께 표시됩니다.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowQuickAdd(true)}
            className="px-4 py-2 bg-pink-500 text-white text-xs font-bold rounded-lg"
          >
            + 빠른 상품 등록
          </button>
          <button
            onClick={goDashboard}
            disabled={switching}
            className="px-4 py-2 bg-white dark:bg-[#1A1A1A] border border-pink-300 dark:border-pink-700 text-pink-700 dark:text-pink-300 text-xs font-bold rounded-lg disabled:opacity-50"
          >
            {switching ? '이동 중…' : '판매 관리 →'}
          </button>
        </div>
        {showQuickAdd && (
          <QuickProductModal
            onClose={() => setShowQuickAdd(false)}
            onSuccess={() => setShowQuickAdd(false)}
          />
        )}
      </section>
    )
  }

  // 심사 중 (셀러 신청 접수됨)
  if (hasSeller && st === 'pending') {
    return (
      <section className="mb-6 bg-gray-50 dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A] rounded-xl p-4">
        <p className="text-sm font-bold text-gray-900 dark:text-white">🧾 사업자 등록 신청 접수됨</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          관리자 승인 후 판매·현금 정산이 활성화됩니다.
        </p>
      </section>
    )
  }

  // 반려/정지
  if (hasSeller && (st === 'rejected' || st === 'suspended')) {
    return (
      <section className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
        <p className="text-sm font-bold text-red-800 dark:text-red-200">🧾 사업자 등록 신청 {st === 'rejected' ? '반려됨' : '정지됨'}</p>
        <p className="text-xs text-red-700 dark:text-red-300 mt-1">자세한 내용은 고객센터로 문의해주세요.</p>
      </section>
    )
  }

  // 셀러 아님 → 판매 시작 안내 (현행 모델: 판매=매장 등록 → /seller/register/supplier, register-from-user store_owner)
  return (
    <section className="mb-6 bg-gray-50 dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A] rounded-xl p-4">
      <p className="text-sm font-bold text-gray-900 dark:text-white">🧾 사업자 등록하고 판매 시작하기</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">
        사업자 등록하면 내 상품·공구권 판매 + 추천 수익 현금 정산이 함께 열려요. 관리자 승인 후 활성화되며, 승인되면 내 링크샵에 추천 핀과 함께 표시됩니다.
      </p>
      <button
        onClick={() => navigate('/seller/register/supplier?from=curator')}
        className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold rounded-lg"
      >
        사업자 등록하기 →
      </button>
    </section>
  )
}

/**
 * 🏁 2026-06-17 (#3a 인라인 상품 등록): 크리에이터 콘솔에서 대시보드 안 나가고 바로 상품 등록.
 *   기존 검증된 POST /api/seller/products(name+price 필수) 재활용 — 신규 판매/정산 코드 0.
 *   셀러 토큰은 transient: seller_token 없으면 switch-to-seller 의 accessToken 을 헤더로만 전달
 *   (localStorage 미저장 → 콘솔에 머물며 셀러모드 UI 안 뒤집힘). 있으면 api client 자동 부착.
 *   이미지=공용 ImageUpload(이미지압축 dynamic import). 상세옵션은 셀러 대시보드에서.
 */
function QuickProductModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: '', price: '', stock: '', category: 'lifestyle', image_url: '' })
  const [submitting, setSubmitting] = useState(false)
  // 셀러 컨텍스트 준비: seller_token 보장(없으면 switch-to-seller 로 발급·저장). BottomNav DISPLAY 는
  //   active_role 기준이라 seller_token 저장이 소비자 UI 를 안 바꿈(BottomNav line 121) → 저장 안전.
  //   이미지 업로드(/api/seller/upload-image)·상품 POST 가 api client 의 자동 seller_token 부착으로 동작.
  const [sellerReady, setSellerReady] = useState(!!(typeof window !== 'undefined' && localStorage.getItem('seller_token')))

  useEffect(() => {
    if (sellerReady) return
    let cancelled = false
    ;(async () => {
      try {
        const { default: api } = await import('@/lib/api')
        const sw = await api.post('/api/seller/switch-to-seller')
        if (!cancelled && sw.data?.success) {
          const { accessToken, refreshToken, seller } = sw.data.data
          localStorage.setItem('seller_token', accessToken)
          localStorage.setItem('seller_refresh_token', refreshToken)
          localStorage.setItem('seller_id', String(seller.id))
          localStorage.setItem('seller_name', seller.name)
          localStorage.setItem('seller_email', seller.email)
          localStorage.setItem('seller_username', seller.username)
          localStorage.setItem('seller_type', seller.seller_type)
          setSellerReady(true)
        }
      } catch { /* 준비 실패 — submit 시 안내 */ }
    })()
    return () => { cancelled = true }
  }, [sellerReady])

  const submit = async () => {
    if (submitting) return
    if (!sellerReady) { toast.error('판매자 준비 중입니다. 잠시 후 다시 시도해주세요'); return }
    const price = Number(form.price)
    if (!form.name.trim()) { toast.error('상품명을 입력해주세요'); return }
    if (!Number.isFinite(price) || price < 0) { toast.error('가격을 올바르게 입력해주세요'); return }
    const stockNum = form.stock.trim() === '' ? 0 : Number(form.stock)
    if (!Number.isFinite(stockNum) || stockNum < 0) { toast.error('재고를 올바르게 입력해주세요'); return }
    setSubmitting(true)
    try {
      const { default: api } = await import('@/lib/api')
      // seller_token 은 위 useEffect 에서 보장 → api client 가 /api/seller/* 에 자동 부착
      const res = await api.post('/api/seller/products', {
        name: form.name.trim(),
        price,
        stock: stockNum,
        category: form.category,
        delivery_type: 'shipping',
        ...(form.image_url ? { image_url: form.image_url } : {}),
      })
      if (res.data?.success) {
        toast.success('상품이 등록됐어요! 내 상점·링크샵에 표시됩니다.')
        onSuccess()
      } else {
        const e = res.data?.error
        toast.error(typeof e === 'string' ? e : '상품 등록에 실패했습니다')
      }
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } }
      toast.error(err.response?.data?.error || '상품 등록 중 오류가 발생했습니다')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60" onClick={onClose} role="presentation">
      <div
        className="w-full max-w-[430px] bg-white dark:bg-[#121212] rounded-t-3xl px-5 pt-5 pb-8 max-h-[85dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label="빠른 상품 등록"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">빠른 상품 등록</h2>
          <button onClick={onClose} aria-label="닫기" className="p-1 rounded-full text-gray-500 dark:text-gray-400 text-lg leading-none">✕</button>
        </div>
        <div className="space-y-3">
          <input
            value={form.name}
            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
            maxLength={200}
            placeholder="상품명 *"
            className="w-full px-3.5 py-2.5 bg-gray-100 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] rounded-xl text-sm text-gray-900 dark:text-white"
          />
          <div className="flex gap-2">
            <input
              value={form.price}
              onChange={(e) => setForm(f => ({ ...f, price: e.target.value.replace(/[^\d]/g, '') }))}
              inputMode="numeric"
              placeholder="가격(원) *"
              className="flex-1 min-w-0 px-3.5 py-2.5 bg-gray-100 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] rounded-xl text-sm text-gray-900 dark:text-white"
            />
            <input
              value={form.stock}
              onChange={(e) => setForm(f => ({ ...f, stock: e.target.value.replace(/[^\d]/g, '') }))}
              inputMode="numeric"
              placeholder="재고"
              className="w-24 px-3.5 py-2.5 bg-gray-100 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] rounded-xl text-sm text-gray-900 dark:text-white"
            />
          </div>
          <select
            value={form.category}
            onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
            className="w-full px-3.5 py-2.5 bg-gray-100 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] rounded-xl text-sm text-gray-900 dark:text-white"
          >
            <option value="fashion">패션</option>
            <option value="beauty">뷰티</option>
            <option value="food">식품</option>
            <option value="electronics">전자기기</option>
            <option value="lifestyle">라이프스타일</option>
          </select>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">상품 이미지 (선택)</label>
            {sellerReady ? (
              <ImageUpload value={form.image_url} onChange={(url) => setForm(f => ({ ...f, image_url: url }))} label="" maxSizeKB={800} />
            ) : (
              <div className="text-xs text-gray-400 dark:text-gray-500 py-3 px-3.5 bg-gray-100 dark:bg-[#1A1A1A] rounded-xl">판매자 준비 중…</div>
            )}
          </div>
        </div>
        <button
          onClick={submit}
          disabled={submitting || !sellerReady}
          className="w-full mt-5 py-3.5 bg-pink-500 text-white font-bold rounded-xl text-sm disabled:opacity-50"
        >
          {submitting ? '등록 중…' : !sellerReady ? '준비 중…' : '상품 등록'}
        </button>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 text-center mt-2">
          상세설명·옵션·디지털상품 등 자세한 설정은 셀러 대시보드에서 편집할 수 있어요.
        </p>
      </div>
    </div>
  )
}

function WithdrawalCard({ info, onWithdraw, onAckUpgrade }: { info: WithdrawalInfo; onWithdraw: () => void; onAckUpgrade: () => Promise<void> }) {
  // 🛡️ 2026-05-25 신모델: 사업자 셀러는 실제 돈 출금, 일반 user 는 딜 잔액 표시.
  const isCash = info.payout_mode === 'cash'
  return (
    <section className="mb-6">
      {isCash ? (
        <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl p-5 text-white">
          <p className="text-xs opacity-80 mb-1">💰 출금 가능 잔액 (현금)</p>
          <p className="text-3xl font-bold mb-3">{formatWon(info.available)}</p>
          <div className="flex justify-between text-xs opacity-90 mb-4">
            <span>누적 적립 {formatWon(info.lifetime_earnings)}</span>
            <span>출금 {formatWon(info.total_withdrawn)}</span>
          </div>
          <button
            onClick={onWithdraw}
            disabled={info.available < info.min_withdrawal}
            className="w-full py-2.5 bg-white dark:bg-[#0A0A0A] text-pink-600 font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {info.available < info.min_withdrawal
              ? `최소 ${formatWon(info.min_withdrawal)} 부터 출금 가능`
              : '출금 신청'}
          </button>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl p-5 text-white">
          <p className="text-xs opacity-80 mb-1">🟡 내 딜 잔액</p>
          <p className="text-3xl font-bold mb-3">{formatNumber(info.deal_balance)}딜</p>
          <p className="text-xs opacity-90 mb-3">
            누적 적립 {formatNumber(info.lifetime_earnings)}딜 — 1딜 = 1원으로 쇼핑/공구에 사용
          </p>
          <Link
            to="/browse"
            className="block w-full py-2.5 bg-white dark:bg-[#0A0A0A] text-orange-600 font-bold rounded-lg text-center"
          >
            🛍️ 쇼핑 둘러보기
          </Link>
        </div>
      )}

      {/* 셀러 승급 안내 */}
      {info.seller_upgrade.eligible && !info.seller_upgrade.offered && (
        <div className="mt-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
          <p className="text-sm font-bold text-amber-900 dark:text-amber-100 mb-1">🎯 셀러 승급 안내</p>
          <p className="text-xs text-amber-800 dark:text-amber-200 mb-3">
            누적 적립이 {formatWon(info.seller_upgrade.threshold)} 를 넘었어요! 셀러로 승급하시면 직접 상품 판매·라이브 송출이 가능해져요.
          </p>
          <div className="flex gap-2">
            <Link to="/seller/register" className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg text-center">
              셀러 가입하기
            </Link>
            <button onClick={onAckUpgrade} className="px-3 py-2 text-amber-700 dark:text-amber-300 text-xs font-bold">
              나중에
            </button>
          </div>
        </div>
      )}

      {/* 출금 이력 */}
      {info.history.length > 0 && (
        <div className="mt-3 bg-gray-50 dark:bg-[#121212] rounded-xl p-4">
          <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">최근 출금 이력</p>
          <div className="space-y-2">
            {info.history.slice(0, 5).map((h) => (
              <div key={h.id} className="flex justify-between items-center text-xs">
                <div>
                  <span className="text-gray-700 dark:text-gray-300">{formatWon(h.amount)}</span>
                  <span className="text-gray-400 dark:text-gray-500 ml-2">({h.bank_name})</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  h.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                  h.status === 'rejected' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-300'
                }`}>{h.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function WithdrawModal({ info, onClose, onSuccess }: { info: WithdrawalInfo; onClose: () => void; onSuccess: () => void }) {
  const [amount, setAmount] = useState(info.available)
  const [bankName, setBankName] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const withholding = Math.floor(amount * info.withholding_rate)
  const netAmount = amount - withholding

  async function submit() {
    if (amount < info.min_withdrawal) {
      toast.error(`최소 ${info.min_withdrawal.toLocaleString()}원 부터 출금 가능`)
      return
    }
    if (!bankName || !bankAccount || !accountHolder) {
      toast.error('은행 / 계좌 / 예금주를 모두 입력하세요')
      return
    }
    setSubmitting(true)
    try {
      const res = await curatorApi.requestWithdrawal({ amount, bank_name: bankName, bank_account: bankAccount, account_holder: accountHolder })
      if (res.success) {
        toast.success(`출금 신청 완료 — 실 입금 ${res.withdrawal?.net_amount.toLocaleString()}원`)
        onSuccess()
      } else {
        toast.error(res.error || '출금 신청 실패')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '출금 신청 실패')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[10001] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-white dark:bg-[#121212] rounded-t-2xl sm:rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">💰 출금 신청</h2>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">금액 (최대 {formatWon(info.available)})</label>
            <input
              type="number"
              min={info.min_withdrawal}
              max={info.available}
              value={amount}
              onChange={(e) => setAmount(Math.max(0, Math.min(info.available, Number(e.target.value) || 0)))}
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white rounded-lg"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">은행</label>
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="예: 카카오뱅크"
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white rounded-lg"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">계좌번호</label>
            <input
              type="text"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value.replace(/[^0-9-]/g, ''))}
              placeholder="3333-01-1234567"
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white rounded-lg"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">예금주</label>
            <input
              type="text"
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white rounded-lg"
            />
          </div>
        </div>

        <div className="mt-4 bg-gray-50 dark:bg-[#0A0A0A] rounded-lg p-3 text-xs space-y-1">
          <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>신청 금액</span><span>{formatWon(amount)}</span></div>
          <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>원천징수 ({(info.withholding_rate * 100).toFixed(1)}%)</span><span>-{formatWon(withholding)}</span></div>
          <div className="flex justify-between font-bold text-gray-900 dark:text-white pt-1 border-t border-gray-200 dark:border-[#2A2A2A]"><span>실 입금</span><span>{formatWon(netAmount)}</span></div>
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-300 font-bold rounded-lg">취소</button>
          <button onClick={submit} disabled={submitting} className="flex-1 py-2.5 bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white font-bold rounded-lg">
            {submitting ? '신청 중...' : '신청'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SummaryCards({ stats }: { stats: DashboardStats }) {
  const { t } = useTranslation()
  const pending = safeNum(stats.pending_earnings)
  const uniqueClicks = stats.unique_clicks_30d != null ? safeNum(stats.unique_clicks_30d) : safeNum(stats.clicks_30d)
  const conversion = safeNum(stats.conversion_rate_30d)
  const cards: Array<{ label: string; value: string; sub?: string; accent: string }> = [
    {
      label: t('curator.earnings.monthEarning', { defaultValue: '30일 적립 (확정)' }),
      value: formatWon(stats.month_earnings),
      sub: pending > 0 ? `+ ${formatNumber(pending)}딜 적립예정` : undefined,
      accent: 'text-pink-500 dark:text-pink-400',
    },
    {
      // 순클릭(ip+ua+일자 dedup) — raw 클릭은 새로고침/봇 부풀림 포함.
      label: t('curator.earnings.uniqueClicks30d', { defaultValue: '30일 순클릭' }),
      value: formatNumber(uniqueClicks),
      sub: stats.unique_clicks_30d != null && stats.clicks_30d > uniqueClicks ? `전체 ${formatNumber(stats.clicks_30d)}` : undefined,
      accent: 'text-blue-500 dark:text-blue-400',
    },
    {
      label: t('curator.earnings.conversion30d', { defaultValue: '30일 전환율' }),
      value: `${conversion}%`,
      sub: `구매 ${formatNumber(stats.purchases_30d)}`,
      accent: 'text-emerald-500 dark:text-emerald-400',
    },
  ]
  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      {cards.map((card) => (
        <div key={card.label} className="bg-gray-50 dark:bg-[#121212] rounded-xl p-3 border border-gray-100 dark:border-[#1A1A1A]">
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">{card.label}</p>
          <p className={`text-lg font-bold ${card.accent}`}>{card.value}</p>
          {card.sub && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{card.sub}</p>}
        </div>
      ))}
    </div>
  )
}

function TopPinsSection({ stats }: { stats: DashboardStats }) {
  const { t } = useTranslation()
  if (!stats.top_pins?.length) return null
  return (
    <section className="mb-6">
      <h2 className="text-sm font-bold mb-3">🔥 {t('curator.earnings.topPins', { defaultValue: '인기 핀 TOP 3' })}</h2>
      <div className="space-y-2">
        {stats.top_pins.map((pin, idx) => (
          <Link
            key={pin.id}
            to={`/products/${pin.product_id}`}
            className="flex items-center gap-3 bg-gray-50 dark:bg-[#121212] rounded-xl p-3 border border-gray-100 dark:border-[#1A1A1A] hover:border-pink-500/50 transition-colors"
          >
            <div className="text-lg font-bold text-gray-400 dark:text-gray-500 w-6">{idx + 1}</div>
            {(pin.thumbnail || pin.image_url) && (
              <img
                src={cfImage(pin.thumbnail || pin.image_url || '', { width: 96, format: 'auto' }) || (pin.thumbnail || pin.image_url || '')}
                alt={pin.product_name}
                className="w-12 h-12 rounded object-cover"
                loading="lazy"
                decoding="async"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{pin.product_name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">👆 {formatNumber(pin.click_count)} 클릭</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

function RecentEarningsSection({ stats }: { stats: DashboardStats }) {
  const { t } = useTranslation()
  const items = stats.recent_earnings || []
  if (!items.length) return null
  return (
    <section className="mb-6">
      <h2 className="text-sm font-bold mb-3">🧾 {t('curator.earnings.recent', { defaultValue: '수익 내역 (원천별)' })}</h2>
      <div className="space-y-2">
        {items.map((e) => (
          <Link
            key={e.id}
            to={`/products/${e.product_id}`}
            className="flex items-center justify-between gap-3 bg-gray-50 dark:bg-[#121212] rounded-xl p-3 border border-gray-100 dark:border-[#1A1A1A] hover:border-pink-500/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {e.product_name || t('curator.earnings.unknownProduct', { defaultValue: '상품' })}
                {e.status === 'holding' && (
                  <span className="ml-1.5 align-middle inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    적립예정
                  </span>
                )}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {new Date(e.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                {e.order_amount ? ` · 주문 ${formatWon(e.order_amount)}` : ''}
              </p>
            </div>
            <span className={`text-sm font-bold shrink-0 ${e.status === 'holding' ? 'text-amber-500' : 'text-pink-500'}`}>+{formatWon(e.commission)}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

function DailyChart({ stats }: { stats: DashboardStats }) {
  const { t } = useTranslation()
  const daily = stats.earnings_daily_30d || []
  if (!daily.length) return (
    <section className="bg-gray-50 dark:bg-[#121212] rounded-xl p-6 text-center text-sm text-gray-500 dark:text-gray-400">
      {t('curator.earnings.noData', { defaultValue: '아직 데이터가 없어요. 친구에게 핀을 공유해보세요!' })}
    </section>
  )

  const max = Math.max(...daily.map((d) => safeNum(d.amount)), 1)
  return (
    <section>
      <h2 className="text-sm font-bold mb-3">📈 {t('curator.earnings.dailyChart', { defaultValue: '일별 적립 (30일)' })}</h2>
      <div className="bg-gray-50 dark:bg-[#121212] rounded-xl p-4 border border-gray-100 dark:border-[#1A1A1A]">
        <div className="flex items-end gap-1 h-32">
          {daily.map((d) => {
            const pct = (safeNum(d.amount) / max) * 100
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group" title={`${d.date}: ${formatWon(d.amount)}`}>
                <div className="w-full bg-pink-500/30 dark:bg-pink-500/40 rounded-t group-hover:bg-pink-500" style={{ height: `${pct}%` }} />
              </div>
            )
          })}
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 text-center">{daily[0]?.date} → {daily[daily.length - 1]?.date}</p>
      </div>
    </section>
  )
}
