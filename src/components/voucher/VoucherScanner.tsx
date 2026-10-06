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
import { OkIcon, BadIcon } from '@/components/icons/urdeal-icons'
import { useTranslation } from 'react-i18next'
import { Keyboard, Loader2 } from 'lucide-react'
import api from '@/lib/api'

/** 확인을 기다리는 스캔. `status` 는 `/verify` 가 준 값(unused·used·expired·refunded…), 조회 실패면 없다. */
type PendingUse = { code: string; loading: boolean; productName?: string; restaurantName?: string; status?: string }

type ScanResult = {
  ok: boolean
  code: string
  message: string
  productName?: string
  restaurantName?: string
  at: string
}

/**
 * QR 값(https://…/v/<code>)·딥링크·raw 코드에서 바우처 코드 추출.
 *
 * 🩸 2026-09-05 (대표 *"매장 계산대 페이지에서 바우처 코드 직접 입력하는게 왜 필요하지?"* 를
 *   파다 드러난 결함): **손으로 친 코드는 거의 항상 실패하고 있었다.**
 *   발급 코드는 `generateVoucherCode` 의 알파벳이 `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` 라
 *   **전부 대문자**인데(라이브 실측: 전량 대문자), 서버 조회는 `WHERE code = ?` 라
 *   SQLite 기본 BINARY 대조 — 대소문자를 가린다(실측: 소문자로 조회하면 **0건**).
 *   그런데 이 입력칸은 `autoCapitalize` 가 없어 **폰 키보드가 소문자로 시작한다.**
 *   ⇒ 유효한 바우처인데 "바우처를 찾을 수 없습니다"(404) 가 뜬다. 카메라가 안 될 때 쓰라고
 *     만든 폴백이, 정작 그 상황에서 절반은 실패하는 상태였다.
 *
 * ⚠️ 대문자 정규화는 QR 경로에도 함께 적용된다 — QR 안의 코드도 이미 대문자라 **무해**하고
 *   (idempotent), 손상된 QR 을 부분 판독했을 때도 같은 규칙이 걸린다.
 * 공백은 통째로 지운다 — 사람은 `UR ABCD EFGH` 처럼 띄어 치고, 붙여넣기엔 공백이 딸려 온다.
 */
