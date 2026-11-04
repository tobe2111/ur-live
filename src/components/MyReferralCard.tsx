/**
 * 🛡️ 2026-05-27 (P2 referral 완성): 마이페이지 친구 초대 카드.
 *
 * - 본인 고유 초대 링크 (?invite={userId}) — 복사 / 카카오 공유
 * - 초대 내역 + 획득 포인트 (GET /api/invite/my)
 * - 첫 구매 시 초대자 보너스 (platform_settings.invite_reward_amount, 기본 1,000원)
 *
 * 기존 invite-reward API 활용 (이미 존재). UI 만 신규.
 */

import { useEffect, useState } from 'react'
import { GiftBoxIcon, PeopleIcon, OkIcon } from '@/components/icons/urdeal-icons'
import { useTranslation } from '@/lib/i18n-lite'
import { Copy } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import KakaoShareButton from '@/components/KakaoShareButton'
const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다 — 공유 모듈로 빼면 묶음기가 화면마다 청크를 하나 더 만든다(2026-11-02 실측)
injectMotionCss('ur-m-popin', `@keyframes ur-popin { 0% { opacity: 0; transform: scale(.5); } 70% { opacity: 1; transform: scale(1.1); } 100% { opacity: 1; transform: none; } }.ur-popin { animation: ur-popin .4s cubic-bezier(.3,1.3,.5,1) both; }@media (prefers-reduced-motion: reduce){.ur-popin{animation:none!important}}`)

interface InviteReward {
  id: number
  invited_user_id: string
  reward_amount: number
  status: string
  created_at: string
}

export default function MyReferralCard() {
  const { t } = useTranslation()
  const [rewards, setRewards] = useState<InviteReward[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [rewardAmount, setRewardAmount] = useState(1000)

  const myUserId = (() => {
    try { return localStorage.getItem('user_id') } catch { return null }
  })()
  const inviteUrl = myUserId
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://urdeal.kr'}/?invite=${myUserId}`
    : ''

  useEffect(() => {
    api.get('/api/invite/my')
      .then(r => {
        if (r.data?.success) {
          setRewards(r.data.data?.rewards || r.data.rewards || [])
          setTotal(r.data.data?.total ?? r.data.total ?? 0)
          if (r.data.data?.reward_amount) setRewardAmount(r.data.data.reward_amount)
        }
      })
      .catch(() => { /* graceful */ })
      .finally(() => setLoading(false))
  }, [])

  // 🎬 2026-11-02 시안 5차 "링크 복사됨": 알림 대신 버튼이 2초 동안 체크 + "복사됨" 으로 바뀐다.
  const [copied, setCopied] = useState(false)
  async function copyLink() {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch { toast.error(t('common.copyFailed', { defaultValue: '복사하지 못했어요' })) }
  }

  if (loading || !myUserId) return null

  const grantedCount = rewards.filter(r => r.status === 'granted').length
  const pendingCount = rewards.filter(r => r.status !== 'granted').length

  return (
    <div className="rounded-2xl p-5 mt-3 bg-gray-100 dark:bg-white/[0.04] border border-line">
      <div className="flex items-center gap-2 mb-3">
        <GiftBoxIcon className="w-5 h-5 text-gray-700 dark:text-white" />
        <h3 className="text-[15px] font-bold text-gray-900 dark:text-white">{t('inviteCard.title', { defaultValue: '친구 초대' })}</h3>
      </div>

      <p className="text-[15px] text-gray-600 dark:text-gray-300 leading-relaxed mb-3">
        친구가 내 링크로 가입하고 <strong className="text-gray-900 dark:text-white">첫 구매</strong> 하면
        <strong className="text-gray-900 dark:text-white"> {formatNumber(rewardAmount)}딜</strong> 적립!
      </p>

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-surface rounded-xl px-3 py-2 text-center">
          <p className="text-[12px] text-gray-500 dark:text-gray-400">{t('inviteCard.statEarned', { defaultValue: '획득 딜' })}</p>
          <p className="text-[15px] font-bold text-gray-900 dark:text-white">{formatNumber(total)}</p>
        </div>
        <div className="bg-surface rounded-xl px-3 py-2 text-center">
          <p className="text-[12px] text-gray-500 dark:text-gray-400">{t('inviteCard.statDone', { defaultValue: '완료' })}</p>
          <p className="text-[15px] font-bold text-gray-900 dark:text-white">{grantedCount}</p>
        </div>
        <div className="bg-surface rounded-xl px-3 py-2 text-center">
          <p className="text-[12px] text-gray-500 dark:text-gray-400">{t('inviteCard.statPending', { defaultValue: '대기' })}</p>
          <p className="text-[15px] font-bold text-gray-400">{pendingCount}</p>
        </div>
      </div>

      {/* 초대 링크 복사 */}
      <div className="flex gap-2">
        <div className="flex-1 bg-surface rounded-xl px-3 py-2 text-[12px] text-gray-500 dark:text-gray-400 truncate flex items-center">
          {inviteUrl}
        </div>
        <button
          onClick={copyLink}
          className="px-4 py-2 bg-brand hover:bg-brand-dark text-white rounded-xl text-[15px] font-bold flex items-center gap-2 active:scale-95"
        >
          {copied
            ? <span key="ok" className="ur-popin inline-flex items-center gap-2" aria-live="polite"><OkIcon className="w-4 h-4" /> {t('inviteCard.copied', { defaultValue: '복사됨' })}</span>
            : <><Copy className="w-4 h-4" /> {t('inviteCard.copy', { defaultValue: '복사' })}</>}
        </button>
      </div>
      {/* 💬 2026-11-04 대표 *"share card 로 공유가 안 되고 있는 것들 … share card 형태로"* — 복사만 있던 친구 초대에 버튼 달린 카톡 카드. */}
      <div className="mt-2">
        <KakaoShareButton
          title={t('inviteCard.shareTitle', { defaultValue: '유어딜 초대장이 도착했어요' })}
          description={t('inviteCard.shareDesc', { defaultValue: '가입하고 첫 구매하면 딜을 드려요. 할인 이용권·교환권을 동네에서 바로 써 보세요.' })}
          link={(() => { try { const u = new URL(inviteUrl); return u.pathname + u.search } catch { return '/' } })()}
          buttonText={t('inviteCard.shareBtn', { defaultValue: '초대 받기' })}
        />
      </div>

      {rewards.length > 0 && (
        <div className="mt-3 pt-3 border-t border-line">
          <p className="text-[12px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-1">
            <PeopleIcon className="w-3 h-3" /> {t('inviteCard.recent', { defaultValue: '최근 초대' })} ({rewards.length})
          </p>
          <div className="space-y-1">
            {rewards.slice(0, 3).map(r => (
              <div key={r.id} className="flex items-center justify-between text-[12px]">
                <span className="text-gray-600 dark:text-gray-300">{t('inviteCard.friend', { defaultValue: '친구' })} #{r.invited_user_id.slice(-4)}</span>
                <span className={r.status === 'granted' ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-400'}>
                  {r.status === 'granted' ? `+${formatNumber(r.reward_amount)}딜` : t('inviteCard.waitingPurchase', { defaultValue: '구매 대기' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
