import { useState, useEffect, useRef } from 'react'
import { Check, X, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

/**
 * 🎟️ 2026-06-20 (대표 — 사용처리 "카운터는 신뢰로 통과"): 소비자 셀프 사용처리 + 라이브 사용완료 화면.
 *   확인 → POST self-redeem(CAS) → 라이브 화면(실시간 시계·매장명·움직임 = 캡처 위조 방지) + 60초 취소.
 *   풀스크린 모달 규칙: z-[10000](하단 네비 z-[9999] 위).
 */
/** 🛰️ 사용 위치 소프트 증거: 권한 있으면만 best-effort 수집(게이트 X). 실패/거부/타임아웃 → null. */
function getGeo(timeoutMs = 3000): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null)
    let done = false
    const finish = (v: { lat: number; lng: number } | null) => { if (!done) { done = true; resolve(v) } }
    const t = setTimeout(() => finish(null), timeoutMs)
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => { clearTimeout(t); finish({ lat: pos.coords.latitude, lng: pos.coords.longitude }) },
        () => { clearTimeout(t); finish(null) },
        { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60_000 },
      )
    } catch { clearTimeout(t); finish(null) }
  })
}

export default function VoucherRedeemModal({
  code,
  storeName,
  storeAddress,
  onClose,
  onRedeemed,
}: {
  code: string
  storeName?: string
  storeAddress?: string
  onClose: () => void
  onRedeemed?: () => void
}) {
  const [phase, setPhase] = useState<'confirm' | 'loading' | 'done'>('confirm')
  const [usedAt, setUsedAt] = useState<string | null>(null)
  const [cancelableUntil, setCancelableUntil] = useState<number>(0)
  const [now, setNow] = useState<number>(Date.now())
  const [store, setStore] = useState(storeName || '매장')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 라이브 시계 (캡처 위조 방지 — 초가 움직임)
  useEffect(() => {
    if (phase !== 'done') return
    timerRef.current = setInterval(() => setNow(Date.now()), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase])

  const cancelLeft = Math.max(0, Math.ceil((cancelableUntil - now) / 1000))

  async function redeem() {
    setPhase('loading')
    try {
      const geo = await getGeo() // 소프트 — 없어도 진행(게이트 X)
      const res = await api.post(`/api/group-buy/vouchers/${encodeURIComponent(code)}/self-redeem`, geo ? { lat: geo.lat, lng: geo.lng } : {})
      const d = res.data?.data
      if (!res.data?.success) throw new Error(res.data?.error || 'fail')
      setStore(d?.storeName || store)
      setUsedAt(d?.usedAt || null)
      setCancelableUntil(d?.cancelableUntil || (Date.now() + 60_000))
      setNow(Date.now())
      setPhase('done')
      onRedeemed?.()
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } }
      toast.error(err.response?.data?.error || '사용 처리에 실패했어요')
      setPhase('confirm')
    }
  }

  async function cancel() {
    try {
      await api.post(`/api/group-buy/vouchers/${encodeURIComponent(code)}/cancel-redeem`)
      toast.success('사용을 취소했어요')
      onRedeemed?.()
      onClose()
    } catch {
      toast.error('취소 가능 시간이 지났어요')
    }
  }

  const clock = new Date(now).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

  return (
    <div className="fixed inset-0 z-[10000] bg-black/60 flex items-end sm:items-center justify-center" onClick={phase === 'confirm' ? onClose : undefined} role="presentation">
      <div
        className="relative bg-white dark:bg-[#0A0A0A] rounded-t-3xl sm:rounded-3xl w-full max-w-[430px] p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        {phase === 'confirm' && (
          <>
            <p className="text-[18px] font-extrabold text-gray-900 dark:text-white">이 공구권을 사용할까요?</p>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1.5">
              <b className="text-gray-900 dark:text-white">{store}</b> 에서 지금 사용합니다. <br />사용 후 환불은 불가하며, 실수 시 60초 내 취소할 수 있어요.
            </p>
            <div className="flex gap-2 mt-5">
              <button onClick={onClose} className="flex-1 py-3.5 rounded-2xl border border-gray-200 dark:border-[#2A2A2A] text-gray-700 dark:text-gray-200 text-sm font-bold">닫기</button>
              <button onClick={redeem} className="flex-[2] py-3.5 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-extrabold active:scale-[0.98] transition-transform">사용하기</button>
            </div>
          </>
        )}

        {phase === 'loading' && (
          <div className="py-12 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
            <p className="text-sm text-gray-500 dark:text-gray-400">처리 중…</p>
          </div>
        )}

        {phase === 'done' && (
          <div className="text-center">
            {/* 라이브 사용완료 — 움직이는 체크 + 실시간 시계 (스크린샷 위조 방지) */}
            <div className="w-20 h-20 mx-auto rounded-full bg-gray-900 dark:bg-white flex items-center justify-center animate-bounce-in">
              <Check className="w-11 h-11 text-white dark:text-gray-900" strokeWidth={3} />
            </div>
            <p className="text-[22px] font-black text-gray-900 dark:text-white mt-4">사용 완료</p>
            <p className="text-[15px] font-bold text-gray-700 dark:text-gray-200 mt-1">{store}</p>
            <p className="text-[28px] font-black text-gray-900 dark:text-white tabular-nums mt-2 tracking-tight">{clock}</p>
            <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-1">직원에게 이 화면을 보여주세요</p>

            {cancelLeft > 0 ? (
              <button onClick={cancel} className="mt-5 w-full py-3 rounded-2xl bg-gray-100 dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-300 text-[13px] font-bold">
                잘못 눌렀어요 · 취소 ({cancelLeft}초)
              </button>
            ) : (
              <button onClick={onClose} className="mt-5 w-full py-3.5 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-extrabold">완료</button>
            )}

            {/* 🗺️ 2026-06-23 카카오맵 후기 유도(아웃링크) — 리뷰는 가져올 수 없으니 작성을 유도(가게 평판↑). */}
            <a
              href={`https://map.kakao.com/?q=${encodeURIComponent(storeAddress ? `${store} ${storeAddress}` : store)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 w-full inline-flex items-center justify-center gap-1.5 py-3 rounded-2xl border border-gray-200 dark:border-[#2A2A2A] text-gray-600 dark:text-gray-300 text-[13px] font-bold active:scale-[0.98] transition-transform"
            >
              🗺️ 카카오맵에 후기 남기기
            </a>
          </div>
        )}

        {phase === 'confirm' && (
          <button onClick={onClose} aria-label="닫기" className="absolute top-3 right-3 p-1.5 rounded-full bg-gray-100 dark:bg-[#1A1A1A]"><X className="w-4 h-4 text-gray-500" /></button>
        )}
      </div>
    </div>
  )
}
