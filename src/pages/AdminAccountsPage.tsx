import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { UserCog, Plus, Trash2, Key, Edit2, X } from 'lucide-react'
import { formatKST } from '@/utils/date'

interface Admin {
  id: number
  email: string
  name: string
  username: string
  role: string
  created_at: string
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  super_admin: { label: '최고관리자', color: 'bg-red-100 text-red-700' },
  admin: { label: '관리자', color: 'bg-blue-100 text-blue-700' },
  viewer: { label: '뷰어', color: 'bg-gray-100 text-gray-600' },
}

// 비밀번호 복잡도 검증: 8자 이상, 영문+숫자+특수문자 중 2가지 이상
function validatePassword(pw: string): string | null {
  if (!pw || pw.length < 8) return '비밀번호는 8자 이상이어야 합니다'
  const hasLetter = /[A-Za-z]/.test(pw)
  const hasDigit = /[0-9]/.test(pw)
  const hasSymbol = /[^A-Za-z0-9]/.test(pw)
  const types = [hasLetter, hasDigit, hasSymbol].filter(Boolean).length
  if (types < 2) return '영문, 숫자, 특수문자 중 2가지 이상을 포함해야 합니다'
  return null
}

export default function AdminAccountsPage() {
  const navigate = useNavigate()
  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }
  const currentAdminId = localStorage.getItem('admin_id') || ''
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState<Admin | null>(null)
  const [showResetPw, setShowResetPw] = useState<Admin | null>(null)
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'admin' })
  const [editForm, setEditForm] = useState({ name: '', role: '', email: '' })
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) { navigate('/admin/login'); return }
    loadAdmins()
  }, [])

  async function loadAdmins() {
    try {
      const res = await api.get('/api/admin/admins', h)
      if (res.data.success) setAdmins(res.data.data || [])
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e.response?.data?.error || '관리자 목록 로드 실패')
    } finally { setLoading(false) }
  }

  async function createAdmin() {
    if (!form.email || !form.password) { toast.error('이메일과 비밀번호를 입력하세요'); return }
    const pwErr = validatePassword(form.password)
    if (pwErr) { toast.error(pwErr); return }
    setSaving(true)
    try {
      const res = await api.post('/api/admin/admins', form, h)
      if (res.data.success) {
        toast.success('관리자 계정이 생성되었습니다')
        setShowCreate(false)
        setForm({ email: '', name: '', password: '', role: 'admin' })
        loadAdmins()
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e.response?.data?.error || '생성 실패')
    } finally { setSaving(false) }
  }

  async function updateAdmin() {
    if (!showEdit) return
    // 자기 자신의 super_admin 권한 해제 방지
    if (String(showEdit.id) === currentAdminId && showEdit.role === 'super_admin' && editForm.role !== 'super_admin') {
      toast.error('본인의 super_admin 권한은 해제할 수 없습니다.')
      return
    }
    // 마지막 super_admin 강등 방지 (프론트 1차 체크)
    if (showEdit.role === 'super_admin' && editForm.role !== 'super_admin') {
      const superAdminCount = admins.filter(a => a.role === 'super_admin').length
      if (superAdminCount <= 1) {
        toast.error('마지막 super_admin 계정의 권한은 해제할 수 없습니다.')
        return
      }
    }
    // 역할 변경 시 확인
    if (editForm.role !== showEdit.role) {
      if (!confirm(`역할을 "${showEdit.role}" → "${editForm.role}"(으)로 변경하시겠습니까?`)) return
    }
    setSaving(true)
    try {
      const res = await api.patch(`/api/admin/admins/${showEdit.id}`, editForm, h)
      if (res.data.success) {
        toast.success('수정되었습니다')
        setShowEdit(null)
        loadAdmins()
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e.response?.data?.error || '수정 실패')
    } finally { setSaving(false) }
  }

  async function deleteAdmin(admin: Admin) {
    // 본인 계정 삭제 방지
    if (String(admin.id) === currentAdminId) {
      toast.error('본인 계정은 삭제할 수 없습니다.')
      return
    }
    // 마지막 super_admin 삭제 방지
    if (admin.role === 'super_admin') {
      const superAdminCount = admins.filter(a => a.role === 'super_admin').length
      if (superAdminCount <= 1) {
        toast.error('마지막 super_admin 계정은 삭제할 수 없습니다.')
        return
      }
    }
    if (!confirm(`${admin.name || admin.email} 관리자를 삭제하시겠습니까?`)) return
    try {
      const res = await api.delete(`/api/admin/admins/${admin.id}`, h)
      if (res.data.success) {
        toast.success('삭제되었습니다')
        loadAdmins()
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e.response?.data?.error || '삭제 실패')
    }
  }

  async function resetPassword() {
    if (!showResetPw || !newPassword) { toast.error('새 비밀번호를 입력하세요'); return }
    const pwErr = validatePassword(newPassword)
    if (pwErr) { toast.error(pwErr); return }
    setSaving(true)
    try {
      const res = await api.post(`/api/admin/admins/${showResetPw.id}/reset-password`, { newPassword }, h)
      if (res.data.success) {
        toast.success('비밀번호가 변경되었습니다')
        setShowResetPw(null)
        setNewPassword('')
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e.response?.data?.error || '비밀번호 변경 실패')
    } finally { setSaving(false) }
  }

  function openEdit(admin: Admin) {
    setEditForm({ name: admin.name || '', role: admin.role, email: admin.email })
    setShowEdit(admin)
  }

  return (
    <AdminLayout title="관리자 계정 관리" headerRight={
      <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">
        <Plus className="w-3.5 h-3.5" /> 새 관리자
      </button>
    }>
      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <UserCog className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900">관리자 목록 ({admins.length}명)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  {['ID', '이메일', '이름', '역할', '생성일', '액션'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {admins.map(admin => {
                  const role = ROLE_LABELS[admin.role] || { label: admin.role, color: 'bg-gray-100 text-gray-600' }
                  return (
                    <tr key={admin.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-500">{admin.id}</td>
                      <td className="px-4 py-3 text-xs text-gray-900 font-medium">{admin.email}</td>
                      <td className="px-4 py-3 text-xs text-gray-700">{admin.name || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${role.color}`}>{role.label}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{formatKST(admin.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(admin)} className="p-1 rounded hover:bg-gray-100" title="수정"><Edit2 className="w-3.5 h-3.5 text-gray-500" /></button>
                          <button onClick={() => { setShowResetPw(admin); setNewPassword('') }} className="p-1 rounded hover:bg-gray-100" title="비밀번호 변경"><Key className="w-3.5 h-3.5 text-amber-500" /></button>
                          <button onClick={() => deleteAdmin(admin)} className="p-1 rounded hover:bg-gray-100" title="삭제"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 생성 모달 */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowCreate(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">새 관리자 추가</h3>
              <button onClick={() => setShowCreate(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <input type="email" placeholder="이메일" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900" />
              <input type="text" placeholder="이름" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900" />
              <input type="password" placeholder="비밀번호" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900" />
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900">
                <option value="admin">관리자</option>
                <option value="super_admin">최고관리자</option>
                <option value="viewer">뷰어 (읽기전용)</option>
              </select>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg">취소</button>
              <button onClick={createAdmin} disabled={saving} className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg disabled:opacity-50">
                {saving ? '생성 중...' : '생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 수정 모달 */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowEdit(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">관리자 수정 — {showEdit.email}</h3>
            <div className="space-y-3">
              <input type="text" placeholder="이름" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900" />
              <input type="email" placeholder="이메일" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900" />
              <select value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900">
                <option value="admin">관리자</option>
                <option value="super_admin">최고관리자</option>
                <option value="viewer">뷰어</option>
              </select>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowEdit(null)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg">취소</button>
              <button onClick={updateAdmin} disabled={saving} className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg disabled:opacity-50">
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 비밀번호 변경 모달 */}
      {showResetPw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowResetPw(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">비밀번호 변경 — {showResetPw.email}</h3>
            <input type="password" placeholder="새 비밀번호" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900" />
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowResetPw(null)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg">취소</button>
              <button onClick={resetPassword} disabled={saving} className="flex-1 py-2.5 bg-amber-500 text-white text-sm font-medium rounded-lg disabled:opacity-50">
                {saving ? '변경 중...' : '변경'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
