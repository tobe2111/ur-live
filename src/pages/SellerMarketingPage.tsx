/**
 * 🛡️ 2026-05-16: 셀러 마케팅 (인플루언서 차단) 관리 페이지.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import SellerLayout from '@/components/SellerLayout'
import { getSellerToken, isSellerAuthenticated, redirectToLogin } from '@/lib/seller-auth'
import { Megaphone, Ban, RotateCcw } from 'lucide-react'

interface Blocked { influencer_id: string; reason: string; blocked_at: string }
interface Recent { influencer_id: string; count: number; total_commission: number }

export default function SellerMarketingPage() {
  const navigate = useNavigate()
  const [marketingEnabled, setMarketingEnabled] = useState(true)
  const [blocked, setBlocked] = useState<Blocked[]>([])
  const [recent, setRecent] = useState<Recent[]>([])
  const [loading, setLoading] = useState(true)
  const [blockingId, setBlockingId] = useState<string | null>(null)

  const headers = { Authorization: `Bearer ${getSellerToken() || ''}` }

  useEffect(() => {
    if (!isSellerAuthenticated()) {
      redirectToLogin(navigate)
      return
    }
    load()
  }, [])

  function load() {
    setLoading(true)
    api.get('/api/seller-marketing/me', { headers })
      .then((r) => {
        if (r.data?.success) {
          setMarketingEnabled(r.data.data.marketing_enabled)
          setBlocked(r.data.data.blocked || [])
          setRecent(r.data.data.recent || [])
        }
      })
      .catch(() => toast.error('데이터 로드 실패'))
      .finally(() => setLoading(false))
  }

  async function toggleMarketing() {
    const next = !marketingEnabled
    if (!next && !confirm('마케팅 OFF 시 모든 신규 referral commission 이 종료됩니다. 진행할까요?')) return
    try {
      await api.post('/api/seller-marketing/toggle', { enabled: next }, { headers })
      setMarketingEnabled(next)
      toast.success(next ? '마케팅 ON' : '마케팅 OFF — 이미 발급된 voucher 의 commission 은 유지')
    } catch { toast.error('변경 실패') }
  }

  async function blockInfluencer(influencerId: string) {
    const reason = prompt(`${influencerId} 차단 사유 (필수, 5자 이상):\n예) 콘텐츠 부적절 / 재고 부족 / 마케팅 종료`)
    if (!reason || reason.trim().length < 5) {
      toast.error('차단 사유 5자 이상 입력')
      return
    }
    setBlockingId(influencerId)
    try {
      await api.post('/api/seller-marketing/block', { influencer_id: influencerId, reason: reason.trim() }, { headers })
      toast.success('차단되었습니다 (이미 발급된 commission 은 유지)')
      load()
    } catch { toast.error('차단 실패') }
    finally { setBlockingId(null) }
  }

  async function unblock(influencerId: string) {
    if (!confirm(`${influencerId} 차단을 해제할까요?`)) return
    try {
      await api.post('/api/seller-marketing/unblock', { influencer_id: influencerId }, { headers })
      toast.success('차단 해제됨')
      load()
    } catch { toast.error('해제 실패') }
  }

  return (
    <SellerLayout title="인플루언서 마케팅">
      <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6 lg:p-8">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-pink-500" /> 인플루언서 마케팅 관리
          </h2>
          <p className="text-xs text-gray-500 mt-1">차단 시점까지 발생한 commission 은 그대로 정산됩니다 (인플루언서 신뢰 보호).</p>
        </div>

        {/* 전체 마케팅 토글 */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">전체 referral 마케팅</p>
            <p className="text-[11px] text-gray-500 mt-0.5">OFF 시 신규 ?ref= 진입 commission 종료</p>
          </div>
          <button
            onClick={toggleMarketing}
            disabled={loading}
            className={`px-4 py-2 rounded-full text-xs font-bold ${marketingEnabled ? 'bg-emerald-500 text-white' : 'bg-gray-300 text-gray-700'}`}
          >
            {marketingEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* 최근 30일 활성 인플루언서 */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">최근 30일 referral 매출 ({recent.length}명)</h3>
          {recent.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">아직 활성 인플루언서가 없습니다</p>
          ) : (
            <ul className="space-y-2">
              {recent.map(r => {
                const isBlocked = blocked.some(b => b.influencer_id === r.influencer_id)
                return (
                  <li key={r.influencer_id} className="flex items-center justify-between gap-3 border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{r.influencer_id}</p>
                      <p className="text-[11px] text-gray-500">{r.count}건 · commission {r.total_commission.toLocaleString()}원</p>
                    </div>
                    {isBlocked ? (
                      <span className="text-[10px] text-red-600 font-bold">차단됨</span>
                    ) : (
                      <button
                        onClick={() => blockInfluencer(r.influencer_id)}
                        disabled={blockingId === r.influencer_id}
                        className="px-3 py-1.5 text-[11px] font-bold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40"
                      >
                        <Ban className="w-3 h-3 inline mr-1" /> 차단
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* 차단 목록 */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">차단된 인플루언서 ({blocked.length}명)</h3>
          {blocked.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">차단된 인플루언서가 없습니다</p>
          ) : (
            <ul className="space-y-2">
              {blocked.map(b => (
                <li key={b.influencer_id} className="flex items-center justify-between gap-3 border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{b.influencer_id}</p>
                    <p className="text-[11px] text-gray-500 truncate">{b.reason}</p>
                    <p className="text-[10px] text-gray-400">{new Date(b.blocked_at).toLocaleDateString('ko-KR')}</p>
                  </div>
                  <button
                    onClick={() => unblock(b.influencer_id)}
                    className="px-3 py-1.5 text-[11px] font-bold text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50"
                  >
                    <RotateCcw className="w-3 h-3 inline mr-1" /> 해제
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </SellerLayout>
  )
}
