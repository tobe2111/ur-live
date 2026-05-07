import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import { ArrowLeft, Users, Clock, Gift, CheckCircle, ShoppingBag } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import KakaoShareButton from '@/components/KakaoShareButton'
import { formatNumber } from '@/utils/format'

interface Tier { count: number; discount: number }
interface Member { user_name: string; joined_at: string }
interface ReferralGroup {
  invite_code: string
  creator_name: string
  product_id: number
  current_count: number
  target_count: number
  discount_percent: number
  tiers: Tier[]
  unlocked_tier: Tier | null
  next_tier: Tier | null
  expires_at: string
  status: 'open' | 'achieved' | 'expired'
  members: Member[]
}

interface ProductInfo {
  id: number
  name: string
  price: number
  image_url?: string
}

/** 로그인 여부 판단 (localStorage) */
function useCurrentUserId(): string | null {
  const userType = typeof window !== 'undefined' ? localStorage.getItem('user_type') : null
  const userId = typeof window !== 'undefined' ? localStorage.getItem('user_id') : null
  if (userType === 'user' && userId) return userId
  return null
}

/** 카운트다운 훅 — 매초 업데이트 */
function useCountdown(targetDate: Date) {
  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, targetDate.getTime() - Date.now()))

  useEffect(() => {
    const timer = setInterval(() => {
      const diff = Math.max(0, targetDate.getTime() - Date.now())
      setTimeLeft(diff)
      if (diff <= 0) clearInterval(timer)
    }, 1000)
    return () => clearInterval(timer)
  }, [targetDate])

  const days = Math.floor(timeLeft / 86400000)
  const hours = Math.floor((timeLeft % 86400000) / 3600000)
  const minutes = Math.floor((timeLeft % 3600000) / 60000)
  const seconds = Math.floor((timeLeft % 60000) / 1000)

  return { days, hours, minutes, seconds, isExpired: timeLeft <= 0 }
}

