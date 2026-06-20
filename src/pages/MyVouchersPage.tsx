import { lazy, Suspense, useState, useEffect, useRef, Fragment } from 'react'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { useNavigate } from 'react-router-dom'

// 🛡️ 2026-05-27 (loading P1): VoucherMap (Kakao Maps SDK ~150KB) 별도 chunk lazy.
//   사용자가 '지도 보기' 토글 시만 로드 → 초기 paint 영향 0.
const VoucherMap = lazy(() => import('./my-vouchers/VoucherMap'))
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import { ArrowLeft, Ticket, MapPin, CheckCircle, XCircle, QrCode, X, Share2, Smartphone, ChevronRight, Copy } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import api from '@/lib/api'
import { useMyVouchers, useInvalidateMyVouchers } from '@/hooks/queries'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { LargeTitle, WalletPageWrapper } from '@/components/wallet/WalletAtoms'
import { walletTokens } from '@/components/wallet/walletTokens'
import { formatNumber } from '@/utils/format'
import { formatPhone } from '@/utils/format-phone'

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
  // 🛡️ 2026-05-15: 참여 후 share prompt — GroupBuyDetailPage.handleJoin 이 localStorage 기록
  const [justJoined, setJustJoined] = useState<{ product_id: number; name: string; image_url?: string } | null>(null)
  // 🛡️ 2026-05-24: phone 미등록 사용자 안내 배너 (한 번 dismiss 하면 7일 숨김).
  const [showPhoneBanner, setShowPhoneBanner] = useState(false)
  // 🛠️ 2026-06-17 (사용자 신고 — '등록하러 가기' 가 마이페이지로만 이동): 인라인 등록 모달.
  const [showPhoneModal, setShowPhoneModal] = useState(false)
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
  const groups = [
    { key: 'unused',   label: t('voucher.groupUnused'),   items: shownVouchers.filter(v => v.status === 'unused') },
    { key: 'used',     label: t('voucher.groupUsed'),     items: shownVouchers.filter(v => v.status === 'used') },
    { key: 'expired',  label: t('voucher.groupExpired'),  items: shownVouchers.filter(v => v.status === 'expired') },
    { key: 'refunded', label: t('voucher.groupRefunded'), items: shownVouchers.filter(v => v.status === 'refunded') },
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
          <div className="bg-gray-50 dark:bg-[#141414] border border-gray-100 dark:border-[#1F1F1F] rounded-2xl p-3.5 flex items-start gap-3">
            <Smartphone className="w-5 h-5 mt-0.5 shrink-0 text-gray-900 dark:text-white" strokeWidth={1.8} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-white">전화번호를 등록하세요</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                교환권(기프티콘)을 문자(MMS)로 자동 발송해 드려요.
              </p>
              <div className="mt-2.5 flex items-center gap-3">
                <button onClick={() => setShowPhoneModal(true)}
                  className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold rounded-xl active:scale-95 transition-transform">
                  등록
                </button>
                <button onClick={dismissPhoneBanner}
                  className="text-gray-400 dark:text-gray-500 text-xs font-medium">
                  나중에
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  <span className={`text-[11px] font-extrabold ${active ? 'text-gray-400 dark:text-gray-500' : 'text-gray-400 dark:text-gray-600'}`}>{count}</span>
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
            <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: '#16A34A' }} aria-hidden />
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

      {/* 🛡️ 2026-05-15: 리스트 / 지도 토글 */}
      {!loading && vouchers.filter(v => v.status === 'unused' && v.restaurant_lat && v.restaurant_lng).length > 0 && (
        <div className="ur-content-narrow px-4 lg:px-8 mb-3 flex gap-1.5">
          <button
            onClick={() => setViewMode('list')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${viewMode === 'list' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-300'}`}
          >
            📋 리스트
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${viewMode === 'map' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-300'}`}
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
        ) : shownVouchers.length === 0 ? (
          <EmptyVouchers
            mode={giftCount > 0 && sourceTab === 'gift' ? 'gift' : 'gb'}
            onExplore={() => navigate(giftCount > 0 && sourceTab === 'gift' ? '/vouchers' : '/group-buy')}
            t={t}
          />
        ) : (
          <>
            {groups.map(group => {
              // 🏁 2026-06-12 (감사 🟢 — 만료분 영구 누적): 만료/환불 그룹은 기본 접힘 (탭하면 펼침).
              const collapsible = group.key === 'expired' || group.key === 'refunded'
              const collapsed = collapsible && !expandedGroups.has(group.key)
              return (
              <div key={group.key} className="mb-6">
                <button
                  type="button"
                  disabled={!collapsible}
                  onClick={() => collapsible && setExpandedGroups(prev => {
                    const n = new Set(prev); if (n.has(group.key)) n.delete(group.key); else n.add(group.key); return n
                  })}
                  className="w-full text-left px-1 mb-2 uppercase flex items-center justify-between"
                  style={{ fontSize: 11, color: tk.secondary, fontWeight: 700, letterSpacing: '0.06em' }}>
                  <span>{group.label} <span style={{ color: tk.tertiary }}>· {group.items.length}</span></span>
                  {collapsible && <span style={{ color: tk.tertiary }}>{collapsed ? '펼치기 ▾' : '접기 ▴'}</span>}
                </button>
                {!collapsed && (
                <div className="space-y-3">
                  {group.items.map(v => {
                    const muted = v.status !== 'unused'
                    return <VoucherTicket key={v.id} v={v} muted={muted} locale={locale} t={t} onShowQr={() => setQrVoucher(v)} />
                  })}
                </div>
                )}
              </div>
            )})}
          </>
        )}
      </div>

      {/* QR Code Modal */}
      {qrVoucher && <QRModal voucher={qrVoucher} onClose={() => setQrVoucher(null)} />}

      {/* 🛠️ 2026-06-17: 전화번호 인라인 등록 (마이페이지 이동 X) */}
      {showPhoneModal && (
        <PhoneRegisterModal
          onClose={() => setShowPhoneModal(false)}
          onSaved={() => { setShowPhoneModal(false); setShowPhoneBanner(false) }}
        />
      )}

      {/* 🛡️ 2026-05-15: 참여 직후 share prompt (3 AI 합의: post-purchase share boost) */}
      {justJoined && <PostJoinShareModal data={justJoined} onClose={() => setJustJoined(null)} />}
    </WalletPageWrapper>
  )
}

/**
 * 🎨 2026-06-20 흑백 iOS-클린 리디자인 (docs/design/my-vouchers-wallet-bw.md 화면5):
 *   기존(핑크 그라데이션 일러스트 + CTA + 카드형 3스텝) → 잉크 톤 통일.
 *   뉴트럴 라운드 일러스트 + 1·2·3 원형 잉크 번호(셰브론) + 블랙 필 CTA.
 *   화이트 테마(다크 토글 지원) — 모든 라이트 토큰에 dark: variant 동반.
 */
function EmptyVouchers({ mode, onExplore, t }: {
  mode: 'gb' | 'gift'
  onExplore: () => void
  t: (key: string, opts?: any) => string
}) {
  const isGift = mode === 'gift'
  const Icon = isGift ? Smartphone : Ticket
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
      {/* 일러스트 — 뉴트럴 라운드 + 잉크 아이콘 (흑백 톤) */}
      <div className="w-[112px] h-[112px] rounded-[28px] flex items-center justify-center mb-6 bg-gray-50 dark:bg-[#141414] border border-gray-100 dark:border-[#1F1F1F]">
        <Icon className="w-12 h-12 text-gray-900 dark:text-white" strokeWidth={1.3} />
      </div>

      <h2 className="text-[19px] font-extrabold tracking-tight text-gray-900 dark:text-white">{title}</h2>
      <p className="mt-2 max-w-[260px] text-[13.5px] leading-relaxed text-gray-500 dark:text-gray-400 whitespace-pre-line">{desc}</p>

      {/* 사용 흐름 1·2·3 — 잉크 원형 번호 + 셰브론 */}
      <div className="mt-9 w-full max-w-[300px] flex items-start justify-between">
        {steps.map((label, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <ChevronRight className="w-4 h-4 mt-2 shrink-0 text-gray-300 dark:text-gray-600" strokeWidth={2.2} aria-hidden />
            )}
            <div className="flex-1 flex flex-col items-center gap-2">
              <div className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[13px] font-bold font-mono bg-gray-900 dark:bg-white text-white dark:text-gray-900">{i + 1}</div>
              <span className="text-[11px] font-medium leading-tight text-gray-600 dark:text-gray-300 whitespace-pre-line">{label}</span>
            </div>
          </Fragment>
        ))}
      </div>

      <button
        onClick={onExplore}
        className="mt-9 w-full max-w-[300px] py-3.5 rounded-2xl text-[15px] font-extrabold bg-gray-900 dark:bg-white text-white dark:text-gray-900 active:scale-[0.98] transition-transform"
      >
        {cta}
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
 * 🛠️ 2026-06-17 (사용자 신고): '등록하러 가기' 가 마이페이지로만 이동하던 것 → 인라인 전화번호 등록 모달.
 *   저장은 PATCH /api/auth/profile (VoucherDetailPage 와 동일 검증된 엔드포인트 — phone 정상 저장됨).
 *   개인정보보호법: 수집·이용 동의 체크박스 필수.
 */
function PhoneRegisterModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [saving, setSaving] = useState(false)
  useEscapeKey(onClose)

  async function save() {
    if (!consent) { toast.error('개인정보 수집·이용 동의 후 진행 가능합니다'); return }
    const clean = phone.replace(/[-\s]/g, '')
    if (!/^01\d{8,9}$/.test(clean)) { toast.error('010 으로 시작하는 휴대폰 번호를 입력하세요'); return }
    setSaving(true)
    try {
      const res = await api.patch('/api/auth/profile', { phone: clean })
      if (res.data?.success) { toast.success('전화번호 저장 완료'); onSaved() }
      else toast.error(res.data?.error || '전화번호 저장 실패')
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || '전화번호 저장 실패')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[10100] bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={onClose} role="presentation">
      <div className="bg-white dark:bg-[#0A0A0A] rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-5 animate-slideUp" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-extrabold text-gray-900 dark:text-white">📱 휴대폰 번호 등록</h3>
          <button onClick={onClose} aria-label="닫기" className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
          기프티쇼 교환권은 휴대폰 MMS 로 발송됩니다.<br />등록하면 다음 교환권부터 자동 발송돼요.
        </p>
        <input
          type="tel" inputMode="numeric" maxLength={13}
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          onKeyDown={(e) => { if (e.key === 'Enter') save() }}
          placeholder="010-1234-5678"
          className="w-full px-3 py-2.5 border border-gray-300 dark:border-[#2A2A2A] dark:bg-[#141414] rounded-xl text-base text-gray-900 dark:text-white mb-3"
          autoFocus
        />
        <label className="flex items-start gap-2 mb-4 cursor-pointer">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 w-4 h-4 accent-gray-900 dark:accent-white" />
          <span className="text-[11px] text-gray-700 dark:text-gray-200 leading-relaxed">
            <b>휴대폰 번호 수집·이용에 동의</b>합니다 (필수)
            <br />
            <span className="text-gray-500 dark:text-gray-400">· 이용 목적: 교환권 MMS / 알림톡 발송 · 보유 기간: 회원 탈퇴 시까지</span>
          </span>
        </label>
        <button
          onClick={save}
          disabled={!phone || !consent || saving}
          className="w-full py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl text-sm font-extrabold disabled:opacity-40 active:scale-[0.99] transition-transform"
        >
          {saving ? '저장 중…' : '이 번호로 등록'}
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

  // 🎨 2026-06-17 (사용자 신고 — UI 별로): 텍스트-only 절취선 티켓 + 영문 휴리스틱 라벨 폐기.
  //   → 음식 사진(식사권 핵심) 노출 + 클린 카드 톤(교환권 상세/목록과 정합).
  const urgent = v.status === 'unused' && daysLeft !== null && daysLeft <= 3
  const statusBadge = v.status !== 'unused' ? (
    <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wide"
      style={{
        background: v.status === 'used' ? 'rgba(0,0,0,0.06)' : v.status === 'expired' ? 'rgba(239,68,68,0.10)' : 'rgba(245,158,11,0.12)',
        color: v.status === 'used' ? '#6B7280' : v.status === 'expired' ? '#DC2626' : '#D97706',
      }}>
      {t(`voucher.status.${v.status}`)}
    </span>
  ) : null

  return (
    <div
      className="relative flex items-stretch gap-3 rounded-2xl bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#1F1F1F] p-3"
      style={{ opacity: muted ? 0.55 : 1, boxShadow: muted ? 'none' : '0 1px 3px rgba(0,0,0,0.04)' }}
    >
      {/* 🎨 음식 사진 — 기존 식사권 카드엔 사진이 없어 밋밋했음(상세/목록 톤과 정합). */}
      <div className="w-[84px] h-[84px] shrink-0 rounded-xl overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#F7F8FA] to-[#EFF1F4] dark:from-[#1A1A1A] dark:to-[#0F0F0F]">
        {v.product_image ? (
          <img src={v.product_image} alt={v.product_name} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <Ticket className="w-7 h-7 text-gray-300 dark:text-gray-600" strokeWidth={1.5} />
        )}
      </div>

      {/* 본문 */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-start gap-2">
          <p className="flex-1 line-clamp-2 text-gray-900 dark:text-white font-bold text-[14px] leading-snug tracking-tight">
            {v.product_name}
          </p>
          {statusBadge}
        </div>
        {v.restaurant_name && (
          <p className="flex items-center gap-1 mt-1 text-[11.5px] text-gray-500 dark:text-gray-400">
            <MapPin className="w-3 h-3 shrink-0" /><span className="truncate">{v.restaurant_name}</span>
          </p>
        )}
        <div className="mt-auto pt-2 flex items-center gap-2 flex-wrap">
          <code
            onClick={(e) => {
              e.stopPropagation()
              if (v.status !== 'unused') return
              navigator.clipboard?.writeText(v.code)
              toast.success(t('voucher.copied', { defaultValue: '복사됨' }))
            }}
            className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold tracking-wide text-gray-500 dark:text-gray-300 bg-gray-100 dark:bg-white/10 rounded-md px-2 py-0.5 ${v.status === 'unused' ? 'cursor-pointer active:opacity-70' : ''}`}
          >
            {v.code}
            {v.status === 'unused' && <Copy className="w-3 h-3 text-gray-400 dark:text-gray-500" strokeWidth={2} aria-hidden />}
          </code>
          {v.status === 'unused' && daysLeft !== null && (
            <span className={`text-[11px] font-extrabold rounded-md px-1.5 py-0.5 ${urgent ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-300'}`}>
              {daysLeft === 0 ? 'D-DAY' : `D-${daysLeft}`}
            </span>
          )}
          {v.status === 'used' && usedAt && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              {t('voucher.usedAt')} · {usedAt.toLocaleDateString(locale)}
            </span>
          )}
        </div>
      </div>

      {/* 액션 — 사용 가능 시 QR/사용, 그 외 상태 아이콘 */}
      {v.status === 'unused' ? (
        <button
          onClick={onShowQr}
          aria-label={t('voucher.scan')}
          className="shrink-0 self-center flex flex-col items-center justify-center gap-1 w-[62px] h-[70px] rounded-xl bg-gray-900 text-white dark:bg-white dark:text-gray-900 active:scale-95 transition-transform"
        >
          <QrCode className="w-6 h-6" strokeWidth={1.6} />
          <span className="text-[10px] font-extrabold">{t('voucher.use', { defaultValue: '사용' })}</span>
        </button>
      ) : (
        <div className="shrink-0 self-center w-[62px] flex items-center justify-center opacity-50">
          <Ticket className="w-6 h-6 text-gray-300 dark:text-gray-600" strokeWidth={1.5} />
        </div>
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

  // 🎨 2026-06-20 흑백 리디자인: 식사권과 동일한 클린 화이트 카드 + 84px 썸네일 + 잉크 타이포.
  //   기프티쇼 정체성은 작은 뉴트럴(회색) 칩으로만 구분 (이전 amber → 잉크 통일).
  const statusBadge = v.status !== 'unused' ? (
    <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wide"
      style={{
        background: v.status === 'used' ? 'rgba(0,0,0,0.06)' : v.status === 'expired' ? 'rgba(239,68,68,0.10)' : 'rgba(245,158,11,0.12)',
        color: v.status === 'used' ? '#6B7280' : v.status === 'expired' ? '#DC2626' : '#D97706',
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