export function extractCode(raw: string): string | null {
  const v = (raw || '').replace(/\s+/g, '').toUpperCase()
  if (!v) return null
  const m = v.match(/\/V\/([A-Z0-9_-]{4,64})/)
  if (m) return m[1]
  if (/^[A-Z0-9_-]{4,64}$/.test(v)) return v
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

  /**
   * ✅ 2026-10-06 (대표 "찍고나서 확인될 때 팝업창으로 사용처리 하시겠습니까? 라고 물어보는게 맞잖아"):
   *   종전엔 비추는 **순간** 사용 처리됐다. 사용은 되돌릴 수 없고(환불 자격이 바뀐다), 카메라는 의도치 않게
   *   옆 손님 화면이나 사진 속 QR 도 읽는다. ⇒ 스캔 → **조회만** (`GET /verify/:code` — 소비하지 않는다)
   *   → 상품·매장·상태를 보여 주고 → [사용 처리] 를 눌러야 `use-by-seller` 가 나간다.
   *   서버 계약은 그대로다(조회 엔드포인트는 원래 있었다). 이 함수는 **확인 뒤에만** 불린다.
   */
  const useVoucher = useCallback(async (code: string) => {
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

  const [pending, setPending] = useState<PendingUse | null>(null)
  const pendingRef = useRef(false)

  /** 스캔/입력 → 조회만 하고 확인을 묻는다. 카메라 루프는 ref 로 부르므로 이 함수가 바뀌어도 재시작하지 않는다. */
  const requestUse = useCallback(async (code: string) => {
    if (pendingRef.current) return // 확인창이 떠 있는 동안 카메라가 계속 읽는 것은 무시
    // 같은 코드 5초 내 재인식(카메라가 같은 QR 계속 봄) 무시 — 확인창을 닫자마자 다시 뜨는 것 방지.
    const last = lastCodeRef.current
    if (last && last.code === code && Date.now() - last.at < 5000) return
    lastCodeRef.current = { code, at: Date.now() }
    pendingRef.current = true
    setPending({ code, loading: true })
    try {
      const r = await api.get(`/api/group-buy/verify/${encodeURIComponent(code)}`)
      const d = r.data?.data || {}
      setPending({ code, loading: false, productName: d.product_name, restaurantName: d.restaurant_name, status: d.status })
    } catch (err: unknown) {
      const st = (err as { response?: { status?: number } }).response?.status
      if (st === 404) {
        pendingRef.current = false
        setPending(null)
        setResults((prev) => [{ ok: false, code, message: t('seller.scan.notFound', { defaultValue: '이용권을 찾을 수 없어요' }), at: new Date().toLocaleTimeString('ko-KR') }, ...prev].slice(0, 20))
        if (navigator.vibrate) navigator.vibrate([60, 60, 60])
        return
      }
      // 조회가 안 돼도 막지 않는다 — 사용 처리 자체는 서버가 다시 검증한다(이중사용·타매장 CAS).
      setPending({ code, loading: false })
    }
  }, [t])
  const requestUseRef = useRef(requestUse)
  requestUseRef.current = requestUse

  const closePending = () => { pendingRef.current = false; setPending(null) }
  const confirmPending = () => {
    if (!pending) return
    const code = pending.code
    closePending()
    void useVoucher(code)
  }

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
            if (code) void requestUseRef.current(code)
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
          if (code) void requestUseRef.current(code)
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
  }, [hasDetector, t])

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
    void requestUse(code)
  }

  const latest = results[0]

  return (
    <div className="space-y-4">
      {/* 카메라 뷰 */}
      <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3]">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
        {!cameraOn && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center text-white/70 text-[15px]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('seller.scan.cameraStarting', { defaultValue: '카메라 시작 중…' })}
          </div>
        )}
        {cameraOn && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-52 h-52 rounded-2xl border-2 border-white/80" />
          </div>
        )}
        {busy && (
          <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-center text-[15px] py-2">
            <Loader2 className="w-4 h-4 animate-spin inline mr-2" />{t('seller.scan.processing', { defaultValue: '사용 처리 중…' })}
          </div>
        )}
      </div>
      {cameraError && <p className="text-[15px] text-tone-warn bg-tone-warn-bg rounded-xl px-3 py-2">{cameraError}</p>}

      {/* 수동 입력 (카메라 불가/QR 손상 대비) */}
      <form onSubmit={submitManual} className="flex gap-2">
        <div className="relative flex-1">
          <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            // ⚠️ 이 넷이 빠지면 폰 키보드가 소문자로 시작하고 자동수정이 코드를 망친다(위 주석의 실사고).
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            placeholder={t('seller.scan.manualPlaceholder', { defaultValue: '코드 직접 입력 (UR-XXXX-XXXX)' })}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-line text-[15px] text-gray-900 dark:text-white bg-surface focus:outline-none focus:ring-2 focus:ring-gray-400/40"
          />
        </div>
        <button type="submit" disabled={busy || !extractCode(manualCode)}
          className="px-4 py-2 rounded-xl bg-brand text-white text-[15px] font-bold disabled:opacity-40">
          {t('seller.scan.useBtn', { defaultValue: '사용 처리' })}
        </button>
      </form>

      {/* 최근 결과 — 최신 1건 크게 + 이번 세션 이력.
          🚦 2026-09-29: 성공이 emerald 였는데 MONO 중화로 **회색**이었다 — 실패(red)만 색이 있어서
          매장에서 스캔했을 때 "통과" 와 "오류" 중 한쪽만 읽혔다. 사용 처리는 되돌릴 수 없는 동작이라
          이 한 쌍이 이 화면에서 가장 중요한 신호다. */}
      {latest && (
        <div className={`rounded-2xl p-4 ${latest.ok ? 'bg-tone-ok-bg' : 'bg-tone-bad-bg'}`}>
          <div className="flex items-center gap-2">
            {latest.ok
              ? <OkIcon className="w-7 h-7 text-tone-ok shrink-0" />
              : <BadIcon className="w-7 h-7 text-tone-bad shrink-0" />}
            <div className="min-w-0">
              <p className={`text-[15px] font-extrabold ${latest.ok ? 'text-tone-ok' : 'text-tone-bad'}`}>{latest.message}</p>
              <p className="text-[12px] text-gray-600 dark:text-gray-400 mt-1 truncate">
                {latest.productName || latest.code}{latest.restaurantName ? ` · ${latest.restaurantName}` : ''} · {latest.at}
              </p>
            </div>
          </div>
        </div>
      )}
      {results.length > 1 && (
        <div className="rounded-2xl bg-surface divide-y divide-gray-100 dark:divide-[#2C2F35] shadow-lift">
          {results.slice(1).map((r, i) => (
            <div key={`${r.code}-${i}`} className="flex items-center gap-2 px-3 py-2 text-[12px]">
              {r.ok ? <OkIcon className="w-3.5 h-3.5 text-tone-ok shrink-0" /> : <BadIcon className="w-3.5 h-3.5 text-tone-bad shrink-0" />}
              <span className="flex-1 truncate text-gray-700 dark:text-gray-300">{r.productName || r.code} — {r.message}</span>
              <span className="text-gray-400 dark:text-gray-500 shrink-0">{r.at}</span>
            </div>
          ))}
        </div>
      )}

      {pending && <UseConfirmSheet pending={pending} onCancel={closePending} onConfirm={confirmPending} />}
    </div>
  )
}

