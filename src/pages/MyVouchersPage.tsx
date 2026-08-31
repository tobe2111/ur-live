import { lazy, Suspense, useState, useEffect, useMemo, useCallback } from 'react'
import { safeTime } from '@/utils/safe-date'
import { useNavigate } from 'react-router-dom'

// 🛡️ 2026-05-27 (loading P1): VoucherMap (Kakao Maps SDK ~150KB) 별도 chunk lazy.
//   사용자가 '지도 보기' 토글 시만 로드 → 초기 paint 영향 0.
const VoucherMap = lazy(() => import('./my-vouchers/VoucherMap'))
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import { ArrowLeft, Ticket, CheckCircle, XCircle, QrCode, X, Map } from 'lucide-react'
import { useMyVouchers } from '@/hooks/queries'
import { WalletPageWrapper } from '@/components/wallet/WalletAtoms'
import WalletHeader from './my-vouchers/WalletHeader'
import { walletTokens } from '@/components/wallet/walletTokens'
import { formatNumber } from '@/utils/format'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import VoucherDisputeBanner from '@/components/voucher/VoucherDisputeBanner'
import { EmptyVouchers } from './my-vouchers/WalletEmpty'
import BrandLoader from '@/components/brand/BrandLoader'
import PostJoinShareModal from './my-vouchers/PostJoinShareModal'
import VoucherTicket from './my-vouchers/VoucherTicket'
import WalletArchive from './my-vouchers/WalletArchive'
import QRModal from './my-vouchers/QRModal'
import { isStoreVoucher } from '@/shared/voucher-wallet'
import AddToHomeHint from '@/components/AddToHomeHint'
import type { Voucher, ViewMode } from './my-vouchers/types'


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
  used: { labelKey: 'voucher.status.used', color: 'bg-gray-100 dark:bg-[#1A1C21] text-gray-500 dark:text-gray-400', icon: CheckCircle },
  expired: { labelKey: 'voucher.status.expired', color: 'bg-red-100 text-red-600', icon: XCircle },
  refunded: { labelKey: 'voucher.status.refunded', color: 'bg-yellow-100 text-yellow-700', icon: XCircle },
} as const


