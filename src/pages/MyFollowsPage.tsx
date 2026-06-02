/**
 * 🛡️ 2026-05-15: 내 단골 셀러 + 알림 매트릭스 설정 페이지.
 *
 * URL: /my/follows
 *
 * 단골 등록한 셀러별로 알림 종류 토글:
 *   - 신상품 알림
 *   - 라이브 시작 알림
 *   - 공구 시작 알림
 *
 * 사용자 retention 핵심 — 셀러별 / 알림 종류별 세밀 컨트롤.
 */

import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Bell, BellOff, Loader2, Heart, ChevronRight } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import SEO from '@/components/SEO'
import {
  useMyFollows,
  useToggleFollowNotify,
  useUnfollowSeller,
  type FollowNotifyKey,
} from '@/hooks/queries/useMyFollows'

export default function MyFollowsPage() {
  const navigate = useNavigate()
  // 🛡️ 2026-06-01 Tier2: 수동 useState+useEffect+fetch → React Query 이전.
  //   재방문 시 캐시 즉시 표시 + optimistic 토글/해제는 useMyFollows 훅이 롤백까지 처리.
  const { data: follows = [], isLoading: loading } = useMyFollows()
  const toggleMut = useToggleFollowNotify()
  const unfollowMut = useUnfollowSeller()
  const savingId = toggleMut.isPending ? (toggleMut.variables?.sellerId ?? null) : null

  function toggle(sellerId: number, key: FollowNotifyKey) {
    const current = follows.find(f => f.seller_id === sellerId)
    if (!current) return
    toggleMut.mutate(
      { sellerId, key, value: !current[key] },
      { onError: (err) => {
        const e = err as { response?: { data?: { error?: string } }; message?: string }
        toast.error(e?.response?.data?.error || e?.message || '변경 실패')
      } },
    )
  }

  function unfollow(sellerId: number) {
    if (!confirm('단골을 해제하시겠습니까?')) return
    unfollowMut.mutate(sellerId, {
      onSuccess: () => toast.info('단골 해제'),
      onError: () => toast.error('해제 실패'),
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#121212]">
      <SEO title="내 단골 셀러" description="단골 등록한 셀러와 알림 설정" url="/my/follows" />

      <div className="sticky top-0 z-30 bg-white dark:bg-[#0A0A0A] border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="ur-content-narrow mx-auto px-4 lg:px-8 flex items-center gap-3 py-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-[#1A1A1A]" aria-label="뒤로">
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-200" />
          </button>
          <h1 className="text-base font-extrabold text-gray-900 dark:text-white">내 단골 셀러</h1>
        </div>
      </div>

      <div className="ur-content-narrow mx-auto px-4 lg:px-8 py-5">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
          </div>
        ) : follows.length === 0 ? (
          <div className="text-center py-20">
            <Heart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">단골 등록한 셀러가 없어요</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">관심 있는 셀러 페이지에서 단골 등록하세요</p>
            <button
              onClick={() => navigate('/group-buy')}
              className="px-5 py-2.5 bg-pink-500 text-white rounded-full text-sm font-bold"
            >
              공구 둘러보기
            </button>
          </div>
        ) : (
          <>
            <div className="bg-pink-50 border border-pink-200 rounded-2xl p-4 mb-4 text-xs text-pink-700">
              💡 셀러별로 받을 알림 종류를 선택하세요. 너무 많이 받으면 OFF, 중요한 알림만 ON.
            </div>

            <div className="space-y-3">
              {follows.map(f => (
                <div key={f.seller_id} className="bg-white dark:bg-[#0A0A0A] rounded-2xl border border-gray-200 dark:border-[#2A2A2A] overflow-hidden">
                  {/* 셀러 정보 */}
                  <button
                    onClick={() => navigate(`/profile/${f.seller_username || f.seller_id}`)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-[#121212] text-left transition-colors"
                  >
                    {f.seller_avatar ? (
                      <img src={f.seller_avatar} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" loading="lazy" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-300 to-rose-400 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{f.seller_name}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        {new Date(f.created_at).toLocaleDateString('ko-KR')} 부터 단골
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </button>

                  {/* 알림 매트릭스 토글 */}
                  <div className="border-t border-gray-100 dark:border-[#1A1A1A] p-3 space-y-2">
                    {([
                      { key: 'notify_live_start' as const, label: '📺 라이브 시작', desc: '셀러가 방송 시작 시 push' },
                      { key: 'notify_group_buy' as const, label: '🔥 공구 시작', desc: '새 공구 등록 시 push' },
                      { key: 'notify_new_product' as const, label: '🎁 신상품', desc: '신상품 / 이벤트 알림' },
                    ]).map(opt => (
                      <label key={opt.key} className="flex items-center justify-between cursor-pointer py-1">
                        <div className="flex items-start gap-2">
                          {f[opt.key] ? (
                            <Bell className="w-4 h-4 text-pink-500 mt-0.5" />
                          ) : (
                            <BellOff className="w-4 h-4 text-gray-300 mt-0.5" />
                          )}
                          <div>
                            <p className="text-xs font-bold text-gray-900 dark:text-white">{opt.label}</p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">{opt.desc}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggle(f.seller_id, opt.key)}
                          disabled={savingId === f.seller_id}
                          className={`relative w-10 h-6 rounded-full transition-colors ${f[opt.key] ? 'bg-pink-500' : 'bg-gray-300 dark:bg-gray-600'} disabled:opacity-50`}
                          aria-label={`${opt.label} 알림 ${f[opt.key] ? '끄기' : '켜기'}`}
                          aria-pressed={f[opt.key]}
                        >
                          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white dark:bg-[#0A0A0A] shadow transition-transform ${f[opt.key] ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                        </button>
                      </label>
                    ))}

                    <button
                      onClick={() => unfollow(f.seller_id)}
                      className="w-full mt-2 px-3 py-2 text-[11px] text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors"
                    >
                      단골 해제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