/**
 * ✅ 사용 처리 확인창. 사용 가능한 이용권만 [사용 처리] 를 낸다 — 이미 쓴/만료/환불은 이유만 말하고 닫게 한다
 *   (누를 수 없는 버튼을 띄우면 사장님은 눌러 보고서야 안다).
 */
function UseConfirmSheet({ pending, onCancel, onConfirm }: { pending: PendingUse; onCancel: () => void; onConfirm: () => void }) {
  const { t } = useTranslation()
  const st = pending.status
  const usable = !pending.loading && (st == null || st === 'unused')
  const blocked = st === 'used'
    ? t('seller.scan.alreadyUsed', { defaultValue: '이미 사용된 이용권이에요' })
    : st && st !== 'unused'
      ? t('seller.scan.notUsable', { defaultValue: '사용할 수 없는 이용권이에요 (만료·환불)' })
      : null
  return (
    <div className="fixed inset-0 z-[10500] flex items-end sm:items-center justify-center bg-black/50 p-4" role="presentation" onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-labelledby="use-confirm-title" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-surface p-6 shadow-lift">
        {pending.loading ? (
          <p className="flex items-center justify-center gap-2 py-6 text-[15px] text-gray-500 dark:text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('seller.scan.checking', { defaultValue: '이용권 확인 중…' })}
          </p>
        ) : (
          <>
            <p className="text-[13px] text-gray-500 dark:text-gray-400">{pending.restaurantName || pending.code}</p>
            <p className="mt-1 text-[17px] font-bold text-gray-900 dark:text-white">{pending.productName || pending.code}</p>
            <h2 id="use-confirm-title" className={`mt-4 text-[15px] font-bold ${blocked ? 'text-tone-bad' : 'text-gray-900 dark:text-white'}`}>
              {blocked ?? t('seller.scan.confirmQ', { defaultValue: '사용 처리하시겠습니까?' })}
            </h2>
            {!blocked && (
              <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">{t('seller.scan.confirmNote', { defaultValue: '사용 처리하면 되돌릴 수 없어요.' })}</p>
            )}
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={onCancel}
                className="flex-1 rounded-full bg-gray-100 dark:bg-white/10 py-3 text-[15px] font-bold text-gray-700 dark:text-gray-200">
                {blocked ? t('common.close', { defaultValue: '닫기' }) : t('common.cancel', { defaultValue: '취소' })}
              </button>
              {usable && !blocked && (
                <button type="button" onClick={onConfirm} autoFocus
                  className="flex-1 rounded-full bg-brand py-3 text-[15px] font-bold text-white">
                  {t('seller.scan.useBtn', { defaultValue: '사용 처리' })}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
