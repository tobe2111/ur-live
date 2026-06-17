/**
 * 🛡️ 2026-06-01: 홈(교환권) 상단 "딜 모으는 법" 띠.
 *   교환권을 보다가 "딜이 부족한데?" → 크리에이터 활동으로 유도하는 바이럴 루프.
 *   정적(=fetch 0) 이라 즉시 렌더 — 홈 first-paint 영향 없음.
 *   각 카드는 실제 적립 경로(링크샵/매장영입/추천/충전)로 연결.
 */
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Link2, Store, UserPlus, Wallet } from 'lucide-react'
import { REFERRAL_GROUP_DISCOUNT_DISABLED } from '@/shared/feature-flags'

export default function DealEarnStrip() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  // 🛡️ 2026-06-04 (사용자 피드백 — 아이콘 촌스러움): 채도 높은 그라데이션 원형 →
  //   소프트 틴트 squircle + 라인 컬러 아이콘. 통일감 있는 모던 핀테크 톤.
  const items = [
    {
      icon: Link2,
      label: t('dealEarn.linkshop', { defaultValue: '링크샵 공유' }),
      desc: t('dealEarn.linkshopDesc', { defaultValue: '담고 공유하면 커미션 딜' }),
      to: '/user/profile',
      tint: 'bg-gray-100 text-gray-700 dark:bg-white/[0.08] dark:text-gray-200',
    },
    {
      icon: Store,
      label: t('dealEarn.recruit', { defaultValue: '매장 영입' }),
      desc: t('dealEarn.recruitDesc', { defaultValue: '매출마다 영입 커미션' }),
      to: '/seller/prospects',
      tint: 'bg-violet-50 text-violet-500 dark:bg-violet-500/12 dark:text-violet-400',
    },
    {
      icon: UserPlus,
      label: t('dealEarn.invite', { defaultValue: '친구 초대' }),
      desc: t('dealEarn.inviteDesc', { defaultValue: '초대하면 딜 보너스' }),
      // 🧭 2026-06-17: 그룹 referral 숨김 — 살아있는 초대보너스 카드(MyReferralCard)가 있는 /user/profile 로.
      to: REFERRAL_GROUP_DISCOUNT_DISABLED ? '/user/profile' : '/referral',
      tint: 'bg-sky-50 text-sky-500 dark:bg-sky-500/12 dark:text-sky-400',
    },
    {
      icon: Wallet,
      label: t('dealEarn.charge', { defaultValue: '딜 충전' }),
      desc: t('dealEarn.chargeDesc', { defaultValue: '1원 = 1딜' }),
      to: '/points/charge',
      tint: 'bg-amber-50 text-amber-500 dark:bg-amber-500/12 dark:text-amber-400',
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
        {items.map(({ icon: Icon, label, desc, to, tint }) => (
          <button
            key={label}
            type="button"
            onClick={() => navigate(to)}
            className="group flex flex-col items-center text-center gap-1.5 py-2 active:scale-[0.97] transition-transform"
          >
            <span className={`w-12 h-12 rounded-2xl ${tint} flex items-center justify-center transition-shadow group-hover:shadow-sm`}>
              <Icon className="w-[22px] h-[22px]" strokeWidth={2} />
            </span>
            <span className="text-[11px] font-semibold text-gray-900 dark:text-white leading-tight">{label}</span>
            <span className="text-[9px] text-gray-400 dark:text-gray-500 leading-tight hidden sm:block">{desc}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
