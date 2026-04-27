import { useEffect, useState } from 'react'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { QrCode, Copy, Plus, Trash2, ExternalLink, Users } from 'lucide-react'

interface InviteCode {
  code: string
  label: string | null
  max_uses: number
  used_count: number
  is_active: number
  created_at: string
  expires_at: string
  is_expired: boolean
  is_full: boolean
}

export default function AgencyInvitesPage() {
  const [items, setItems] = useState<InviteCode[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [label, setLabel] = useState('')
  const [maxUses, setMaxUses] = useState(100)

  async function fetchItems() {
    setLoading(true)
    try {
      const token = localStorage.getItem('agency_token')
      const r = await api.get('/api/agency/invites', { headers: { Authorization: `Bearer ${token}` } })
      if (r.data.success) setItems(r.data.data)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '영입 코드 조회 실패')
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchItems() }, [])

  async function createCode() {
    if (creating) return
    setCreating(true)
    try {
      const token = localStorage.getItem('agency_token')
      const r = await api.post('/api/agency/invites', {
        label: label.trim() || null,
        max_uses: maxUses,
      }, { headers: { Authorization: `Bearer ${token}` } })
      if (r.data.success) {
        toast.success('영입 코드 생성 완료')
        setLabel('')
        setMaxUses(100)
        fetchItems()
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '생성 실패')
    } finally { setCreating(false) }
  }

  async function deactivate(code: string) {
    if (!confirm(`코드 ${code} 를 비활성화하시겠습니까? (이미 가입한 셀러는 영향 없음)`)) return
    try {
      const token = localStorage.getItem('agency_token')
      await api.delete(`/api/agency/invites/${code}`, { headers: { Authorization: `Bearer ${token}` } })
      toast.info('코드 비활성화 완료')
      fetchItems()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '실패')
    }
  }

  function copyLink(code: string) {
    const url = `${window.location.origin}/seller/register?invite=${code}`
    navigator.clipboard.writeText(url).then(() => {
      toast.success('영입 링크 복사 완료')
    }).catch(() => {
      toast.error('복사 실패 — 수동 복사하세요')
    })
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      toast.success('코드 복사 완료')
    }).catch(() => {})
  }

  return (
    <AgencyLayout title="셀러 영입">
      <div className="p-6 space-y-6">
        <DashboardPageHeader
          title="셀러 영입 (QR / 링크)"
          subtitle="코드를 발급해서 셀러에게 공유하세요. 7일 유효, 가입 시 자동으로 본 에이전시에 매핑됩니다."
          icon={<QrCode className="h-5 w-5" />}
        />

        {/* 발급 폼 */}
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 mb-3">새 영입 코드 발급</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">메모 (선택)</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="예: 박람회용, SNS 광고용"
                maxLength={100}
                className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">최대 사용 횟수</label>
              <input
                type="number"
                value={maxUses}
                onChange={(e) => setMaxUses(Number(e.target.value) || 100)}
                min={1}
                max={10000}
                className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={createCode}
                disabled={creating}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-bold rounded-lg"
              >
                <Plus className="w-4 h-4" /> {creating ? '생성 중...' : '코드 발급'}
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">⏱️ 발급된 코드는 7일간 유효합니다. 만료 후 자동 비활성화.</p>
        </div>

        {/* 목록 */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">발급 내역</h3>
            <span className="text-xs text-gray-500">{items.length}개</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400">불러오는 중...</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">아직 발급된 코드가 없습니다.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {items.map((it) => {
                const dead = !it.is_active || it.is_expired || it.is_full
                return (
                  <div key={it.code} className={`p-4 flex items-center justify-between gap-3 ${dead ? 'opacity-60' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-base font-bold text-gray-900">{it.code}</span>
                        {!it.is_active ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">비활성</span>
                        ) : it.is_expired ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">만료</span>
                        ) : it.is_full ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">소진</span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700">활성</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {it.label || '메모 없음'} · <Users className="inline w-3 h-3" /> {it.used_count}/{it.max_uses} ·
                        만료: {new Date(it.expires_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => copyCode(it.code)} title="코드 복사" className="p-2 hover:bg-gray-100 rounded">
                        <Copy className="w-4 h-4 text-gray-500" />
                      </button>
                      <button onClick={() => copyLink(it.code)} title="영입 링크 복사" className="p-2 hover:bg-gray-100 rounded">
                        <ExternalLink className="w-4 h-4 text-gray-500" />
                      </button>
                      {it.is_active === 1 && (
                        <button onClick={() => deactivate(it.code)} title="비활성화" className="p-2 hover:bg-red-50 rounded">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AgencyLayout>
  )
}
