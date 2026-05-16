import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Ticket, CheckCircle, Clock, XCircle, Loader2, Lock, ScanLine, Camera, X } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import api from '@/lib/api'
import SEO from '@/components/SEO'

// 🛡️ 2026-05-16: QR 스캐너 모달 — qr-scanner 라이브러리 사용 (~10KB gzipped).
//   사용 흐름: 매장 점주가 [QR 스캔] 버튼 → 카메라 활성화 → QR 인식 → 코드 자동 입력 후 사용 처리.
//   카메라 권한 거부 / 미지원 시 자동으로 모달 닫힘 + 토스트 안내.
function QRScannerModal({ onResult, onClose }: { onResult: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<{ stop: () => void; destroy: () => void } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let scanner: { start: () => Promise<void>; stop: () => void; destroy: () => void } | null = null

    async function start() {
      try {
        const QrScanner = (await import('qr-scanner')).default
        if (cancelled || !videoRef.current) return
        scanner = new QrScanner(
          videoRef.current,
          (res: { data: string }) => {
            const raw = res.data
            // URL 형식이면 마지막 path segment 추출, 아니면 그대로
            let code = raw
            try {
              const u = new URL(raw)
              const segs = u.pathname.split('/').filter(Boolean)
              code = segs[segs.length - 1] || raw
            } catch { /* not a URL — use as-is */ }
            onResult(code.toUpperCase())
            scanner?.stop()
          },
          { preferredCamera: 'environment', highlightScanRegion: true, maxScansPerSecond: 5 },
        )
        scannerRef.current = scanner
        await scanner.start()
      } catch (e) {
        if (cancelled) return
        const msg = (e as Error)?.message || String(e)
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied')) {
          setError('카메라 권한을 허용해주세요')
        } else if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('no camera')) {
          setError('카메라를 사용할 수 없습니다')
        } else {
          setError('QR 스캐너 초기화 실패 — 코드 직접 입력해주세요')
        }
      }
    }
    start()
    return () => {
      cancelled = true
      try { scannerRef.current?.stop() } catch { /* ignore */ }
      try { scannerRef.current?.destroy() } catch { /* ignore */ }
    }
  }, [onResult])

  return (
    <div className="fixed inset-0 z-[10500] flex items-center justify-center bg-black/90" onClick={onClose} role="dialog" aria-modal="true">
      <div className="relative w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-12 right-0 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white" aria-label="닫기">
          <X className="w-6 h-6" />
        </button>
        <div className="bg-black rounded-2xl overflow-hidden aspect-square">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        </div>
        <p className="text-center text-white text-sm mt-4">손님 화면의 QR 코드를 스캔해주세요</p>
        {error && (
          <div className="mt-3 bg-red-500/20 border border-red-400 rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-white">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}

interface StoreStats {
  product_name: string
  restaurant_name: string
  total_vouchers: number
  used: number
  unused: number
  expired: number
  group_buy_current: number
  group_buy_target: number
}

export default function StoreStatsPage() {
  const { t } = useTranslation()
  const { productId } = useParams<{ productId: string }>()
  const [searchParams] = useSearchParams()
  const magicToken = searchParams.get('t')?.trim() || ''
  const [pin, setPin] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [stats, setStats] = useState<StoreStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // 🛡️ 2026-05-13 (공구 UX): 가게 현장 바우처 사용 처리 UI
  const [voucherCode, setVoucherCode] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [usingVoucher, setUsingVoucher] = useState(false)
  const [recentUses, setRecentUses] = useState<Array<{ code: string; success: boolean; reason?: string; at: number }>>([])

  const handleUseVoucher = async () => {
    const code = voucherCode.trim().toUpperCase()
    if (!code) return
    if (!pin || pin.length < 4) {
      toast.error('가게 PIN 이 필요합니다')
      return
    }
    setUsingVoucher(true)
    try {
      const res = await api.post(`/api/group-buy/${encodeURIComponent(code)}/use`, { pin })
      const success = res.data?.success === true
      setRecentUses(prev => [{ code, success, reason: success ? undefined : (res.data?.error as string), at: Date.now() }, ...prev].slice(0, 10))
      if (success) {
        // 🛡️ 2026-05-16: 사용 처리 성공 시 어떤 메뉴인지 큰 toast + 자동 5초 표시
        const menuName = res.data?.data?.product_name || stats?.product_name || ''
        const influencerId = res.data?.data?.influencer_id
        const msg = influencerId
          ? `✅ 메뉴 제공: ${menuName}\n📢 ${influencerId} 의 추천 손님`
          : `✅ 메뉴 제공: ${menuName}`
        toast.success(msg, { duration: 6000 })
        setVoucherCode('')
        // stats refresh
        try {
          const tokenParam = magicToken || ''
          const r = await api.get(`/api/group-buy/store-stats/${productId}${tokenParam ? `?t=${tokenParam}` : ''}`, tokenParam ? {} : { headers: { 'X-Store-Pin': pin } })
          if (r.data?.success) setStats(r.data.data)
        } catch { /* ignore */ }
      } else {
        toast.error(res.data?.error || '바우처 사용 실패')
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      const reason = e?.response?.data?.error || '사용 실패'
      setRecentUses(prev => [{ code, success: false, reason, at: Date.now() }, ...prev].slice(0, 10))
      toast.error(reason)
    } finally {
      setUsingVoucher(false)
    }
  }

  async function authenticate(opts?: { token?: string }) {
    const useToken = opts?.token || magicToken
    if (!useToken && !pin.trim()) return
    setLoading(true)
    setError('')
    try {
      const url = useToken
        ? `/api/group-buy/store-stats/${productId}?t=${encodeURIComponent(useToken)}`
        : `/api/group-buy/store-stats/${productId}`
      const res = await api.post(url, useToken ? {} : { pin: pin.trim() })
      if (res.data.success) {
        setStats(res.data.data)
        setAuthenticated(true)
      } else {
        setError(res.data.error || t('storeStats.authFail'))
      }
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string }; status?: number } }
      setError(err_.response?.data?.error || t('storeStats.authFailedMsg'))
    } finally {
      setLoading(false)
    }
  }

  // 🛡️ 2026-04-27: Magic Link — ?t=token 이 있으면 자동 인증.
  useEffect(() => {
    if (magicToken && !authenticated && !loading && !stats) {
      authenticate({ token: magicToken })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [magicToken])

  // Magic Link 토큰으로 자동 인증 중 — 로딩 화면
  if (magicToken && !authenticated && !error) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0A0A0A] flex items-center justify-center px-5">
        <SEO title={t('storeStats.seoTitle')} description={t('storeStats.seoDesc')} url={`/store/stats/${productId ?? ''}`} noindex />
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500 dark:text-gray-400">매장 인증 중...</p>
        </div>
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0A0A0A] flex items-center justify-center px-5">
        <SEO title={t('storeStats.seoTitle')} description={t('storeStats.seoDesc')} url={`/store/stats/${productId ?? ''}`} noindex />
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-orange-100 flex items-center justify-center">
            <Lock className="w-7 h-7 text-orange-600" />
          </div>
          <h1 className="text-lg font-extrabold text-gray-900 dark:text-white mb-1">식당 통계</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">사장님께 알림톡으로 발송된 링크로 접속하시면 비밀번호 없이 바로 확인할 수 있어요.</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-6">또는 인플루언서에게 받은 비밀번호를 입력하세요</p>

          {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg p-3 mb-4">{error}</p>}

          <input
            value={pin}
            onChange={e => setPin(e.target.value)}
            type="password"
            placeholder={t('storeStats.passwordPlaceholder')}
            className="w-full px-4 py-3.5 border border-gray-300 dark:border-[#3A3A3A] rounded-xl text-center text-lg text-gray-900 dark:text-white tracking-widest focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 mb-4"
            onKeyDown={e => e.key === 'Enter' && authenticate()}
          />
          <button
            onClick={() => authenticate()}
            disabled={!pin.trim() || loading}
            className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold rounded-xl disabled:opacity-40"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t('storeStats.confirm')}
          </button>
        </div>
      </div>
    )
  }

  if (!stats) return null

  const usedPercent = stats.total_vouchers > 0 ? Math.round((stats.used / stats.total_vouchers) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#121212] px-5 py-8">
      <SEO title={t('storeStats.titleSuffix', { name: stats.restaurant_name || t('storeStats.fallbackRestaurant') })} description={t('storeStats.seoDesc')} url={`/store/stats/${productId ?? ''}`} noindex />
      <div className="ur-content-narrow">
        {/* 헤더 */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">{stats.restaurant_name || t('storeStats.fallbackRestaurant')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{stats.product_name}</p>
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { label: t('storeStats.labelUsed'), value: stats.used, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
            { label: t('storeStats.labelUnused'), value: stats.unused, icon: Ticket, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: t('storeStats.labelExpired'), value: stats.expired, icon: XCircle, color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-[#1A1A1A]' },
            { label: t('storeStats.labelTotal'), value: stats.total_vouchers, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-[#0A0A0A] rounded-xl p-4 border border-gray-200 dark:border-[#2A2A2A]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">{s.label}</span>
                <div className={`w-7 h-7 ${s.bg} rounded-lg flex items-center justify-center`}>
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* 사용률 바 */}
        <div className="bg-white dark:bg-[#0A0A0A] rounded-xl p-5 border border-gray-200 dark:border-[#2A2A2A] mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-gray-900 dark:text-white">바우처 사용률</span>
            <span className="text-sm font-bold text-green-600">{usedPercent}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-[#2A2A2A] rounded-full h-3">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${usedPercent}%` }} />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{stats.used}장 사용 / {stats.total_vouchers}장 발급</p>
        </div>

        {/* 🛡️ 2026-05-16 (선물하기 모델): 손님이 미리 결제한 메뉴 제공 */}
        <div className="bg-white dark:bg-[#0A0A0A] rounded-xl p-5 border-2 border-emerald-200 dark:border-emerald-900 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <ScanLine className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">손님 식권 확인 → 메뉴 제공</h3>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-lg p-3 mb-3">
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">📋 사용 방법</p>
            <ol className="text-xs text-emerald-800 dark:text-emerald-200 mt-1 space-y-0.5 list-decimal pl-4">
              <li>손님 QR 스캔 또는 코드 입력</li>
              <li>화면에 "메뉴 X 제공" 확인 후 음식 만들기</li>
              <li>POS / T오더 결제 X (이미 유어딜에서 결제 완료)</li>
              <li>추가 주문은 T오더로 별도 받기</li>
            </ol>
          </div>
          {/* QR 스캔 버튼 (메인) */}
          <button
            onClick={() => setScannerOpen(true)}
            disabled={usingVoucher}
            className="w-full mb-3 py-3.5 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Camera className="w-5 h-5" /> QR 스캔하기
          </button>
          <p className="text-center text-[11px] text-gray-400 mb-2">— 또는 코드 직접 입력 —</p>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="text"
              value={voucherCode}
              onChange={e => setVoucherCode(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleUseVoucher() }}
              placeholder="예: UR-AB12-XY34"
              className="flex-1 border border-gray-300 dark:border-[#2A2A2A] rounded-xl px-3 py-3 text-sm font-mono text-center tracking-wider bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white"
              autoCapitalize="characters"
              autoCorrect="off"
            />
            <button
              onClick={handleUseVoucher}
              disabled={usingVoucher || !voucherCode.trim()}
              className="px-5 py-3 bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold rounded-xl disabled:opacity-40 whitespace-nowrap"
            >
              {usingVoucher ? <Loader2 className="w-4 h-4 animate-spin" /> : '사용 처리'}
            </button>
          </div>
          {recentUses.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-[#2A2A2A]">
              <p className="text-[11px] text-gray-500 mb-2">최근 시도</p>
              <div className="space-y-1.5">
                {recentUses.slice(0, 5).map((u, i) => (
                  <div key={i} className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg ${
                    u.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                    <span className="font-mono">{u.success ? '✓' : '✗'} {u.code}</span>
                    <span className="text-[10px] opacity-80">{u.success ? '완료' : (u.reason || '실패')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 공동구매 현황 */}
        <div className="bg-white dark:bg-[#0A0A0A] rounded-xl p-5 border border-gray-200 dark:border-[#2A2A2A]">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">공동구매 현황</h3>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">참여자</span>
            <span className="text-sm font-bold text-pink-600">{stats.group_buy_current}/{stats.group_buy_target}명</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-[#2A2A2A] rounded-full h-2">
            <div className="h-full bg-pink-500 rounded-full" style={{ width: `${stats.group_buy_target > 0 ? Math.min(100, (stats.group_buy_current / stats.group_buy_target) * 100) : 0}%` }} />
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">유어딜 · 식당 공동구매 서비스</p>
      </div>

      {/* QR 스캐너 모달 */}
      {scannerOpen && (
        <QRScannerModal
          onResult={(code) => {
            setVoucherCode(code)
            setScannerOpen(false)
            // 스캔 즉시 자동 사용 처리 (UX 친화 — 매장 점주가 별도 버튼 안 눌러도 됨)
            setTimeout(() => { void handleUseVoucher() }, 100)
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  )
}