export default function ReferralPage() {
  const { t } = useTranslation()
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const userId = useCurrentUserId()
  const [group, setGroup] = useState<ReferralGroup | null>(null)
  const [product, setProduct] = useState<ProductInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)

  const fetchGroup = async () => {
    if (!code) return
    try {
      const r = await api.get(`/api/referral/${code}`)
      if (r.data.success) {
        const g: ReferralGroup = r.data.data
        setGroup(g)
        // 상품 정보 조회
        if (g.product_id) {
          try {
            const p = await api.get(`/api/group-buy/products/${g.product_id}`)
            if (p.data.success) {
              const prod = p.data.data
              setProduct({
                id: prod.id,
                name: prod.name,
                price: prod.price,
                image_url: prod.image_url || prod.thumbnail_url,
              })
            }
          } catch {
            // 상품 조회 실패해도 페이지는 표시
          }
        }
      }
    } catch {
      toast.error(t('referralPage.inviteLinkInvalid'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchGroup() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [code])

  const handleJoin = async () => {
    if (!userId) {
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      navigate('/login')
      return
    }
    if (!code) return
    setJoining(true)
    try {
      const res = await api.post(`/api/referral/join/${code}`)
      if (res.data.success) {
        const d = res.data.data
        if (d.status === 'achieved') {
          toast.success(`목표 달성! ${d.discount_percent}% 할인 적용`)
        } else if (d.unlocked_tier) {
          toast.success(`${d.unlocked_tier.discount}% 할인 단계 달성!`)
        } else {
          toast.success(t('referralPage.joinSuccess'))
        }
        await fetchGroup()
      } else {
        toast.error(res.data.error || t('referralPage.joinFail'))
      }
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string }; status?: number } }
      toast.error(err_.response?.data?.error || t('referralPage.joinFail'))
    } finally {
      setJoining(false)
    }
  }

  const handleCheckout = () => {
    if (!group) return
    navigate(`/checkout?product_id=${group.product_id}&referral_code=${group.invite_code}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0A0A0A] flex flex-col items-center justify-center px-4">
        <Gift className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
        <p className="text-gray-900 dark:text-white font-bold text-lg">유효하지 않은 초대입니다</p>
        <Link to="/" className="mt-4 text-gray-900 dark:text-white text-sm font-medium underline">홈으로 돌아가기</Link>
      </div>
    )
  }

  const isAchieved = group.status === 'achieved'
  const isExpired = group.status === 'expired' || new Date(group.expires_at) < new Date()
  const isOpen = group.status === 'open' && !isExpired
  const alreadyJoined = !!userId && group.members.some(m => m.user_name)
    && group.members.some(m => {
      // user_name 기반 매칭 폴백 (정확한 판별은 서버 응답 참조)
      const currentName = localStorage.getItem('user_name') || ''
      return currentName && m.user_name === currentName
    })

  const topTier = group.tiers[group.tiers.length - 1]
  const currentDiscount = group.unlocked_tier?.discount ?? 0
  const discountedPrice = product
    ? Math.round(product.price * (100 - currentDiscount) / 100)
    : 0

  const shareTitle = product
    ? `🎁 ${product.name} 공동구매 같이 해요!`
    : `🎁 ${group.creator_name}님의 공동구매 같이 해요!`
  const shareDescription = `지금 ${group.current_count}/${group.target_count}명 모였어요. 친구 초대하면 최대 ${topTier?.discount ?? 0}% 할인!`

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#121212]">
      <SEO title={t('referralPage.seoTitle')} description={t('referralPage.seoDesc')} url="/referral" />
      {/* v4 Header */}
      <div className="sticky top-0 md:top-14 z-40 bg-white dark:bg-[#0A0A0A] border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="ur-content-narrow flex items-center justify-between px-3 lg:px-8 py-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-900 dark:text-white" />
          </button>
          <h1 className="text-[16px] font-extrabold text-gray-900 dark:text-white">공동구매</h1>
          <div className="w-9" />
        </div>
      </div>

      <div className="ur-content-narrow px-4 lg:px-8 py-4 space-y-3 pb-32" style={{ background: '#F9FAFB', minHeight: 'calc(100dvh - 48px)' }}>
        {/* 1. Hero Header — 상품 + 크리에이터 + 카운트다운 */}
        <section className="bg-white dark:bg-[#0A0A0A] rounded-2xl p-4 border border-gray-200 dark:border-[#2A2A2A]">
          {product && (
            <div className="flex gap-3 mb-4">
              {product.image_url && (
                <img src={product.image_url} alt="" className="w-20 h-20 rounded-xl object-cover shrink-0 border border-gray-100 dark:border-[#1A1A1A]" loading="lazy" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-gray-900 dark:text-white line-clamp-2">{product.name}</p>
                <div className="mt-1.5 flex items-baseline gap-2">
                  {currentDiscount > 0 ? (
                    <>
                      <span className="text-lg font-bold text-pink-500">{formatNumber(discountedPrice)}원</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 line-through">{formatNumber(product.price)}원</span>
                    </>
                  ) : (
                    <span className="text-lg font-bold text-gray-900 dark:text-white">{formatNumber(product.price)}원</span>
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 pb-3 border-b border-gray-100 dark:border-[#1A1A1A]">
            <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-bold">
              {group.creator_name.slice(0, 1)}
            </div>
            <p className="text-sm text-gray-900 dark:text-white">
              <span className="font-bold">{group.creator_name}</span>
              <span className="text-gray-600 dark:text-gray-300">님의 공동구매</span>
            </p>
          </div>

          {/* 카운트다운 */}
          <div className="pt-3">
            {isExpired ? (
              <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
                <Clock className="w-4 h-4" />
                <span>마감된 공동구매입니다</span>
              </div>
            ) : isAchieved ? (
              <div className="flex items-center justify-center gap-2 text-green-600 text-sm font-semibold">
                <CheckCircle className="w-4 h-4" />
                <span>목표 달성! 결제가 가능합니다</span>
              </div>
            ) : (
              <CountdownTimer expiresAt={group.expires_at} />
            )}
          </div>
        </section>

        {/* 2. Tier Progress Bar */}
        <section className="bg-white dark:bg-[#0A0A0A] rounded-2xl p-5 border border-gray-200 dark:border-[#2A2A2A]">
          {/* 현재 할인 표시 */}
          <div className="text-center mb-5">
            {currentDiscount > 0 ? (
              <>
                <p className="text-xs text-gray-600 dark:text-gray-300 mb-1">현재 적용 할인</p>
                <p className="text-3xl font-bold text-pink-500">{currentDiscount}% 할인 적용 중!</p>
              </>
            ) : (
              <>
                <p className="text-xs text-gray-600 dark:text-gray-300 mb-1">현재 참여 인원</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{group.current_count}명</p>
              </>
            )}
            {group.next_tier && (
              <p className="text-sm text-gray-700 dark:text-gray-200 mt-2">
                <span className="font-bold text-pink-500">{group.next_tier.count - group.current_count}명</span>
                <span> 더 모이면 </span>
                <span className="font-bold text-pink-500">{group.next_tier.discount}% 할인!</span>
              </p>
            )}
            {!group.next_tier && isAchieved && (
              <p className="text-sm text-green-600 mt-2 font-semibold">최대 할인 달성!</p>
            )}
          </div>

          {/* 티어 진행 바 */}
          <TierProgressBar
            tiers={group.tiers}
            currentCount={group.current_count}
            targetCount={group.target_count}
          />
        </section>

        {/* v4 Participants — 아바타 스택 + 최근 참여자 */}
        <section className="bg-white dark:bg-[#0A0A0A] rounded-2xl p-4 border border-gray-100 dark:border-[#1A1A1A]">
          <div className="flex items-center gap-1.5 mb-3">
            <Users className="w-3.5 h-3.5 text-gray-900 dark:text-white" />
            <p className="text-[13px] font-bold text-gray-900 dark:text-white">{group.current_count}명 참여 중</p>
          </div>
          {/* 아바타 스택 */}
          {group.members.length > 0 && (
            <div className="flex items-center flex-wrap -space-x-2 mb-3">
              {group.members.slice(0, 12).map((m, i) => {
                const colors = ['#FEE2E2','#FCE7F3','#DBEAFE','#D1FAE5','#FEF3C7','#EDE9FE'];
                return (
                  <div key={i} className="rounded-full border-2 border-white flex items-center justify-center relative"
                    style={{
                      width: 28, height: 28, zIndex: 20 - i,
                      background: i === 0 ? '#111827' : colors[i % colors.length],
                      color: i === 0 ? '#fff' : '#111827',
                      fontSize: 10, fontWeight: 700,
                    }}>
                    {(m.user_name || '?').slice(0, 1)}
                  </div>
                );
              })}
              {group.members.length > 12 && (
                <div className="rounded-full flex items-center justify-center ml-1"
                  style={{ width: 28, height: 28, background: '#F3F4F6', color: '#6B7280', fontSize: 9, fontWeight: 700 }}>
                  +{group.members.length - 12}
                </div>
              )}
            </div>
          )}
          {/* 최근 참여자 */}
          <div className="space-y-2">
            {group.members.slice(0, 3).map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: '#FCE7F3', color: '#BE185D', fontSize: 10, fontWeight: 700 }}>
                  {(m.user_name || '?').slice(0, 1)}
                </div>
                <span className="text-[12px] text-gray-900 dark:text-white font-medium">{m.user_name}</span>
                {i === 0 && <span className="rounded-full px-1.5 py-0.5 bg-gray-900 text-white text-[9px] font-bold">방장</span>}
                <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto">
                  {m.joined_at ? new Date(m.joined_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : ''}
                </span>
              </div>
            ))}
            {group.members.length === 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">아직 참여자가 없습니다.</p>
            )}
          </div>
        </section>

        {/* v4 티어별 할인표 */}
        <section className="bg-white dark:bg-[#0A0A0A] rounded-2xl p-4 border border-gray-100 dark:border-[#1A1A1A]">
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-sm">🎁</span>
            <p className="text-[13px] font-bold text-gray-900 dark:text-white">티어별 할인</p>
          </div>
          <div className="space-y-1.5">
            {group.tiers.map((t, i) => {
              const reached = group.current_count >= t.count
              return (
                <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2"
                  style={{ background: reached ? '#FDF2F8' : '#F9FAFB' }}>
                  <span style={{ fontSize: 12, color: reached ? '#BE185D' : '#6B7280', fontWeight: reached ? 700 : 500 }}>
                    {t.count}명 모이면
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: reached ? '#BE185D' : '#9CA3AF' }}>
                    {t.discount}% 할인{reached ? ' ✓' : ''}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {/* 4. Action Buttons (fixed bottom) */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white dark:bg-[#0A0A0A] border-t border-gray-200 dark:border-[#2A2A2A] p-4 safe-area-bottom">
        <div className="max-w-md mx-auto">
          {isAchieved ? (
            <button
              onClick={handleCheckout}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-gray-900 text-white rounded-xl font-bold text-sm active:scale-[0.98]"
            >
              <ShoppingBag className="w-4 h-4" />
              {product
                ? `${formatNumber(discountedPrice)}원에 결제하기 (${currentDiscount}% 할인)`
                : t('referralPage.checkout')}
            </button>
          ) : isExpired ? (
            <button
              disabled
              className="w-full py-3.5 bg-gray-200 dark:bg-[#2A2A2A] text-gray-500 dark:text-gray-400 rounded-xl font-bold text-sm cursor-not-allowed"
            >
              마감된 공동구매
            </button>
          ) : alreadyJoined ? (
            <KakaoShareButton
              title={shareTitle}
              description={shareDescription}
              imageUrl={product?.image_url}
              link={`/referral/${group.invite_code}`}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#FEE500] text-[#3C1E1E] rounded-xl font-bold text-sm active:scale-[0.98]"
            />
          ) : !userId ? (
            <button
              onClick={handleJoin}
              className="w-full py-3.5 bg-gray-900 text-white rounded-xl font-bold text-sm active:scale-[0.98]"
            >
              로그인 후 참여하기
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleJoin}
                disabled={joining}
                className="flex-1 py-3.5 bg-gray-900 text-white rounded-xl font-bold text-sm active:scale-[0.98] disabled:opacity-50"
              >
                {joining ? t('referralPage.joining') : t('referralPage.join')}
              </button>
              <div className="shrink-0">
                <KakaoShareButton
                  title={shareTitle}
                  description={shareDescription}
                  imageUrl={product?.image_url}
                  link={`/referral/${group.invite_code}`}
                  compact
                  className="h-full px-4 flex items-center gap-1.5 bg-[#FEE500] text-[#3C1E1E] rounded-xl text-sm font-bold active:scale-95"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** 티어 진행 바 — 마일스톤 시각화 */
function TierProgressBar({
  tiers,
  currentCount,
  targetCount,
}: {
  tiers: Tier[]
  currentCount: number
  targetCount: number
}) {
  if (!tiers || tiers.length === 0) return null

  const maxCount = Math.max(targetCount, tiers[tiers.length - 1].count)
  const progressPct = Math.min(100, (currentCount / maxCount) * 100)

  return (
    <div className="relative pt-2 pb-10">
      {/* v4 트랙 */}
      <div className="relative rounded-full" style={{ height: 8, background: '#F3F4F6' }}>
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, #F472B6, #EC4899)' }}
        />

        {/* 티어 마커 */}
        {tiers.map((t, i) => {
          const pct = Math.min(100, (t.count / maxCount) * 100)
          const reached = currentCount >= t.count
          return (
            <div
              key={i}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
              style={{ left: `${pct}%` }}
            >
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  reached
                    ? 'bg-pink-500 border-pink-500 shadow-md shadow-pink-200'
                    : 'bg-white dark:bg-[#0A0A0A] border-gray-300 dark:border-[#3A3A3A]'
                }`}
              >
                {reached && <CheckCircle className="w-3 h-3 text-white" />}
              </div>
              {/* 라벨 */}
              <div className="absolute top-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-center">
                <div className={`text-[10px] font-bold ${reached ? 'text-pink-600' : 'text-gray-500 dark:text-gray-400'}`}>
                  {t.count}명
                </div>
                <div className={`text-[10px] font-bold ${reached ? 'text-pink-600' : 'text-gray-400 dark:text-gray-500'}`}>
                  -{t.discount}%
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** 실시간 카운트다운 (days:hours:minutes:seconds) */
function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const { t } = useTranslation()
  const { days, hours, minutes, seconds, isExpired } = useCountdown(new Date(expiresAt))
  if (isExpired) return null

  return (
    <div className="pt-4 text-center">
      <p className="text-[11px] text-pink-500 font-bold mb-2">⏰ {t('referralPage.timeRemaining')}</p>
      <div className="flex items-center justify-center gap-1.5">
        {[
          { v: days, l: t('referralPage.unitDays') },
          { v: hours, l: t('referralPage.unitHours') },
          { v: minutes, l: t('referralPage.unitMinutes') },
          { v: seconds, l: t('referralPage.unitSeconds') },
        ].filter((t, i) => i > 0 || t.v > 0).map((t, i, arr) => (
          <span key={t.l} className="contents">
            <div className="rounded-lg px-2.5 py-1.5 bg-pink-50">
              <span className="text-[16px] font-extrabold text-pink-700" style={{ fontFamily: 'ui-monospace, monospace' }}>
                {String(t.v).padStart(2, '0')}
              </span>
              <span className="text-[9px] block leading-none mt-0.5 text-pink-700">{t.l}</span>
            </div>
            {i < arr.length - 1 && <span className="text-[14px] text-gray-300 dark:text-gray-600 font-extrabold">:</span>}
          </span>
        ))}
      </div>
    </div>
  )
}

