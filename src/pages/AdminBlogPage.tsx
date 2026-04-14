/**
 * Admin Blog Management Page
 * 블로그 글 작성 · 수정 · 발행 · 삭제
 */
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { Button } from '@/components/ui/button'
import {
  Plus, Edit2, Trash2, Eye, EyeOff,
  Loader2, ArrowLeft, Save, Send
} from 'lucide-react'

interface BlogPost {
  id: number
  slug: string
  title: string
  summary: string
  content: string
  tags: string   // JSON string
  author: string
  thumbnail_url: string | null
  is_published: number
  published_at: string | null
  created_at: string
  updated_at: string
}

type View = 'list' | 'edit'

// ── 슬러그 자동 생성 ─────────────────────────────────────────
function toSlug(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

// ── 태그 파싱 ────────────────────────────────────────────────
function parseTags(raw: string): string[] {
  try { return JSON.parse(raw) } catch { return [] }
}

export default function AdminBlogPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const editId = searchParams.get('edit')

  const [view, setView] = useState<View>(editId ? 'edit' : 'list')
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // 폼 상태
  const [form, setForm] = useState({
    id: 0,
    slug: '',
    title: '',
    summary: '',
    content: '',
    tagsInput: '',   // 콤마 구분 입력
    author: '유어딜 팀',
    thumbnail_url: '',
    is_published: false,
  })

  useEffect(() => { loadPosts() }, [])

  useEffect(() => {
    if (editId) {
      const post = posts.find(p => p.id === Number(editId))
      if (post) openEdit(post)
    }
  }, [editId, posts])

  async function loadPosts() {
    try {
      setLoading(true)
      const res = await api.get('/api/admin/blog')
      if (res.data.success) setPosts(res.data.data || [])
    } catch { toast.error('블로그 목록 로드 실패') }
    finally { setLoading(false) }
  }

  function openEdit(post?: BlogPost) {
    if (post) {
      setForm({
        id: post.id,
        slug: post.slug || '',
        title: post.title || '',
        summary: post.summary || '',
        content: post.content || '',
        tagsInput: parseTags(post.tags || '[]').join(', '),
        author: post.author || '유어딜 팀',
        thumbnail_url: post.thumbnail_url || '',
        is_published: post.is_published === 1,
      })
    } else {
      setForm({ id: 0, slug: '', title: '', summary: '', content: '', tagsInput: '', author: '유어딜 팀', thumbnail_url: '', is_published: false })
    }
    setView('edit')
  }

  function handleTitleChange(title: string) {
    setForm(f => ({
      ...f,
      title,
      slug: f.id === 0 ? toSlug(title) : f.slug,
    }))
  }

  async function save(publish?: boolean) {
    if (!form.title.trim()) { toast.error('제목을 입력해주세요.'); return }
    if (!form.slug.trim()) { toast.error('슬러그를 입력해주세요.'); return }
    if (!form.content.trim()) { toast.error('본문을 입력해주세요.'); return }

    try {
      setSaving(true)
      const payload = {
        slug: form.slug.trim(),
        title: form.title.trim(),
        summary: form.summary.trim(),
        content: form.content,
        tags: form.tagsInput.split(',').map(t => t.trim()).filter(Boolean),
        author: form.author.trim() || '유어딜 팀',
        thumbnail_url: form.thumbnail_url.trim() || null,
        is_published: publish !== undefined ? publish : form.is_published,
      }

      if (form.id) {
        await api.put(`/api/admin/blog/${form.id}`, payload)
        toast.success(payload.is_published ? '발행되었습니다.' : '저장되었습니다.')
      } else {
        await api.post('/api/admin/blog', payload)
        toast.success(payload.is_published ? '발행되었습니다.' : '임시저장 되었습니다.')
      }

      await loadPosts()
      setView('list')
      setSearchParams({})
    } catch (err: any) {
      toast.error(err.response?.data?.error || '저장 실패')
    } finally { setSaving(false) }
  }

  async function deletePost(id: number) {
    if (!confirm('정말 삭제하시겠습니까?')) return
    try {
      await api.delete(`/api/admin/blog/${id}`)
      toast.success('삭제되었습니다.')
      await loadPosts()
    } catch { toast.error('삭제 실패') }
  }

  async function togglePublish(post: BlogPost) {
    try {
      await api.put(`/api/admin/blog/${post.id}`, {
        ...post,
        tags: parseTags(post.tags),
        is_published: post.is_published === 1 ? 0 : 1,
      })
      toast.success(post.is_published === 1 ? '비공개로 변경됨' : '발행됨')
      await loadPosts()
    } catch { toast.error('변경 실패') }
  }

  // ── 목록 뷰 ────────────────────────────────────────────────
  if (view === 'list') return (
    <AdminLayout title="블로그 관리">
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">블로그 관리</h1>
            <p className="text-sm text-gray-500 mt-1">글을 작성하고 docs.ur-team.com에 발행하세요</p>
          </div>
          <Button onClick={() => openEdit()} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="w-4 h-4 mr-2" /> 새 글 작성
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
            <p className="text-gray-400 mb-4">작성된 글이 없습니다</p>
            <Button onClick={() => openEdit()} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4 mr-2" /> 첫 글 작성하기
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map(post => (
              <div key={post.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 hover:shadow-sm transition-shadow">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      post.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {post.is_published ? '발행됨' : '임시저장'}
                    </span>
                    {parseTags(post.tags).slice(0, 3).map(tag => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">{tag}</span>
                    ))}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 truncate">{post.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {post.author} · {post.published_at
                      ? new Date(post.published_at).toLocaleDateString('ko-KR')
                      : new Date(post.created_at).toLocaleDateString('ko-KR')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => togglePublish(post)}
                    title={post.is_published ? '비공개로 변경' : '발행'}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                  >
                    {post.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => { openEdit(post); setSearchParams({ edit: String(post.id) }) }}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deletePost(post.id)}
                    className="p-2 rounded-lg hover:bg-red-50 text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )

  // ── 에디터 뷰 ───────────────────────────────────────────────
  return (
    <AdminLayout title="블로그 관리">
      <div className="max-w-3xl mx-auto py-8 px-4 space-y-5">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => { setView('list'); setSearchParams({}) }}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4" /> 목록으로
          </button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => save(false)} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              임시저장
            </Button>
            <Button onClick={() => save(true)} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              발행하기
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
          {/* 제목 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">제목 <span className="text-red-500">*</span></label>
            <input
              value={form.title}
              onChange={e => handleTitleChange(e.target.value)}
              placeholder="블로그 글 제목"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* 슬러그 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">슬러그 (URL)</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 shrink-0">docs.ur-team.com/blog/</span>
              <input
                value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                placeholder="url-friendly-slug"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* 요약 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">요약 (SEO 설명)</label>
            <textarea
              value={form.summary}
              onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
              placeholder="검색 결과와 소셜 미리보기에 표시될 요약 (150자 이내 권장)"
              rows={2}
              maxLength={300}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{form.summary.length}/300</p>
          </div>

          {/* 태그 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">태그</label>
            <input
              value={form.tagsInput}
              onChange={e => setForm(f => ({ ...f, tagsInput: e.target.value }))}
              placeholder="셀러, 라이브방송, 팁  (콤마로 구분)"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* 저자 + 썸네일 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">저자</label>
              <input
                value={form.author}
                onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
                placeholder="유어딜 팀"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">썸네일 URL</label>
              <input
                value={form.thumbnail_url}
                onChange={e => setForm(f => ({ ...f, thumbnail_url: e.target.value }))}
                placeholder="https://..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* 본문 에디터 */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
            <span className="text-sm font-medium text-gray-700">본문</span>
            <span className="text-xs text-gray-400">(마크다운 지원)</span>
            <span className="ml-auto text-xs text-gray-400">{form.content.length}자</span>
          </div>
          <textarea
            value={form.content}
            onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            placeholder={`## 소제목\n\n본문 내용을 마크다운으로 작성하세요.\n\n- 목록 항목\n- 목록 항목\n\n**굵게**, *기울임*, \`코드\`\n\n> 인용구`}
            className="w-full px-5 py-4 text-sm font-mono leading-relaxed resize-none focus:outline-none"
            style={{ minHeight: 480 }}
          />
        </div>

        {/* 발행 상태 토글 */}
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">발행 상태</p>
            <p className="text-xs text-gray-500">{form.is_published ? '발행됨 — 공개적으로 노출됩니다' : '임시저장 — 외부에 노출되지 않습니다'}</p>
          </div>
          <button
            onClick={() => setForm(f => ({ ...f, is_published: !f.is_published }))}
            className={`relative w-12 h-6 rounded-full transition-colors ${form.is_published ? 'bg-blue-600' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${form.is_published ? 'translate-x-6' : ''}`} />
          </button>
        </div>

        {/* 하단 버튼 */}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => save(false)} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            임시저장
          </Button>
          <Button onClick={() => save(true)} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white px-6">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            발행하기
          </Button>
        </div>
      </div>
    </AdminLayout>
  )
}
