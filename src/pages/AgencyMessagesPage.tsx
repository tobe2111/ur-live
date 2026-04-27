import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader, DashboardLoading, DashboardEmptyState } from '@/components/dashboard'
import { MessageSquare, Plus, Trash2, Send, X, History } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { swallow } from '@/shared/utils/swallow'

type Category = 'invite' | 'follow_up' | 'reactivation' | 'announcement' | 'general'

interface Template {
  id: number
  name: string
  body: string
  category: Category
  is_active: number
  usage_count: number
  created_at: string
  updated_at: string
}

interface Send {
  id: number
  template_id: number
  template_name?: string
  channel: 'in_app' | 'alimtalk' | 'email'
  recipient_seller_id: number
  rendered_body: string
  status: string
  sent_at: string
}

interface SellerOption {
  id: number
  name: string
  email?: string
}

const CATEGORY_LABEL: Record<Category, string> = {
  invite: '초대',
  follow_up: '팔로우업',
  reactivation: '재활성화',
  announcement: '공지',
  general: '일반',
}

const CATEGORY_BADGE: Record<Category, string> = {
  invite: 'bg-blue-100 text-blue-700',
  follow_up: 'bg-amber-100 text-amber-700',
  reactivation: 'bg-purple-100 text-purple-700',
  announcement: 'bg-indigo-100 text-indigo-700',
  general: 'bg-gray-100 text-gray-700',
}

