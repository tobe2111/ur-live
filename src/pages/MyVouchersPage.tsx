import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import { ArrowLeft, Ticket, MapPin, Clock, CheckCircle, XCircle, QrCode, X, Gift, Share2 } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import api from '@/lib/api'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { LargeTitle, WalletPageWrapper } from '@/components/wallet/WalletAtoms'
import { walletTokens } from '@/components/wallet/walletTokens'

interface Voucher {
  id: number
  code: string
  status: 'unused' | 'used' | 'expired' | 'refunded'
  product_name: string
  restaurant_name?: string
  restaurant_address?: string
  restaurant_lat?: number
  restaurant_lng?: number
  product_image?: string
  expires_at?: string
  used_at?: string
  created_at: string
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
            <p className="text-[11px] text-gray-500 mb-4">
              매장 카카오맵 후기 작성하고 인증해주시면 보너스 딜 지급 (기본 1,000딜).
              <br/>1) 카카오맵 앱에서 매장 검색 → 후기 작성
              <br/>2) 후기 페이지 URL 복사 또는 스크린샷 캡쳐
              <br/>3) 아래에 제출
            </p>
            <div className="grid grid-cols-2 gap-1 mb-3">
              <button onClick={() => setMode('url')} className={`py-2 text-xs font-bold rounded ${mode === 'url' ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-700'}`}>URL 제출</button>
              <button onClick={() => setMode('screenshot')} className={`py-2 text-xs font-bold rounded ${mode === 'screenshot' ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-700'}`}>스크린샷 (AI 자동 검증)</button>
            </div>
            {mode === 'url' ? (
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">카카오맵 후기 URL</label>
                <input value={reviewUrl} onChange={(e) => setReviewUrl(e.target.value)}
                  placeholder="https://place.map.kakao.com/..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 dark:text-white dark:bg-[#1A1A1A]" />
                <p className="text-[10px] text-gray-500 mt-1">어드민 검증 후 1~3일 내 보너스 지급</p>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">후기 스크린샷</label>
                <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadScreenshot(e.target.files[0])}
                  className="w-full text-xs" />
                {uploading && <p className="text-[10px] text-gray-500 mt-1">업로드 중...</p>}
                {screenshotUrl && screenshotUrl.startsWith('data:') && (
                  <img src={screenshotUrl} alt="preview" className="mt-2 max-h-40 rounded" />
                )}
                <p className="text-[10px] text-emerald-600 mt-1">✨ AI 가 매장명/후기 내용 확인 시 즉시 보너스 지급</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button onClick={() => setOpen(false)} className="py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-700">취소</button>
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
    <div className="mx-auto bg-white p-2 rounded">
      <QRCodeSVG value={value} size={size} level="M" includeMargin={false} />
    </div>
  )
}

