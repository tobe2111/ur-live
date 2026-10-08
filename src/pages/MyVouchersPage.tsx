import { lazy, Suspense, useState, useEffect, useMemo, useCallback } from 'react'
import { TicketStubIcon, OkIcon, BadIcon } from '@/components/icons/urdeal-icons'
import { safeTime } from '@/utils/safe-date'
import { useNavigate } from 'react-router-dom'

// 🛡️ 2026-05-27 (loading P1): VoucherMap (Kakao Maps SDK ~150KB) 별도 chunk lazy.
//   사용자가 '지도 보기' 토글 시만 로드 → 초기 paint 영향 0.
const VoucherMap = lazy(() => import('./my-vouchers/VoucherMap'))
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import { ArrowLeft, QrCode } from 'lucide-react'
import { useMyVouchers } from '@/hooks/queries'
import { WalletPageWrapper } from '@/components/wallet/WalletAtoms'
import WalletHeader from './my-vouchers/WalletHeader'
import { walletTokens } from '@/components/wallet/walletTokens'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import VoucherDisputeBanner from '@/components/voucher/VoucherDisputeBanner'
import { EmptyVouchers } from './my-vouchers/WalletEmpty'
import BrandLoader from '@/components/brand/BrandLoader'
import VoucherTicket from './my-vouchers/VoucherTicket'
import WalletRow from './my-vouchers/WalletRow'
import QRModal from './my-vouchers/QRModal'
import { isStoreVoucher, isUsableWalletItem } from '@/shared/voucher-wallet'
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
  unused: { labelKey: 'voucher.status.unused', color: 'bg-green-100 text-green-700', icon: TicketStubIcon },
  used: { labelKey: 'voucher.status.used', color: 'bg-gray-100 dark:bg-[#1D1F29] text-gray-500 dark:text-gray-400', icon: OkIcon },
  expired: { labelKey: 'voucher.status.expired', color: 'bg-red-100 text-red-600', icon: BadIcon },
  refunded: { labelKey: 'voucher.status.refunded', color: 'bg-yellow-100 text-yellow-700', icon: BadIcon },
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
  // 🎫 2026-09-02 (대표 시안 — 코레일톡 화이트 지갑): [사용 가능 | 사용 완료] 밑줄 탭 + outline 칩 필터.
  //   접기 박스(WalletArchive)는 이 지갑에서 탭으로 대체(교환권 지갑 /my-gifticons 는 그대로 그 박스를 쓴다).
  const [tab, setTab] = useState<'unused' | 'done'>('unused')
  // 🎨 2026-06-20 흑백 리디자인 화면2(지도 전용) — 인-페이지 뷰(새 라우트 X)
  const [mapSelected, setMapSelected] = useState<Voucher | null>(null)
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null)
  // 🛡️ 2026-05-15: 참여 후 share prompt — GroupBuyDetailPage.handleJoin 이 localStorage 기록
  // 🗑️ 2026-10-06 (대표 "참여완료 이거 뜨면 안되지 않아? 없어졌잖아"): 구매 직후 '참여 완료!' 공유 모달 제거.
  //   두 가지로 틀려 있었다. ① **용어** — "참여"는 폐기된 개념이다(이용권은 모여서 사는 게 아니라 즉시 구매).
  //   ② **더 나쁜 것: 보상이 없다** — 모달은 "친구 초대 시 양쪽 0.5% 보너스 딜" 을 약속했는데 라이브
  //   `user_referral_bonus_pct` 는 2026-08-23 대표 "심플 모델" 로 **0** 이다. 없는 보상을 약속하고 있었다.
  //   문구만 고치면 보상 없는 공유 권유만 남고, 결제 완료 화면이 이미 축하를 하므로 축하가 둘이 된다. ⇒ 삭제.
  // 🗑️ 2026-06-20 (대표 신고): '전화번호 등록' 배너 제거 — 교환권 구매 시 서버가 PHONE_REQUIRED 로
  //   번호를 강제 수집(users.phone)하므로, 교환권 보유 유저는 이미 번호가 있음 → 배너는 중복/노이즈.

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
  // 🎟️ 마이 상단 카운트와 **같은 술어**(2026-10-07) — 손으로 적으면 또 갈린다.
  const unusedItems = shownVouchers.filter(isUsableWalletItem)
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
    () => shownVouchers.filter(v => isUsableWalletItem(v) && v.restaurant_lat && v.restaurant_lng),
    [shownVouchers],
  )
  const handleMarkerClick = useCallback(
    (mv: { id: number | string }) => setMapSelected(vouchers.find(x => x.id === mv.id) ?? null),
    [vouchers],
  )

  // 🎨 2026-06-21 (대표 "페이지가 투박 — UX/UI 재설계", 시안 A '프리미엄 패스'):
  //   지갑 = 자산. 상단 '보유 이용권 금액' 히어로 — 보유 금액(사용 가능분 합) + 아낀 돈.
  // 🐛 2026-06-21 fix: /vouchers/my 는 product_price 를 안 줘서 (원가-액면)=항상 0 → '아낀 돈' 영구 미표시였음.
  //   applied_price 는 '결제한(할인된) 단가', applied_discount_pct 는 할인율 → 원가 대비 절약 = 액면 * pct/(100-pct).
  const heroTotal = unusedItems.reduce((s, v) => s + (v.applied_price ?? v.product_price ?? 0), 0)
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
        <div className="sticky top-0 md:top-14 z-30 flex items-center gap-2 px-3 pt-3 pb-2"
          style={{ background: tk.chrome, borderBottom: `0.5px solid ${tk.separator}` }}>
          <button onClick={() => { setViewMode('list'); setMapSelected(null) }}
            className="w-9 h-9 flex items-center justify-center rounded-full" style={{ background: tk.fillSoft, color: tk.label }}
            aria-label={t('common.back', { defaultValue: '뒤로가기' })}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-[17px] font-bold tracking-tight text-gray-900 dark:text-white">{t('voucher.mapTitle', { defaultValue: '지도에서 보기' })}</h1>
        </div>
        <div className="relative">
          <Suspense fallback={<div className="flex items-center justify-center text-[15px] text-gray-500 dark:text-gray-400" style={{ height: 460 }}>{t('voucher.mapLoading', { defaultValue: '지도 불러오는 중...' })}</div>}>
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
            <div className="absolute left-0 right-0 bottom-3 overflow-x-auto scrollbar-hide">
              <div className="flex gap-3 px-3 snap-x snap-mandatory">
                {mapCarousel.map((v) => {
                  const d = (userLoc && v.restaurant_lat && v.restaurant_lng) ? haversineMeters(userLoc, { lat: v.restaurant_lat, lng: v.restaurant_lng }) : null
                  const selected = card?.id === v.id
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setMapSelected(v)}
                      className={`snap-start shrink-0 w-[80%] max-w-[300px] flex items-center gap-3 rounded-2xl bg-surface shadow-lift p-3 text-left transition-colors ${selected ? 'ring-2 ring-brand' : ''}`}
                      style={{ boxShadow: '0 8px 28px rgba(10,10,10,0.18)' }}
                    >
                      <div className="w-[52px] h-[52px] shrink-0 rounded-xl overflow-hidden flex items-center justify-center bg-brand-tint">
                        {v.product_image
                          ? <img src={cfImage(v.product_image, { width: 200, quality: 82, format: 'auto' }) || v.product_image} alt="" loading="lazy" className="w-full h-full object-cover" onError={(e) => cfImageOnError(e.currentTarget, v.product_image)} />
                          : <TicketStubIcon className="w-5 h-5 text-gray-300 dark:text-gray-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-bold tracking-tight text-gray-900 dark:text-white truncate">{v.product_name}</p>
                        <p className="text-[12px] text-gray-400 dark:text-gray-500 truncate mt-1">
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
                        className="shrink-0 flex items-center gap-2 rounded-xl px-4 py-2 bg-brand text-white text-[13px] font-bold active:scale-95 transition-transform"
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
        /* 🎫 2026-09-03 (대표 "내 이용권 문장 삭제"): 화면에서 제목 줄을 지운다.
           하단 탭 '이용권'이 이미 어디인지 말하고, 지갑의 주인공은 금액과 카드다.
           제목은 sr-only 로만 남아 문서 구조·보조기술 접근성은 유지된다. */
        hideTitle
        /* 🎫 2026-10-07 (대표 확정 A안 "정돈" — "이 페이지 자체가 못생겼어"): 금액을 여기서 **한 번만** 말한다.
           종전엔 '사용 가능' 이 요약·탭·칩·카드 띠에 네 번, 금액이 합계·카드에 두 번 나왔다.
           🎫 2026-10-08 (대표 "굳이 없어도 될 것 같아"): 그 A안이 남겨 둔 마지막 중복 — 금액 뒤 `· 3장` —
           도 걷었다. 바로 아래 탭 배지('사용 가능 3')가 같은 `unusedItems.length` 를 40px 안에서 또
           말하고 있었다. 장수는 이제 **탭 배지 한 곳**뿐이고, 머리글은 금액만 말한다. */
        eyebrow={t('voucher.walletEyebrow', { defaultValue: '쓸 수 있는 이용권' })}
        amount={shownVouchers.length > 0 ? heroTotal : null}
        unit={heroUnit}
      />


      <div className="ur-content-narrow px-4 lg:px-8 pb-2">
        {loading ? (
          <BrandLoader />
        ) : isError ? (
          /* 🛡️ 2026-07-02: 네트워크 실패를 "빈 지갑"으로 위장하지 않음 — 에러 + 재시도. */
          <div className="text-center py-16">
            <p className="text-[15px] font-bold text-gray-900 dark:text-white mb-1">{t('voucher.loadFailed', { defaultValue: '이용권을 불러오지 못했어요' })}</p>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-4">{t('common.checkNetworkRetry', { defaultValue: '네트워크 상태를 확인한 뒤 다시 시도해주세요' })}</p>
            <button
              onClick={() => refetch()}
              className="px-5 py-2 bg-brand text-white rounded-full text-[15px] font-bold"
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
            {/* 🎫 탭 — [사용 가능 N | 지난 이용권] + 오른쪽 '지도로 보기'(2026-10-07 A안). 칩 줄(전체·만료 임박·지도)은 걷었다:
                '전체 N' 은 탭이 이미 말하고, 만료가 가까운 순서는 목록 정렬이 이미 맡는다. */}
            <div className="flex items-end gap-5 mb-4 border-b border-rule">
              {([['unused', t('voucher.groupUnused', { defaultValue: '사용 가능' })], ['done', t('voucher.groupPast', { defaultValue: '지난 이용권' })]] as const).map(([key, label]) => (
                <button key={key} type="button" onClick={() => setTab(key)}
                  className={`relative pb-2 text-[17px] tracking-[-0.02em] ${tab === key ? 'font-extrabold text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 font-semibold'}`}>
                  {label}
                  {key === 'unused' && unusedItems.length > 0 && <span className="ml-1 text-[13px] font-bold text-brand-text tabular-nums">{unusedItems.length}</span>}
                  {tab === key && <span aria-hidden="true" className="absolute left-0 right-0 -bottom-px h-[2.5px] bg-brand" />}
                </button>
              ))}
              {tab === 'unused' && mapVouchers.length > 0 && (
                <button type="button" onClick={() => setViewMode('map')}
                  className="ml-auto pb-2 text-[13px] font-bold text-gray-600 dark:text-gray-300">
                  {t('voucher.mapViewLink', { defaultValue: '지도로 보기' })}
                </button>
              )}
            </div>

            {tab === 'unused' ? (
              (() => {
                const shown = unusedItems
                return shown.length > 0 ? (
                  /* 🎫 2026-09-15 (대표 확정 "안 E"): **가장 급한 한 장만 펴고 나머지는 한 줄씩**.
                     종전엔 가진 이용권을 전부 펼친 티켓으로 그려, 3장이면 스크롤 한 번이고 8장이면
                     "내가 뭘 갖고 있나" 를 훑는 데만 네 번을 내려야 했다. `unusedItems` 는 이미
                     **만료 가까운 순**으로 정렬돼 있어(윗쪽 sort) `shown[0]` 이 곧 '지금 쓸 것'이다.
                     ⚠️ 접기이지 삭제가 아니다 — 줄을 누르면 종전과 **같은 QR 모달**이 열린다. */
                  <div className="space-y-3">
                    <VoucherTicket key={shown[0].id} v={shown[0]} muted={false} locale={locale} t={t} onShowQr={() => setQrVoucher(shown[0])} />
                    {shown.length > 1 && (
                      <div className="overflow-hidden rounded-2xl bg-surface shadow-lift divide-y divide-rule">
                        {shown.slice(1).map(v => <WalletRow key={v.id} v={v} t={t} onOpen={() => setQrVoucher(v)} />)}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="py-8 text-center text-[13px] text-gray-400 dark:text-gray-500">{t('voucher.noUnused', { defaultValue: '사용 가능한 이용권이 없어요' })}</p>
                )
              })()
            ) : (
              [...usedItems, ...archivedItems].length > 0 ? (
                <div className="space-y-3">
                  {[...usedItems, ...archivedItems].map(v => <VoucherTicket key={v.id} v={v} muted locale={locale} t={t} onShowQr={() => setQrVoucher(v)} />)}
                </div>
              ) : (
                <p className="py-8 text-center text-[13px] text-gray-400 dark:text-gray-500">{t('voucher.noDone', { defaultValue: '사용한 이용권이 아직 없어요' })}</p>
              )
            )}
          </>
        )}
      </div>

      {/* QR Code Modal */}
      {qrVoucher && <QRModal voucher={qrVoucher} onClose={() => setQrVoucher(null)} />}

    </WalletPageWrapper>
  )
}

