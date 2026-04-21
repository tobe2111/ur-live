import { useState, useEffect } from 'react'
import api from '@/lib/api'
import AgencyLayout from '@/components/AgencyLayout'
import { Send, Loader2, Bell } from 'lucide-react'
import { toast } from '@/hooks/useToast'

export default function AgencyNoticesPage() {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [notices, setNotices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const headers = { Authorization: `Bearer ${localStorage.getItem('agency_token')}` }

  useEffect(() => {
    api.get('/api/agency/notices', { headers })
      .then(r => { if (r.data.success) setNotices(r.data.data || []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) { toast.error('제목과 내용을 입력해주세요'); return }
    if (!confirm('소속 셀러 전원에게 공지를 발송하시겠습니까?')) return
    setSending(true)
    try {
      const res = await api.post('/api/agency/notices', { title: title.trim(), message: message.trim() }, { headers })
      if (res.data.success) {
        toast.success(res.data.message)
        setTitle(''); setMessage('')
        setNotices(prev => [{ title: title.trim(), message: message.trim(), created_at: new Date().toISOString() }, ...prev])
      }
    } catch { toast.error('발송 실패') }
    finally { setSending(false) }
  }

  return (
    <AgencyLayout title="셀러 공지사항">
      <div className="p-6 max-w-3xl">
        <h1 className="text-xl font-bold text-gray-900 mb-6">셀러 공지사항</h1>

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
