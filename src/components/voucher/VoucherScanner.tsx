/**
 * 🎟️ 2026-07-06 (대표 — 계산대 스캔을 메인에서, 셀러 대시보드 안 거치고): 매장 계산대용
 *   바우처 스캔 코어. SellerVoucherScanPage(대시보드)와 StoreScanPage(독립 풀스크린 POS)가 공유.
 *
 * 스캔 엔진 2종(additive dual-mode — 기존 Android 동작 불변):
 *   · 기본: 네이티브 BarcodeDetector (Android/데스크톱 Chrome — 외부 lib 0, 가장 가벼움).
 *   · 폴백: BarcodeDetector 미지원(iOS Safari/WebKit — 아이폰 전부) 시 qr-scanner(순수 JS/wasm)로
 *          진짜 카메라 스캔. 둘 다 실패 시 코드 직접 입력.
 * 사용처리: use-by-seller(원자 CAS) — 서버가 이중사용/타매장 차단. 같은 코드 5초 dedup.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, XCircle, Keyboard, Loader2 } from 'lucide-react'
import api from '@/lib/api'

type ScanResult = {
  ok: boolean
  code: string
  message: string
  productName?: string
  restaurantName?: string
  at: string
}

/** QR 값(https://…/v/<code>)·딥링크·raw 코드에서 바우처 코드 추출. */
export function extractCode(raw: string): string | null {
  const v = (raw || '').trim()
  if (!v) return null
  const m = v.match(/\/v\/([A-Za-z0-9_-]{4,64})/)
  if (m) return m[1]
  if (/^[A-Za-z0-9_-]{4,64}$/.test(v)) return v
  return null
}

export default function VoucherScanner() {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanningRef = useRef(false)
  // qr-scanner 인스턴스(iOS 폴백) — start/stop/destroy 만 사용.
  const qrScannerRef = useRef<{ start: () => Promise<void>; stop: () => void; destroy: () => void } | null>(null)
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
      // 📟 2026-07-20: 직원 폰/공기계 = 스캔 전용 기기 키(X-Scan-Device-Key) — seller 토큰 없을 때만
      const deviceKey = !token ? localStorage.getItem('scan_device_key') : null
      const res = await api.post(`/api/group-buy/${encodeURIComponent(code)}/use-by-seller`, {}, {
        headers: token ? { Authorization: `Bearer ${token}` } : (deviceKey ? { 'X-Scan-Device-Key': deviceKey } : {}),
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

  const startCamera = useCallback(async () => {
    setCameraError(null)
    // 🟢 기본 경로: 네이티브 BarcodeDetector (Android/Chrome) — 기존 로직 그대로.
    if (hasDetector) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setCameraOn(true)
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
      return
    }
    // 🍎 폴백 경로: iOS(BarcodeDetector 미지원) — qr-scanner 가 카메라+디코딩 자체 관리.
    try {
      const QrScanner = (await import('qr-scanner')).default
      if (!videoRef.current) return
      const scanner = new QrScanner(
        videoRef.current,
        (res: { data: string }) => {
          const code = extractCode(res.data)
          if (code) void useVoucher(code)
        },
        { preferredCamera: 'environment', highlightScanRegion: false, maxScansPerSecond: 5 },
      )
      qrScannerRef.current = scanner
      await scanner.start()
      setCameraOn(true)
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
      try { qrScannerRef.current?.stop() } catch { /* ignore */ }
      try { qrScannerRef.current?.destroy() } catch { /* ignore */ }
    }
  }, [startCamera])

  // 🔆 2026-07-06: 계산대 화면 꺼짐/디밍 방지 — Screen Wake Lock(웹 표준, iOS 16.4+/안드).
  //   연속 스캔 중 화면이 잠기면 손님 대기가 끊김. fail-soft(미지원/거부 시 무시). QRModal 과 동일 패턴.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    let released = false
    const wl = (typeof navigator !== 'undefined' ? (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock : undefined)
    const request = async () => { try { if (wl && !released) lock = await wl.request('screen') } catch { /* unsupported/denied */ } }
    void request()
    const onVis = () => { if (typeof document !== 'undefined' && document.visibilityState === 'visible') void request() }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis)
    return () => {
      released = true
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis)
      try { lock?.release() } catch { /* ignore */ }
    }
  }, [])

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault()
    const code = extractCode(manualCode)
    if (!code) return
    setManualCode('')
    void useVoucher(code)
  }

  const latest = results[0]

  return (
    <div className="space-y-4">
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

      {/* 수동 입력 (카메라 불가/QR 손상 대비) */}
      <form onSubmit={submitManual} className="flex gap-2">
        <div className="relative flex-1">
          <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder={t('seller.scan.manualPlaceholder', { defaultValue: '바우처 코드 직접 입력' })}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-[#2C2F35] text-sm text-gray-900 dark:text-white bg-white dark:bg-[#1D1F29] focus:outline-none focus:ring-2 focus:ring-gray-400/40"
          />
        </div>
        <button type="submit" disabled={busy || !extractCode(manualCode)}
          className="px-4 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-bold disabled:opacity-40">
          {t('seller.scan.useBtn', { defaultValue: '사용 처리' })}
        </button>
      </form>

      {/* 최근 결과 — 최신 1건 크게 + 이번 세션 이력 */}
      {latest && (
        <div className={`rounded-2xl border p-4 ${latest.ok ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30' : 'bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/30'}`}>
          <div className="flex items-center gap-2.5">
            {latest.ok
              ? <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0" />
              : <XCircle className="w-7 h-7 text-red-500 shrink-0" />}
            <div className="min-w-0">
              <p className={`text-[15px] font-extrabold ${latest.ok ? 'text-emerald-900 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>{latest.message}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 truncate">
                {latest.productName || latest.code}{latest.restaurantName ? ` · ${latest.restaurantName}` : ''} · {latest.at}
              </p>
            </div>
          </div>
        </div>
      )}
      {results.length > 1 && (
        <div className="rounded-2xl border border-gray-200 dark:border-[#2C2F35] bg-white dark:bg-[#1D1F29] divide-y divide-gray-100 dark:divide-[#2C2F35]">
          {results.slice(1).map((r, i) => (
            <div key={`${r.code}-${i}`} className="flex items-center gap-2 px-3 py-2 text-xs">
              {r.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
              <span className="flex-1 truncate text-gray-700 dark:text-gray-300">{r.productName || r.code} — {r.message}</span>
              <span className="text-gray-400 dark:text-gray-500 shrink-0">{r.at}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
