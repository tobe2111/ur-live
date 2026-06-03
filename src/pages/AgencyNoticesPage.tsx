import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { Send, Loader2, Bell } from 'lucide-react'
import { toast } from '@/hooks/useToast'

export default function AgencyNoticesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const token = localStorage.getItem('agency_token')
  // 🛡️ 2026-06-03 Tier2(대시보드): 수동 페칭 → useApiQuery.
  const { data: notices = [], isLoading: loading, refetch } = useApiQuery<any[]>(
    ['agency', 'notices'], '/api/agency/notices',
    { select: (r: any) => (r?.success ? r.data || [] : []), enabled: !!token },
  )

  useEffect(() => {
    if (!token) navigate('/agency/login', { replace: true })
  }, [token, navigate])

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) { toast.error('제목과 내용을 입력해주세요'); return }
    if (!confirm('소속 셀러 전원에게 공지를 발송하시겠습니까?')) return
    setSending(true)
    try {
      const res = await api.post('/api/agency/notices', { title: title.trim(), message: message.trim() })
      if (res.data.success) {
        toast.success(res.data.message)
        setTitle(''); setMessage('')
        refetch()
      }
    } catch { toast.error('발송 실패') }
    finally { setSending(false) }
  }

  return (
    <AgencyLayout title={t('agency.notices')}>
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* 🛡️ 2026-04-22 배치 130: 디자인 시스템 적용 */}
        <DashboardPageHeader
          title={t('agency.notices')}
          subtitle={t('agency.noticesSubtitle')}
          icon={<Bell className="h-5 w-5" />}
        />

        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-3">새 공지 작성</h2>
          <input
            value={title} onChange={e => setTitle(e.target.value)}
            placeholder="공지 제목" maxLength={100}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 mb-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <textarea
            value={message} onChange={e => setMessage(e.target.value)}
            placeholder="공지 내용을 입력하세요" rows={4} maxLength={500}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 mb-3 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button onClick={handleSend} disabled={sending}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            전체 셀러에게 발송
          </button>
        </div>

        <h2 className="text-sm font-bold text-gray-900 mb-3">발송 이력</h2>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
        ) : notices.length === 0 ? (
          <p className="text-center py-8 text-gray-500 text-sm">발송된 공지가 없습니다</p>
        ) : (
          <div className="space-y-3">
            {notices.map((n, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Bell className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-bold text-gray-900">{n.title}</span>
                </div>
                <p className="text-sm text-gray-600 ml-6">{n.message}</p>
                <p className="text-xs text-gray-400 ml-6 mt-1">{new Date(n.created_at).toLocaleString('ko-KR')}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AgencyLayout>
  )
}
