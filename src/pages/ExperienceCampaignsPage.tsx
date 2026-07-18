/**
 * 🎁 2026-07-12 체험 캠페인 — 소비자 (목록·상세·응모·내 응모현황). 다크 테마(유저 대면).
 *   백엔드: src/features/group-buy/api/experience-campaign.routes.ts
 *   선정 시 0원 체험권이 /my-vouchers(이용권 지갑)에 자동 발급됨.
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import SEO from '@/components/SEO'
import { Gift, Clock, Users, CheckCircle2 } from 'lucide-react'
import { cfImage } from '@/utils/cf-image'

interface Campaign {
  id: number; title: string; description?: string; slots: number
  product_id: number; product_name?: string; restaurant_name?: string; image_url?: string
  apply_end?: string | null; mission?: string; entry_count?: number; status?: string
}
interface MyEntry { campaign_id: number; status: string; voucher_id: number | null; title: string; product_name?: string; restaurant_name?: string; image_url?: string; created_at: string }

export default function ExperienceCampaignsPage() {
  const nav = useNavigate()
  const [tab, setTab] = useState<'open' | 'mine'>('open')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [mine, setMine] = useState<MyEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState<number | null>(null)
  const loggedIn = !!(typeof localStorage !== 'undefined' && localStorage.getItem('user_id'))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/api/experience-campaigns')
      setCampaigns(r.data?.campaigns || [])
      if (loggedIn) {
        const m = await api.get('/api/experience-campaigns/my/entries').catch(() => ({ data: { entries: [] } }))
        setMine(m.data?.entries || [])
      }
    } catch { /* graceful */ } finally { setLoading(false) }
  }, [loggedIn])
  useEffect(() => { void load() }, [load])

  const apply = async (id: number) => {
    if (!loggedIn) { toast.error('로그인이 필요합니다'); nav('/login?returnUrl=/experience'); return }
    setApplying(id)
    try {
      await api.post(`/api/experience-campaigns/${id}/apply`)
      toast.success('응모 완료! 추첨 결과는 알림으로 안내드려요.')
      void load()
    } catch (e) {
      const code = (e as { response?: { data?: { code?: string; error?: string } } })?.response?.data
      toast.error(code?.code === 'ALREADY_APPLIED' ? '이미 응모하셨어요' : (code?.error || '응모 실패'))
    } finally { setApplying(null) }
  }

  const appliedIds = new Set(mine.map(m => m.campaign_id))
  const entryLabel = (s: string) => s === 'selected' ? '🎉 선정' : s === 'applied' ? '응모 완료' : s === 'not_selected' ? '미선정' : s

  return (
    <div className="min-h-[100dvh] bg-[#020202] text-white pb-24">
      <SEO title="체험단 응모 - 유어딜" description="무료로 응모하고 공정 추첨으로 매장 체험권을 받아보세요." url="/experience" />
      <div className="ur-content-wide px-4 lg:px-8 pt-5">
        <h1 className="text-[20px] font-black flex items-center gap-2"><Gift className="w-5 h-5 text-pink-400" />체험단</h1>
        <p className="text-[13px] text-gray-400 mt-1">무료 응모 · 공정 추첨 · 선정 시 체험권이 이용권 지갑에 발급돼요.</p>

        <div className="flex gap-2 mt-4 mb-4">
          <button type="button" onClick={() => setTab('open')} className={`px-4 py-2 rounded-full text-[13px] font-semibold ${tab === 'open' ? 'bg-white text-black' : 'bg-[#1A1A1A] text-gray-300'}`}>모집중</button>
          <button type="button" onClick={() => setTab('mine')} className={`px-4 py-2 rounded-full text-[13px] font-semibold ${tab === 'mine' ? 'bg-white text-black' : 'bg-[#1A1A1A] text-gray-300'}`}>내 응모현황</button>
        </div>

        {loading ? <div className="py-16 text-center text-gray-500 text-[13px]">불러오는 중…</div>
        : tab === 'open' ? (
          campaigns.length === 0 ? <div className="py-16 text-center text-gray-500 text-[13px]">모집 중인 체험단이 없어요.</div>
          : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {campaigns.map(c => {
              const applied = appliedIds.has(c.id)
              return (
                <div key={c.id} className="bg-[#121212] rounded-2xl border border-[#1A1A1A] overflow-hidden">
                  {c.image_url && <img src={cfImage(c.image_url, { width: 480 })} alt="" className="w-full aspect-[16/10] object-cover" loading="lazy" />}
                  <div className="p-4">
                    <p className="text-[14px] font-bold text-white line-clamp-1">{c.title}</p>
                    <p className="text-[12px] text-gray-400 line-clamp-1 mt-0.5">{c.restaurant_name || c.product_name}</p>
                    {c.mission && <p className="text-[11px] text-pink-300/80 mt-1">미션: {c.mission}</p>}
                    <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-2">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />모집 {c.slots}명</span>
                      <span className="flex items-center gap-1"><Gift className="w-3 h-3" />응모 {c.entry_count ?? 0}</span>
                      {c.apply_end && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />~{new Date(c.apply_end).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}</span>}
                    </div>
                    {c.description && <p className="text-[12px] text-gray-400 mt-2 line-clamp-2">{c.description}</p>}
                    <button type="button" disabled={applied || applying === c.id} onClick={() => void apply(c.id)}
                      className={`mt-3 w-full py-2.5 rounded-xl text-[13px] font-bold ${applied ? 'bg-[#1A1A1A] text-gray-500' : 'bg-pink-500 text-white'}`}>
                      {applied ? <span className="flex items-center justify-center gap-1"><CheckCircle2 className="w-4 h-4" />응모 완료</span> : applying === c.id ? '응모 중…' : '무료 응모하기'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          !loggedIn ? <div className="py-16 text-center text-gray-500 text-[13px]">로그인 후 확인할 수 있어요.</div>
          : mine.length === 0 ? <div className="py-16 text-center text-gray-500 text-[13px]">응모한 체험단이 없어요.</div>
          : <div className="space-y-2">
            {mine.map(m => (
              <div key={m.campaign_id} className="bg-[#121212] rounded-2xl border border-[#1A1A1A] p-4 flex items-center gap-3">
                {m.image_url && <img src={cfImage(m.image_url, { width: 120 })} alt="" className="w-14 h-14 rounded-xl object-cover" loading="lazy" />}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-white line-clamp-1">{m.title}</p>
                  <p className="text-[11px] text-gray-500">{m.restaurant_name || m.product_name} · {new Date(m.created_at).toLocaleDateString('ko-KR')}</p>
                </div>
                <div className="text-right">
                  <span className={`text-[12px] font-bold ${m.status === 'selected' ? 'text-pink-400' : m.status === 'not_selected' ? 'text-gray-500' : 'text-blue-300'}`}>{entryLabel(m.status)}</span>
                  {m.status === 'selected' && <button type="button" onClick={() => nav('/my-vouchers')} className="block mt-1 text-[11px] text-pink-300 underline">체험권 보기</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