export default function MyVouchersPage() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  // 🛡️ 2026-05-22 P1 영구 fix: useState+useEffect+직접 fetch → useMyVouchers().
  //   localStorage initialData (즉시 0ms 표시) + 2분 stale + 페이지 전환 시 dedup.
  // 🛡️ 2026-07-02: isError 분기 — 훅이 캐시 없는 실패를 throw 하게 바뀜(빈 지갑 위장 방지).
  const { data: vouchersRaw, isLoading: loading, isError, refetch } = useMyVouchers()
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

  // 상태별 그룹핑 (만료/환불 그룹 접기 상태는 WalletArchive 안으로 — 2026-08-31 추출)
  // 🎟️ 2026-06-18 (대표 신고 — 이용권 탭에 교환권 섞임): source 분리 → 세그먼트 탭.
  // 🎟️ 2026-08-31 (대표 "교환권은 교환권 페이지에서, 이용권은 이용권 페이지에서"): 탭도 걷어냈다.
  //   이 지갑은 **이용권 전용**이고, 교환권(문자로 오는 기프티콘)은 /my-gifticons 가 담당한다.
  //   어느 지갑 것인지 판정은 shared/voucher-wallet SSOT 한 곳에서만(카테고리로 나누지 말 것).
  const shownVouchers = useMemo(() => vouchers.filter(isStoreVoucher), [vouchers])
  // 🎨 2026-06-20 흑백 리디자인 화면1: 사용가능 카드 + (사용완료 / 만료·환불) 헤어라인 박스
  // 🎨 2026-06-21 (개선 #1): 만료 임박순 정렬 — API 는 created_at DESC 만 → 히어로 'D-N'과 목록 최상단 불일치.
  //   곧 사라질 이용권이 위로 오도록 만료 가까운 순(만료일 없는 건 뒤로). filter 가 새 배열이라 원본 불변.
  const unusedItems = shownVouchers.filter(v => v.status === 'unused')
    .sort((a, b) => {
      const ta = a.expires_at ? safeTime(a.expires_at) : Number.POSITIVE_INFINITY
      const tb = b.expires_at ? safeTime(b.expires_at) : Number.POSITIVE_INFINITY
      return ta - tb
    })
  const usedItems = shownVouchers.filter(v => v.status === 'used')
  const archivedItems = shownVouchers.filter(v => v.status === 'expired' || v.status === 'refunded')
  // 지도에 표시 가능한 미사용 이용권 (좌표 보유) — 메모이즈(지도 재초기화 방지)
  // 🐛 2026-06-21: 지갑 스코프로 제한 — 교환권 핀이 이용권 지도에 새던 것 차단(2026-08-31 이후엔 페이지가 분리돼 구조적으로도 0).
  const mapVouchers = useMemo(
    () => shownVouchers.filter(v => v.status === 'unused' && v.restaurant_lat && v.restaurant_lng),
    [shownVouchers],
  )
  const handleMarkerClick = useCallback(
    (mv: { id: number | string }) => setMapSelected(vouchers.find(x => x.id === mv.id) ?? null),
    [vouchers],
  )

  // 가까운 만료일 (현재 탭 unused 이용권 중 가장 가까운)
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
  //   지갑 = 자산. 상단 '보유 이용권 금액' 히어로 — 보유 금액(사용 가능분 합) + 아낀 돈.
  // 🐛 2026-06-21 fix: /vouchers/my 는 product_price 를 안 줘서 (원가-액면)=항상 0 → '아낀 돈' 영구 미표시였음.
  //   applied_price 는 '결제한(할인된) 단가', applied_discount_pct 는 할인율 → 원가 대비 절약 = 액면 * pct/(100-pct).
  const heroTotal = unusedItems.reduce((s, v) => s + (v.applied_price ?? v.product_price ?? 0), 0)
  const heroSaved = unusedItems.reduce((s, v) => {
    const pct = v.applied_discount_pct ?? 0
    const paid = v.applied_price ?? 0
    return (pct > 0 && pct < 100 && paid > 0) ? s + Math.round((paid * pct) / (100 - pct)) : s
  }, 0)
  // 🪙 2026-08-31: 이 지갑은 이용권 전용이라 단위는 항상 '원'(교환권의 '딜' 단위는 /my-gifticons 가 담당).
  const heroUnit = t('voucher.won', { defaultValue: '원' })

  // 🎨 화면2 — 지도에서 보기 (전용 인-페이지 화면)
  if (viewMode === 'map') {
    // 거리순 정렬 캐러셀 (위치 없으면 원본 순). 기본 강조 = 가장 가까운(없으면 첫) 이용권.
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
          {/* 🎨 2026-06-21 (개선 #1): 주변 이용권 캐러셀 (거리순) — 1장 카드 → 가로 스크롤 비교. */}
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
                      className={`snap-start shrink-0 w-[80%] max-w-[300px] flex items-center gap-3 rounded-2xl bg-white dark:bg-[#141414] border p-3 text-left transition-colors ${selected ? 'border-gray-900 dark:border-white' : 'border-gray-200 dark:border-[#2C2F35]'}`}
                      style={{ boxShadow: '0 8px 28px rgba(10,10,10,0.18)' }}
                    >
                      <div className="w-[52px] h-[52px] shrink-0 rounded-xl overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#F7F8FA] to-[#EFF1F4] dark:from-[#1A1C21] dark:to-[#0F0F0F] ring-1 ring-gray-100 dark:ring-white/10">
                        {v.product_image
                          ? <img src={cfImage(v.product_image, { width: 200, quality: 82, format: 'auto' }) || v.product_image} alt="" loading="lazy" className="w-full h-full object-cover" onError={(e) => cfImageOnError(e.currentTarget, v.product_image)} />
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

      {/* 🎨 2026-07-20 (대표 — 지갑 상단 리디자인): LargeTitle + 회색 세그먼트 → 모던 지갑 헤더
          (26px 타이틀 + 총 보유 칩 + 언더라인 탭). 교환권 보유 시에만 탭 노출. */}
      <WalletHeader
        title={t('voucher.myVouchers')}
        amount={shownVouchers.length > 0 ? heroTotal : null}
        unit={heroUnit}
        stats={shownVouchers.length > 0 ? [
          { label: t('voucher.heroUsable', { defaultValue: '사용 가능' }), value: `${unusedItems.length}${t('voucher.heroCountUnit', { defaultValue: '장' })}` },
          ...(nearestExpiry !== null ? [{ label: t('voucher.heroExpiry', { defaultValue: '만료 임박' }), value: nearestExpiry === 0 ? 'D-DAY' : `D-${nearestExpiry}`, mono: true, tone: (nearestExpiry <= 2 ? 'danger' : undefined) as 'danger' | undefined }] : []),
          ...(heroSaved > 0 ? [{ label: t('voucher.heroSaved', { defaultValue: '아낀 돈' }), value: `${formatNumber(heroSaved)}${heroUnit}`, mono: true, tone: 'success' as const }] : []),
        ] : []}
      />


      <div className="ur-content-narrow px-4 lg:px-8 pb-2">
        {loading ? (
          <BrandLoader />
        ) : isError ? (
          /* 🛡️ 2026-07-02: 네트워크 실패를 "빈 지갑"으로 위장하지 않음 — 에러 + 재시도. */
          <div className="text-center py-16">
            <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">{t('voucher.loadFailed', { defaultValue: '이용권을 불러오지 못했어요' })}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{t('common.checkNetworkRetry', { defaultValue: '네트워크 상태를 확인한 뒤 다시 시도해주세요' })}</p>
            <button
              onClick={() => refetch()}
              className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full text-sm font-bold"
            >
              {t('common.retry', { defaultValue: '다시 시도' })}
            </button>
          </div>
        ) : shownVouchers.length === 0 ? (
          <EmptyVouchers
            mode="gb"
            /* 🧭 2026-07-20: /group-buy 는 홈 리다이렉트(이중 홉) — 이용권 CTA 는 홈(동네딜 피드) 직행 */
            onExplore={() => navigate('/')}
            t={t}
          />
        ) : (
          <>
            {/* 🏠 2026-07-12 (앱-레디): 지갑 = 최고 관여 순간 → 홈 화면 추가 컨텍스트 유도(자가 게이트) */}
            <AddToHomeHint context="wallet" />
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
              <p className="py-8 text-center text-[13px] text-gray-400 dark:text-gray-500">{t('voucher.noUnused', { defaultValue: '사용 가능한 이용권이 없어요' })}</p>
            )}

            {/* 사용 완료 / 만료·환불 — 헤어라인 박스 (탭하면 인라인 펼침) */}
            <WalletArchive used={usedItems} archived={archivedItems} locale={locale} t={t} onShowQr={setQrVoucher} />
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

