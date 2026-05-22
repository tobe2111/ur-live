import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
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
  const { t } = useTranslation()
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
    if (!localStorage.getItem('admin_token')) {
      navigate('/admin/login'); return
    }
    loadBanners()
  }, [])

  async function loadBanners() {
    try {
      setLoading(true)
      const response = await api.get('/api/admin/banners')
      if (response.data.success) setBanners(response.data.data || [])
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string }; status?: number } }
      showAlert(err_.response?.data?.error || t('admin.banners.k001', { defaultValue: '배너 로딩 실패' }), 'error')
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
    // 🛡️ 2026-05-18: 제목 optional 화 — 이미지만 있어도 등록 허용 (이미지 자체가 메시지인 경우).
    if (!formData.image_url) {
      showAlert(t('admin.banners.imageRequired', { defaultValue: '이미지 URL은 필수입니다.' }), 'error'); return
    }
    try {
      if (editingBanner) {
        await api.put(`/api/admin/banners/${editingBanner.id}`, formData)
        showAlert(t('admin.banners.k003', { defaultValue: '배너가 수정되었습니다.' }), 'success')
      } else {
        await api.post('/api/admin/banners', formData)
        showAlert(t('admin.banners.k004', { defaultValue: '배너가 생성되었습니다.' }), 'success')
      }
      setShowForm(false); loadBanners()
    } catch (err: unknown) { showAlert((err as { response?: { data?: { error?: string; message?: string }; status?: number } }).response?.data?.error || t('admin.banners.k005', { defaultValue: '배너 저장 실패' }), 'error') }
  }

  async function handleDelete(id: number) {
    if (!confirm(t('admin.banners.k006', { defaultValue: '정말 이 배너를 삭제하시겠습니까?' }))) return
    try {
      await api.delete(`/api/admin/banners/${id}`)
      showAlert(t('admin.banners.k007', { defaultValue: '배너가 삭제되었습니다.' }), 'success'); loadBanners()
    } catch (err: unknown) { showAlert((err as { response?: { data?: { error?: string; message?: string }; status?: number } }).response?.data?.error || t('admin.banners.k008', { defaultValue: '배너 삭제 실패' }), 'error') }
  }

  async function toggleActive(banner: Banner) {
    try {
      await api.put(`/api/admin/banners/${banner.id}`, { ...banner, is_active: !banner.is_active })
      showAlert(`배너가 ${!banner.is_active ? '활성화' : '비활성화'}되었습니다.`, 'success'); loadBanners()
    } catch (err: unknown) { showAlert((err as { response?: { data?: { error?: string; message?: string }; status?: number } }).response?.data?.error || t('admin.banners.k009', { defaultValue: '상태 변경 실패' }), 'error') }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F4F5F7]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">{t('admin.banners.k010', { defaultValue: '배너를 불러오는 중...' })}</p>
        </div>
      </div>
    )
  }

  return (
    <AdminLayout title={t('admin.pages.banners')}>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title={t('admin.pages.banners')}
          subtitle={t('admin.banners.k011', { defaultValue: "메인 배너 등록 · 표시 순서 관리" })}
          icon={<ImageIcon className="h-5 w-5" />}
          actions={
            <button onClick={handleNew} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
              <Plus className="h-3.5 w-3.5" /> 새 배너 추가
            </button>
          }
        />
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
            <h2 className="text-sm font-semibold text-gray-900">{editingBanner ? t('admin.banners.k012', { defaultValue: '배너 수정' }) : t('admin.banners.k013', { defaultValue: '새 배너 추가' })}</h2>
            <button onClick={() => setShowForm(false)} aria-label="닫기" className="p-1.5 rounded-lg hover:bg-gray-100">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('admin.banners.titleOptional', { defaultValue: '제목 (선택)' })}</label>
                <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder={t('admin.banners.titlePlaceholder', { defaultValue: '비워두면 이미지만 표시됩니다' })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('admin.banners.k015', { defaultValue: '순서' })} <span className="text-gray-400 font-normal">{t('admin.banners.k016', { defaultValue: '(숫자 낮을수록 앞에 표시)' })}</span></label>
                <input type="number" min="0" value={formData.display_order} onChange={e => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('admin.banners.k017', { defaultValue: '이미지 URL *' })}</label>
              <input type="url" value={formData.image_url} onChange={e => setFormData({ ...formData, image_url: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="https://..." required />
              <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <p className="text-xs font-semibold text-blue-700 mb-1.5">📐 권장 이미지 규격 (메인 hero 배너)</p>
                <ul className="space-y-1 text-xs text-blue-600">
                  <li><strong>⭐ 권장 사이즈:</strong> 1600 × 500 px (16:5) — 모바일/PC 모두 자연</li>
                  <li>대체 사이즈: 1200 × 420 px (≈2.86:1)</li>
                  <li><strong>안전영역:</strong> 이미지 중앙 16:7 (1120×490) 안에 핵심 텍스트/로고</li>
                  <li>화면 적용 aspect: 모바일 16:7 / sm 21:6 / PC 28:5 (max-h 280px)</li>
                  <li><strong>최대 용량:</strong> 500KB 이하 (큰 이미지 = 페이지 느려짐)</li>
                  <li><strong>형식:</strong> WebP &gt; PNG &gt; JPEG</li>
                </ul>
                <p className="text-xs text-blue-500 mt-1.5">※ 여러 배너 등록 시 사용자가 dots 클릭으로 전환 / 자동 슬라이드 X</p>
                <p className="text-xs text-blue-500 mt-0.5">※ image_url 없이 등록 시 코드 fallback 그라디언트 (4종) 사용</p>
              </div>
              {formData.image_url && <img src={formData.image_url} alt={t('admin.banners.k029', { defaultValue: "미리보기" })} className="mt-2 w-full max-w-sm aspect-video object-cover rounded-lg" loading="lazy" />}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('admin.banners.k030', { defaultValue: '링크 URL' })}</label>
              <input type="text" value={formData.link_url} onChange={e => setFormData({ ...formData, link_url: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder={t('admin.banners.k031', { defaultValue: "#live-section 또는 https://..." })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('admin.banners.k032', { defaultValue: '설명' })}</label>
              <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none" rows={2} />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('admin.banners.k033', { defaultValue: '시작일' })}</label>
                <input type="date" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('admin.banners.k034', { defaultValue: '종료일' })}</label>
                <input type="date" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_active" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
              <label htmlFor="is_active" className="text-sm font-medium text-gray-700">{t('admin.banners.k035', { defaultValue: '활성화' })}</label>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">{t('admin.banners.k036', { defaultValue: '취소' })}</button>
              <button type="submit" className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700">{editingBanner ? t('admin.banners.k037', { defaultValue: '수정' }) : t('admin.banners.k038', { defaultValue: '생성' })}</button>
            </div>
          </form>
        </div>
      )}

      {/* 배너 목록 */}
      <div className="space-y-3">
        {banners.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm py-20 text-center">
            <ImageIcon className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400 mb-4">{t('admin.banners.k039', { defaultValue: '등록된 배너가 없습니다.' })}</p>
            <button onClick={handleNew} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 mx-auto">
              <Plus className="w-4 h-4" /> 첫 배너 추가하기
            </button>
          </div>
        ) : banners.map(banner => (
          <div key={banner.id} className={`bg-white rounded-xl shadow-sm p-4 flex items-start gap-4 ${!banner.is_active ? 'opacity-60' : ''}`}>
            <div className="relative w-40 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
              <img src={banner.image_url} alt={banner.title || t('admin.banners.noTitleAlt', { defaultValue: '배너 이미지' })} className="w-full h-full object-cover" loading="lazy" />
              {!banner.is_active && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <EyeOff className="w-6 h-6 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between mb-1">
                <h3 className={`text-sm font-semibold ${banner.title ? 'text-gray-900' : 'text-gray-400 italic'}`}>{banner.title || t('admin.banners.noTitle', { defaultValue: '(제목 없음 — 이미지만)' })}</h3>
                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                  <span className="text-xs text-gray-400">순서 {banner.display_order}</span>
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${banner.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {banner.is_active ? t('admin.banners.k040', { defaultValue: '활성' }) : t('admin.banners.k041', { defaultValue: '비활성' })}
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
                  {banner.is_active ? <><EyeOff className="w-3.5 h-3.5" /> {t('admin.banners.k042', { defaultValue: '비활성화' })}</> : <><Eye className="w-3.5 h-3.5" /> {t('admin.banners.k035', { defaultValue: '활성화' })}</>}
                </button>
                <button onClick={() => handleDelete(banner.id)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-500 bg-red-50 hover:bg-red-100">
                  <Trash2 className="w-3.5 h-3.5" /> 삭제
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      </div>
    </AdminLayout>
  )
}
