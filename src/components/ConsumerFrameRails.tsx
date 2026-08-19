import { useEffect, useState, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
// 🟢 2026-07-13 [UNLOCK_LOADING]: qrcode.react static → lazy (LinkshopVisitorRails 와 동일 패턴).
//   이 static import 때문에 route-chunk-map 이 홈 표면 폐쇄에 `codes`(qrcode/barcode 18KB) 를 포함 →
//   홈 modulepreload 에 딸려옴(PC 는 거터 QR 렌더, 모바일은 안 쓰는데도 preload). QR 은 장식용 모바일-앱
//   다운로드 코드라 첫 페인트 비필수 → lazy 로 빼 홈 첫 페인트 preload 에서 18KB 제거.
const QRCodeSVG = lazy(() => import('qrcode.react').then(m => ({ default: m.QRCodeSVG })))
import { Home, Gift, Ticket, Sparkles, User, ChevronRight, Smartphone, MapPin, ShieldCheck, Percent, Store } from 'lucide-react'
import UrDealLogo from '@/components/brand/UrDealLogo'

/**
 * 🖥️ 2026-06-20 (대표 시안 — 에버랜드 PC): 컨슈머 PC 액자(app-framed) 양옆 거터를 비우지 않고
 *   브랜드/QR/바로가기 레일로 채운다. 흑백(모노) 톤 — 직전 B&W 전환과 정합.
 *   xl(≥1280) 에서만 표시(거터 폭 충분할 때). 위치는 프레임(430) 중심 기준 calc 로 고정.
 *   주의: 순수 장식/네비 — 라우팅/인증 로직 없음. SSR 안전(QR 은 mount 후 url 채움).
 */

const FRAME_HALF = 215 // 430 / 2
const GAP = 24
const RAIL_W = 264
// 레일이 프레임에 닿지 않도록 프레임 가장자리에서 GAP 만큼 띄움.
const leftStyle = { right: `calc(50% + ${FRAME_HALF + GAP}px)`, width: `${RAIL_W}px` }
const rightStyle = { left: `calc(50% + ${FRAME_HALF + GAP}px)`, width: `${RAIL_W}px` }

const cardCls =
  'rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] backdrop-blur-sm shadow-sm'

function QuickLink({ icon: Icon, label, onClick }: { icon: typeof Home; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors text-left"
    >
      <Icon className="w-[18px] h-[18px] text-gray-700 dark:text-gray-300 shrink-0" aria-hidden="true" />
      <span className="flex-1 text-[13px] font-semibold text-gray-900 dark:text-white">{label}</span>
      <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" aria-hidden="true" />
    </button>
  )
}

export default function ConsumerFrameRails() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (typeof window !== 'undefined') setUrl(window.location.href)
  }, [])

  return (
    <>
      {/* LEFT — 브랜드 + 모바일 QR */}
      <aside
        className="hidden xl:flex fixed top-0 bottom-0 z-30 flex-col justify-center gap-4 pointer-events-none"
        style={leftStyle}
        aria-hidden="true"
      >
        <div className="pointer-events-auto flex flex-col gap-4">
          <div className="px-1">
            <UrDealLogo size={22} />
            <p className="mt-2 text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">
              {t('frameRails.tagline', { defaultValue: '내 손안의 동네 딜 — 교환권 · 동네공구' })}
            </p>
          </div>

          {/* 🎨 2026-07-07 (대표 — "PC 거터 휑함"): 큰 QR 하나만 있던 좌측을 브랜드 가치 3종 + 작은 QR 로 재구성. */}
          <div className={`${cardCls} p-3.5 space-y-2.5`}>
            {[
              { icon: ShieldCheck, title: t('frameRails.valTrust', { defaultValue: '유어딜 안전결제' }), desc: t('frameRails.valTrustDesc', { defaultValue: '결제·정산을 보증해요' }) },
              { icon: Percent, title: t('frameRails.valDeal', { defaultValue: '매일 새로운 동네 딜' }), desc: t('frameRails.valDealDesc', { defaultValue: '할인가로 발견·구매' }) },
              { icon: Store, title: t('frameRails.valShop', { defaultValue: '내 쇼핑몰, 링크샵' }), desc: t('frameRails.valShopDesc', { defaultValue: '누구나 5분이면 오픈' }) },
            ].map((v) => (
              <div key={v.title} className="flex items-start gap-2.5">
                <span className="mt-0.5 w-7 h-7 shrink-0 rounded-lg bg-gray-900 dark:bg-white/10 text-white dark:text-white flex items-center justify-center">
                  <v.icon className="w-[15px] h-[15px]" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-bold text-gray-900 dark:text-white leading-tight">{v.title}</span>
                  <span className="block text-[11px] text-gray-500 dark:text-gray-400 leading-snug">{v.desc}</span>
                </span>
              </div>
            ))}
          </div>

          <div className={`${cardCls} p-3.5`}>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Smartphone className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
              <p className="text-[11px] font-bold tracking-wide text-gray-500 dark:text-gray-400">
                {t('frameRails.openMobile', { defaultValue: '모바일로 보기' })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-white dark:bg-white p-2 flex items-center justify-center shrink-0">
                {url ? (
                  <Suspense fallback={<div className="w-[84px] h-[84px]" />}>
                    <QRCodeSVG value={url} size={84} fgColor="#0F151D" bgColor="#ffffff" level="M" />
                  </Suspense>
                ) : (
                  <div className="w-[84px] h-[84px]" />
                )}
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                {t('frameRails.scanInline', { defaultValue: '카메라로 스캔하면 모바일에서 이어서 볼 수 있어요' })}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* RIGHT — 바로가기 */}
      <aside
        className="hidden xl:flex fixed top-0 bottom-0 z-30 flex-col justify-center gap-4 pointer-events-none"
        style={rightStyle}
      >
        <div className="pointer-events-auto flex flex-col gap-4">
          {/* 🧭 2026-07-03 (대표 — 바로가기 업데이트): 하단 네비 정본 5탭과 통일
              (홈·쇼핑·이용권·링크샵·마이). 낡은 라벨(교환권/내 지갑)·중복 동네딜(→은퇴한 /group-buy) 제거. */}
          <div className={`${cardCls} p-2`}>
            <p className="px-3.5 pt-2 pb-1 text-[11px] font-bold tracking-wide text-gray-500 dark:text-gray-400">
              {t('frameRails.quicklinks', { defaultValue: '바로가기' })}
            </p>
            <QuickLink icon={Home} label={t('nav.home', { defaultValue: '홈' })} onClick={() => navigate('/')} />
            {/* 🏷️ 2026-08-17 (UX 전수검사 P2): 라벨 "쇼핑"은 잠정 숨김된 쇼핑탭 잔재 — 목적지(/vouchers)에
                맞는 정본 라벨 "교환권"(하단 네비 탭2와 동일 Gift 아이콘)으로 정정. */}
            <QuickLink icon={Gift} label={t('nav.vouchers', { defaultValue: '교환권' })} onClick={() => navigate('/vouchers')} />
            <QuickLink icon={Ticket} label={t('nav.myGbVouchers', { defaultValue: '이용권' })} onClick={() => navigate('/my-vouchers')} />
            <QuickLink icon={Sparkles} label={t('nav.linkshop', { defaultValue: '링크샵' })} onClick={() => navigate('/u/me')} />
            <QuickLink icon={User} label={t('nav.my', { defaultValue: '마이' })} onClick={() => navigate('/user/profile')} />
          </div>

          {/* CTA: 홈이 곧 동네딜이라 '전체 동네딜'(은퇴)은 중복 → '지도로 동네딜 보기'로 (홈 목록과 상호보완). */}
          <button
            onClick={() => navigate('/map')}
            className="pointer-events-auto w-full flex items-center justify-center gap-1.5 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-3.5 text-[13px] font-bold hover:opacity-90 transition-opacity shadow-sm"
          >
            <MapPin className="w-4 h-4" aria-hidden="true" />
            {t('frameRails.exploreMap', { defaultValue: '지도로 동네딜 보기 →' })}
          </button>
        </div>
      </aside>
    </>
  )
}
