import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader, DashboardLoading, DashboardEmptyState } from '@/components/dashboard'
import { Users, UserPlus, X, Pause, Play, Trash2, Copy, Check } from 'lucide-react'
import { toast } from '@/hooks/useToast'

type Role = 'owner' | 'manager' | 'agent' | 'analyst'

interface Member {
  id: number
  email: string
  user_id: number | null
  role: Role
  permissions: string | null
  status: 'invited' | 'active' | 'suspended' | 'removed'
  invited_at: string
  joined_at: string | null
  last_active_at: string | null
  effective_permissions: {
    invite: boolean
    settle: boolean
    campaign: boolean
    message: boolean
    coupon: boolean
    contract: boolean
    members: boolean
    view: boolean
  }
}

const ROLE_LABEL: Record<Role, string> = {
  owner: '소유자',
  manager: '매니저',
  agent: '에이전트',
  analyst: '분석가',
}

const ROLE_COLOR: Record<Role, string> = {
  owner: 'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100 text-blue-700',
  agent: 'bg-emerald-100 text-emerald-700',
  analyst: 'bg-gray-100 text-gray-600',
}

const STATUS_LABEL: Record<Member['status'], string> = {
  invited: '초대됨',
  active: '활성',
  suspended: '정지',
  removed: '제거됨',
}