function QRModal({ voucher, onClose }: { voucher: Voucher; onClose: () => void }) {
  const { t } = useTranslation()
  useEscapeKey(onClose)
  const qrUrl = `https://live.ur-team.com/v/${voucher.code}`

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
        <div className="flex justify-center mb-4">
          <VoucherQRCode value={qrUrl} size={160} />
        </div>
        <div className="bg-gray-100 dark:bg-[#1A1A1A] rounded-lg px-3 py-2 text-center">
          <code className="text-sm font-mono font-bold text-pink-500">{voucher.code}</code>
        </div>
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
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [loading, setLoading] = useState(true)
  const [qrVoucher, setQrVoucher] = useState<Voucher | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  // 🛡️ 2026-05-15: 참여 후 share prompt — GroupBuyDetailPage.handleJoin 이 localStorage 기록
  const [justJoined, setJustJoined] = useState<{ product_id: number; name: string; image_url?: string } | null>(null)

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

  useEffect(() => {
    api.get('/api/vouchers/my')
      .then(r => { if (r.data.success) setVouchers(r.data.data || []) })
      .catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
      .finally(() => setLoading(false))
  }, [])

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
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${viewMode === 'list' ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            📋 리스트
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${viewMode === 'map' ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            🗺️ 지도로 보기
          </button>
        </div>
      )}

      <div className="ur-content-narrow px-4 lg:px-8 pb-2">
        {viewMode === 'map' && !loading ? (
          <VoucherMap
            vouchers={vouchers.filter(v => v.status === 'unused' && v.restaurant_lat && v.restaurant_lng)}
            onMarkerClick={(v) => setQrVoucher(v)}
          />
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
 * 🛡️ 2026-05-15: 미사용 voucher 매장들을 카카오 지도에 멀티 마커로 표시.
 * 각 마커 클릭 시 onMarkerClick(voucher) 호출 → QR 모달 오픈.
 *
 * Kakao Maps SDK 가 이미 다른 페이지에서 로드되어 있을 가능성이 높음 (e.g. /restaurant-map).
 * window.kakao 미존재 시 동적 로드.
 */
function VoucherMap({ vouchers, onMarkerClick }: { vouchers: Voucher[]; onMarkerClick: (v: Voucher) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)

  // useEffect 로 카카오 SDK 로드 + 마커 추가
  useEffect(() => {
    if (!containerRef.current || vouchers.length === 0) return
    const KAKAO_KEY = (import.meta.env?.VITE_KAKAO_JAVASCRIPT_KEY || '') as string
    if (!KAKAO_KEY) {
      if (import.meta.env.DEV) console.warn('[VoucherMap] Kakao JS key missing')
      return
    }

    function ensureSdkLoaded(): Promise<void> {
      return new Promise((resolve, reject) => {
        const w = window as any
        if (w.kakao && w.kakao.maps) { resolve(); return }
        const existingScript = document.querySelector(`script[src*="dapi.kakao.com"]`)
        if (existingScript) {
          existingScript.addEventListener('load', () => w.kakao?.maps?.load(() => resolve()))
          existingScript.addEventListener('error', () => reject(new Error('kakao sdk load failed')))
          return
        }
        const s = document.createElement('script')
        s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&autoload=false`
        s.async = true
        s.onload = () => w.kakao.maps.load(() => resolve())
        s.onerror = () => reject(new Error('kakao sdk load failed'))
        document.head.appendChild(s)
      })
    }

    let cancelled = false
    ensureSdkLoaded().then(() => {
      if (cancelled || !containerRef.current) return
      const w = window as any
      const lats = vouchers.map(v => Number(v.restaurant_lat))
      const lngs = vouchers.map(v => Number(v.restaurant_lng))
      const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length
      const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length
      const map = new w.kakao.maps.Map(containerRef.current, {
        center: new w.kakao.maps.LatLng(centerLat, centerLng),
        level: 7,
      })
      mapRef.current = map

      const bounds = new w.kakao.maps.LatLngBounds()
      vouchers.forEach((v) => {
        if (!v.restaurant_lat || !v.restaurant_lng) return
        const pos = new w.kakao.maps.LatLng(v.restaurant_lat, v.restaurant_lng)
        bounds.extend(pos)
        const marker = new w.kakao.maps.Marker({ position: pos, map })
        const iw = new w.kakao.maps.InfoWindow({
          content: `<div style="padding:8px 12px;font-size:12px;font-weight:700;color:#111;">${(v.restaurant_name || v.product_name).replace(/</g, '&lt;')}</div>`,
        })
        w.kakao.maps.event.addListener(marker, 'mouseover', () => iw.open(map, marker))
        w.kakao.maps.event.addListener(marker, 'mouseout', () => iw.close())
        w.kakao.maps.event.addListener(marker, 'click', () => onMarkerClick(v))
      })
      if (vouchers.length > 1) map.setBounds(bounds, 40, 40, 40, 40)
    }).catch((err) => {
      if (import.meta.env.DEV) console.error('[VoucherMap]', err)
    })
    return () => { cancelled = true }
  }, [vouchers, onMarkerClick])

  if (vouchers.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-sm text-gray-500">지도에 표시할 미사용 식사권이 없어요</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: 400 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
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
