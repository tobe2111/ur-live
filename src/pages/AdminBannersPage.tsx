import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { Plus, Edit, Trash2, Eye, EyeOff, Calendar, Link as LinkIcon, Image as ImageIcon, X } from 'lucide-react'

interface Banner {
  id: number
  title: string
  image_url: string
  link_url?: string
  description?: string
  is_active: boolean
  display_order: number
  start_date?: string
  end_date?: string
  created_at: string
  updated_at: string
}

const EMPTY_FORM = {
  title: '', image_url: '', link_url: '', description: '',
  is_active: true, display_order: 0, start_date: '', end_date: ''
}

export default function AdminBannersPage() {
  const navigate = useNavigate()
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [alertMsg, setAlertMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  function showAlert(text: string, type: 'success' | 'error') {
    setAlertMsg({ text, type })
    setTimeout(() => setAlertMsg(null), 3000)
  }

  useEffect(() => {
    if (localStorage.getItem('user_type') !== 'admin') {
      navigate('/admin/login'); return
    }
    loadBanners()
  }, [])

  async function loadBanners() {
    try {
      setLoading(true)
      const response = await api.get('/api/admin/banners')
      if (response.data.success) setBanners(response.data.data || [])
    } catch (err: any) {
      showAlert(err.response?.data?.error || '배너 로딩 실패', 'error')
    } finally { setLoading(false) }
  }

  function handleEdit(banner: Banner) {
    setEditingBanner(banner)
    setFormData({
      title: banner.title, image_url: banner.image_url,
      link_url: banner.link_url || '', description: banner.description || '',
      is_active: banner.is_active, display_order: banner.display_order,
      start_date: banner.start_date ? banner.start_date.split('T')[0] : '',
      end_date: banner.end_date ? banner.end_date.split('T')[0] : ''
    })
    setShowForm(true)
  }

  function handleNew() {
    setEditingBanner(null)
    setFormData({ ...EMPTY_FORM, display_order: banners.length })
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.title || !formData.image_url) {
      showAlert('제목과 이미지 URL은 필수입니다.', 'error'); return
    }
    try {
      if (editingBanner) {
        await api.put(`/api/admin/banners/${editingBanner.id}`, formData)
        showAlert('배너가 수정되었습니다.', 'success')
      } else {
        await api.post('/api/admin/banners', formData)
        showAlert('배너가 생성되었습니다.', 'success')
      }
      setShowForm(false); loadBanners()
    } catch (err: any) { showAlert(err.response?.data?.error || '배너 저장 실패', 'error') }
  }

  async function handleDelete(id: number) {
    if (!confirm('정말 이 배너를 삭제하시겠습니까?')) return
    try {
      await api.delete(`/api/admin/banners/${id}`)
      showAlert('배너가 삭제되었습니다.', 'success'); loadBanners()
    } catch (err: any) { showAlert(err.response?.data?.error || '배너 삭제 실패', 'error') }
  }

  async function toggleActive(banner: Banner) {
    try {
      await api.put(`/api/admin/banners/${banner.id}`, { ...banner, is_active: !banner.is_active })
      showAlert(`배너가 ${!banner.is_active ? '활성화' : '비활성화'}되었습니다.`, 'success'); loadBanners()
    } catch (err: any) { showAlert(err.response?.data?.error || '상태 변경 실패', 'error') }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F4F5F7]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">배너를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <AdminLayout
      title="배너 관리"
      headerRight={
        <button onClick={handleNew} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700">
          <Plus className="w-3.5 h-3.5" /> 새 배너 추가
        </button>
      }
    >
      {/* 알림 */}
      {alertMsg && (
        <div className={`p-4 rounded-xl text-sm font-medium ${alertMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {alertMsg.text}
        </div>
      )}

      {/* 배너 등록/수정 폼 */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">{editingBanner ? '배너 수정' : '새 배너 추가'}</h2>
            <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">제목 *</label>
                <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">순서</label>
                <input type="number" value={formData.display_order} onChange={e => setFormData({ ...formData, display_order: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">이미지 URL *</label>
              <input type="url" value={formData.image_url} onChange={e => setFormData({ ...formData, image_url: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="https://..." required />
              {formData.image_url && <img src={formData.image_url} alt="미리보기" className="mt-2 w-full max-w-sm h-32 object-cover rounded-lg" />}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">링크 URL</label>
              <input type="text" value={formData.link_url} onChange={e => setFormData({ ...formData, link_url: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="#live-section 또는 https://..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">설명</label>
              <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" rows={2} />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">시작일</label>
                <input type="date" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">종료일</label>
                <input type="date" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_active" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
              <label htmlFor="is_active" className="text-sm font-medium text-gray-700">활성화</label>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">취소</button>
              <button type="submit" className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700">{editingBanner ? '수정' : '생성'}</button>
            </div>
          </form>
        </div>
      )}

      {/* 배너 목록 */}
      <div className="space-y-3">
        {banners.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm py-20 text-center">
            <ImageIcon className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400 mb-4">등록된 배너가 없습니다.</p>
            <button onClick={handleNew} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 mx-auto">
              <Plus className="w-4 h-4" /> 첫 배너 추가하기
            </button>
          </div>
        ) : banners.map(banner => (
          <div key={banner.id} className={`bg-white rounded-xl shadow-sm p-4 flex items-start gap-4 ${!banner.is_active ? 'opacity-60' : ''}`}>
            <div className="relative w-40 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
              <img src={banner.image_url} alt={banner.title} className="w-full h-full object-cover" />
              {!banner.is_active && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <EyeOff className="w-6 h-6 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between mb-1">
                <h3 className="text-sm font-semibold text-gray-900">{banner.title}</h3>
                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                  <span className="text-xs text-gray-400">순서 {banner.display_order}</span>
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${banner.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {banner.is_active ? '활성' : '비활성'}
                  </span>
                </div>
              </div>
              {banner.description && <p className="text-xs text-gray-400 mb-2">{banner.description}</p>}
              <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
                {banner.link_url && <span className="flex items-center gap-1"><LinkIcon className="w-3.5 h-3.5" /><span className="truncate max-w-xs">{banner.link_url}</span></span>}
                {banner.start_date && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{new Date(banner.start_date).toLocaleDateString()}</span>}
                {banner.end_date && <span>~ {new Date(banner.end_date).toLocaleDateString()}</span>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleEdit(banner)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200">
                  <Edit className="w-3.5 h-3.5" /> 수정
                </button>
                <button onClick={() => toggleActive(banner)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200">
                  {banner.is_active ? <><EyeOff className="w-3.5 h-3.5" /> 비활성화</> : <><Eye className="w-3.5 h-3.5" /> 활성화</>}
                </button>
                <button onClick={() => handleDelete(banner.id)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-500 bg-red-50 hover:bg-red-100">
                  <Trash2 className="w-3.5 h-3.5" /> 삭제
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  )
}
