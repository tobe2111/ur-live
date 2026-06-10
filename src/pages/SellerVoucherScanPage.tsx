/**
 * 🧭 2026-06-10 (오프라인 공구 현장 동선 — 갭①): 매장 계산대용 바우처 스캔 화면.
 *
 * 배경: 사용처리 API(PIN/use-by-seller/원자 CAS)는 견고한데 셀러 대시보드에 "스캔" 진입점이
 * 없어 안내 문구만 있었음. 점심 피크에 직원이 1탭으로 처리하는 화면이 오프라인 사업의 병목 해소.
 *
 * 동선: 카메라 자동 시작 → 손님 QR(https://…/v/<code>) 인식 → use-by-seller 1탭 사용처리
 *       → 결과 카드(메뉴명/매장) → 자동으로 다음 스캔 대기 (연속 처리). 카메라 불가 시 코드 직접 입력.
 * 스캔: SellerInventoryPage 와 동일한 네이티브 BarcodeDetector (외부 lib 0, 미지원 브라우저는 수동 입력).
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, XCircle, Camera, Keyboard, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader } from '@/components/dashboard'

type ScanResult = {
  ok: boolean
  code: string
  message: string
  productName?: string
  restaurantName?: string
  at: string
}

/** QR 값(https://…/v/<code>)·딥링크·raw 코드에서 바우처 코드 추출. */
function extractCode(raw: string): string | null {
  const v = (raw || '').trim()
  if (!v) return null
  const m = v.match(/\/v\/([A-Za-z0-9_-]{4,64})/)
  if (m) return m[1]
  if (/^[A-Za-z0-9_-]{4,64}$/.test(v)) return v
  return null
}

