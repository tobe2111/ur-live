import { useState } from 'react'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { Send, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/useToast'

export default function AdminNoticesPage() {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [target, setTarget] = useState<'all' | 'sellers' | 'users'>('all')
  const [sending, setSending] = useState(false)
  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }

  const send = async () => {
    if (!title.trim() || !message.trim()) { toast.error('제목과 내용을 입력해주세요'); return }
    if (!confirm(`"${target === 'all' ? '전체' : target === 'sellers' ? '셀러' : '사용자'}"에게 공지를 발송하시겠습니까?`)) return
    setSending(true)
    try {
      const res = await api.post('/api/admin/tools/notices', { title: title.trim(), message: message.trim(), target }, h)
      toast.success(res.data.message); setTitle(''); setMessage('')
    } catch { toast.error('발송 실패') }
    finally { setSending(false) }
  }

  return (
    <AdminLayout title="공지사항">
      <div className="p-6 max-w-3xl">
        <h1 className="text-xl font-bold text-gray-900 mb-6">공지사항 발송</h1>
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">발송 대상</label>
            <div className="flex gap-2">
              {([{ v: 'all' as const, l: '전체' }, { v: 'sellers' as const, l: '셀러만' }, { v: 'users' as const, l: '사용자만' }]).map(t => (
                <button key={t.v} onClick={() => setTarget(t.v)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${target === t.v ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                  {t.l}
                </button>
              ))}
            </div>
          </div>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="공지 제목"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900" />
          <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="공지 내용" rows={5}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 resize-none" />
          <button onClick={send} disabled={sending}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            발송
          </button>
        </div>
      </div>
    </AdminLayout>
  )
}
