import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { logout as authLogout } from '@/utils/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Trash2, Eye, EyeOff, Calendar, Link as LinkIcon, Image as ImageIcon, MoveUp, MoveDown } from 'lucide-react'
import { CustomModal, useModal } from '@/components/CustomModal'

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

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null)
  const [showForm, setShowForm] = useState(false)
  const navigate = useNavigate()
  const { modal, showAlert, closeModal } = useModal()

  const [formData, setFormData] = useState({
    title: '',
    image_url: '',
    link_url: '',
    description: '',
    is_active: true,
    display_order: 0,
    start_date: '',
    end_date: ''
  })

  useEffect(() => {
    checkAuth()
    loadBanners()
  }, [])

  function checkAuth() {
    const userType = localStorage.getItem('user_type')
    if (userType !== 'admin') {
      showAlert('관리자 권한이 필요합니다.', 'error')
      setTimeout(() => navigate('/admin/login'), 1500)
    }
  }

  async function loadBanners() {
    try {
      setLoading(true)
      const response = await api.get('/api/admin/banners')
      if (response.data.success) {
        setBanners(response.data.data || [])
      }
    } catch (error: any) {
      showAlert(error.response?.data?.error || '배너 로딩 실패', 'error')
    } finally {
      setLoading(false)
    }
  }

  function handleEdit(banner: Banner) {
    setEditingBanner(banner)
    setFormData({
      title: banner.title,
      image_url: banner.image_url,
      link_url: banner.link_url || '',
      description: banner.description || '',
      is_active: banner.is_active,
      display_order: banner.display_order,
      start_date: banner.start_date ? banner.start_date.split('T')[0] : '',
      end_date: banner.end_date ? banner.end_date.split('T')[0] : ''
    })
    setShowForm(true)
  }

  function handleNew() {
    setEditingBanner(null)
    setFormData({
      title: '',
      image_url: '',
      link_url: '',
      description: '',
      is_active: true,
      display_order: banners.length,
      start_date: '',
      end_date: ''
    })
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.title || !formData.image_url) {
      showAlert('제목과 이미지 URL은 필수입니다.', 'error')
      return
    }

    try {
      if (editingBanner) {
        await api.put(`/api/admin/banners/${editingBanner.id}`, formData)
        showAlert('배너가 수정되었습니다.', 'success')
      } else {
        await api.post('/api/admin/banners', formData)
        showAlert('배너가 생성되었습니다.', 'success')
      }
      setShowForm(false)
      loadBanners()
    } catch (error: any) {
      showAlert(error.response?.data?.error || '배너 저장 실패', 'error')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('정말 이 배너를 삭제하시겠습니까?')) return

    try {
      await api.delete(`/api/admin/banners/${id}`)
      showAlert('배너가 삭제되었습니다.', 'success')
      loadBanners()
    } catch (error: any) {
      showAlert(error.response?.data?.error || '배너 삭제 실패', 'error')
    }
  }

  async function toggleActive(banner: Banner) {
    try {
      await api.put(`/api/admin/banners/${banner.id}`, {
        ...banner,
        is_active: !banner.is_active
      })
      showAlert(`배너가 ${!banner.is_active ? '활성화' : '비활성화'}되었습니다.`, 'success')
      loadBanners()
    } catch (error: any) {
      showAlert(error.response?.data?.error || '상태 변경 실패', 'error')
    }
  }

  function handleLogout() {
    // 🔧 표준 logout 함수 사용 (JWT + 레거시 키 모두 삭제)
    authLogout()
    console.log('[AdminBannersPage] 🚪 관리자 로그아웃 완료')
    navigate('/admin/login')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#6A5ACD] mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CustomModal
        isOpen={modal.isOpen}
        onClose={closeModal}
        onConfirm={modal.onConfirm}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />

      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">🎨 배너 관리</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                onClick={() => navigate('/admin')}
                variant="outline"
              >
                대시보드로
              </Button>
              <Button 
                onClick={handleLogout}
                variant="outline"
              >
                로그아웃
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        {/* Actions */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-gray-600">
            총 <span className="font-bold text-[#6A5ACD]">{banners.length}</span>개의 배너
          </p>
          <Button 
            onClick={handleNew}
            className="bg-gradient-to-r from-[#6A5ACD] to-[#8A5ACD] hover:from-[#5A4ABD] hover:to-[#7A4ABD]"
          >
            <Plus className="h-4 w-4 mr-2" />
            새 배너 추가
          </Button>
        </div>

        {/* Banner Form */}
        {showForm && (
          <Card className="mb-6 border-2 border-[#6A5ACD]">
            <CardContent className="p-6">
              <h2 className="text-xl font-bold mb-4">
                {editingBanner ? '배너 수정' : '새 배너 추가'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">제목 *</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">순서</label>
                    <input
                      type="number"
                      value={formData.display_order}
                      onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">이미지 URL *</label>
                  <input
                    type="url"
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="https://..."
                    required
                  />
                  {formData.image_url && (
                    <div className="mt-2">
                      <img 
                        src={formData.image_url} 
                        alt="미리보기" 
                        className="w-full max-w-md h-48 object-cover rounded-lg"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">링크 URL</label>
                  <input
                    type="text"
                    value={formData.link_url}
                    onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="#live-section 또는 https://..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">설명</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    rows={3}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">시작일</label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">종료일</label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="is_active" className="text-sm font-medium">활성화</label>
                </div>

                <div className="flex items-center space-x-3 pt-4 border-t">
                  <Button type="submit" className="bg-[#6A5ACD] hover:bg-[#5A4ABD]">
                    {editingBanner ? '수정' : '생성'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => setShowForm(false)}
                  >
                    취소
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Banner List */}
        <div className="space-y-4">
          {banners.map((banner) => (
            <Card key={banner.id} className={!banner.is_active ? 'opacity-50' : ''}>
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="relative w-48 h-27 flex-shrink-0 rounded-lg overflow-hidden">
                    <img 
                      src={banner.image_url} 
                      alt={banner.title}
                      className="w-full h-full object-cover"
                    />
                    {!banner.is_active && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <EyeOff className="h-8 w-8 text-white" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{banner.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{banner.description}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={banner.is_active ? 'default' : 'secondary'}>
                          순서 {banner.display_order}
                        </Badge>
                        {banner.is_active ? (
                          <Badge className="bg-green-500">활성</Badge>
                        ) : (
                          <Badge variant="secondary">비활성</Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 text-sm text-gray-500 mb-4">
                      {banner.link_url && (
                        <div className="flex items-center space-x-1">
                          <LinkIcon className="h-4 w-4" />
                          <span className="truncate max-w-xs">{banner.link_url}</span>
                        </div>
                      )}
                      {banner.start_date && (
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(banner.start_date).toLocaleDateString()}</span>
                        </div>
                      )}
                      {banner.end_date && (
                        <span>~ {new Date(banner.end_date).toLocaleDateString()}</span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(banner)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        수정
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleActive(banner)}
                      >
                        {banner.is_active ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                        {banner.is_active ? '비활성화' : '활성화'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(banner.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        삭제
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {banners.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">등록된 배너가 없습니다.</p>
                <Button onClick={handleNew}>
                  <Plus className="h-4 w-4 mr-2" />
                  첫 배너 추가하기
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
