/**
 * 🛡️ 2026-06-01: 홈(교환권) 상단 "딜 모으는 법" 띠.
 *   교환권을 보다가 "딜이 부족한데?" → 크리에이터 활동으로 유도하는 바이럴 루프.
 *   정적(=fetch 0) 이라 즉시 렌더 — 홈 first-paint 영향 없음.
 *   각 카드는 실제 적립 경로(링크샵/매장영입/추천/충전)로 연결.
 */
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Link2, Store, UserPlus, Wallet } from 'lucide-react'

export default function DealEarnStrip() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const items = [
    {
      icon: Link2,
      label: t('dealEarn.linkshop', { defaultValue: '링크샵 공유' }),
      desc: t('dealEarn.linkshopDesc', { defaultValue: '담고 공유하면 커미션 딜' }),
      to: '/user/profile',
      cls: 'from-pink-500 to-rose-500',
    },
    {
      icon: Store,
      label: t('dealEarn.recruit', { defaultValue: '매장 영입' }),
      desc: t('dealEarn.recruitDesc', { defaultValue: '매출마다 영입 커미션' }),
      to: '/seller/prospects',
      cls: 'from-violet-500 to-purple-500',
    },
    {
      icon: UserPlus,
      label: t('dealEarn.invite', { defaultValue: '친구 초대' }),
      desc: t('dealEarn.inviteDesc', { defaultValue: '초대하면 딜 보너스' }),
      to: '/referral',
      cls: 'from-sky-500 to-blue-500',
    },
    {
      icon: Wallet,
      label: t('dealEarn.charge', { defaultValue: '딜 충전' }),
      desc: t('dealEarn.chargeDesc', { defaultValue: '1원 = 1딜' }),
      to: '/points/charge',
      cls: 'from-amber-500 to-orange-500',
    },
  ]

  return (
    <section className="ur-content-wide px-4 lg:px-8 pt-3 pb-1">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">
          💰 {t('dealEarn.title', { defaultValue: '딜 모으는 법' })}
        </h2>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">
          {t('dealEarn.subtitle', { defaultValue: '모아서 교환권으로 바꾸세요' })}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {items.map(({ icon: Icon, label, desc, to, cls }) => (
          <button
            key={label}
            type="button"
            onClick={() => navigate(to)}
            className="flex flex-col items-center text-center gap-1.5 p-2 rounded-2xl bg-gray-50 dark:bg-[#141414] active:scale-[0.97] transition-transform"
          >
            <span className={`w-10 h-10 rounded-full bg-gradient-to-br ${cls} flex items-center justify-center`}>
              <Icon className="w-5 h-5 text-white" />
            </span>
            <span className="text-[11px] font-semibold text-gray-900 dark:text-white leading-tight">{label}</span>
            <span className="text-[9px] text-gray-400 dark:text-gray-500 leading-tight hidden sm:block">{desc}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
