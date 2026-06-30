import { lazy, Suspense, useState, useEffect, useRef, useMemo, useCallback, Fragment } from 'react'
import { safeDate, safeTime } from '@/utils/safe-date'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { useNavigate } from 'react-router-dom'

// 🛡️ 2026-05-27 (loading P1): VoucherMap (Kakao Maps SDK ~150KB) 별도 chunk lazy.
//   사용자가 '지도 보기' 토글 시만 로드 → 초기 paint 영향 0.
const VoucherMap = lazy(() => import('./my-vouchers/VoucherMap'))
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import { ArrowLeft, Ticket, MapPin, CheckCircle, XCircle, QrCode, X, Share2, ChevronRight, Copy, Map, Gift, Smartphone } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import api from '@/lib/api'
import { useMyVouchers, useInvalidateMyVouchers } from '@/hooks/queries'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { LargeTitle, WalletPageWrapper } from '@/components/wallet/WalletAtoms'
import { walletTokens } from '@/components/wallet/walletTokens'
import { formatNumber } from '@/utils/format'
import VoucherRedeemModal from '@/components/voucher/VoucherRedeemModal'
import VoucherDisputeBanner from '@/components/voucher/VoucherDisputeBanner'
import { WalletSkeleton, EmptyVouchers } from './my-vouchers/WalletEmpty'

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
  product_id?: number  // 🛡️ /api/vouchers/my 가 v.product_id 반환 — 재구매 딥링크용
  applied_discount_pct?: number  // 🛡️ 할인율(%) — '아낀 돈' 계산용 (product_price 미반환이므로 이걸로)
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
  const [wakeActive, setWakeActive] = useState(false)  // 🎨 개선 #3: 화면 꺼짐 방지 활성 표시
  const qrUrl = `https://live.ur-team.com/v/${voucher.code}`

  // 🛡️ 2026-05-30: 즉시판매 단일가 모델 — 사용자 셀프 구매취소(청약철회). 미사용 + 구매 7일 이내만.
  const invalidateVouchers = useInvalidateMyVouchers()
  const [cancelling, setCancelling] = useState(false)
  // 🎟️ 2026-06-20 현장 셀프 사용처리 모달
  const [showRedeem, setShowRedeem] = useState(false)
  // 🛡️ 2026-06-26 (소비자 감사): safeDate — D1 'YYYY-MM-DD HH:MM:SS' 를 사파리가 Invalid Date 로 파싱하면
  //   NaN < window 가 false → 미사용 7일내인데도 환불 버튼이 사라지던 것(기능 차단). safeDate 가 파싱 보정.
  const createdMs = safeDate(voucher.created_at)?.getTime() ?? NaN
  const canSelfCancel = voucher.status === 'unused' && Number.isFinite(createdMs) &&
    (Date.now() - createdMs) < 7 * 86400000
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

  // 🎨 2026-06-21 (개선 #3): 매장 스캔 중 화면 꺼짐/디밍 방지 — Screen Wake Lock(웹 표준, iOS 16.4+/안드).
  //   네이티브 밝기 API 는 미보유 → wakeLock 으로 dim/sleep 차단(스캔 끊김 방지). 전부 fail-soft.
  useEffect(() => {
    if (voucher.status !== 'unused') return
    let lock: { release: () => Promise<void> } | null = null
    let released = false
    const wl = (typeof navigator !== 'undefined' ? (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock : undefined)
    const request = async () => { try { if (wl && !released) { lock = await wl.request('screen'); setWakeActive(true) } } catch { /* unsupported/denied */ } }
    request()
    const onVis = () => { if (typeof document !== 'undefined' && document.visibilityState === 'visible') request() }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis)
    return () => {
      released = true
      setWakeActive(false)
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis)
      try { lock?.release() } catch { /* ignore */ }
    }
  }, [voucher.status])

  const isUsed = voucher.status === 'used'
  const isExpired = voucher.status === 'expired' || voucher.status === 'refunded'

  // 🎨 2026-06-21 (개선 #3): 매장 길찾기 (카카오맵). 좌표 우선, 없으면 주소 검색.
  const mapUrl = (voucher.restaurant_lat && voucher.restaurant_lng)
    ? `https://map.kakao.com/link/to/${encodeURIComponent(voucher.restaurant_name || '매장')},${voucher.restaurant_lat},${voucher.restaurant_lng}`
    : voucher.restaurant_address
      ? `https://map.kakao.com/link/search/${encodeURIComponent(voucher.restaurant_address)}`
      : null

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
    <div className="fixed inset-0 z-[10600] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-[2px]" onClick={onClose} role="presentation">
      <div className="bg-white dark:bg-[#0A0A0A] rounded-t-3xl sm:rounded-3xl p-6 pt-3 sm:pt-6 w-full sm:max-w-xs sm:mx-4 relative animate-slideUp" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('voucher.qrCode', { defaultValue: 'QR 코드' })}>
        {/* 그래버 (모바일 바텀시트) */}
        <div className="sm:hidden mx-auto mb-4 h-1 w-9 rounded-full bg-gray-200 dark:bg-[#2A2A2A]" aria-hidden />
        <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-[#1A1A1A] dark:bg-[#1A1A1A]">
          <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
        <p className="text-center text-[17px] font-extrabold tracking-tight text-gray-900 dark:text-white mb-1">{voucher.product_name}</p>
        {voucher.restaurant_name && (
          <p className="flex items-center justify-center gap-1 text-center text-xs text-gray-500 dark:text-gray-400 mb-4">
            <MapPin className="w-3 h-3 shrink-0" />{voucher.restaurant_name}
            {mapUrl && (
              <a href={mapUrl} target="_blank" rel="noopener noreferrer"
                className="ml-1 inline-flex items-center gap-0.5 font-semibold text-gray-900 dark:text-white underline underline-offset-2 active:opacity-60">
                {t('voucher.directions', { defaultValue: '길찾기' })}
              </a>
            )}
          </p>
        )}
        <div className="flex justify-center mb-4">
          <div className="relative p-4 rounded-2xl bg-white dark:bg-[#0A0A0A] border border-gray-100 dark:border-[#1F1F1F]" style={{ boxShadow: '0 2px 12px rgba(10,10,10,0.06)' }}>
            {/* 스캔 프레임 코너 브래킷 (사용 가능 시) */}
            {!isUsed && !isExpired && (
              <>
                <span className="absolute top-2 left-2 w-3.5 h-3.5 border-t-2 border-l-2 rounded-tl-[3px] border-gray-900 dark:border-white" aria-hidden />
                <span className="absolute top-2 right-2 w-3.5 h-3.5 border-t-2 border-r-2 rounded-tr-[3px] border-gray-900 dark:border-white" aria-hidden />
                <span className="absolute bottom-2 left-2 w-3.5 h-3.5 border-b-2 border-l-2 rounded-bl-[3px] border-gray-900 dark:border-white" aria-hidden />
                <span className="absolute bottom-2 right-2 w-3.5 h-3.5 border-b-2 border-r-2 rounded-br-[3px] border-gray-900 dark:border-white" aria-hidden />
              </>
            )}
            <div className={isUsed || isExpired ? 'opacity-20 grayscale' : ''}>
              <VoucherQRCode value={qrUrl} size={160} />
            </div>
            {/* 🛡️ 2026-05-16: 사용 완료 / 만료 시 큰 오버레이 (재사용 방지) */}
            {isUsed && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-500/10 rounded-2xl">
                <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center">
                  <CheckCircle className="w-12 h-12 text-white" strokeWidth={3} />
                </div>
                <p className="mt-2 text-base font-extrabold text-emerald-700">사용 완료</p>
                {voucher.used_at && (
                  <p className="text-[10px] text-emerald-600">{safeDate(voucher.used_at)?.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}</p>
                )}
              </div>
            )}
            {isExpired && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-500/10 rounded-2xl">
                <div className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center">
                  <XCircle className="w-12 h-12 text-white" strokeWidth={3} />
                </div>
                <p className="mt-2 text-base font-extrabold text-red-700">
                  {voucher.status === 'expired' ? '만료됨' : '환불됨'}
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="bg-gray-100 dark:bg-[#1A1A1A] rounded-xl px-3 py-2.5 text-center">
          <code className={`text-[15px] font-mono font-bold tracking-[0.08em] ${isUsed || isExpired ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>{voucher.code}</code>
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
        {/* 🎨 개선 #3: 화면 꺼짐 방지 활성 안내 (스캔 중 디밍 차단) */}
        {!isUsed && !isExpired && wakeActive && (
          <p className="text-center text-[10.5px] text-gray-400 dark:text-gray-500 mt-1.5">
            {t('voucher.wakeOn', { defaultValue: '🔆 화면 꺼짐 방지 중 — 스캔하기 좋게' })}
          </p>
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
            {/* 🎟️ 2026-06-20 현장 사용 — 가장 강조(잉크 풀폭). 매장에서 이걸 눌러 사용처리. */}
            <button
              onClick={() => setShowRedeem(true)}
              className="mt-4 w-full py-3.5 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[15px] font-extrabold active:scale-[0.98] transition-transform"
            >
              {t('voucher.useNow', { defaultValue: '현장에서 사용하기' })}
            </button>
            <div className={`mt-2 grid gap-2 ${canSelfCancel ? 'grid-cols-2' : 'grid-cols-1'}`}>
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
      {showRedeem && (
        <VoucherRedeemModal
          code={voucher.code}
          storeName={voucher.restaurant_name}
          storeAddress={voucher.restaurant_address}
          onClose={() => setShowRedeem(false)}
          onRedeemed={() => { setVoucher(v => ({ ...v, status: 'used' })); invalidateVouchers() }}
        />
      )}
    </div>
  )
}

export default function MyVouchersPage() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  // 🛡️ 2026-05-22 P1 영구 fix: useState+useEffect+직접 fetch → useMyVouchers().
  //   localStorage initialData (즉시 0ms 표시) + 2분 stale + 페이지 전환 시 dedup.
  const { data: vouchersRaw, isLoading: loading } = useMyVouchers()
  // 🎨 2026-06-21 (개선 #1): vouchers/mapVouchers/onMarkerClick 메모이즈 — 지도 카드 선택 시
  //   리렌더마다 VoucherMap effect 재실행(지도 재초기화·깜빡임)되던 것 방지.
  const vouchers = useMemo(() => (vouchersRaw ?? []) as unknown as Voucher[], [vouchersRaw])
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
  // 🎟️ 2026-06-18 (대표 신고 — 이용권 탭에 교환권 섞임): source 분리.
  //   이용권(internal, 매장 QR/PIN) 기본 / 교환권(kt_alpha, MMS 발송)은 별도 세그먼트. 교환권 보유 시에만 토글 노출.
  const [sourceTab, setSourceTab] = useState<'gb' | 'gift'>('gb')
  const gbCount = vouchers.filter(v => v.source !== 'kt_alpha').length
  const giftCount = vouchers.filter(v => v.source === 'kt_alpha').length
  const shownVouchers = giftCount > 0
    ? vouchers.filter(v => (sourceTab === 'gift' ? v.source === 'kt_alpha' : v.source !== 'kt_alpha'))
    : vouchers
  // 🎨 2026-06-20 흑백 리디자인 화면1: 사용가능 카드 + (사용완료 / 만료·환불) 헤어라인 박스
  // 🎨 2026-06-21 (개선 #1): 만료 임박순 정렬 — API 는 created_at DESC 만 → 히어로 'D-N'과 목록 최상단 불일치.
  //   곧 사라질 식사권이 위로 오도록 만료 가까운 순(만료일 없는 건 뒤로). filter 가 새 배열이라 원본 불변.
  const unusedItems = shownVouchers.filter(v => v.status === 'unused')
    .sort((a, b) => {
      const ta = a.expires_at ? safeTime(a.expires_at) : Number.POSITIVE_INFINITY
      const tb = b.expires_at ? safeTime(b.expires_at) : Number.POSITIVE_INFINITY
      return ta - tb
    })
  const usedItems = shownVouchers.filter(v => v.status === 'used')
  const archivedItems = shownVouchers.filter(v => v.status === 'expired' || v.status === 'refunded')
  // 지도에 표시 가능한 미사용 식사권 (좌표 보유) — 메모이즈(지도 재초기화 방지)
  // 🐛 2026-06-21: 현재 탭(이용권/교환권) 스코프로 제한 — 교환권 탭에서 이용권 핀/지도버튼 새던 것 차단.
  const mapVouchers = useMemo(() => {
    const scoped = giftCount > 0
      ? vouchers.filter(v => (sourceTab === 'gift' ? v.source === 'kt_alpha' : v.source !== 'kt_alpha'))
      : vouchers
    return scoped.filter(v => v.status === 'unused' && v.restaurant_lat && v.restaurant_lng)
  }, [vouchers, sourceTab, giftCount])
  const handleMarkerClick = useCallback(
    (mv: { id: number | string }) => setMapSelected(vouchers.find(x => x.id === mv.id) ?? null),
    [vouchers],
  )

  // 가까운 만료일 (현재 탭 unused 식사권 중 가장 가까운)
  const nearestExpiry = (() => {
    const now = Date.now()
    const candidates = unusedItems
      .filter(v => v.expires_at)
      .map(v => safeTime(v.expires_at!))
      .filter(t => t > now)
      .sort((a, b) => a - b)
    if (!candidates[0]) return null
    const days = Math.max(0, Math.ceil((candidates[0] - now) / (1000 * 60 * 60 * 24)))
    return days
  })()

  // 🎨 2026-06-21 (대표 "페이지가 투박 — UX/UI 재설계", 시안 A '프리미엄 패스'):
  //   지갑 = 자산. 상단 '보유 식사권 금액' 히어로 — 보유 금액(사용 가능분 합) + 아낀 돈.
  // 🐛 2026-06-21 fix: /vouchers/my 는 product_price 를 안 줘서 (원가-액면)=항상 0 → '아낀 돈' 영구 미표시였음.
  //   applied_price 는 '결제한(할인된) 단가', applied_discount_pct 는 할인율 → 원가 대비 절약 = 액면 * pct/(100-pct).
  const heroTotal = unusedItems.reduce((s, v) => s + (v.applied_price ?? v.product_price ?? 0), 0)
  const heroSaved = unusedItems.reduce((s, v) => {
    const pct = v.applied_discount_pct ?? 0
    const paid = v.applied_price ?? 0
    return (pct > 0 && pct < 100 && paid > 0) ? s + Math.round((paid * pct) / (100 - pct)) : s
  }, 0)
  // 🪙 2026-06-23 (대표 신고 "교환권은 1800딜로 떠야"): 교환권(kt_alpha)은 딜로만 결제 → 단위 '딜'
  //   (식사권 face value 는 '원' 유지 — utils/format.ts formatProductPrice 의 deal_only 규칙과 동일).
  //   히어로는 탭별(unusedItems=shownVouchers) 동질 집합이라 sourceTab 으로 단위 판정.
  const heroIsDeal = sourceTab === 'gift'
  const heroUnit = heroIsDeal ? t('voucher.deal', { defaultValue: '딜' }) : t('voucher.won', { defaultValue: '원' })

  // 🎨 화면2 — 지도에서 보기 (전용 인-페이지 화면)
  if (viewMode === 'map') {
    // 거리순 정렬 캐러셀 (위치 없으면 원본 순). 기본 강조 = 가장 가까운(없으면 첫) 식사권.
    const dist = (v: Voucher) => (userLoc && v.restaurant_lat && v.restaurant_lng)
      ? haversineMeters(userLoc, { lat: v.restaurant_lat, lng: v.restaurant_lng }) : Infinity
    const mapCarousel = userLoc ? [...mapVouchers].sort((a, b) => dist(a) - dist(b)) : mapVouchers
    const nearest = mapCarousel[0] ?? null
    const card = mapSelected ?? nearest
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
                onMarkerClick={handleMarkerClick}
                focus={mapSelected && mapSelected.restaurant_lat && mapSelected.restaurant_lng ? { lat: mapSelected.restaurant_lat, lng: mapSelected.restaurant_lng } : null}
              />
            </div>
          </Suspense>
          {/* 🎨 2026-06-21 (개선 #1): 주변 식사권 캐러셀 (거리순) — 1장 카드 → 가로 스크롤 비교. */}
          {mapVouchers.length > 0 && (
            <div className="absolute left-0 right-0 bottom-3 overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
              <div className="flex gap-3 px-3 snap-x snap-mandatory">
                {mapCarousel.map((v) => {
                  const d = (userLoc && v.restaurant_lat && v.restaurant_lng) ? haversineMeters(userLoc, { lat: v.restaurant_lat, lng: v.restaurant_lng }) : null
                  const selected = card?.id === v.id
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setMapSelected(v)}
                      className={`snap-start shrink-0 w-[80%] max-w-[300px] flex items-center gap-3 rounded-2xl bg-white dark:bg-[#141414] border p-3 text-left transition-colors ${selected ? 'border-gray-900 dark:border-white' : 'border-gray-200 dark:border-[#2A2A2A]'}`}
                      style={{ boxShadow: '0 8px 28px rgba(10,10,10,0.18)' }}
                    >
                      <div className="w-[52px] h-[52px] shrink-0 rounded-xl overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#F7F8FA] to-[#EFF1F4] dark:from-[#1A1A1A] dark:to-[#0F0F0F] ring-1 ring-gray-100 dark:ring-white/10">
                        {v.product_image
                          ? <img src={v.product_image} alt="" loading="lazy" className="w-full h-full object-cover" />
                          : <Ticket className="w-5 h-5 text-gray-300 dark:text-gray-600" strokeWidth={1.5} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-bold tracking-tight text-gray-900 dark:text-white truncate">{v.product_name}</p>
                        <p className="text-[12px] text-gray-400 dark:text-gray-500 truncate mt-0.5">
                          {v.restaurant_name || ''}
                          {d !== null && (
                            <>{v.restaurant_name ? ' · ' : ''}{formatDistance(d)} · {t('voucher.walkMin', { count: walkMinutes(d), defaultValue: `도보 ${walkMinutes(d)}분` })}</>
                          )}
                        </p>
                      </div>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); setQrVoucher(v) }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setQrVoucher(v) } }}
                        className="shrink-0 flex items-center gap-1.5 rounded-xl px-4 py-2.5 bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-[13px] font-bold active:scale-95 transition-transform"
                      >
                        <QrCode className="w-4 h-4" strokeWidth={1.8} />{t('voucher.use', { defaultValue: '사용' })}
                      </span>
                    </button>
                  )
                })}
              </div>
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

      {/* 🔁 2026-06-23 양방향 분쟁: 매장이 "안 왔어요" 신고한 이용권에 대한 손님 항변 배너(자가완결) */}
      <VoucherDisputeBanner />

      {/* 🎨 2026-06-21 시안 A '프리미엄 패스': 보유 금액 히어로 (지갑=자산 느낌). 사용 가능분 있을 때만.
          theme-dual: 잉크 히어로 카드 — 라이트/다크 모두 항상 어두운 카드(신용카드처럼). 내부 text-white/gray 의도적. */}
      {unusedItems.length > 0 && (
        <div className="ur-content-narrow px-4 lg:px-8 mb-4">
          <div className="rounded-[20px] px-[18px] pt-[18px] pb-4 bg-gray-900 dark:bg-[#141414] text-white"
            style={{ boxShadow: '0 14px 32px -10px rgba(10,10,10,0.45)' }}>
            <p className="text-[12px] font-semibold text-gray-400">{heroIsDeal ? t('voucher.heroBalanceLabelGift', { defaultValue: '보유 교환권 금액' }) : t('voucher.heroBalanceLabel', { defaultValue: '보유 식사권 금액' })}</p>
            <p className="mt-1 text-[32px] font-extrabold font-mono tracking-tight leading-none">
              {formatNumber(heroTotal)}<span className="font-sans text-[16px] font-bold text-gray-300 ml-0.5">{heroUnit}</span>
            </p>
            <div className="mt-3.5 pt-3 flex items-center gap-6 border-t border-white/10">
              <div>
                <p className="text-[11px] text-gray-400">{t('voucher.heroUsable', { defaultValue: '사용 가능' })}</p>
                <p className="mt-0.5 text-[15px] font-extrabold">{unusedItems.length}{t('voucher.heroCountUnit', { defaultValue: '장' })}</p>
              </div>
              {nearestExpiry !== null && (
                <div>
                  <p className="text-[11px] text-gray-400">{t('voucher.heroExpiry', { defaultValue: '만료 임박' })}</p>
                  <p className={`mt-0.5 text-[15px] font-extrabold font-mono ${nearestExpiry <= 2 ? 'text-[#FF6B6B]' : ''}`}>{nearestExpiry === 0 ? 'D-DAY' : `D-${nearestExpiry}`}</p>
                </div>
              )}
              {heroSaved > 0 && (
                <div>
                  <p className="text-[11px] text-gray-400">{t('voucher.heroSaved', { defaultValue: '아낀 돈' })}</p>
                  <p className="mt-0.5 text-[15px] font-extrabold font-mono text-[#34C759]">{formatNumber(heroSaved)}{heroUnit}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🎟️ 2026-06-18: 이용권/교환권 세그먼트 — 교환권(기프티콘) 보유 시에만. 기본 이용권.
          🎨 2026-06-20 (사용자 신고 — '성의없어'): 두 줄짜리 plain pill → iOS 세그먼트 컨트롤(트랙+슬라이드 강조). */}
      {giftCount > 0 && (
        <div className="ur-content-narrow px-4 lg:px-8 mb-4">
          <div className="flex p-1 rounded-2xl bg-gray-100 dark:bg-[#1A1A1A]">
            {([
              ['gb', '🎟️', t('voucher.tabGroupBuy', { defaultValue: '이용권' }), gbCount],
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

      <div className="ur-content-narrow px-4 lg:px-8 pb-2">
        {loading ? (
          <WalletSkeleton />
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
    <div className="fixed inset-0 z-[10600] flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={onClose} role="presentation">
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

// 🎨 2026-06-21 시안 A: 패스 풋 'QR 힌트' (장식 — 실제 QR 은 사용하기 모달). 잉크 finder 패턴 + 닷.
function MiniQrHint({ muted }: { muted?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={`w-10 h-10 shrink-0 ${muted ? 'text-gray-300 dark:text-gray-700' : 'text-gray-900 dark:text-white'}`} aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="7">
        <rect x="6" y="6" width="26" height="26" rx="4" />
        <rect x="68" y="6" width="26" height="26" rx="4" />
        <rect x="6" y="68" width="26" height="26" rx="4" />
      </g>
      <g fill="currentColor">
        <rect x="44" y="44" width="10" height="10" rx="1.5" />
        <rect x="62" y="44" width="10" height="10" rx="1.5" />
        <rect x="44" y="62" width="10" height="10" rx="1.5" />
        <rect x="80" y="62" width="10" height="10" rx="1.5" />
        <rect x="62" y="80" width="10" height="10" rx="1.5" />
      </g>
    </svg>
  )
}

/**
 * 🎨 2026-06-21 시안 A '프리미엄 패스' (대표 "페이지가 투박 — UX/UI 재설계" 승인):
 *   가로 리스트 행 → 토스/애플월렛식 세로 '패스'.
 *   헤더(썸네일+가게+D-N 배지) · 큰 제목 · 큰 금액 + 사용하기 · 천공(점선+양옆 노치) · 풋(QR 힌트+코드).
 */
function VoucherTicket({ v, muted, locale, t, onShowQr }: {
  v: Voucher
  muted: boolean
  locale: string
  t: (key: string, opts?: any) => string
  onShowQr: () => void
}) {
  const navigate = useNavigate()  // 🎨 2026-06-21 (개선 #4): 사용완료/만료 카드 '재구매' 딥링크
  const expiresAt = safeDate(v.expires_at)
  const usedAt = safeDate(v.used_at)
  const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null

  // 🛡️ 2026-05-25 (A 옵션): KT Alpha 쿠폰은 별도 카드 형식 (재발송 버튼 포함)
  if (v.source === 'kt_alpha') {
    return <KtAlphaVoucherCard v={v} muted={muted} t={t} />
  }

  // 🎨 2026-06-20 흑백 iOS-클린 (docs/design/my-vouchers-wallet-bw.md 화면1 카드):
  //   60px 썸네일 · 🟢 상태점+사용가능+D-N · 제목 · 📍가게 · 코드칩 / 우측: 가격 + 컴팩트 사용 pill.
  const urgent = v.status === 'unused' && daysLeft !== null && daysLeft <= 2
  const price = v.applied_price ?? v.product_price ?? null

  const notchStyle = { background: '#F2F2F7', border: '1px solid #ECECEF' } as const

  return (
    <div
      className="relative rounded-[18px] bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#1F1F1F]"
      style={{ opacity: muted ? 0.55 : 1, boxShadow: muted ? 'none' : '0 1px 2px rgba(10,10,10,0.05), 0 14px 30px -12px rgba(10,10,10,0.16)' }}
    >
      {/* 헤더: 썸네일 + 가게 + 상태 배지 */}
      <div className="flex items-center gap-2.5 px-4 pt-3.5">
        <div className="w-9 h-9 shrink-0 rounded-[10px] overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#F7F8FA] to-[#EFF1F4] dark:from-[#1A1A1A] dark:to-[#0F0F0F] ring-1 ring-gray-100 dark:ring-white/10">
          {v.product_image ? (
            <img src={v.product_image} alt="" loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <Ticket className="w-4 h-4 text-gray-300 dark:text-gray-600" strokeWidth={1.6} />
          )}
        </div>
        <span className="flex items-center gap-1 min-w-0 text-[12px] font-semibold text-gray-500 dark:text-gray-400">
          {v.restaurant_name
            ? (<><MapPin className="w-3 h-3 shrink-0" /><span className="truncate">{v.restaurant_name}</span></>)
            : (<span className="truncate">{t('voucher.tabGroupBuy', { defaultValue: '이용권' })}</span>)}
        </span>
        {v.status === 'unused' ? (
          daysLeft !== null ? (
            <span className={`ml-auto shrink-0 text-[11px] font-extrabold font-mono px-2.5 py-1 rounded-full ${urgent ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-300'}`}>
              {daysLeft === 0 ? 'D-DAY' : `D-${daysLeft}`}
            </span>
          ) : (
            <span className="ml-auto shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 dark:text-gray-400">
              <span className="w-[6px] h-[6px] rounded-full" style={{ background: '#16A34A', boxShadow: '0 0 0 3px rgba(22,163,74,0.12)' }} aria-hidden />
              {t('voucher.status.unused', { defaultValue: '사용 가능' })}
            </span>
          )
        ) : (
          <span className="ml-auto shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full"
            style={{ background: v.status === 'expired' ? 'rgba(220,38,38,0.10)' : 'rgba(0,0,0,0.06)', color: v.status === 'expired' ? '#DC2626' : '#6B7280' }}>
            {t(`voucher.status.${v.status}`)}
          </span>
        )}
      </div>

      {/* 제목 */}
      <p className="px-4 pt-2 text-[18px] font-extrabold tracking-tight text-gray-900 dark:text-white truncate">{v.product_name}</p>

      {/* 금액 + 사용하기 */}
      <div className="flex items-end justify-between px-4 pt-1.5 pb-4">
        {price !== null ? (
          <div className="text-[24px] font-extrabold font-mono tracking-tight text-gray-900 dark:text-white leading-none">
            {formatNumber(price)}<span className="font-sans text-[14px] font-bold text-gray-400 dark:text-gray-500 ml-0.5">{t('voucher.won', { defaultValue: '원' })}</span>
          </div>
        ) : <span />}
        {v.status === 'unused' ? (
          <button
            onClick={onShowQr}
            aria-label={t('voucher.scan', { defaultValue: '사용' })}
            className="flex items-center gap-1.5 rounded-[13px] px-5 py-2.5 bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-[13.5px] font-extrabold active:scale-95 transition-transform"
          >
            <QrCode className="w-4 h-4" strokeWidth={1.9} />
            {t('voucher.useFull', { defaultValue: '사용하기' })}
          </button>
        ) : (v.status === 'used' && usedAt) ? (
          <span className="text-[12px] font-medium text-gray-400 dark:text-gray-500">{usedAt.toLocaleDateString(locale)} {t('voucher.usedSuffix', { defaultValue: '사용' })}</span>
        ) : <span />}
      </div>

      {/* 천공 + 풋 — refunded 는 액션 없음(천공/풋 생략) */}
      {v.status !== 'refunded' && (
        <>
          {/* 천공 — 점선 + 양옆 노치 (실물 티켓 메타포) */}
          <div className="relative" aria-hidden>
            <div className="mx-3.5 border-t border-dashed border-gray-200 dark:border-[#2A2A2A]" />
            <span className="absolute top-0 -translate-y-1/2 left-0 -translate-x-1/2 w-3.5 h-3.5 rounded-full" style={notchStyle} />
            <span className="absolute top-0 -translate-y-1/2 right-0 translate-x-1/2 w-3.5 h-3.5 rounded-full" style={notchStyle} />
          </div>

          {v.status === 'unused' ? (
            /* 풋: QR 힌트 + 코드 (탭하면 복사) */
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                // 🐛 2026-06-21: 실제 복사 성공 시에만 토스트 (비보안 컨텍스트 등 미지원 시 거짓 '복사됨' 방지)
                const cb = navigator.clipboard
                if (!cb?.writeText) return
                cb.writeText(v.code).then(() => toast.success(t('voucher.copied', { defaultValue: '복사됨' }))).catch(() => { /* 권한 거부 */ })
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left active:opacity-70"
            >
              <MiniQrHint />
              <div className="min-w-0">
                <span className="flex items-center gap-1.5 font-mono text-[12px] font-bold tracking-wide text-gray-700 dark:text-gray-200">
                  <span className="truncate">{v.code}</span>
                  <Copy className="w-3 h-3 shrink-0 text-gray-400 dark:text-gray-500" strokeWidth={2} aria-hidden />
                </span>
                <span className="block text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{t('voucher.tapForQr', { defaultValue: '탭하면 코드 복사 · 사용하기로 QR 제시' })}</span>
              </div>
            </button>
          ) : (
            /* 🎨 2026-06-21 (개선 #4): 사용완료/만료 동선 — 재구매 + (사용완료만) 후기 보너스 */
            <div className="px-4 pt-3 pb-3.5">
              {v.product_id != null && (
                <button
                  type="button"
                  onClick={() => navigate(`/group-buy/${v.product_id}`)}
                  className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white text-[13px] font-bold active:scale-[0.98] transition-transform"
                >
                  {t('voucher.rebuy', { defaultValue: '다시 구매하기' })}
                </button>
              )}
              {v.status === 'used' && <ReviewBonusButton voucherCode={v.code} />}
            </div>
          )}
        </>
      )}
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

  // 🎨 2026-06-21 (대표 신고 "투박") — 식사권(VoucherTicket)과 동일한 클린 가로 레이아웃으로 통일.
  //   60px 썸네일(gift_catalog 이미지) · 상태 점 + 기프티쇼 칩 · 제목 · 발송/실패/바코드 안내 ·
  //   우측 가격 + 컴팩트 액션. PIN 모드만 하단에 인앱 바코드. 천공/큰 버튼/세로 패스 구조 제거.
  const price = v.applied_price ?? null

  return (
    <div
      className="relative rounded-2xl bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#1F1F1F] p-[13px]"
      style={{ opacity: muted ? 0.55 : 1, boxShadow: muted ? 'none' : '0 1px 3px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-stretch gap-3">
        {/* 썸네일 60px */}
        <div className="w-[60px] h-[60px] shrink-0 rounded-xl overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#F7F8FA] to-[#EFF1F4] dark:from-[#1A1A1A] dark:to-[#0F0F0F]">
          {v.product_image ? (
            <img src={v.product_image} alt={v.product_name} loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <Gift className="w-6 h-6 text-gray-300 dark:text-gray-600" strokeWidth={1.5} />
          )}
        </div>

        {/* 본문 */}
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          {/* 상태 줄 + 기프티쇼 칩 */}
          <div className="flex items-center gap-1.5">
            {sendFailed ? (
              <>
                <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: '#DC2626' }} aria-hidden />
                <span className="text-[12px] font-semibold text-red-600 dark:text-red-400">{t('voucher.sendFailedBadge', { defaultValue: '발송 실패' })}</span>
              </>
            ) : v.status === 'unused' ? (
              <>
                <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: '#16A34A' }} aria-hidden />
                <span className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">{t('voucher.status.unused', { defaultValue: '사용 가능' })}</span>
              </>
            ) : (
              <span className="text-[12px] font-semibold" style={{ color: v.status === 'expired' ? '#DC2626' : '#6B7280' }}>{t(`voucher.status.${v.status}`)}</span>
            )}
            <span className="ml-auto shrink-0 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-300">📱 기프티쇼</span>
          </div>

          {/* 제목 */}
          <p className="text-gray-900 dark:text-white font-bold text-[16px] leading-tight tracking-tight truncate">{v.product_name}</p>

          {/* 서브: 발송/실패/바코드 안내 */}
          {sendFailed ? (
            <p className="text-[12px] text-gray-400 dark:text-gray-500 leading-snug">{t('voucher.ktSendFailedShort', { defaultValue: '결제 완료 · 재발송은 고객센터로 문의' })}</p>
          ) : hasBarcode ? (
            <p className="text-[12px] text-gray-400 dark:text-gray-500 leading-snug">{t('voucher.ktShowBarcode', { defaultValue: '매장에서 아래 바코드를 제시하세요' })}</p>
          ) : maskedPhone ? (
            <p className="flex items-center gap-1 text-[12px] text-gray-400 dark:text-gray-500 min-w-0">
              <Smartphone className="w-3 h-3 shrink-0" strokeWidth={2} aria-hidden /><span className="truncate">{maskedPhone} {t('voucher.ktSentSuffix', { defaultValue: '문자 발송' })}</span>
            </p>
          ) : (
            <p className="text-[12px] text-gray-400 dark:text-gray-500 leading-snug">{t('voucher.ktCheckMmsShort', { defaultValue: '휴대폰 메시지함에서 확인' })}</p>
          )}
        </div>

        {/* 우측: 가격 + 액션 */}
        <div className="shrink-0 flex flex-col items-end justify-between">
          {price !== null ? (
            <div className="text-[15px] font-bold font-mono text-gray-900 dark:text-white whitespace-nowrap">
              {formatNumber(price)}<span className="font-sans text-[11px] font-semibold text-gray-400 dark:text-gray-500">{t('voucher.deal', { defaultValue: '딜' })}</span>
            </div>
          ) : <span />}
          {sendFailed ? (
            <a href="tel:0507-0177-0432" aria-label={t('voucher.contactSupport', { defaultValue: '고객센터 문의 (0507-0177-0432)' })}
              className="flex items-center gap-1 rounded-xl px-3 py-[9px] border border-gray-200 dark:border-[#2A2A2A] text-gray-700 dark:text-gray-200 text-[12px] font-bold active:scale-95 transition-transform whitespace-nowrap">
              {t('voucher.contactSupportShort', { defaultValue: '고객센터' })}
            </a>
          ) : (
            <div className="w-7 h-7 flex items-center justify-center opacity-60" aria-hidden>
              <Smartphone className="w-5 h-5 text-gray-300 dark:text-gray-600" strokeWidth={1.6} />
            </div>
          )}
        </div>
      </div>

      {/* PIN 모드 인앱 바코드 — 하단 (매장 제시용) */}
      {hasBarcode && (
        <div className="mt-3 px-3 py-3 rounded-xl bg-gray-50 dark:bg-[#0A0A0A] border border-gray-100 dark:border-[#1F1F1F] flex flex-col items-center gap-1.5">
          <Barcode value={v.kt_pin as string} />
          <span className="text-[12px] font-mono font-bold tracking-[0.15em] text-gray-900 dark:text-white">{v.kt_pin}</span>
        </div>
      )}
    </div>
  )
}