export default function SellerVoucherScanPage() {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanningRef = useRef(false)
  const lastCodeRef = useRef<{ code: string; at: number } | null>(null)
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [manualCode, setManualCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<ScanResult[]>([])
  const hasDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window

  const useVoucher = useCallback(async (code: string) => {
    // 같은 코드 5초 내 재인식(카메라가 같은 QR 계속 봄) 무시 — 이중 호출 방지(서버도 CAS 로 안전).
    const last = lastCodeRef.current
    if (last && last.code === code && Date.now() - last.at < 5000) return
    lastCodeRef.current = { code, at: Date.now() }
    setBusy(true)
    try {
      const token = localStorage.getItem('seller_token')
      const res = await api.post(`/api/group-buy/${encodeURIComponent(code)}/use-by-seller`, {}, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const d = res.data || {}
      setResults((prev) => [{
        ok: !!d.success,
        code,
        message: d.success
          ? t('seller.scan.usedOk', { defaultValue: '사용 처리 완료' })
          : (d.error || t('seller.scan.usedFail', { defaultValue: '사용 처리 실패' })),
        productName: d.data?.product_name || d.product_name,
        restaurantName: d.data?.restaurant_name || d.restaurant_name,
        at: new Date().toLocaleTimeString('ko-KR'),
      }, ...prev].slice(0, 20))
      if (navigator.vibrate) navigator.vibrate(d.success ? 80 : [60, 60, 60])
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setResults((prev) => [{
        ok: false,
        code,
        message: e.response?.data?.error || t('seller.scan.networkError', { defaultValue: '네트워크 오류 — 다시 시도해주세요' }),
        at: new Date().toLocaleTimeString('ko-KR'),
      }, ...prev].slice(0, 20))
      if (navigator.vibrate) navigator.vibrate([60, 60, 60])
    } finally {
      setBusy(false)
    }
  }, [t])

  // 카메라 + BarcodeDetector 루프 (SellerInventoryPage 패턴)
  const startCamera = useCallback(async () => {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraOn(true)
      if (!hasDetector) return
      const detector = new (window as unknown as {
        BarcodeDetector: new (opts: { formats: string[] }) => { detect: (s: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> }
      }).BarcodeDetector({ formats: ['qr_code'] })
      scanningRef.current = true
      const tick = async () => {
        if (!scanningRef.current || !videoRef.current) return
        try {
          const found = await detector.detect(videoRef.current)
          const code = found.length ? extractCode(found[0].rawValue) : null
          if (code) await useVoucher(code)
        } catch { /* 프레임 미준비 등 — 다음 tick */ }
        if (scanningRef.current) setTimeout(tick, 350)
      }
      void tick()
    } catch {
      setCameraError(t('seller.scan.cameraError', { defaultValue: '카메라를 열 수 없어요. 아래에 코드를 직접 입력해주세요.' }))
      setCameraOn(false)
    }
  }, [hasDetector, t, useVoucher])

  useEffect(() => {
    void startCamera()
    return () => {
      scanningRef.current = false
      streamRef.current?.getTracks().forEach((tr) => tr.stop())
    }
  }, [startCamera])

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault()
    const code = extractCode(manualCode)
    if (!code) return
    setManualCode('')
    void useVoucher(code)
  }

  const latest = results[0]

  return (
    <SellerLayout title={t('seller.scan.title', { defaultValue: '바우처 스캔' })}>
      <div className="mx-auto max-w-xl space-y-4 p-4 sm:p-6">
        <DashboardPageHeader
          icon={<Camera className="w-5 h-5" />}
          title={t('seller.scan.title', { defaultValue: '바우처 스캔' })}
          subtitle={t('seller.scan.subtitle', { defaultValue: '손님 QR을 비추면 자동으로 사용 처리돼요 (연속 스캔 가능)' })}
        />

        {/* 카메라 뷰 */}
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3]">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          {!cameraOn && !cameraError && (
            <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('seller.scan.cameraStarting', { defaultValue: '카메라 시작 중…' })}
            </div>
          )}
          {cameraOn && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-52 h-52 rounded-2xl border-2 border-white/80" />
            </div>
          )}
          {busy && (
            <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-center text-sm py-2">
              <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />{t('seller.scan.processing', { defaultValue: '사용 처리 중…' })}
            </div>
          )}
        </div>
        {cameraError && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{cameraError}</p>}
        {!hasDetector && cameraOn && (
          <p className="text-xs text-gray-500">{t('seller.scan.noDetector', { defaultValue: '이 브라우저는 자동 인식을 지원하지 않아요 — 아래에 코드를 직접 입력해주세요.' })}</p>
        )}

        {/* 수동 입력 (카메라 불가/QR 손상 대비) */}
        <form onSubmit={submitManual} className="flex gap-2">
          <div className="relative flex-1">
            <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder={t('seller.scan.manualPlaceholder', { defaultValue: '바우처 코드 직접 입력' })}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-pink-400/40"
            />
          </div>
          <button type="submit" disabled={busy || !extractCode(manualCode)}
            className="px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold disabled:opacity-40">
            {t('seller.scan.useBtn', { defaultValue: '사용 처리' })}
          </button>
        </form>

        {/* 최근 결과 — 최신 1건 크게 + 이번 세션 이력 */}
        {latest && (
          <div className={`rounded-2xl border p-4 ${latest.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-2.5">
              {latest.ok
                ? <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0" />
                : <XCircle className="w-7 h-7 text-red-500 shrink-0" />}
              <div className="min-w-0">
                <p className={`text-[15px] font-extrabold ${latest.ok ? 'text-emerald-900' : 'text-red-700'}`}>{latest.message}</p>
                <p className="text-xs text-gray-600 mt-0.5 truncate">
                  {latest.productName || latest.code}{latest.restaurantName ? ` · ${latest.restaurantName}` : ''} · {latest.at}
                </p>
              </div>
            </div>
          </div>
        )}
        {results.length > 1 && (
          <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100">
            {results.slice(1).map((r, i) => (
              <div key={`${r.code}-${i}`} className="flex items-center gap-2 px-3 py-2 text-xs">
                {r.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                <span className="flex-1 truncate text-gray-700">{r.productName || r.code} — {r.message}</span>
                <span className="text-gray-400 shrink-0">{r.at}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </SellerLayout>
  )
}
