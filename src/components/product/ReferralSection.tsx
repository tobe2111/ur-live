import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Clock, ChevronRight, Gift } from 'lucide-react'
import api from '@/lib/api'
import { parseTiers, formatTimeRemaining } from '@/components/product/product-detail-helpers'
import type { ActiveGroup } from '@/components/product/product-detail-types'

export function ReferralSection({
  productId,
  productTiers,
  isLoggedIn,
  showToast,
}: {
  productId: number | string
  productTiers?: unknown
  isLoggedIn: boolean
  showToast: (message: string, type?: 'success' | 'error') => void
}) {
  const navigate = useNavigate()
  const [groups, setGroups] = useState<ActiveGroup[]>([])
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [creating, setCreating] = useState(false)

  const tiers = parseTiers(productTiers)

  useEffect(() => {
    let cancelled = false
    setLoadingGroups(true)
    api.get(`/api/referral/product/${productId}`)
      .then(r => {
        if (cancelled) return
        if (r.data.success) setGroups((r.data.data || []) as ActiveGroup[])
      })
      .catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
      .finally(() => { if (!cancelled) setLoadingGroups(false) })
    return () => { cancelled = true }
  }, [productId])

  const handleCreate = async () => {
    if (!isLoggedIn) {
      showToast('로그인 후 시작할 수 있습니다.', 'error')
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      navigate('/login')
      return
    }
    setCreating(true)
    try {
      const maxTier = tiers[tiers.length - 1]
      const res = await api.post('/api/referral/create', {
        product_id: Number(productId),
        target_count: maxTier.count,
        discount_percent: maxTier.discount,
        tiers,
      })
      if (res.data.success) {
        navigate(`/referral/${res.data.data.invite_code}`)
      } else {
        showToast(res.data.error || '공동구매 생성에 실패했습니다.', 'error')
      }
    } catch (err: unknown) {
      const _err = err as { message?: string };
      const msg = err instanceof Error ? err.message : '공동구매 생성에 실패했습니다.'
      showToast(msg, 'error')
    } finally {
      setCreating(false)
    }
  }

  const tierPreview = tiers.map(t => `${t.count}명: ${t.discount}%할인`).join(' → ')

  return (
    <div className="mx-4 mb-3 bg-white rounded-xl border border-gray-200 p-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-1.5">
        <Gift className="w-4 h-4 text-gray-900" />
        <h3 className="text-sm font-bold text-gray-900">공동구매로 더 싸게</h3>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed mb-3">
        친구를 초대할수록 더 큰 할인! 모집 인원에 따라 단계별 할인이 적용됩니다.
      </p>

      {/* 티어 미리보기 */}
      <div className="mb-3 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5">
        <p className="text-[11px] text-gray-500 mb-1">할인 단계</p>
        <p className="text-xs font-semibold text-gray-900 leading-snug break-keep">
          {tierPreview}
        </p>
      </div>

      {/* 시작 버튼 */}
      <button
        onClick={handleCreate}
        disabled={creating}
        className="w-full py-3 bg-gray-900 text-white text-sm font-bold rounded-xl active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        <Users className="w-4 h-4" />
        {creating ? '생성 중...' : '공동구매 시작하기'}
      </button>

      {/* 진행 중인 그룹 */}
      {loadingGroups ? (
        <div className="mt-3 space-y-2">
          <div className="h-14 rounded-lg bg-gray-50 animate-pulse" />
        </div>
      ) : groups.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-900 mb-2">진행 중인 공동구매</p>
          <div className="space-y-2">
            {groups.map((g) => {
              const progress = g.target_count > 0 ? (g.current_count / g.target_count) * 100 : 0
              const unlockedDiscount = g.unlocked_tier?.discount ?? 0
              const timeLeft = formatTimeRemaining(g.expires_at)
              return (
                <button
                  key={g.invite_code}
                  onClick={() => navigate(`/referral/${g.invite_code}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white text-left hover:bg-gray-50 active:scale-[0.99] transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <p className="text-xs font-semibold text-gray-900 truncate">
                        {g.creator_name}님의 공동구매
                      </p>
                      {unlockedDiscount > 0 && (
                        <span className="text-[10px] font-bold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded">
                          {unlockedDiscount}% 할인 중
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mb-1.5 text-[11px] text-gray-500">
                      <Users className="w-3 h-3" />
                      <span>{g.current_count}/{g.target_count}명</span>
                      {timeLeft && (
                        <>
                          <span className="text-gray-300">·</span>
                          <Clock className="w-3 h-3" />
                          <span>{timeLeft}</span>
                        </>
                      )}
                    </div>
                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gray-900 rounded-full transition-all"
                        style={{ width: `${Math.min(100, progress)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 shrink-0">
                    <span className="text-[11px] font-bold text-gray-900">참여</span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
