import { lazy, Suspense, useState, useEffect, useRef, Fragment } from 'react'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { useNavigate } from 'react-router-dom'

// 🛡️ 2026-05-27 (loading P1): VoucherMap (Kakao Maps SDK ~150KB) 별도 chunk lazy.
//   사용자가 '지도 보기' 토글 시만 로드 → 초기 paint 영향 0.
const VoucherMap = lazy(() => import('./my-vouchers/VoucherMap'))
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import { ArrowLeft, Ticket, MapPin, CheckCircle, XCircle, QrCode, X, Share2, ChevronRight, Copy, Map, ArrowRight } from 'lucide-react'
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
  kt_pin?: string | null  // 🔢 #4: PIN 모드 발급분의 쿠폰 PIN/바코드 (인앱 표시용)
  order_id?: number
}

type ViewMode = 'list' | 'map'

// 🎨 2026-06-20 화면2 지도 — 거리/도보 시간 (Haversine, 시안 "320m · 도보 4분")
function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}
function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10}m` : `${(m / 1000).toFixed(1)}km`
}
function walkMinutes(m: number): number {
  return Math.max(1, Math.round(m / 75)) // 약 4.5km/h (75m/분) — 시안 320m→4분
}

const STATUS_MAP = {
  unused: { labelKey: 'voucher.status.unused', color: 'bg-green-100 text-green-700', icon: Ticket },
  used: { labelKey: 'voucher.status.used', color: 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-500 dark:text-gray-400', icon: CheckCircle },
  expired: { labelKey: 'voucher.status.expired', color: 'bg-red-100 text-red-600', icon: XCircle },
  refunded: { labelKey: 'voucher.status.refunded', color: 'bg-yellow-100 text-yellow-700', icon: XCircle },
} as const

// 🛡️ 2026-05-16: 외부 QR API (api.qrserver.com) 의존 제거 → qrcode.react 로컬 SVG.
// 🛡️ 2026-06-01 (loading): qrcode.react 는 QR 모달 열 때만 필요 → lazy (페이지 chunk -10KB).
//   장점: 외부 서비스 다운에 영향 X, latency 0, 오프라인에서도 렌더, 프라이버시.
const QRCodeSVG = lazy(() => import('qrcode.react').then(m => ({ default: m.QRCodeSVG })))

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
      // 🛠️ 2026-06-17 (기술부채 청산): DataURL(멀티MB base64 를 POST 본문/DB 에 저장하던 임시) →
      //   검증된 R2 업로드 endpoint(/api/upload/image, 유저 쿠키 인증)로. 응답 URL 만 제출.
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post('/api/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const url = res.data?.data?.url
      if (res.data?.success && url) setScreenshotUrl(url)
      else toast.error(res.data?.error || '업로드 실패')
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || '업로드 실패')
    } finally { setUploading(false) }
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
        className="mt-4 w-full py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold flex items-center justify-center gap-1">
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
              <button onClick={() => setMode('url')} className={`py-2 text-xs font-bold rounded ${mode === 'url' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-200'}`}>URL 제출</button>
              <button onClick={() => setMode('screenshot')} className={`py-2 text-xs font-bold rounded ${mode === 'screenshot' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-200'}`}>스크린샷 (AI 자동 검증)</button>
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
                className="py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-bold disabled:opacity-50">
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
      <Suspense fallback={<div style={{ width: size, height: size }} className="animate-pulse bg-gray-100 dark:bg-[#1A1A1A] rounded" />}>
        <QRCodeSVG value={value} size={size} level="M" includeMargin={false} />
      </Suspense>
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
    if (!(await confirmDialog({ message: t('voucher.cancelConfirm', { defaultValue: '이 교환권 구매를 취소하고 환불받으시겠어요?\n(미사용 + 구매 7일 이내만 가능)' }), danger: true }))) return
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
          <code className={`text-sm font-mono font-bold ${isUsed || isExpired ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>{voucher.code}</code>
        </div>
        {/* 🛡️ 캡쳐 도용 방지 — 실시간 시간 + 🟢 pulse (흑백 리디자인 화면3) */}
        {!isUsed && !isExpired && (
          <div className="flex items-center justify-center gap-1.5 mt-2.5">
            <span className="w-[7px] h-[7px] rounded-full bg-[#16A34A] animate-pulse" aria-hidden />
            <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 font-mono">
              {t('voucher.realtime', { defaultValue: '실시간' })} · {new Date(now).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        )}

        {/* 🛡️ 선결제 안내 — "이미 결제 완료" 🟢 체크 (선물 X, 추가결제 X) */}
        {voucher.status === 'unused' && (
          <div className="mt-4 flex items-start gap-2.5 bg-gray-50 dark:bg-[#141414] rounded-xl px-3.5 py-3">
            <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-[#16A34A]" strokeWidth={2.2} />
            <div className="text-left">
              <p className="text-[13px] font-bold text-gray-900 dark:text-white">{t('voucher.alreadyPaidTitle', { defaultValue: '이미 결제 완료된 식사권이에요' })}</p>
              <p className="text-[11.5px] leading-relaxed text-gray-500 dark:text-gray-400 mt-0.5">{t('voucher.alreadyPaidDesc', { defaultValue: '매장에서 추가 결제 없이 이 화면만 보여주세요' })}</p>
            </div>
          </div>
        )}

        {/* 매장 안내 (usage_guide) — 칩 + 텍스트 */}
        {voucher.usage_guide && voucher.status === 'unused' && (
          <div className="mt-2.5 flex items-center gap-2 px-0.5">
            <span className="shrink-0 text-[11px] font-semibold text-gray-900 dark:text-white border border-gray-200 dark:border-[#2A2A2A] rounded-md px-2 py-0.5">{t('voucher.storeGuide', { defaultValue: '매장 안내' })}</span>
            <span className="text-[11.5px] text-gray-500 dark:text-gray-400 whitespace-pre-wrap">{voucher.usage_guide}</span>
          </div>
        )}

        {/* 🏁 액션: 공유 / 구매 취소·환불 (흑백 리디자인 화면3 — 2버튼 그리드).
            '선물하기'는 제거됨(2026-06-12): QR 링크 공유일 뿐 소유권 이전 아님 + 셀프취소 시 무효화 오해. */}
        {voucher.status === 'unused' && (
          <>
            <div className={`mt-4 grid gap-2 ${canSelfCancel ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <button onClick={shareVoucher}
                className="py-3 rounded-xl border border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white text-[13px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform">
                <Share2 className="w-4 h-4" /> {t('voucher.share')}
              </button>
              {canSelfCancel && (
                <button onClick={handleSelfCancel} disabled={cancelling}
                  className="py-3 rounded-xl border border-gray-200 dark:border-[#2A2A2A] text-gray-500 dark:text-gray-400 text-[13px] font-bold disabled:opacity-50 active:scale-[0.98] transition-transform">
                  {cancelling ? t('voucher.cancelling', { defaultValue: '취소 처리 중…' }) : t('voucher.cancelRefund', { defaultValue: '구매 취소·환불' })}
                </button>
              )}
            </div>
            {canSelfCancel && (
              <p className="text-[10.5px] text-gray-400 dark:text-gray-500 text-center mt-2.5">
                {t('voucher.refundWindowNote', { defaultValue: '미사용 · 결제 후 7일 이내에만 환불할 수 있어요' })}
              </p>
            )}
          </>
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
  // 🎨 2026-06-20 흑백 리디자인 화면2(지도 전용) — 인-페이지 뷰(새 라우트 X)
  const [mapSelected, setMapSelected] = useState<Voucher | null>(null)
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null)
  // 🛡️ 2026-05-15: 참여 후 share prompt — GroupBuyDetailPage.handleJoin 이 localStorage 기록
  const [justJoined, setJustJoined] = useState<{ product_id: number; name: string; image_url?: string } | null>(null)
  // 🗑️ 2026-06-20 (대표 신고): '전화번호 등록' 배너 제거 — 교환권 구매 시 서버가 PHONE_REQUIRED 로
  //   번호를 강제 수집(users.phone)하므로, 교환권 보유 유저는 이미 번호가 있음 → 배너는 중복/노이즈.

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

  // 🎨 2026-06-20 화면2 지도 — 진입 시 현재 위치 1회 요청(거리/도보 시간 계산용). 거부/실패 시 거리 미표시(graceful).
  useEffect(() => {
    if (viewMode !== 'map' || userLoc) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { /* 권한 거부/실패 — 거리 표시만 생략 */ },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    )
  }, [viewMode, userLoc])

  // 🛡️ useMyVouchers hook 이 fetch + cache + setState 모두 처리 — 직접 useEffect 불필요.

  const locale = i18n.language?.startsWith('ko') ? 'ko-KR' : i18n.language || 'en-US'

  // 🛡️ 2026-04-30: CLAUDE.md 규칙 — /my-vouchers 는 화이트 테마 (쇼핑/결제 플로우)
  const theme = 'light' as const
  const tk = walletTokens[theme]

  // 상태별 그룹핑
  // 🏁 2026-06-12: 만료/환불 그룹 접기 상태 (기본 접힘)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  // 🎟️ 2026-06-18 (대표 신고 — 공구권 탭에 교환권 섞임): source 분리.
  //   공구권(internal, 매장 QR/PIN) 기본 / 교환권(kt_alpha, MMS 발송)은 별도 세그먼트. 교환권 보유 시에만 토글 노출.
  const [sourceTab, setSourceTab] = useState<'gb' | 'gift'>('gb')
  const gbCount = vouchers.filter(v => v.source !== 'kt_alpha').length
  const giftCount = vouchers.filter(v => v.source === 'kt_alpha').length
  const shownVouchers = giftCount > 0
    ? vouchers.filter(v => (sourceTab === 'gift' ? v.source === 'kt_alpha' : v.source !== 'kt_alpha'))
    : vouchers
  // 🎨 2026-06-20 흑백 리디자인 화면1: 사용가능 카드 + (사용완료 / 만료·환불) 헤어라인 박스
  const unusedItems = shownVouchers.filter(v => v.status === 'unused')
  const usedItems = shownVouchers.filter(v => v.status === 'used')
  const archivedItems = shownVouchers.filter(v => v.status === 'expired' || v.status === 'refunded')
  // 지도에 표시 가능한 미사용 식사권 (좌표 보유)
  const mapVouchers = vouchers.filter(v => v.status === 'unused' && v.restaurant_lat && v.restaurant_lng)

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

  // 🎨 화면2 — 지도에서 보기 (전용 인-페이지 화면)
  if (viewMode === 'map') {
    // 기본 선택 = 현 위치 기준 가장 가까운 식사권 (위치 없으면 첫 번째) — 시안처럼 카드 즉시 표시
    const dist = (v: Voucher) => (userLoc && v.restaurant_lat && v.restaurant_lng)
      ? haversineMeters(userLoc, { lat: v.restaurant_lat, lng: v.restaurant_lng }) : Infinity
    const nearest = mapVouchers.length === 0 ? null
      : (userLoc ? [...mapVouchers].sort((a, b) => dist(a) - dist(b))[0] : mapVouchers[0])
    const card = mapSelected ?? nearest
    const cardDist = (card && userLoc && card.restaurant_lat && card.restaurant_lng)
      ? haversineMeters(userLoc, { lat: card.restaurant_lat, lng: card.restaurant_lng }) : null
    return (
      <WalletPageWrapper theme={theme}>
        <SEO title={t('voucher.seoTitle')} description={t('voucher.seoDescription')} url="/my-vouchers" noindex />
        <div className="sticky top-0 md:top-14 z-30 flex items-center gap-2.5 px-3 pt-3 pb-2.5"
          style={{ background: tk.chrome, borderBottom: `0.5px solid ${tk.separator}` }}>
          <button onClick={() => { setViewMode('list'); setMapSelected(null) }}
            className="w-9 h-9 flex items-center justify-center rounded-full" style={{ background: tk.fillSoft, color: tk.label }}
            aria-label={t('common.back', { defaultValue: '뒤로가기' })}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-[19px] font-bold tracking-tight text-gray-900 dark:text-white">{t('voucher.mapTitle', { defaultValue: '지도에서 보기' })}</h1>
        </div>
        <div className="relative">
          <Suspense fallback={<div className="flex items-center justify-center text-sm text-gray-500 dark:text-gray-400" style={{ height: 460 }}>{t('voucher.mapLoading', { defaultValue: '지도 불러오는 중...' })}</div>}>
            <div className="[&>div]:rounded-none [&>div]:border-0" style={{ height: 460 }}>
              <VoucherMap
                vouchers={mapVouchers}
                userLocation={userLoc}
                onMarkerClick={(v) => setMapSelected(vouchers.find(x => x.id === v.id) ?? null)}
              />
            </div>
          </Suspense>
          {/* 선택 카드 (하단) — 시안: 썸네일 + 상품명 + 가게 · 거리 · 도보 N분 + 사용 */}
          {card && (
            <div className="absolute left-3 right-3 bottom-3 flex items-center gap-3 rounded-2xl bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#2A2A2A] p-3" style={{ boxShadow: '0 6px 22px rgba(0,0,0,0.14)' }}>
              <div className="w-[52px] h-[52px] shrink-0 rounded-xl overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#F7F8FA] to-[#EFF1F4] dark:from-[#1A1A1A] dark:to-[#0F0F0F]">
                {card.product_image
                  ? <img src={card.product_image} alt="" loading="lazy" className="w-full h-full object-cover" />
                  : <Ticket className="w-5 h-5 text-gray-300 dark:text-gray-600" strokeWidth={1.5} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold tracking-tight text-gray-900 dark:text-white truncate">{card.product_name}</p>
                <p className="text-[12px] text-gray-400 dark:text-gray-500 truncate mt-0.5">
                  {card.restaurant_name || ''}
                  {cardDist !== null && (
                    <>{card.restaurant_name ? ' · ' : ''}{formatDistance(cardDist)} · {t('voucher.walkMin', { count: walkMinutes(cardDist), defaultValue: `도보 ${walkMinutes(cardDist)}분` })}</>
                  )}
                </p>
              </div>
              <button onClick={() => { setQrVoucher(card) }}
                className="shrink-0 flex items-center gap-1.5 rounded-xl px-4 py-2.5 bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-[13px] font-bold active:scale-95 transition-transform">
                <QrCode className="w-4 h-4" strokeWidth={1.8} />{t('voucher.use', { defaultValue: '사용' })}
              </button>
            </div>
          )}
        </div>
        {qrVoucher && <QRModal voucher={qrVoucher} onClose={() => setQrVoucher(null)} />}
      </WalletPageWrapper>
    )
  }

  return (
    <WalletPageWrapper theme={theme}>
      <SEO title={t('voucher.seoTitle')} description={t('voucher.seoDescription')} url="/my-vouchers" />

      {/* 🎨 2026-06-20: back-only 빈 상단 바 제거 (최상위 탭 화면 — 시안엔 없음). LargeTitle 이 최상단. */}

      {/* Large Title + 메타 */}
      <LargeTitle theme={theme} title={t('voucher.myVouchers')} />

      {/* 🎟️ 2026-06-18: 공구권/교환권 세그먼트 — 교환권(기프티콘) 보유 시에만. 기본 공구권.
          🎨 2026-06-20 (사용자 신고 — '성의없어'): 두 줄짜리 plain pill → iOS 세그먼트 컨트롤(트랙+슬라이드 강조). */}
      {giftCount > 0 && (
        <div className="ur-content-narrow px-4 lg:px-8 mb-4">
          <div className="flex p-1 rounded-2xl bg-gray-100 dark:bg-[#1A1A1A]">
            {([
              ['gb', '🎟️', t('voucher.tabGroupBuy', { defaultValue: '공구권' }), gbCount],
              ['gift', '📱', t('voucher.tabGifticon', { defaultValue: '교환권' }), giftCount],
            ] as const).map(([key, emoji, label, count]) => {
              const active = sourceTab === key
              return (
                <button
                  key={key}
                  onClick={() => setSourceTab(key)}
                  className={`flex-1 py-2 rounded-xl text-[13px] font-bold flex items-center justify-center gap-1.5 transition-all ${active ? 'bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
                >
                  <span aria-hidden>{emoji}</span>
                  {label}
                  <span className={`min-w-[17px] px-1 inline-flex items-center justify-center rounded-full text-[10px] font-extrabold tabular-nums ${active ? 'bg-black/[0.06] text-gray-500 dark:bg-white/10 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>{count}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 🎨 2026-06-20 (흑백 리디자인): 🟢 사용가능 점 + '가장 가까운 만료 D-N'(임박 시 빨강).
          docs/design/my-vouchers-wallet-bw.md 화면1 상태줄. */}
      {shownVouchers.length > 0 && (
        <div className="ur-content-narrow px-4 lg:px-8 -mt-2 mb-4 flex items-center gap-2 flex-wrap"
          style={{ fontSize: 13, letterSpacing: '-0.01em' }}>
          <span className="inline-flex items-center gap-1.5" style={{ fontWeight: 600, color: tk.secondary }}>
            <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: '#16A34A', boxShadow: '0 0 0 3px rgba(22,163,74,0.12)' }} aria-hidden />
            {shownVouchers.filter(v => v.status === 'unused').length}{t('voucher.activeCountSuffix', { defaultValue: '장 사용 가능' })}
          </span>
          {nearestExpiry !== null && (
            <>
              <span className="w-[3px] h-[3px] rounded-full shrink-0" style={{ background: tk.tertiary }} aria-hidden />
              <span style={{ color: tk.secondary, fontWeight: 600 }}>
                {t('voucher.nearestExpiry', { defaultValue: '가장 가까운 만료' })}{' '}
                <b style={{ color: nearestExpiry <= 2 ? '#DC2626' : tk.label, fontWeight: 700 }}>
                  {nearestExpiry === 0 ? 'D-DAY' : `D-${nearestExpiry}`}
                </b>
              </span>
            </>
          )}
        </div>
      )}

      <div className="ur-content-narrow px-4 lg:px-8 pb-2">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: tk.accent, borderTopColor: 'transparent' }} />
          </div>
        ) : shownVouchers.length === 0 ? (
          <EmptyVouchers
            mode={giftCount > 0 && sourceTab === 'gift' ? 'gift' : 'gb'}
            onExplore={() => navigate(giftCount > 0 && sourceTab === 'gift' ? '/vouchers' : '/group-buy')}
            t={t}
          />
        ) : (
          <>
            {/* 사용 가능 N + 🗺 지도 토글 (화면1) */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] font-semibold text-gray-500 dark:text-gray-400">
                {t('voucher.groupUnused', { defaultValue: '사용 가능' })} <span className="text-gray-400 dark:text-gray-500">{unusedItems.length}</span>
              </span>
              {mapVouchers.length > 0 && (
                <button onClick={() => setViewMode('map')}
                  className="flex items-center gap-1 text-[13px] font-semibold text-gray-900 dark:text-white active:opacity-60">
                  <Map className="w-4 h-4" strokeWidth={1.8} />{t('voucher.mapView', { defaultValue: '지도' })}
                </button>
              )}
            </div>

            {/* 사용 가능 카드 */}
            {unusedItems.length > 0 ? (
              <div className="space-y-3">
                {unusedItems.map(v => <VoucherTicket key={v.id} v={v} muted={false} locale={locale} t={t} onShowQr={() => setQrVoucher(v)} />)}
              </div>
            ) : (
              <p className="py-8 text-center text-[13px] text-gray-400 dark:text-gray-500">{t('voucher.noUnused', { defaultValue: '사용 가능한 식사권이 없어요' })}</p>
            )}

            {/* 사용 완료 / 만료·환불 — 헤어라인 박스 (탭하면 인라인 펼침) */}
            {(usedItems.length > 0 || archivedItems.length > 0) && (
              <div className="mt-4 rounded-2xl border border-gray-200 dark:border-[#1F1F1F] overflow-hidden">
                {([
                  { key: 'used', label: t('voucher.groupUsed', { defaultValue: '사용 완료' }), items: usedItems },
                  { key: 'archived', label: t('voucher.groupArchived', { defaultValue: '만료 · 환불' }), items: archivedItems },
                ] as const).filter(g => g.items.length > 0).map((g, idx) => {
                  const open = expandedGroups.has(g.key)
                  return (
                    <Fragment key={g.key}>
                      {idx > 0 && <div className="h-px bg-gray-100 dark:bg-[#1F1F1F] mx-[15px]" />}
                      <button type="button"
                        onClick={() => setExpandedGroups(prev => { const n = new Set(prev); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n })}
                        className="w-full flex items-center justify-between px-[15px] py-3.5 text-left">
                        <span className="text-[14px] font-semibold text-gray-900 dark:text-white">{g.label} <span className="text-gray-400 dark:text-gray-500 font-medium">{g.items.length}</span></span>
                        <ChevronRight className={`w-4 h-4 shrink-0 text-gray-300 dark:text-gray-600 transition-transform ${open ? 'rotate-90' : ''}`} />
                      </button>
                      {open && (
                        <div className="px-[13px] pb-3 space-y-3">
                          {g.items.map(v => <VoucherTicket key={v.id} v={v} muted locale={locale} t={t} onShowQr={() => setQrVoucher(v)} />)}
                        </div>
                      )}
                    </Fragment>
                  )
                })}
              </div>
            )}
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

/**
 * 🎨 2026-06-21 흑백 고급 마감 — 빈 상태 히어로 일러스트.
 *   기존 '회색 박스 + 얇은 lucide 아이콘'(플레이스홀더 느낌)을 천공(perforation)·스텁·
 *   QR/바코드 모티프가 있는 '실제 티켓' 라인아트로 교체 + 뒤에 한 장 더 겹친 스택 깊이 +
 *   부드러운 그라운드 섀도. 순수 잉크(currentColor) — 라이트/다크 토큰 동반.
 */
function TicketShape({ className, strokeWidth = 2.2, variant, faded }: {
  className?: string
  strokeWidth?: number
  variant: 'gb' | 'gift'
  faded?: boolean
}) {
  return (
    <svg viewBox="0 0 140 96" fill="none" className={className} aria-hidden>
      {/* 티켓 본체: 상·하단 천공 노치 + 라운드 코너 */}
      <path
        d="M16 8 L87 8 A9 9 0 0 0 105 8 L124 8 A12 12 0 0 1 136 20 L136 76 A12 12 0 0 1 124 88 L105 88 A9 9 0 0 0 87 88 L16 88 A12 12 0 0 1 4 76 L4 20 A12 12 0 0 1 16 8 Z"
        stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" fill="none"
      />
      {/* 천공 점선 */}
      <line x1="96" y1="16" x2="96" y2="80" stroke="currentColor" strokeWidth={strokeWidth * 0.6} strokeDasharray="2.4 5" strokeLinecap="round" opacity={0.4} />
      {!faded && (
        <>
          {/* 본문 패널 — 내용 라인 */}
          <rect x="18" y="34" width="52" height="6" rx="3" fill="currentColor" opacity="0.9" />
          <rect x="18" y="48" width="40" height="5" rx="2.5" fill="currentColor" opacity="0.32" />
          <rect x="18" y="60" width="28" height="5" rx="2.5" fill="currentColor" opacity="0.18" />
          {/* 스텁 모티프 — gb: QR 닷 / gift: 바코드 */}
          {variant === 'gift' ? (
            <g stroke="currentColor" strokeLinecap="round">
              <line x1="108" y1="38" x2="108" y2="58" strokeWidth="2" opacity="0.85" />
              <line x1="113" y1="38" x2="113" y2="58" strokeWidth="1.1" opacity="0.5" />
              <line x1="117" y1="38" x2="117" y2="58" strokeWidth="2.4" opacity="0.85" />
              <line x1="122" y1="38" x2="122" y2="58" strokeWidth="1.1" opacity="0.5" />
              <line x1="126" y1="38" x2="126" y2="58" strokeWidth="2" opacity="0.85" />
            </g>
          ) : (
            <g fill="currentColor">
              {[0, 1, 2].map(r => [0, 1, 2].map(cc => (
                <rect key={`${r}-${cc}`} x={108 + cc * 7} y={41 + r * 7} width="4.5" height="4.5" rx="1" opacity={(r + cc) % 2 === 0 ? 0.85 : 0.32} />
              )))}
            </g>
          )}
        </>
      )}
    </svg>
  )
}

function WalletEmptyGlyph({ variant }: { variant: 'gb' | 'gift' }) {
  return (
    <div className="relative mb-7" style={{ width: 176, height: 132 }} aria-hidden>
      {/* 그라운드 섀도 */}
      <div className="absolute left-1/2 bottom-[12px] -translate-x-1/2 rounded-[50%]"
        style={{ width: 108, height: 16, background: 'radial-gradient(closest-side, rgba(10,10,10,0.13), rgba(10,10,10,0))' }} />
      {/* 뒤 티켓 (스택 깊이) */}
      <div className="absolute left-1/2 top-1/2 text-gray-200 dark:text-[#272727]"
        style={{ transform: 'translate(calc(-50% - 17px), calc(-50% - 9px)) rotate(-11deg)', width: 122 }}>
        <TicketShape variant={variant} strokeWidth={2.4} faded className="w-full" />
      </div>
      {/* 앞 티켓 */}
      <div className="absolute left-1/2 top-1/2 text-gray-900 dark:text-white"
        style={{ transform: 'translate(calc(-50% + 5px), -50%) rotate(3deg)', width: 134, filter: 'drop-shadow(0 8px 14px rgba(10,10,10,0.10))' }}>
        <TicketShape variant={variant} strokeWidth={2.4} className="w-full" />
      </div>
    </div>
  )
}

/**
 * 🎨 2026-06-20 흑백 iOS-클린 리디자인 (docs/design/my-vouchers-wallet-bw.md 화면5):
 *   기존(핑크 그라데이션 일러스트 + CTA + 카드형 3스텝) → 잉크 톤 통일.
 *   뉴트럴 라운드 일러스트 + 1·2·3 원형 잉크 번호(셰브론) + 블랙 필 CTA.
 *   화이트 테마(다크 토글 지원) — 모든 라이트 토큰에 dark: variant 동반.
 *   🎨 2026-06-21 고급 마감: 일러스트 → WalletEmptyGlyph(스택 티켓), 스텝 셰브론 → 연결 트랙.
 */
function EmptyVouchers({ mode, onExplore, t }: {
  mode: 'gb' | 'gift'
  onExplore: () => void
  t: (key: string, opts?: any) => string
}) {
  const isGift = mode === 'gift'
  const title = isGift
    ? t('voucher.emptyGiftTitle', { defaultValue: '받아둔 교환권이 없어요' })
    : t('voucher.emptyGbTitle', { defaultValue: '받아둔 식사권이 없어요' })
  const desc = isGift
    ? t('voucher.emptyGiftDesc', { defaultValue: '교환권을 구매하면 휴대폰으로 발송되고\n여기에서도 모아볼 수 있어요' })
    : t('voucher.emptyGbDesc', { defaultValue: '동네 맛집 공동구매에 참여하면\n선결제 식사권이 여기에 쌓여요' })
  const cta = isGift
    ? t('voucher.emptyGiftCta', { defaultValue: '교환권 보러가기' })
    : t('voucher.emptyGbCta', { defaultValue: '공구 보러가기' })

  // 🎨 흑백 리디자인 화면5 — 1·2·3 원형 스텝(2줄 라벨)
  const steps: string[] = isGift
    ? [
        t('voucher.stepGift1', { defaultValue: '교환권\n구매' }),
        t('voucher.stepGift2', { defaultValue: 'MMS\n발송' }),
        t('voucher.stepGift3', { defaultValue: '매장에서\n제시' }),
      ]
    : [
        t('voucher.stepGb1', { defaultValue: '공구\n참여' }),
        t('voucher.stepGb2', { defaultValue: '지갑에\n식사권' }),
        t('voucher.stepGb3', { defaultValue: '매장에서\nQR 제시' }),
      ]

  return (
    <div className="py-12 flex flex-col items-center text-center">
      {/* 히어로 일러스트 — 스택 티켓(천공·스텁·QR/바코드) */}
      <WalletEmptyGlyph variant={isGift ? 'gift' : 'gb'} />

      <h2 className="text-[20px] font-extrabold tracking-[-0.02em] text-gray-900 dark:text-white">{title}</h2>
      <p className="mt-2 max-w-[264px] text-[13.5px] leading-relaxed text-gray-500 dark:text-gray-400 whitespace-pre-line">{desc}</p>

      {/* 사용 흐름 1·2·3 — 잉크 원형 번호 + 연결 트랙(헤어라인) */}
      <div className="mt-9 w-full max-w-[300px] flex items-start">
        {steps.map((label, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <div className="flex-1 mt-[16px] h-px mx-1.5 rounded-full bg-gray-200 dark:bg-[#2A2A2A]" aria-hidden />
            )}
            <div className="flex flex-col items-center gap-2 w-[58px] shrink-0">
              <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-[14px] font-bold font-mono bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-[0_2px_6px_rgba(10,10,10,0.18)] dark:shadow-none">{i + 1}</div>
              <span className="text-[11px] font-medium leading-tight text-gray-600 dark:text-gray-300 whitespace-pre-line">{label}</span>
            </div>
          </Fragment>
        ))}
      </div>

      <button
        onClick={onExplore}
        className="mt-9 w-full max-w-[300px] py-3.5 rounded-2xl text-[15px] font-extrabold bg-gray-900 dark:bg-white text-white dark:text-gray-900 active:scale-[0.98] transition-transform flex items-center justify-center gap-1.5 shadow-[0_8px_22px_rgba(10,10,10,0.20)] dark:shadow-none"
      >
        {cta}
        <ArrowRight className="w-[17px] h-[17px]" strokeWidth={2.4} />
      </button>
    </div>
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
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">친구 초대 시 양쪽 <span className="font-bold text-gray-900 dark:text-white">0.5% 보너스 딜</span></p>
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

  // 🛡️ 2026-05-25 (A 옵션): KT Alpha 쿠폰은 별도 카드 형식 (재발송 버튼 포함)
  if (v.source === 'kt_alpha') {
    return <KtAlphaVoucherCard v={v} muted={muted} t={t} />
  }

  // 🎨 2026-06-20 흑백 iOS-클린 (docs/design/my-vouchers-wallet-bw.md 화면1 카드):
  //   60px 썸네일 · 🟢 상태점+사용가능+D-N · 제목 · 📍가게 · 코드칩 / 우측: 가격 + 컴팩트 사용 pill.
  const urgent = v.status === 'unused' && daysLeft !== null && daysLeft <= 2
  const price = v.applied_price ?? v.product_price ?? null

  return (
    <div
      className="relative flex items-stretch gap-3 rounded-2xl bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#1F1F1F] p-[13px]"
      style={{ opacity: muted ? 0.55 : 1, boxShadow: muted ? 'none' : '0 1px 2px rgba(10,10,10,0.05), 0 10px 22px -8px rgba(10,10,10,0.10)' }}
    >
      {/* 썸네일 60px */}
      <div className="w-[60px] h-[60px] shrink-0 rounded-xl overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#F7F8FA] to-[#EFF1F4] dark:from-[#1A1A1A] dark:to-[#0F0F0F] ring-1 ring-gray-100 dark:ring-white/10">
        {v.product_image ? (
          <img src={v.product_image} alt={v.product_name} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <Ticket className="w-6 h-6 text-gray-300 dark:text-gray-600" strokeWidth={1.5} />
        )}
      </div>

      {/* 본문 */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {/* 상태 줄 */}
        <div className="flex items-center gap-1.5">
          {v.status === 'unused' ? (
            <>
              <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: '#16A34A', boxShadow: '0 0 0 3px rgba(22,163,74,0.12)' }} aria-hidden />
              <span className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">{t('voucher.status.unused', { defaultValue: '사용 가능' })}</span>
              {daysLeft !== null && (
                <span className={`text-[12px] font-bold font-mono ${urgent ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>
                  {daysLeft === 0 ? 'D-DAY' : `D-${daysLeft}`}
                </span>
              )}
            </>
          ) : (
            <span className="text-[12px] font-semibold" style={{ color: v.status === 'expired' ? '#DC2626' : '#6B7280' }}>
              {t(`voucher.status.${v.status}`)}
              {v.status === 'used' && usedAt && <span className="ml-1 text-gray-400 dark:text-gray-500 font-normal">· {usedAt.toLocaleDateString(locale)}</span>}
            </span>
          )}
        </div>

        {/* 제목 */}
        <p className="text-gray-900 dark:text-white font-bold text-[16px] leading-tight tracking-tight truncate">{v.product_name}</p>

        {/* 가게 */}
        {v.restaurant_name && (
          <p className="flex items-center gap-1 text-[12px] text-gray-400 dark:text-gray-500 min-w-0">
            <MapPin className="w-3 h-3 shrink-0" /><span className="truncate">{v.restaurant_name}</span>
          </p>
        )}

        {/* 코드 칩 */}
        <code
          onClick={(e) => {
            e.stopPropagation()
            if (v.status !== 'unused') return
            navigator.clipboard?.writeText(v.code)
            toast.success(t('voucher.copied', { defaultValue: '복사됨' }))
          }}
          className={`mt-0.5 self-start inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold tracking-wide text-gray-500 dark:text-gray-300 bg-gray-100 dark:bg-white/10 rounded-md px-2 py-[3px] ${v.status === 'unused' ? 'cursor-pointer active:opacity-70' : ''}`}
        >
          {v.code}
          {v.status === 'unused' && <Copy className="w-3 h-3 text-gray-400 dark:text-gray-500" strokeWidth={2} aria-hidden />}
        </code>
      </div>

      {/* 천공 — 티켓 스텁 구분 점선 (고급 마감) */}
      <div className="self-stretch shrink-0 my-0.5 border-l border-dashed border-gray-200 dark:border-[#2A2A2A]" aria-hidden />

      {/* 우측: 가격 + 사용 pill */}
      <div className="shrink-0 flex flex-col items-end justify-between">
        {price !== null ? (
          <div className="text-[15px] font-bold font-mono text-gray-900 dark:text-white whitespace-nowrap">
            {formatNumber(price)}<span className="font-sans text-[11px] font-semibold text-gray-400 dark:text-gray-500">원</span>
          </div>
        ) : <span />}
        {v.status === 'unused' ? (
          <button
            onClick={onShowQr}
            aria-label={t('voucher.scan', { defaultValue: '사용' })}
            className="flex items-center gap-1.5 rounded-xl px-[15px] py-[9px] bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-[13px] font-bold active:scale-95 transition-transform"
          >
            <QrCode className="w-4 h-4" strokeWidth={1.8} />
            {t('voucher.use', { defaultValue: '사용' })}
          </button>
        ) : (
          <div className="w-7 h-7 flex items-center justify-center opacity-50">
            <Ticket className="w-5 h-5 text-gray-300 dark:text-gray-600" strokeWidth={1.5} />
          </div>
        )}
      </div>
    </div>
  )
}

// 🛡️ 2026-05-25 (A 옵션): KT Alpha 쿠폰 카드 — MMS 발송된 기프티쇼 표시.
// 🔢 2026-06-17 (#4): 쿠폰 PIN → CODE128 바코드. jsbarcode 동적 import (페이지 chunk 영향 0).
function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    let cancelled = false
    import('jsbarcode').then(({ default: JsBarcode }) => {
      if (cancelled || !ref.current) return
      try { JsBarcode(ref.current, value, { format: 'CODE128', displayValue: false, height: 54, margin: 0, width: 1.7 }) } catch { /* invalid value */ }
    }).catch(() => { /* lib load fail */ })
    return () => { cancelled = true }
  }, [value])
  return <svg ref={ref} aria-label="쿠폰 바코드" className="max-w-full" />
}

function KtAlphaVoucherCard({ v, muted, t }: {
  v: Voucher
  muted: boolean
  t: (key: string, opts?: any) => string
}) {
  // 🛡️ 2026-06-12 (감사 1단계 — 사용자 결정): "MMS 다시 받기" 버튼 제거.
  //   admin 전용 endpoint(/api/admin/kt-alpha/trigger-order/:id) 를 일반 유저가 호출해
  //   항상 401/403 실패하던 dead 버튼 — 재발송은 어드민 화면(AdminVoucherTransactionsPage)에서.
  const maskedPhone = v.kt_recipient_phone
    ? v.kt_recipient_phone.replace(/(\d{3})\d{4}(\d{4})/, "$1-****-$2")
    : ""
  // 🔢 #4: PIN 모드 발급분(kt_pin 보유)은 인앱 바코드. 아니면 MMS 안내(기존).
  const hasBarcode = !!v.kt_pin && v.status === 'unused'
  // 🔔 2026-06-17 (사용자 요청): 발송 실패(잔액부족/API오류 등) 명시 — '결제됐는데 안 옴' 깜깜이 해소.
  const sendFailed = v.kt_status === 'failed'

  // 🎨 2026-06-20 흑백 리디자인: 식사권과 동일한 클린 화이트 카드 + 84px 썸네일 + 잉크 타이포.
  //   기프티쇼 정체성은 작은 뉴트럴(회색) 칩으로만 구분 (이전 amber → 잉크 통일).
  const statusBadge = v.status !== 'unused' ? (
    <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wide"
      style={{
        background: v.status === 'used' ? 'rgba(0,0,0,0.06)' : v.status === 'expired' ? 'rgba(239,68,68,0.10)' : 'rgba(245,158,11,0.12)',
        color: v.status === 'used' ? '#6B7280' : v.status === 'expired' ? '#DC2626' : '#6b7280',
      }}>
      {t(`voucher.status.${v.status}`)}
    </span>
  ) : null

  return (
    <div
      className="relative rounded-2xl bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#1F1F1F] p-3"
      style={{ opacity: muted ? 0.55 : 1, boxShadow: muted ? 'none' : '0 1px 3px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-stretch gap-3">
        {/* 상품 이미지 (식사권 카드와 동일 규격) */}
        <div className="w-[84px] h-[84px] shrink-0 rounded-xl overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#F7F8FA] to-[#EFF1F4] dark:from-[#1A1A1A] dark:to-[#0F0F0F]">
          {v.product_image ? (
            <img src={v.product_image} alt={v.product_name} loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <Ticket className="w-7 h-7 text-gray-300 dark:text-gray-600" strokeWidth={1.5} />
          )}
        </div>

        {/* 본문 */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wide bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-300">
              📱 기프티쇼
            </span>
            {sendFailed ? (
              <span className="ml-auto shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wide bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400">발송 실패</span>
            ) : statusBadge ? <span className="ml-auto">{statusBadge}</span> : null}
          </div>
          <p className="line-clamp-2 mt-1 text-gray-900 dark:text-white font-bold text-[14px] leading-snug tracking-tight">{v.product_name}</p>
          {v.applied_price && (
            <p className="mt-0.5 text-[13px] font-extrabold text-gray-900 dark:text-white">{formatNumber(v.applied_price)}원</p>
          )}
          <div className="mt-auto pt-1.5">
            {sendFailed ? (
              <>
                <p className="text-[11px] font-bold text-red-600 dark:text-red-400">발송에 실패했어요</p>
                <p className="mt-0.5 text-[10.5px] leading-relaxed text-gray-500 dark:text-gray-400">결제는 완료됐어요. 고객센터로 재발송을 요청해 주세요.</p>
              </>
            ) : (
              <>
                {maskedPhone && !hasBarcode && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">📞 {maskedPhone} 로 발송됨</p>
                )}
                <p className="mt-0.5 text-[10.5px] leading-relaxed text-gray-400 dark:text-gray-500">
                  {hasBarcode
                    ? t('voucher.ktShowBarcode', { defaultValue: '매장에서 아래 바코드를 제시하세요' })
                    : t('voucher.ktCheckMms', { defaultValue: '휴대폰 메시지함에서 쿠폰 확인. 카카오톡 선물함 자동 연계 가능.' })}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 🔢 #4: 인앱 바코드 (PIN 모드 발급분) */}
      {hasBarcode && (
        <div className="mt-3 px-3 py-3 rounded-xl bg-gray-50 dark:bg-[#0A0A0A] border border-gray-100 dark:border-[#1F1F1F] flex flex-col items-center gap-1.5">
          <Barcode value={v.kt_pin as string} />
          <span className="text-[12px] font-mono font-bold tracking-[0.15em] text-gray-900 dark:text-white">{v.kt_pin}</span>
        </div>
      )}
    </div>
  )
}
