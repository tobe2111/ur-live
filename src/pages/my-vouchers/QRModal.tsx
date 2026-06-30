// 🧱 2026-06-29 TD: MyVouchersPage god 파일 분해 — 이용권 사용(QR/PIN) 모달(verbatim 추출). 동작 불변.
//   QRCodeSVG(lazy)·VoucherQRCode 는 모듈 내부 전용, QRModal 만 페이지가 사용.
import { lazy, Suspense, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import VoucherRedeemModal from '@/components/voucher/VoucherRedeemModal'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useInvalidateMyVouchers } from '@/hooks/queries'
import { safeDate } from '@/utils/safe-date'
import { CheckCircle, MapPin, Share2, X, XCircle } from 'lucide-react'
import type { Voucher } from './types'
import ReviewBonusButton from './ReviewBonusButton'

// 🛡️ 2026-05-16: 외부 QR API (api.qrserver.com) 의존 제거 → qrcode.react 로컬 SVG.
// 🛡️ 2026-06-01 (loading): qrcode.react 는 QR 모달 열 때만 필요 → lazy (페이지 chunk -10KB).
//   장점: 외부 서비스 다운에 영향 X, latency 0, 오프라인에서도 렌더, 프라이버시.
const QRCodeSVG = lazy(() => import('qrcode.react').then(m => ({ default: m.QRCodeSVG })))

// 🛡️ 2026-05-16: 카카오맵 후기 보너스 제출 버튼 (used voucher 에 노출)
//   URL 또는 스크린샷 둘 중 하나 제출 → 백엔드가 OCR / 어드민 검증

function VoucherQRCode({ value, size = 160 }: { value: string; size?: number }) {
  return (
    <div className="mx-auto bg-white dark:bg-[#0A0A0A] p-2 rounded">
      <Suspense fallback={<div style={{ width: size, height: size }} className="animate-pulse bg-gray-100 dark:bg-[#1A1A1A] rounded" />}>
        <QRCodeSVG value={value} size={size} level="M" includeMargin={false} />
      </Suspense>
    </div>
  )
}

export default function QRModal({ voucher: initialVoucher, onClose }: { voucher: Voucher; onClose: () => void }) {
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
              <p className="text-[13px] font-bold text-gray-900 dark:text-white">{t('voucher.alreadyPaidTitle', { defaultValue: '이미 결제 완료된 이용권이에요' })}</p>
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

