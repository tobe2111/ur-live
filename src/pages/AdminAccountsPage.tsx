import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader, DashboardLoading } from '@/components/dashboard'
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

export default function AdminAccountsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }
  const currentAdminId = localStorage.getItem('admin_id') || ''

  const ROLE_LABELS: Record<string, { label: string; color: string }> = {
    super_admin: { label: t('admin.accounts.roleSuperAdmin'), color: 'bg-red-100 text-red-700' },
    admin: { label: t('admin.accounts.roleAdmin'), color: 'bg-blue-100 text-blue-700' },
    viewer: { label: t('admin.accounts.roleViewer'), color: 'bg-gray-100 text-gray-600' },
  }

  // 비밀번호 복잡도 검증: 8자 이상, 영문+숫자+특수문자 중 2가지 이상
  function validatePassword(pw: string): string | null {
    if (!pw || pw.length < 8) return t('admin.accounts.pwMinLength')
    const hasLetter = /[A-Za-z]/.test(pw)
    const hasDigit = /[0-9]/.test(pw)
    const hasSymbol = /[^A-Za-z0-9]/.test(pw)
    const types = [hasLetter, hasDigit, hasSymbol].filter(Boolean).length
    if (types < 2) return t('admin.accounts.pwComplexity')
    return null
  }
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
      toast.error(e.response?.data?.error || t('admin.accounts.loadFailed'))
    } finally { setLoading(false) }
  }

  async function createAdmin() {
    if (!form.email || !form.password) { toast.error(t('admin.accounts.enterEmailPw')); return }
    const pwErr = validatePassword(form.password)
    if (pwErr) { toast.error(pwErr); return }
    setSaving(true)
    try {
      const res = await api.post('/api/admin/admins', form, h)
      if (res.data.success) {
        toast.success(t('admin.accounts.created'))
        setShowCreate(false)
        setForm({ email: '', name: '', password: '', role: 'admin' })
        loadAdmins()
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e.response?.data?.error || t('admin.accounts.createFailed'))
    } finally { setSaving(false) }
  }

  async function updateAdmin() {
    if (!showEdit) return
    // 자기 자신의 super_admin 권한 해제 방지
    if (String(showEdit.id) === currentAdminId && showEdit.role === 'super_admin' && editForm.role !== 'super_admin') {
      toast.error(t('admin.accounts.cannotRevokeSelf'))
      return
    }
    // 마지막 super_admin 강등 방지 (프론트 1차 체크)
    if (showEdit.role === 'super_admin' && editForm.role !== 'super_admin') {
      const superAdminCount = admins.filter(a => a.role === 'super_admin').length
      if (superAdminCount <= 1) {
        toast.error(t('admin.accounts.cannotRevokeLastSuper'))
        return
      }
    }
    // 역할 변경 시 확인
    if (editForm.role !== showEdit.role) {
      if (!confirm(t('admin.accounts.confirmRoleChange', { from: showEdit.role, to: editForm.role }))) return
    }
    setSaving(true)
    try {
      const res = await api.patch(`/api/admin/admins/${showEdit.id}`, editForm, h)
      if (res.data.success) {
        toast.success(t('common.updateSuccess'))
        setShowEdit(null)
        loadAdmins()
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e.response?.data?.error || t('admin.accounts.updateFailed'))
    } finally { setSaving(false) }
  }

  async function deleteAdmin(admin: Admin) {
    // 본인 계정 삭제 방지
    if (String(admin.id) === currentAdminId) {
      toast.error(t('admin.accounts.cannotDeleteSelf'))
      return
    }
    // 마지막 super_admin 삭제 방지
    if (admin.role === 'super_admin') {
      const superAdminCount = admins.filter(a => a.role === 'super_admin').length
      if (superAdminCount <= 1) {
        toast.error(t('admin.accounts.cannotDeleteLastSuper'))
        return
      }
    }
    if (!confirm(t('admin.accounts.confirmDelete', { name: admin.name || admin.email }))) return
    try {
      const res = await api.delete(`/api/admin/admins/${admin.id}`, h)
      if (res.data.success) {
        toast.success(t('common.deleteSuccess'))
        loadAdmins()
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e.response?.data?.error || t('admin.accounts.deleteFailed'))
    }
  }

  async function resetPassword() {
    if (!showResetPw || !newPassword) { toast.error(t('admin.accounts.enterNewPw')); return }
    const pwErr = validatePassword(newPassword)
    if (pwErr) { toast.error(pwErr); return }
    setSaving(true)
    try {
      const res = await api.post(`/api/admin/admins/${showResetPw.id}/reset-password`, { newPassword }, h)
      if (res.data.success) {
        toast.success(t('seller.resetPassword.changed'))
        setShowResetPw(null)
        setNewPassword('')
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e.response?.data?.error || t('admin.accounts.pwChangeFailed'))
    } finally { setSaving(false) }
  }

  function openEdit(admin: Admin) {
    setEditForm({ name: admin.name || '', role: admin.role, email: admin.email })
    setShowEdit(admin)
  }

  return (
    <AdminLayout title={t('admin.accounts.pageTitle')}>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title={t('admin.accounts.pageTitle')}
          subtitle={t('admin.accounts.listHeader', { count: admins.length })}
          icon={<UserCog className="h-5 w-5" />}
          actions={
            <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
              <Plus className="h-3.5 w-3.5" /> {t('admin.accounts.newAdmin')}
            </button>
          }
        />
      {loading ? (
        <DashboardLoading />
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <UserCog className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900">{t('admin.accounts.listHeader', { count: admins.length })}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  {['ID', t('auth.email'), t('common.name'), t('admin.accounts.role'), t('admin.accounts.createdAt'), t('admin.accounts.action')].map(h => (
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
                          <button onClick={() => openEdit(admin)} className="p-1 rounded hover:bg-gray-100" aria-label={t("common.edit", { defaultValue: "수정" })} title={t("common.edit")}><Edit2 className="w-3.5 h-3.5 text-gray-500" /></button>
                          <button onClick={() => { setShowResetPw(admin); setNewPassword('') }} className="p-1 rounded hover:bg-gray-100" aria-label={t("admin.accounts.changePassword", { defaultValue: "비밀번호 변경" })} title={t("admin.accounts.changePassword")}><Key className="w-3.5 h-3.5 text-amber-500" /></button>
                          <button onClick={() => deleteAdmin(admin)} className="p-1 rounded hover:bg-gray-100" aria-label={t("common.delete", { defaultValue: "삭제" })} title={t("common.delete")}><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
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
              <h3 className="text-sm font-semibold text-gray-900">{t('admin.accounts.addNew')}</h3>
              <button onClick={() => setShowCreate(false)} aria-label="닫기"><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <input type="email" placeholder={t('auth.email')} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900" />
              <input type="text" placeholder={t('common.name')} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900" />
              <input type="password" placeholder={t('auth.password')} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900" />
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900">
                <option value="admin">{t('admin.accounts.roleAdmin')}</option>
                <option value="super_admin">{t('admin.accounts.roleSuperAdmin')}</option>
                <option value="viewer">{t('admin.accounts.roleViewerReadonly')}</option>
              </select>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg">{t('common.cancel')}</button>
              <button onClick={createAdmin} disabled={saving} className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg disabled:opacity-50">
                {saving ? t('common.creating') : t('seller.coupons.createBtn')}
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
            <h3 className="text-sm font-semibold text-gray-900 mb-4">{t('admin.accounts.editAdmin', { email: showEdit.email })}</h3>
            <div className="space-y-3">
              <input type="text" placeholder={t('common.name')} value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900" />
              <input type="email" placeholder={t('auth.email')} value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900" />
              <select value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900">
                <option value="admin">{t('admin.accounts.roleAdmin')}</option>
                <option value="super_admin">{t('admin.accounts.roleSuperAdmin')}</option>
                <option value="viewer">{t('admin.accounts.roleViewer')}</option>
              </select>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowEdit(null)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg">{t('common.cancel')}</button>
              <button onClick={updateAdmin} disabled={saving} className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg disabled:opacity-50">
                {saving ? t('common.saving') : t('common.save')}
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
            <h3 className="text-sm font-semibold text-gray-900 mb-4">{t('admin.accounts.changePasswordFor', { email: showResetPw.email })}</h3>
            <input type="password" placeholder={t('admin.accounts.newPasswordPlaceholder')} value={newPassword} onChange={e => setNewPassword(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900" />
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowResetPw(null)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg">{t('common.cancel')}</button>
              <button onClick={resetPassword} disabled={saving} className="flex-1 py-2.5 bg-amber-500 text-white text-sm font-medium rounded-lg disabled:opacity-50">
                {saving ? t('admin.accounts.changing') : t('common.change')}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  )
}