export default function AgencyMembersPage() {
  const navigate = useNavigate()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ token: string; email: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const token = localStorage.getItem('agency_token')
  const headers = { Authorization: `Bearer ${token}` }

  const [form, setForm] = useState({
    email: '',
    role: 'agent' as Role,
  })

  useEffect(() => {
    if (!token) { navigate('/agency/login', { replace: true }); return }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    api.get('/api/agency/members', { headers })
      .then(r => { if (r.data?.success) setMembers(r.data.data || []) })
      .catch((e: any) => {
        if (e?.response?.status === 401) navigate('/agency/login', { replace: true })
        else toast.error('멤버 조회 실패')
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load])

  const submit = async () => {
    if (!form.email) { toast.error('이메일 필수'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { toast.error('유효한 이메일'); return }

    try {
      const r = await api.post('/api/agency/members/invite', {
        email: form.email.toLowerCase(),
        role: form.role,
      }, { headers })
      if (r.data?.success) {
        setInviteResult({ token: r.data.data.invite_token, email: form.email })
        setForm({ email: '', role: 'agent' })
        load()
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.error || '초대 실패')
    }
  }

  const changeRole = async (m: Member, newRole: Role) => {
    if (m.role === newRole) return
    if (m.role === 'owner') { toast.error('owner 변경 불가'); return }
    try {
      await api.patch(`/api/agency/members/${m.id}`, { role: newRole }, { headers })
      toast.success(`${m.email} → ${ROLE_LABEL[newRole]}`)
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.error || '변경 실패')
    }
  }

  const suspend = async (m: Member) => {
    if (!confirm(`${m.email} 을 일시 정지하시겠습니까?`)) return
    try {
      await api.post(`/api/agency/members/${m.id}/suspend`, {}, { headers })
      toast.info('정지됨')
      load()
    } catch (e: any) { toast.error(e?.response?.data?.error || '실패') }
  }

  const reactivate = async (m: Member) => {
    try {
      await api.post(`/api/agency/members/${m.id}/reactivate`, {}, { headers })
      toast.success('재활성화됨')
      load()
    } catch (e: any) { toast.error(e?.response?.data?.error || '실패') }
  }

  const remove = async (m: Member) => {
    if (!confirm(`${m.email} 을 제거하시겠습니까?`)) return
    try {
      await api.delete(`/api/agency/members/${m.id}`, { headers })
      toast.info('제거됨')
      load()
    } catch (e: any) { toast.error(e?.response?.data?.error || '실패') }
  }

  const copyInviteLink = () => {
    if (!inviteResult) return
    const url = `${window.location.origin}/agency/accept-invite?token=${inviteResult.token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <AgencyLayout title="팀 멤버">
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="팀 멤버"
          subtitle="에이전시 운영 팀원 — owner/manager/agent/analyst 역할 분리"
          icon={<Users className="h-5 w-5" />}
          actions={
            <button onClick={() => setInviting(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg">
              <UserPlus className="w-4 h-4" /> 멤버 초대
            </button>
          }
        />

        {loading ? (
          <DashboardLoading />
        ) : members.length === 0 ? (
          <DashboardEmptyState icon={<Users className="h-7 w-7" />} title="멤버 없음" />
        ) : (
          <div className="space-y-2">
            {members.map(m => (
              <div key={m.id} className={`bg-white rounded-xl border p-4 ${m.status === 'suspended' ? 'opacity-60 border-yellow-300' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-bold text-gray-900">{m.email}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${ROLE_COLOR[m.role]}`}>
                        {ROLE_LABEL[m.role]}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                        m.status === 'active' ? 'bg-green-50 text-green-700' :
                        m.status === 'invited' ? 'bg-blue-50 text-blue-700' :
                        m.status === 'suspended' ? 'bg-yellow-50 text-yellow-700' :
                        'bg-red-50 text-red-700'
                      }`}>
                        {STATUS_LABEL[m.status]}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-gray-500">
                      {m.effective_permissions.invite && <span>✓ 영입</span>}
                      {m.effective_permissions.campaign && <span>✓ 캠페인</span>}
                      {m.effective_permissions.message && <span>✓ 메시지</span>}
                      {m.effective_permissions.coupon && <span>✓ 쿠폰</span>}
                      {m.effective_permissions.settle && <span>✓ 정산</span>}
                      {m.effective_permissions.contract && <span>✓ 계약</span>}
                      {m.effective_permissions.members && <span>✓ 멤버관리</span>}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">
                      초대: {new Date(m.invited_at).toLocaleDateString('ko-KR')}
                      {m.joined_at && ` · 가입: ${new Date(m.joined_at).toLocaleDateString('ko-KR')}`}
                    </p>
                  </div>

                  {m.role !== 'owner' && (
                    <div className="flex items-center gap-1 shrink-0">
                      <select
                        value={m.role}
                        onChange={(e) => changeRole(m, e.target.value as Role)}
                        className="text-xs bg-white border border-gray-200 rounded px-2 py-1 cursor-pointer hover:border-gray-300"
                      >
                        <option value="manager">매니저</option>
                        <option value="agent">에이전트</option>
                        <option value="analyst">분석가</option>
                      </select>
                      {m.status === 'active' ? (
                        <button onClick={() => suspend(m)} className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded" title="일시 정지">
                          <Pause className="w-3.5 h-3.5" />
                        </button>
                      ) : m.status === 'suspended' ? (
                        <button onClick={() => reactivate(m)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="재활성화">
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      ) : null}
                      <button onClick={() => remove(m)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="제거">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 초대 모달 */}
      {inviting && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setInviting(false); setInviteResult(null) }}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">멤버 초대</h2>
              <button onClick={() => { setInviting(false); setInviteResult(null) }}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {inviteResult ? (
              <div className="space-y-3">
                <div className="bg-green-50 rounded-xl p-3 text-sm text-green-800">
                  ✅ {inviteResult.email} 초대 완료
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-700 mb-2">초대 링크 — 이메일/카톡으로 전달</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-[10px] bg-gray-100 px-3 py-2 rounded text-gray-700 font-mono break-all">
                      {window.location.origin}/agency/accept-invite?token={inviteResult.token}
                    </code>
                    <button onClick={copyInviteLink} className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded">
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-gray-500">
                  💡 초대 받은 사람은 같은 이메일로 회원가입 후 이 링크로 멤버십을 활성화합니다.
                </p>
                <button onClick={() => { setInviting(false); setInviteResult(null) }}
                  className="w-full py-2 bg-gray-900 text-white text-sm font-bold rounded-lg">
                  완료
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-gray-700">이메일 *</label>
                  <input type="email" value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="example@company.com"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700">역할 *</label>
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as Role })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900">
                    <option value="manager">매니저 — 영입/캠페인/메시지/쿠폰 + 정산 신청</option>
                    <option value="agent">에이전트 — 영입/메시지/쿠폰 (정산/캠페인 X)</option>
                    <option value="analyst">분석가 — 조회만</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setInviting(false)} className="px-4 py-2 text-gray-600 text-sm font-bold">취소</button>
                  <button onClick={submit} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg">
                    초대
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AgencyLayout>
  )
}
