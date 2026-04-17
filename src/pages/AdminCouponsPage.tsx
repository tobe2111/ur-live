import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Plus, Trash2, Ticket, Copy } from 'lucide-react'
import AdminLayout from '@/components/AdminLayout'

interface Coupon {
  id: number; code: string; name: string; type: string; value: number
  min_order_amount: number; max_discount: number | null
  total_count: number; used_count: number
  is_active: number; expires_at: string | null; created_at: string
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    code: '', name: '', type: 'fixed' as 'fixed' | 'percent',
    value: 0, min_order_amount: 0, max_discount: 0, total_count: 0, expires_at: ''
  })
  const [submitting, setSubmitting] = useState(false)

  const headers = { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }

  useEffect(() => { loadCoupons() }, [])

  async function loadCoupons() {
    try {
      const r = await api.get('/api/admin/coupons', { headers })
      if (r.data.success) setCoupons(r.data.data || [])
    } catch { toast.error('쿠폰 목록 로딩 실패') }
    finally { setLoading(false) }
  }

  function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = 'UR-'
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
    code += '-'
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
    setForm(f => ({ ...f, code }))
  }

  async function handleCreate() {
    if (!form.code || !form.name || !form.value) {
      toast.error('코드, 이름, 할인값을 입력해주세요')
      return
    }
    setSubmitting(true)
    try {
      const res = await api.post('/api/admin/coupons', form, { headers })
      if (res.data.success) {
        toast.success('쿠폰이 생성되었습니다')
        setShowForm(false)
        setForm({ code: '', name: '', type: 'fixed', value: 0, min_order_amount: 0, max_discount: 0, total_count: 0, expires_at: '' })
        loadCoupons()
      } else {
        toast.error(res.data.error || '생성 실패')
      }
    } catch (err: unknown) { toast.error((err as { response?: { data?: { error?: string; message?: string }; status?: number } }).response?.data?.error || '쿠폰 생성 실패') }
    finally { setSubmitting(false) }
  }

  async function handleDelete(id: number) {
    if (!confirm('이 쿠폰을 삭제하시겠습니까?')) return
    try {
      await api.delete(`/api/admin/coupons/${id}`, { headers })
      toast.success('삭제되었습니다')
      setCoupons(prev => prev.filter(c => c.id !== id))
    } catch { toast.error('삭제 실패') }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    toast.success(`${code} 복사됨`)
  }

  return (
    <AdminLayout title="쿠폰 관리">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">쿠폰 관리</h1>
            <p className="text-sm text-gray-500 mt-1">할인 쿠폰 생성 및 관리</p>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); if (!showForm) generateCode() }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            쿠폰 생성
          </button>
        </div>

        {/* 쿠폰 생성 폼 */}
        {showForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">새 쿠폰 생성</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">쿠폰 코드</label>
                <div className="flex gap-2">
                  <input
                    value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="UR-XXXX-XXXX"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-400 focus:outline-none"
                  />
                  <button onClick={generateCode} className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
                    자동생성
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">쿠폰 이름</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="예: 신규가입 할인"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">할인 유형</label>
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value as 'fixed' | 'percent' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-400 focus:outline-none"
                >
                  <option value="fixed">정액 (원)</option>
                  <option value="percent">정률 (%)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  할인값 {form.type === 'fixed' ? '(원)' : '(%)'}
                </label>
                <input
                  type="number"
                  value={form.value || ''}
                  onChange={e => setForm(f => ({ ...f, value: Number(e.target.value) }))}
                  placeholder={form.type === 'fixed' ? '5000' : '10'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">최소 주문금액 (원)</label>
                <input
                  type="number"
                  value={form.min_order_amount || ''}
                  onChange={e => setForm(f => ({ ...f, min_order_amount: Number(e.target.value) }))}
                  placeholder="0 (제한 없음)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">최대 할인금액 (원)</label>
                <input
                  type="number"
                  value={form.max_discount || ''}
                  onChange={e => setForm(f => ({ ...f, max_discount: Number(e.target.value) }))}
                  placeholder="0 (제한 없음)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">발급 수량 (0 = 무제한)</label>
                <input
                  type="number"
                  value={form.total_count || ''}
                  onChange={e => setForm(f => ({ ...f, total_count: Number(e.target.value) }))}
                  placeholder="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">만료일</label>
                <input
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-400 focus:outline-none"
                />
              </div>
            </div>

            {/* 미리보기 */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>{form.name || '쿠폰명'}</strong> —
                {form.type === 'fixed' ? `${form.value.toLocaleString()}원 할인` : `${form.value}% 할인`}
                {form.min_order_amount > 0 && ` (${form.min_order_amount.toLocaleString()}원 이상)`}
                {form.max_discount > 0 && ` (최대 ${form.max_discount.toLocaleString()}원)`}
              </p>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? '생성 중...' : '생성'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* 쿠폰 목록 */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : coupons.length === 0 ? (
          <div className="text-center py-20">
            <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">생성된 쿠폰이 없습니다</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">코드</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">이름</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">할인</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">사용</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">만료</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">상태</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {coupons.map(c => {
                    const isExpired = c.expires_at && new Date(c.expires_at) < new Date()
                    const isSoldOut = c.total_count > 0 && c.used_count >= c.total_count
                    return (
                      <tr key={c.id} className={`${isExpired || isSoldOut ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <code className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono">{c.code}</code>
                            <button onClick={() => copyCode(c.code)} className="text-gray-400 hover:text-gray-600">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-900">{c.name}</td>
                        <td className="px-4 py-3">
                          <span className="text-blue-600 font-medium">
                            {c.type === 'fixed' ? `${c.value.toLocaleString()}원` : `${c.value}%`}
                          </span>
                          {c.min_order_amount > 0 && (
                            <span className="text-gray-400 text-xs ml-1">({c.min_order_amount.toLocaleString()}원↑)</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {c.used_count}{c.total_count > 0 ? `/${c.total_count}` : ''}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {c.expires_at ? new Date(c.expires_at).toLocaleDateString('ko-KR') : '무기한'}
                        </td>
                        <td className="px-4 py-3">
                          {isExpired ? (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">만료</span>
                          ) : isSoldOut ? (
                            <span className="px-2 py-0.5 bg-red-50 text-red-500 text-xs rounded-full">소진</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-green-50 text-green-600 text-xs rounded-full">활성</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