export default function AgencyMessagesPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'templates' | 'sends'>('templates')
  const [templates, setTemplates] = useState<Template[]>([])
  const [sends, setSends] = useState<Send[]>([])
  const [sellers, setSellers] = useState<SellerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [sendingTemplate, setSendingTemplate] = useState<Template | null>(null)
  const [selectedSellerIds, setSelectedSellerIds] = useState<number[]>([])

  const token = localStorage.getItem('agency_token')
  const headers = { Authorization: `Bearer ${token}` }

  const [form, setForm] = useState({
    name: '',
    body: '',
    category: 'general' as Category,
  })

  useEffect(() => {
    if (!token) { navigate('/agency/login', { replace: true }); return }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadTemplates = useCallback(() => {
    setLoading(true)
    api.get('/api/agency/messages/templates', { headers })
      .then(r => { if (r.data?.success) setTemplates(r.data.data || []) })
      .catch(() => toast.error('템플릿 조회 실패'))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadSends = useCallback(() => {
    setLoading(true)
    api.get('/api/agency/messages/sends?limit=50', { headers })
      .then(r => { if (r.data?.success) setSends(r.data.data || []) })
      .catch(() => toast.error('이력 조회 실패'))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadSellers = () => {
    api.get('/api/agency/sellers', { headers })
      .then(r => { if (r.data?.success) setSellers(r.data.data || []) })
      .catch(swallow('agency:messages-fetch-sellers'))
  }

  useEffect(() => {
    if (tab === 'templates') loadTemplates()
    else if (tab === 'sends') loadSends()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const submit = async () => {
    if (!form.name || !form.body) { toast.error('이름/본문 필수'); return }
    try {
      await api.post('/api/agency/messages/templates', form, { headers })
      toast.success('템플릿 추가됨')
      setCreating(false)
      setForm({ name: '', body: '', category: 'general' })
      loadTemplates()
    } catch (e: any) {
      toast.error(e?.response?.data?.error || '생성 실패')
    }
  }

  const deleteTemplate = async (id: number) => {
    if (!confirm('이 템플릿을 비활성화하시겠습니까?')) return
    try {
      await api.delete(`/api/agency/messages/templates/${id}`, { headers })
      toast.info('비활성화됨')
      loadTemplates()
    } catch { toast.error('삭제 실패') }
  }

  const send = async () => {
    if (!sendingTemplate) return
    if (selectedSellerIds.length === 0) { toast.error('받을 셀러 선택 필수'); return }
    try {
      const r = await api.post('/api/agency/messages/send', {
        template_id: sendingTemplate.id,
        seller_ids: selectedSellerIds,
      }, { headers })
      if (r.data?.success) {
        const d = r.data.data
        toast.success(`${d.sent}명 발송됨 (요청 ${d.requested}, 자격 ${d.eligible})`)
        setSendingTemplate(null)
        setSelectedSellerIds([])
        loadTemplates()  // usage_count 갱신
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.error || '발송 실패')
    }
  }

  const openSend = (tpl: Template) => {
    loadSellers()
    setSendingTemplate(tpl)
    setSelectedSellerIds([])
  }

  return (
    <AgencyLayout title="메시지 템플릿">
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="메시지 템플릿"
          subtitle="셀러에게 일괄 발송할 수 있는 메시지 템플릿. 변수: {{seller_name}}, {{agency_name}}, {{commission_rate}}"
          icon={<MessageSquare className="h-5 w-5" />}
          actions={tab === 'templates' && (
            <button onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg">
              <Plus className="w-4 h-4" /> 템플릿 추가
            </button>
          )}
        />

        <div className="flex gap-2 border-b border-gray-200">
          <button onClick={() => setTab('templates')}
            className={`px-4 py-2 text-sm font-bold ${tab === 'templates' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
            템플릿
          </button>
          <button onClick={() => setTab('sends')}
            className={`px-4 py-2 text-sm font-bold ${tab === 'sends' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
            발송 이력
          </button>
        </div>

        {/* === 템플릿 탭 === */}
        {tab === 'templates' && (
          loading ? <DashboardLoading /> : templates.length === 0 ? (
            <DashboardEmptyState icon={<MessageSquare className="h-7 w-7" />} title="템플릿이 없습니다 — 추가해보세요" />
          ) : (
            <div className="space-y-2">
              {templates.map(t => (
                <div key={t.id} className={`bg-white rounded-xl border p-4 ${t.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-bold text-gray-900">{t.name}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${CATEGORY_BADGE[t.category]}`}>
                          {CATEGORY_LABEL[t.category]}
                        </span>
                        {t.usage_count > 0 && (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold">
                            {t.usage_count}회 사용
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2 whitespace-pre-wrap">{t.body}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {t.is_active && (
                        <button onClick={() => openSend(t)}
                          className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg"
                          title="셀러에게 발송">
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => deleteTemplate(t.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg" title="비활성화">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* === 발송 이력 탭 === */}
        {tab === 'sends' && (
          loading ? <DashboardLoading /> : sends.length === 0 ? (
            <DashboardEmptyState icon={<History className="h-7 w-7" />} title="발송 이력 없음" />
          ) : (
            <div className="space-y-2">
              {sends.map(s => (
                <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-bold text-gray-900">{s.template_name || '템플릿 삭제됨'}</p>
                    <span className="text-[10px] text-gray-400">{new Date(s.sent_at).toLocaleString('ko-KR')}</span>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-1">{s.rendered_body}</p>
                  <p className="text-[10px] text-gray-400 mt-1">셀러 #{s.recipient_seller_id} · {s.channel} · {s.status}</p>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* 생성 모달 */}
      {creating && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setCreating(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">템플릿 추가</h2>
              <button onClick={() => setCreating(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700">이름 *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700">카테고리</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as Category })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900">
                  {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700">본문 * (변수: {`{{seller_name}}, {{agency_name}}, {{commission_rate}}`})</label>
                <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 font-mono" rows={6} maxLength={2000}
                  placeholder={`예시:\n{{seller_name}}님, 안녕하세요!\n{{agency_name}} 입니다. 이번 달 캠페인에 함께해주세요. 수수료 {{commission_rate}}% 우대 적용됩니다.`} />
                <p className="text-[10px] text-gray-400 mt-1">{form.body.length} / 2000</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setCreating(false)} className="px-4 py-2 text-gray-600 text-sm font-bold">취소</button>
                <button onClick={submit} className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg">생성</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 발송 모달 */}
      {sendingTemplate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSendingTemplate(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">템플릿 발송</h2>
                <p className="text-xs text-gray-500">{sendingTemplate.name}</p>
              </div>
              <button onClick={() => setSendingTemplate(null)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 mb-3 text-xs text-gray-600 whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
              {sendingTemplate.body}
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700">받을 셀러 (1~200명)</label>
              <div className="flex items-center gap-2 mb-1">
                <button onClick={() => setSelectedSellerIds(sellers.map(s => s.id))}
                  className="text-xs text-blue-600 hover:underline">전체 선택</button>
                <button onClick={() => setSelectedSellerIds([])}
                  className="text-xs text-gray-500 hover:underline">전체 해제</button>
                <span className="text-xs text-gray-400 ml-auto">{selectedSellerIds.length}명 선택</span>
              </div>
              <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
                {sellers.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3">소속 셀러 없음</p>
                ) : sellers.map(s => (
                  <label key={s.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
                    <input type="checkbox"
                      checked={selectedSellerIds.includes(s.id)}
                      onChange={e => setSelectedSellerIds(e.target.checked
                        ? [...selectedSellerIds, s.id]
                        : selectedSellerIds.filter(id => id !== s.id))} />
                    <span className="text-xs text-gray-700">{s.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <button onClick={() => setSendingTemplate(null)} className="px-4 py-2 text-gray-600 text-sm font-bold">취소</button>
              <button onClick={send}
                disabled={selectedSellerIds.length === 0}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
                <Send className="w-4 h-4" /> {selectedSellerIds.length}명 발송
              </button>
            </div>
          </div>
        </div>
      )}
    </AgencyLayout>
  )
}
