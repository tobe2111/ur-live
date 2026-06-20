import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { QRCodeSVG } from 'qrcode.react'
import { Home, Ticket, MapPin, Wallet, User, ChevronRight, Smartphone } from 'lucide-react'
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

          <div className={`${cardCls} p-4`}>
            <div className="flex items-center gap-1.5 mb-3">
              <Smartphone className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
              <p className="text-[11px] font-bold tracking-wide text-gray-500 dark:text-gray-400">
                {t('frameRails.openMobile', { defaultValue: '모바일로 보기' })}
              </p>
            </div>
            <div className="rounded-xl bg-white dark:bg-white p-3 flex items-center justify-center">
              {url ? (
                <QRCodeSVG value={url} size={132} fgColor="#0A0A0A" bgColor="#ffffff" level="M" />
              ) : (
                <div className="w-[132px] h-[132px]" />
              )}
            </div>
            <p className="mt-2.5 text-[11px] text-center text-gray-500 dark:text-gray-400">
              {t('frameRails.scan', { defaultValue: '카메라로 스캔하세요' })}
            </p>
          </div>
        </div>
      </aside>

      {/* RIGHT — 바로가기 */}
      <aside
        className="hidden xl:flex fixed top-0 bottom-0 z-30 flex-col justify-center gap-4 pointer-events-none"
        style={rightStyle}
      >
        <div className="pointer-events-auto flex flex-col gap-4">
          <div className={`${cardCls} p-2`}>
            <p className="px-3.5 pt-2 pb-1 text-[11px] font-bold tracking-wide text-gray-500 dark:text-gray-400">
              {t('frameRails.quicklinks', { defaultValue: '바로가기' })}
            </p>
            <QuickLink icon={Home} label={t('nav.home', { defaultValue: '홈' })} onClick={() => navigate('/')} />
            <QuickLink icon={Ticket} label={t('nav.vouchers', { defaultValue: '교환권' })} onClick={() => navigate('/vouchers')} />
            <QuickLink icon={MapPin} label={t('nav.dongnedeal', { defaultValue: '동네딜' })} onClick={() => navigate('/group-buy')} />
            <QuickLink icon={Wallet} label={t('myVouchers.title', { defaultValue: '내 지갑' })} onClick={() => navigate('/my-vouchers')} />
            <QuickLink icon={User} label={t('nav.mypage', { defaultValue: '마이' })} onClick={() => navigate('/user/profile')} />
          </div>

          <button
            onClick={() => navigate('/group-buy')}
            className="pointer-events-auto w-full rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-3.5 text-[13px] font-bold hover:opacity-90 transition-opacity shadow-sm"
          >
            {t('frameRails.exploreDeals', { defaultValue: '전체 동네딜 둘러보기 →' })}
          </button>
        </div>
      </aside>
    </>
  )
}
