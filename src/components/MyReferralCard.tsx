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
import { Gift, Copy, Users } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'

interface InviteReward {
  id: number
  invited_user_id: string
  reward_amount: number
  status: string
  created_at: string
}

export default function MyReferralCard() {
  const [rewards, setRewards] = useState<InviteReward[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [rewardAmount, setRewardAmount] = useState(1000)

  const myUserId = (() => {
    try { return localStorage.getItem('user_id') } catch { return null }
  })()
  const inviteUrl = myUserId
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://live.ur-team.com'}/?invite=${myUserId}`
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

  async function copyLink() {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      toast.success('초대 링크 복사됨')
    } catch { /* ignore */ }
  }

  if (loading || !myUserId) return null

  const grantedCount = rewards.filter(r => r.status === 'granted').length
  const pendingCount = rewards.filter(r => r.status !== 'granted').length

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-50 dark:from-[#1A1015] dark:to-[#150F12] border border-pink-200 dark:border-[#2A1A20] rounded-2xl p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Gift className="w-5 h-5 text-pink-500" />
        <h3 className="text-base font-extrabold text-gray-900 dark:text-white">친구 초대</h3>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-3">
        친구가 내 링크로 가입하고 <strong className="text-pink-600">첫 구매</strong> 하면
        <strong className="text-pink-600"> {formatNumber(rewardAmount)}딜</strong> 적립!
      </p>

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-white dark:bg-[#0A0A0A] rounded-xl px-3 py-2 text-center">
          <p className="text-[10px] text-gray-500 dark:text-gray-400">획득 딜</p>
          <p className="text-base font-extrabold text-pink-600">{formatNumber(total)}</p>
        </div>
        <div className="bg-white dark:bg-[#0A0A0A] rounded-xl px-3 py-2 text-center">
          <p className="text-[10px] text-gray-500 dark:text-gray-400">완료</p>
          <p className="text-base font-extrabold text-gray-900 dark:text-white">{grantedCount}</p>
        </div>
        <div className="bg-white dark:bg-[#0A0A0A] rounded-xl px-3 py-2 text-center">
          <p className="text-[10px] text-gray-500 dark:text-gray-400">대기</p>
          <p className="text-base font-extrabold text-gray-400">{pendingCount}</p>
        </div>
      </div>

      {/* 초대 링크 복사 */}
      <div className="flex gap-2">
        <div className="flex-1 bg-white dark:bg-[#0A0A0A] rounded-xl px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 truncate flex items-center">
          {inviteUrl}
        </div>
        <button
          onClick={copyLink}
          className="px-4 py-2.5 bg-pink-500 hover:bg-pink-600 text-white rounded-xl text-sm font-bold flex items-center gap-1.5 active:scale-95"
        >
          <Copy className="w-4 h-4" /> 복사
        </button>
      </div>

      {rewards.length > 0 && (
        <div className="mt-3 pt-3 border-t border-pink-100 dark:border-[#2A1A20]">
          <p className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-1">
            <Users className="w-3 h-3" /> 최근 초대 ({rewards.length})
          </p>
          <div className="space-y-1">
            {rewards.slice(0, 3).map(r => (
              <div key={r.id} className="flex items-center justify-between text-[11px]">
                <span className="text-gray-600 dark:text-gray-300">친구 #{r.invited_user_id.slice(-4)}</span>
                <span className={r.status === 'granted' ? 'text-pink-600 font-bold' : 'text-gray-400'}>
                  {r.status === 'granted' ? `+${formatNumber(r.reward_amount)}딜` : '구매 대기'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
