import { lazy, Suspense, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// 🛡️ 2026-05-27 (loading P1): VoucherMap (Kakao Maps SDK ~150KB) 별도 chunk lazy.
//   사용자가 '지도 보기' 토글 시만 로드 → 초기 paint 영향 0.
const VoucherMap = lazy(() => import('./my-vouchers/VoucherMap'))
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import { ArrowLeft, Ticket, MapPin, Clock, CheckCircle, XCircle, QrCode, X, Gift, Share2 } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import api from '@/lib/api'
import { useMyVouchers, useInvalidateMyVouchers } from '@/hooks/queries'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { LargeTitle, WalletPageWrapper } from '@/components/wallet/WalletAtoms'
import { walletTokens } from '@/components/wallet/walletTokens'
import { formatNumber } from '@/utils/format'

interface Voucher {
  id: number | string  // KT Alpha 는 'kt-{voId}' 형식
  code: string
  status: 'unused' | 'used' | 'expired' | 'refunded' | 'processing'
  product_name: string
  restaurant_name?: string
  restaurant_address?: string
  restaurant_lat?: number
  restaurant_lng?: number
  product_image?: string
  expires_at?: string
  used_at?: string
  created_at: string
  applied_price?: number  // 🛡️ 2026-05-16: voucher 액면가 (차감 금액 안내용)
  product_price?: number
  usage_guide?: string    // 매장이 등록한 사용 가이드 (예: "평일 점심만")
  // 🛡️ 2026-05-25 (A 옵션): KT Alpha 통합 표시
  source?: 'internal' | 'kt_alpha'
  kt_alpha_voucher_order_id?: number
  kt_recipient_phone?: string
  kt_status?: string  // 'sent' | 'processing'
  order_id?: number
}

type ViewMode = 'list' | 'map'

const STATUS_MAP = {
  unused: { labelKey: 'voucher.status.unused', color: 'bg-green-100 text-green-700', icon: Ticket },
  used: { labelKey: 'voucher.status.used', color: 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-500 dark:text-gray-400', icon: CheckCircle },
  expired: { labelKey: 'voucher.status.expired', color: 'bg-red-100 text-red-600', icon: XCircle },
  refunded: { labelKey: 'voucher.status.refunded', color: 'bg-yellow-100 text-yellow-700', icon: XCircle },
} as const

// 🛡️ 2026-05-16: 외부 QR API (api.qrserver.com) 의존 제거 → qrcode.react 로컬 SVG.
//   장점: 외부 서비스 다운에 영향 X, latency 0, 오프라인에서도 렌더, 프라이버시.
import { QRCodeSVG } from 'qrcode.react'

// 🛡️ 2026-05-16: 카카오맵 후기 보너스 제출 버튼 (used voucher 에 노출)
//   URL 또는 스크린샷 둘 중 하나 제출 → 백엔드가 OCR / 어드민 검증
function ReviewBonusButton({ voucherCode }: { voucherCode: string }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'url' | 'screenshot'>('url')
  const [reviewUrl, setReviewUrl] = useState('')
  const [screenshotUrl, setScreenshotUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function uploadScreenshot(file: File) {
    if (file.size > 5 * 1024 * 1024) { toast.error('5MB 이하만'); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      // 셀러 upload endpoint 재사용 — 일반 user 도 imgbb 업로드 필요
      // ★ 별도 user-upload endpoint 필요하나, 우선 imgbb 직접 호출 X. 임시: DataURL.
      const reader = new FileReader()
      reader.onload = () => { setScreenshotUrl(reader.result as string); setUploading(false) }
      reader.onerror = () => { toast.error('읽기 실패'); setUploading(false) }
      reader.readAsDataURL(file)
    } catch { toast.error('업로드 실패'); setUploading(false) }
  }

  async function submit() {
    if (mode === 'url' && !reviewUrl) { toast.error('URL 입력'); return }
    if (mode === 'screenshot' && !screenshotUrl) { toast.error('스크린샷 업로드'); return }
    setSubmitting(true)
    try {
      const res = await api.post('/api/review-bonus/submit', {
        voucher_code: voucherCode,
        review_url: mode === 'url' ? reviewUrl : undefined,
        screenshot_url: mode === 'screenshot' ? screenshotUrl : undefined,
      })
      if (res.data?.success) {
        toast.success(res.data.message || '제출됨')
        setOpen(false)
      } else toast.error(res.data?.error || '실패')
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || '실패')
    } finally { setSubmitting(false) }
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="mt-4 w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold flex items-center justify-center gap-1">
        ⭐ 카카오맵 후기 작성하고 보너스 받기
      </button>
      {open && (
        <div className="fixed inset-0 z-[10500] flex items-end sm:items-center justify-center bg-black/60" onClick={() => setOpen(false)}>
          <div className="bg-white dark:bg-[#0A0A0A] rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">⭐ 카카오맵 후기 작성 보너스</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-4">
              매장 카카오맵 후기 작성하고 인증해주시면 보너스 딜 지급 (기본 1,000딜).
              <br/>1) 카카오맵 앱에서 매장 검색 → 후기 작성
              <br/>2) 후기 페이지 URL 복사 또는 스크린샷 캡쳐
              <br/>3) 아래에 제출
            </p>
            <div className="grid grid-cols-2 gap-1 mb-3">
              <button onClick={() => setMode('url')} className={`py-2 text-xs font-bold rounded ${mode === 'url' ? 'bg-pink-500 text-white' : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-200'}`}>URL 제출</button>
              <button onClick={() => setMode('screenshot')} className={`py-2 text-xs font-bold rounded ${mode === 'screenshot' ? 'bg-pink-500 text-white' : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-200'}`}>스크린샷 (AI 자동 검증)</button>
            </div>
            {mode === 'url' ? (
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">카카오맵 후기 URL</label>
                <input value={reviewUrl} onChange={(e) => setReviewUrl(e.target.value)}
                  placeholder="https://place.map.kakao.com/..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 dark:text-white dark:bg-[#1A1A1A]" />
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">어드민 검증 후 1~3일 내 보너스 지급</p>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">후기 스크린샷</label>
                <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadScreenshot(e.target.files[0])}
                  className="w-full text-xs" />
                {uploading && <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">업로드 중...</p>}
                {screenshotUrl && screenshotUrl.startsWith('data:') && (
                  <img src={screenshotUrl} alt="preview" className="mt-2 max-h-40 rounded" />
                )}
                <p className="text-[10px] text-emerald-600 mt-1">✨ AI 가 매장명/후기 내용 확인 시 즉시 보너스 지급</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button onClick={() => setOpen(false)} className="py-2 border border-gray-200 dark:border-[#2A2A2A] rounded-lg text-sm font-bold text-gray-700 dark:text-gray-200">취소</button>
              <button onClick={submit} disabled={submitting || uploading}
                className="py-2 bg-pink-500 text-white rounded-lg text-sm font-bold disabled:opacity-50">
                {submitting ? '제출 중...' : '제출'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function VoucherQRCode({ value, size = 160 }: { value: string; size?: number }) {
  return (
    <div className="mx-auto bg-white dark:bg-[#0A0A0A] p-2 rounded">
      <QRCodeSVG value={value} size={size} level="M" includeMargin={false} />
    </div>
  )
}

function QRModal({ voucher: initialVoucher, onClose }: { voucher: Voucher; onClose: () => void }) {
  const { t } = useTranslation()
  useEscapeKey(onClose)
  const [voucher, setVoucher] = useState(initialVoucher)
  const [now, setNow] = useState(Date.now())
  const qrUrl = `https://live.ur-team.com/v/${voucher.code}`

  // 🛡️ 2026-05-30: 즉시판매 단일가 모델 — 사용자 셀프 구매취소(청약철회). 미사용 + 구매 7일 이내만.
  const invalidateVouchers = useInvalidateMyVouchers()
  const [cancelling, setCancelling] = useState(false)
  const canSelfCancel = voucher.status === 'unused' && !!voucher.created_at &&
    (Date.now() - new Date(voucher.created_at).getTime()) < 7 * 86400000
  async function handleSelfCancel() {
    if (cancelling) return
    if (!window.confirm(t('voucher.cancelConfirm', { defaultValue: '이 교환권 구매를 취소하고 환불받으시겠어요?\n(미사용 + 구매 7일 이내만 가능)' }))) return
    setCancelling(true)
    try {
      const res = await api.post(`/api/group-buy/voucher/${voucher.code}/cancel`)
      if (res.data?.success) {
        toast.success(res.data.message || t('voucher.cancelDone', { defaultValue: '구매가 취소되었습니다' }))
        setVoucher(v => ({ ...v, status: 'refunded' }))
        invalidateVouchers()
      } else {
        toast.error(res.data?.error || t('voucher.cancelFail', { defaultValue: '취소할 수 없습니다' }))
      }
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || t('voucher.cancelError', { defaultValue: '취소 중 오류가 발생했습니다' }))
    } finally {
      setCancelling(false)
    }
  }

  // 🛡️ 2026-05-16: 실시간 status 폴링 (5초마다) — 사장님이 스캔하면 즉시 "사용 완료" 표시
  //   백엔드 atomic CAS 로 재사용 자체는 차단되어 있음. UI 가 늦게 인지하는 것만 해결.
  useEffect(() => {
    if (voucher.status !== 'unused') return
    const t = setInterval(async () => {
      try {
        const res = await api.get(`/api/vouchers/verify/${voucher.code}`)
        if (res.data?.success && res.data?.data?.status) {
          const newStatus = res.data.data.status
          if (newStatus !== voucher.status) {
            setVoucher(v => ({ ...v, status: newStatus, used_at: res.data.data.used_at || v.used_at }))
          }
        }
      } catch { /* silent */ }
    }, 5000)
    return () => clearInterval(t)
  }, [voucher.code, voucher.status])

  // 시간 점멸 (캡쳐 도용 방지 — 사용 가능 상태일 때만)
  useEffect(() => {
    if (voucher.status !== 'unused') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [voucher.status])

  const isUsed = voucher.status === 'used'
  const isExpired = voucher.status === 'expired' || voucher.status === 'refunded'

  async function shareVoucher() {
    const shareData = {
      title: t('voucher.shareTitle', { productName: voucher.product_name }),
      text: t('voucher.shareText', { restaurant: voucher.restaurant_name ? voucher.restaurant_name + ' · ' : '', productName: voucher.product_name }),
      url: qrUrl,
    }
    const nav = typeof navigator !== 'undefined' ? navigator : null
    if (nav && 'share' in nav) {
      try { await (nav as Navigator).share(shareData); return } catch { /* cancelled or fallback */ }
    }
    try {
      await (nav as Navigator)?.clipboard.writeText(`${shareData.text}\n${qrUrl}`)
      toast.success(t('voucher.linkCopied'))
    } catch { /* ignore */ }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onClick={onClose} role="presentation">
      <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl p-6 mx-4 max-w-xs w-full relative" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('voucher.qrCode', { defaultValue: 'QR 코드' })}>
        <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-[#1A1A1A] dark:bg-[#1A1A1A]">
          <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
        <p className="text-center text-sm font-bold text-gray-900 dark:text-white mb-1">{voucher.product_name}</p>
        {voucher.restaurant_name && (
          <p className="text-center text-xs text-gray-500 dark:text-gray-400 mb-4">{voucher.restaurant_name}</p>
        )}
        <div className="flex justify-center mb-4 relative">
          <div className={isUsed || isExpired ? 'opacity-20 grayscale' : ''}>
            <VoucherQRCode value={qrUrl} size={160} />
          </div>
          {/* 🛡️ 2026-05-16: 사용 완료 / 만료 시 큰 오버레이 (재사용 방지) */}
          {isUsed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-500/10 rounded-xl">
              <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-white" strokeWidth={3} />
              </div>
              <p className="mt-2 text-base font-extrabold text-emerald-700">사용 완료</p>
              {voucher.used_at && (
                <p className="text-[10px] text-emerald-600">{new Date(voucher.used_at).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}</p>
              )}
            </div>
          )}
          {isExpired && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-500/10 rounded-xl">
              <div className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center">
                <XCircle className="w-12 h-12 text-white" strokeWidth={3} />
              </div>
              <p className="mt-2 text-base font-extrabold text-red-700">
                {voucher.status === 'expired' ? '만료됨' : '환불됨'}
              </p>
            </div>
          )}
        </div>
        <div className="bg-gray-100 dark:bg-[#1A1A1A] rounded-lg px-3 py-2 text-center">
          <code className={`text-sm font-mono font-bold ${isUsed || isExpired ? 'text-gray-400 line-through' : 'text-pink-500'}`}>{voucher.code}</code>
        </div>
        {/* 🛡️ 2026-05-16: 캡쳐 도용 방지 — 실시간 시간 표시 (사용 가능 상태만) */}
        {!isUsed && !isExpired && (
          <p className="text-[10px] text-gray-400 text-center mt-1 font-mono">
            {new Date(now).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        )}

        {/* 🛡️ 2026-05-16: 선물하기 모델 — voucher = "이 메뉴 사놓음" (할인권 X) */}
        {voucher.status === 'unused' && (
          <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 text-center">
            <p className="text-[11px] text-emerald-700 font-medium">🎁 이미 결제 완료</p>
            <p className="text-base font-extrabold text-emerald-800 mt-0.5">
              {voucher.product_name}
            </p>
            <p className="text-[10px] text-emerald-600 mt-0.5">매장에서 추가 결제 없이 받으세요</p>
          </div>
        )}
        {voucher.usage_guide && voucher.status === 'unused' && (
          <p className="text-[11px] text-gray-600 dark:text-gray-300 text-center mt-2 whitespace-pre-wrap">
            ℹ️ {voucher.usage_guide}
          </p>
        )}
        <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center mt-2">{t('voucher.showQrAtStore')}</p>

        {/* 선물/공유 버튼 (사용 가능한 식사권만) */}
        {voucher.status === 'unused' && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={shareVoucher}
              className="py-2.5 rounded-xl bg-pink-50 border border-pink-200 text-pink-600 text-xs font-bold flex items-center justify-center gap-1">
              <Share2 className="w-3.5 h-3.5" /> {t('voucher.share')}
            </button>
            <button onClick={shareVoucher}
              className="py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-bold flex items-center justify-center gap-1">
              <Gift className="w-3.5 h-3.5" /> {t('voucher.gift')}
            </button>
          </div>
        )}

        {/* 🛡️ 2026-05-30: 셀프 구매취소 (미사용 + 7일 이내) */}
        {canSelfCancel && (
          <button onClick={handleSelfCancel} disabled={cancelling}
            className="mt-2 w-full py-2.5 rounded-xl border border-gray-200 dark:border-[#2A2A2A] text-gray-500 dark:text-gray-400 text-xs font-bold disabled:opacity-50">
            {cancelling ? t('voucher.cancelling', { defaultValue: '취소 처리 중…' }) : t('voucher.selfCancel', { defaultValue: '구매 취소 (7일 이내 환불)' })}
          </button>
        )}

        {/* 🛡️ 2026-05-16: 사용한 voucher 에 후기 보너스 안내 */}
        {voucher.status === 'used' && (
          <ReviewBonusButton voucherCode={voucher.code} />
        )}
      </div>
    </div>
  )
}

export default function MyVouchersPage() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  // 🛡️ 2026-05-22 P1 영구 fix: useState+useEffect+직접 fetch → useMyVouchers().
  //   localStorage initialData (즉시 0ms 표시) + 2분 stale + 페이지 전환 시 dedup.
  const { data: vouchersRaw, isLoading: loading } = useMyVouchers()
  const vouchers = (vouchersRaw ?? []) as unknown as Voucher[]
  const [qrVoucher, setQrVoucher] = useState<Voucher | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  // 🛡️ 2026-05-15: 참여 후 share prompt — GroupBuyDetailPage.handleJoin 이 localStorage 기록
  const [justJoined, setJustJoined] = useState<{ product_id: number; name: string; image_url?: string } | null>(null)
  // 🛡️ 2026-05-24: phone 미등록 사용자 안내 배너 (한 번 dismiss 하면 7일 숨김).
  const [showPhoneBanner, setShowPhoneBanner] = useState(false)
  useEffect(() => {
    const dismissedAt = Number(localStorage.getItem('phone_banner_dismissed_at') || 0)
    if (Date.now() - dismissedAt < 7 * 86400000) return
    api.get('/api/auth/me').then(r => {
      const phone = r.data?.data?.phone || r.data?.user?.phone
      if (!phone) setShowPhoneBanner(true)
    }).catch(() => null)
  }, [])
  function dismissPhoneBanner() {
    localStorage.setItem('phone_banner_dismissed_at', String(Date.now()))
    setShowPhoneBanner(false)
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem('gb_just_joined')
      if (raw) {
        const data = JSON.parse(raw)
        // 5분 이내만 표시 (오래된 건 무시)
        if (Date.now() - (data.timestamp || 0) < 5 * 60 * 1000) {
          setJustJoined({ product_id: data.product_id, name: data.name, image_url: data.image_url })
        }
        localStorage.removeItem('gb_just_joined')
      }
    } catch { /* silent */ }
  }, [])

  // 🛡️ useMyVouchers hook 이 fetch + cache + setState 모두 처리 — 직접 useEffect 불필요.

  const locale = i18n.language?.startsWith('ko') ? 'ko-KR' : i18n.language || 'en-US'

  // 🛡️ 2026-04-30: CLAUDE.md 규칙 — /my-vouchers 는 화이트 테마 (쇼핑/결제 플로우)
  const theme = 'light' as const
  const tk = walletTokens[theme]

  // 상태별 그룹핑
  const groups = [
    { key: 'unused',   label: t('voucher.groupUnused'),   items: vouchers.filter(v => v.status === 'unused') },
    { key: 'used',     label: t('voucher.groupUsed'),     items: vouchers.filter(v => v.status === 'used') },
    { key: 'expired',  label: t('voucher.groupExpired'),  items: vouchers.filter(v => v.status === 'expired') },
    { key: 'refunded', label: t('voucher.groupRefunded'), items: vouchers.filter(v => v.status === 'refunded') },
  ].filter(g => g.items.length > 0)

  // 가까운 만료일 (unused 식사권 중 가장 가까운)
  const nearestExpiry = (() => {
    const now = Date.now()
    const candidates = vouchers
      .filter(v => v.status === 'unused' && v.expires_at)
      .map(v => new Date(v.expires_at!).getTime())
      .filter(t => t > now)
      .sort((a, b) => a - b)
    if (!candidates[0]) return null
    const days = Math.max(0, Math.ceil((candidates[0] - now) / (1000 * 60 * 60 * 24)))
    return days
  })()

  return (
    <WalletPageWrapper theme={theme}>
      <SEO title={t('voucher.seoTitle')} description={t('voucher.seoDescription')} url="/my-vouchers" />

      {/* 상단 chrome — 뒤로가기 + 알림 영역 */}
      <div className="sticky top-0 md:top-14 z-30 px-2 pt-3 pb-2 flex items-center"
        style={{ background: tk.chrome, borderBottom: `0.5px solid ${tk.separator}` }}>
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-full"
          style={{ background: tk.fillSoft, color: tk.label }}
          aria-label={t('common.back', { defaultValue: '뒤로가기' })}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Large Title + 메타 */}
      <LargeTitle theme={theme} title={t('voucher.myVouchers')} />

      {/* 🛡️ 2026-05-24: phone 미등록 안내 — KT Alpha 자동 발송 받으려면 phone 필수 */}
      {showPhoneBanner && (
        <div className="ur-content-narrow px-4 lg:px-8 mb-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
            <span className="text-xl">📱</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-900">전화번호를 등록하세요</p>
              <p className="text-xs text-amber-700 mt-0.5">
                기프티쇼 교환권은 휴대폰 MMS 로 발송됩니다. 등록하면 다음 교환권부터 자동 발송돼요.
              </p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => navigate('/user/profile')}
                  className="px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg">
                  등록하러 가기
                </button>
                <button onClick={dismissPhoneBanner}
                  className="px-3 py-1.5 text-amber-700 text-xs font-medium">
                  나중에 (7일)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {vouchers.length > 0 && (
        <div className="ur-content-narrow px-4 lg:px-8 -mt-2 mb-4 flex items-center gap-2 flex-wrap"
          style={{ fontSize: 12, color: tk.secondary, letterSpacing: '-0.01em' }}>
          <span style={{ fontWeight: 600, color: tk.label }}>
            {vouchers.filter(v => v.status === 'unused').length}{t('voucher.activeCountSuffix', { defaultValue: '장 사용 가능' })}
          </span>
          {nearestExpiry !== null && (
            <>
              <span style={{ color: tk.tertiary }}>·</span>
              <span>
                {nearestExpiry === 0
                  ? t('voucher.expiresToday', { defaultValue: '오늘 만료' })
                  : t('voucher.expiresInDays', { count: nearestExpiry, defaultValue: `${nearestExpiry}일 뒤 만료` })}
              </span>
            </>
          )}
        </div>
      )}

      {/* 🛡️ 2026-05-15: 리스트 / 지도 토글 */}
      {!loading && vouchers.filter(v => v.status === 'unused' && v.restaurant_lat && v.restaurant_lng).length > 0 && (
        <div className="ur-content-narrow px-4 lg:px-8 mb-3 flex gap-1.5">
          <button
            onClick={() => setViewMode('list')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${viewMode === 'list' ? 'bg-pink-500 text-white' : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-300'}`}
          >
            📋 리스트
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${viewMode === 'map' ? 'bg-pink-500 text-white' : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-300'}`}
          >
            🗺️ 지도로 보기
          </button>
        </div>
      )}

      <div className="ur-content-narrow px-4 lg:px-8 pb-2">
        {viewMode === 'map' && !loading ? (
          <Suspense fallback={<div className="rounded-xl border border-gray-200 dark:border-[#2A2A2A] flex items-center justify-center text-sm text-gray-500 dark:text-gray-400" style={{ height: 400 }}>지도 불러오는 중...</div>}>
            <VoucherMap
              vouchers={vouchers.filter(v => v.status === 'unused' && v.restaurant_lat && v.restaurant_lng)}
              onMarkerClick={(v) => setQrVoucher(vouchers.find(x => x.id === v.id) ?? null)}
            />
          </Suspense>
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: tk.accent, borderTopColor: 'transparent' }} />
          </div>
        ) : vouchers.length === 0 ? (
          <div className="text-center py-20">
            <Ticket className="w-12 h-12 mx-auto mb-3" style={{ color: tk.tertiary }} />
            <p className="font-bold mb-1" style={{ color: tk.label }}>{t('voucher.empty')}</p>
            <p className="text-sm mb-4" style={{ color: tk.secondary }}>{t('voucher.emptyHint')}</p>
            <button
              onClick={() => navigate('/browse?category=meal_voucher')}
              className="px-5 py-2.5 rounded-full text-sm font-bold text-white active:opacity-90"
              style={{ background: tk.accentGradient }}
            >
              {t('voucher.exploreRestaurants')}
            </button>
          </div>
        ) : (
          <>
            {groups.map(group => (
              <div key={group.key} className="mb-6">
                <p className="px-1 mb-2 uppercase"
                  style={{ fontSize: 11, color: tk.secondary, fontWeight: 700, letterSpacing: '0.06em' }}>
                  {group.label} <span style={{ color: tk.tertiary }}>· {group.items.length}</span>
                </p>
                <div className="space-y-3">
                  {group.items.map(v => {
                    const muted = v.status !== 'unused'
                    return <VoucherTicket key={v.id} v={v} muted={muted} locale={locale} t={t} onShowQr={() => setQrVoucher(v)} />
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* QR Code Modal */}
      {qrVoucher && <QRModal voucher={qrVoucher} onClose={() => setQrVoucher(null)} />}

      {/* 🛡️ 2026-05-15: 참여 직후 share prompt (3 AI 합의: post-purchase share boost) */}
      {justJoined && <PostJoinShareModal data={justJoined} onClose={() => setJustJoined(null)} />}
    </WalletPageWrapper>
  )
}

function PostJoinShareModal({ data, onClose }: { data: { product_id: number; name: string; image_url?: string }; onClose: () => void }) {
  const userId = localStorage.getItem('user_id') || localStorage.getItem('uid') || ''
  const shareUrl = `https://live.ur-team.com/group-buy/${data.product_id}${userId ? `?ref=${userId}` : ''}`

  async function shareToKakao() {
    try {
      const { ensureKakaoSdk } = await import('@/lib/kakao-sdk')
      await ensureKakaoSdk()
      ;(window as any).Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: `${data.name} 공구 함께해요!`,
          description: '친구 가입 시 양쪽 0.5% 보너스 딜 🎁',
          imageUrl: data.image_url || `https://live.ur-team.com/api/og/group-buy/${data.product_id}`,
          link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
        },
        buttons: [{ title: '나도 참여하기', link: { mobileWebUrl: shareUrl, webUrl: shareUrl } }],
      })
      onClose()
    } catch {
      try { await navigator.clipboard.writeText(shareUrl); toast.success('링크 복사됨') } catch { /* silent */ }
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={onClose} role="presentation">
      <div className="bg-white dark:bg-[#0A0A0A] rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6 animate-slideUp" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="text-center mb-4">
          <p className="text-3xl mb-2">🎉</p>
          <p className="text-base font-extrabold text-gray-900 dark:text-white">참여 완료!</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">친구 초대 시 양쪽 <span className="font-bold text-pink-500">0.5% 보너스 딜</span></p>
        </div>
        {data.image_url && (
          <img src={data.image_url} alt="" className="w-full aspect-video object-cover rounded-2xl mb-4" loading="lazy" />
        )}
        <p className="text-sm font-bold text-center text-gray-900 dark:text-white mb-4">{data.name}</p>
        <button
          onClick={shareToKakao}
          className="w-full py-3.5 bg-[#FEE500] text-[#3C1E1E] rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          💬 카카오톡으로 친구 초대
        </button>
        <button
          onClick={onClose}
          className="w-full mt-2 py-2.5 text-gray-500 dark:text-gray-400 text-xs font-medium"
        >
          나중에
        </button>
      </div>
    </div>
  )
}

/**
 * Ticket-style voucher card.
 * Left: category dot + product name + restaurant + code.
 * Right: perforation (notch + dotted line) + sub QR + use button.
 *
 * Visual:
 *   ┌──────────────────────────────────┬─┬───────────┐
 *   │ ●  KOREAN BEEF                   │ │  [QR]     │
 *   │    한우 등심 1인 코스             │○│           │
 *   │    @동래원                       │ │  사용하기  │
 *   │    YD-30K-AC8F           D-7    │ │           │
 *   └──────────────────────────────────┴─┴───────────┘
 */
function VoucherTicket({ v, muted, locale, t, onShowQr }: {
  v: Voucher
  muted: boolean
  locale: string
  t: (key: string, opts?: any) => string
  onShowQr: () => void
}) {
  const expiresAt = v.expires_at ? new Date(v.expires_at) : null
  const usedAt = v.used_at ? new Date(v.used_at) : null
  const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null

  // 카테고리 라벨 — 식당명/상품명에서 키워드 추출. 디자인 v4 톤에 맞춰 영문 대문자.
  const categoryLabel = deriveCategoryLabel(v.product_name, v.restaurant_name)
  const accentDot = '#EF4444'

  const statusBadge = (() => {
    if (v.status === 'unused') return null
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md"
        style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
          background: v.status === 'used' ? 'rgba(0,0,0,0.06)' : v.status === 'expired' ? 'rgba(239,68,68,0.10)' : 'rgba(245,158,11,0.10)',
          color: v.status === 'used' ? '#6B7280' : v.status === 'expired' ? '#DC2626' : '#D97706',
        }}>
        {t(`voucher.status.${v.status}`)}
      </span>
    )
  })()

  // 🛡️ 2026-05-25 (A 옵션): KT Alpha 쿠폰은 별도 카드 형식 (재발송 버튼 포함)
  if (v.source === 'kt_alpha') {
    return <KtAlphaVoucherCard v={v} muted={muted} t={t} />
  }

  return (
    <div
      className="relative flex rounded-xl overflow-hidden bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#1F1F1F]"
      style={{ opacity: muted ? 0.55 : 1, boxShadow: muted ? 'none' : '0 1px 3px rgba(0,0,0,0.04)' }}
    >
      {/* 좌측 본문 (~75%) */}
      <div className="flex-1 p-4 pr-3 min-w-0">
        {/* 카테고리 라벨 + 상태 뱃지 */}
        <div className="flex items-center gap-1.5 mb-1">
          <span
            aria-hidden
            style={{ width: 6, height: 6, borderRadius: '50%', background: accentDot, display: 'inline-block', flexShrink: 0 }}
          />
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '0.08em',
            color: '#6B7280', textTransform: 'uppercase',
          }}>
            {categoryLabel}
          </span>
          {statusBadge && <span className="ml-auto">{statusBadge}</span>}
        </div>

        {/* 상품명 */}
        <p className="line-clamp-2 mb-1" style={{ fontSize: 14, fontWeight: 700, color: '#0A0A0A', letterSpacing: '-0.02em', lineHeight: 1.3 }}>
          {v.product_name}
        </p>

        {/* 식당명 */}
        {v.restaurant_name && (
          <p className="flex items-center gap-1 mb-2.5" style={{ fontSize: 11, color: '#6B7280' }}>
            <MapPin className="w-3 h-3" style={{ flexShrink: 0 }} />
            <span className="truncate">{v.restaurant_name}</span>
          </p>
        )}

        {/* 코드 + D-day row */}
        <div className="flex items-center gap-2 flex-wrap">
          <code
            onClick={(e) => {
              e.stopPropagation()
              if (v.status !== 'unused') return
              navigator.clipboard?.writeText(v.code)
              toast.success(t('voucher.copied', { defaultValue: '복사됨' }))
            }}
            className={v.status === 'unused' ? 'cursor-pointer active:opacity-70' : ''}
            style={{
              fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontWeight: 700, color: '#0A0A0A', letterSpacing: '0.02em',
              background: 'rgba(0,0,0,0.04)', padding: '3px 6px', borderRadius: 4,
            }}>
            {v.code}
          </code>
          {v.status === 'unused' && daysLeft !== null && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: daysLeft <= 3 ? '#DC2626' : '#6B7280',
              letterSpacing: '-0.01em',
            }}>
              {daysLeft === 0 ? 'D-DAY' : `D-${daysLeft}`}
            </span>
          )}
          {v.status === 'used' && usedAt && (
            <span style={{ fontSize: 10, color: '#9CA3AF' }}>
              {t('voucher.usedAt')} · {usedAt.toLocaleDateString(locale)}
            </span>
          )}
        </div>
      </div>

      {/* 절취선 노치 (top + bottom round cutouts) + 점선 */}
      <div className="relative flex items-stretch" style={{ width: 1 }}>
        <span aria-hidden style={{
          position: 'absolute', left: -7, top: -7, width: 14, height: 14, borderRadius: '50%',
          background: '#F2F2F7',
        }} />
        <span aria-hidden style={{
          position: 'absolute', left: -7, bottom: -7, width: 14, height: 14, borderRadius: '50%',
          background: '#F2F2F7',
        }} />
        <span aria-hidden style={{
          width: 1, marginTop: 12, marginBottom: 12, alignSelf: 'stretch',
          backgroundImage: 'linear-gradient(to bottom, transparent 0, transparent 3px, rgba(0,0,0,0.18) 3px, rgba(0,0,0,0.18) 6px)',
          backgroundSize: '1px 6px',
        }} />
      </div>

      {/* 우측 액션 (~25%) */}
      <div className="w-[88px] flex flex-col items-center justify-center gap-1.5 px-2 py-3 shrink-0"
        style={{ background: 'rgba(0,0,0,0.025)' }}>
        {v.status === 'unused' ? (
          <>
            {/* 미니 QR placeholder */}
            <button
              onClick={onShowQr}
              aria-label={t('voucher.scan')}
              className="w-12 h-12 rounded-md flex items-center justify-center active:opacity-80"
              style={{ background: '#0A0A0A', color: '#FFFFFF' }}
            >
              <QrCode className="w-6 h-6" strokeWidth={1.5} />
            </button>
            <span style={{ fontSize: 10, color: '#0A0A0A', fontWeight: 700, letterSpacing: '-0.01em' }}>
              {t('voucher.use', { defaultValue: '사용' })}
            </span>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 opacity-60">
            <Ticket className="w-7 h-7" style={{ color: '#9CA3AF' }} strokeWidth={1.5} />
            <span style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 600 }}>
              {t(`voucher.status.${v.status}`)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Derive a short uppercase English category from product name / restaurant.
 * Heuristic — keeps the v4 design's editorial feel without requiring backend changes.
 */
function deriveCategoryLabel(productName: string, restaurantName?: string): string {
  const text = `${productName} ${restaurantName || ''}`.toLowerCase()
  if (/한우|소고기|등심|채끝|안심|beef/.test(text)) return 'KOREAN BEEF'
  if (/오마카세|omakase|스시|sushi|초밥/.test(text)) return 'OMAKASE'
  if (/그릴|grill|스테이크|steak/.test(text)) return 'GRILL'
  if (/돼지|삼겹|pork|족발|보쌈/.test(text)) return 'PORK'
  if (/치킨|chicken|닭/.test(text)) return 'CHICKEN'
  if (/파스타|pasta|피자|pizza|이탈리|italian/.test(text)) return 'ITALIAN'
  if (/중식|짜장|짬뽕|마라|chinese/.test(text)) return 'CHINESE'
  if (/일식|라멘|돈카츠|japanese|udon|우동/.test(text)) return 'JAPANESE'
  if (/카페|coffee|디저트|dessert|cafe/.test(text)) return 'CAFE'
  if (/술|와인|맥주|bar|pub/.test(text)) return 'BAR'
  return 'MEAL'
}

// 🛡️ 2026-05-25 (A 옵션): KT Alpha 쿠폰 카드 — MMS 발송된 기프티쇼 표시.
function KtAlphaVoucherCard({ v, muted, t }: {
  v: Voucher
  muted: boolean
  t: (key: string, opts?: any) => string
}) {
  const [resending, setResending] = useState(false)

  async function resend() {
    if (!v.order_id) return
    if (!confirm("MMS 를 휴대폰으로 다시 발송할까요?")) return
    setResending(true)
    try {
      const { default: api } = await import("@/lib/api")
      const r = await api.post(`/api/admin/kt-alpha/trigger-order/${v.order_id}`, {})
      if (r.data?.success && r.data.result?.sent > 0) {
        const { toast } = await import("@/hooks/useToast")
        toast.success("재발송 완료 — 휴대폰을 확인해주세요")
      } else {
        const { toast } = await import("@/hooks/useToast")
        toast.error("재발송 실패 — 어드민에게 문의")
      }
    } catch {
      const { toast } = await import("@/hooks/useToast")
      toast.error("재발송 실패")
    } finally {
      setResending(false)
    }
  }

  const maskedPhone = v.kt_recipient_phone
    ? v.kt_recipient_phone.replace(/(\d{3})\d{4}(\d{4})/, "$1-****-$2")
    : ""

  return (
    <div
      className="relative flex rounded-xl overflow-hidden bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800"
      style={{ opacity: muted ? 0.55 : 1 }}
    >
      <div className="flex-1 p-4 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: "#F59E0B", display: "inline-block", flexShrink: 0 }} />
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em" }} className="text-amber-700 dark:text-amber-400">
            📱 KT ALPHA · 기프티쇼
          </span>
        </div>
        <p className="text-[15px] font-bold text-gray-900 dark:text-white truncate">{v.product_name}</p>
        {v.applied_price && (
          <p className="text-sm text-amber-600 dark:text-amber-400 font-bold mt-0.5">{formatNumber(v.applied_price)}원</p>
        )}
        {maskedPhone && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            📞 {maskedPhone} 로 발송됨
          </p>
        )}
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 leading-relaxed">
          휴대폰 메시지함에서 쿠폰 확인. 카카오톡 선물함 자동 연계 가능.
        </p>
        <button
          onClick={resend}
          disabled={resending}
          className="mt-3 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg"
        >
          {resending ? "재발송 중..." : "📱 MMS 다시 받기"}
        </button>
      </div>
      {v.product_image && (
        <div className="w-24 h-24 m-3 rounded-lg overflow-hidden bg-white dark:bg-[#0A0A0A] shrink-0">
          <img src={v.product_image} alt={v.product_name} className="w-full h-full object-cover" loading="lazy" />
        </div>
      )}
    </div>
  )
}
