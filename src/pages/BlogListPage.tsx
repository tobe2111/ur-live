import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Clock, Tag, ChevronRight } from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'

interface BlogPost {
  id: number; slug: string; title: string; summary: string; tags: string
  author: string; thumbnail_url: string | null; published_at: string
}

export default function BlogListPage() {
  const navigate = useNavigate()
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTag, setSelectedTag] = useState('')

  useEffect(() => {
    const url = selectedTag ? `/api/blog/public?tag=${selectedTag}` : '/api/blog/public'
    api.get(url)
      .then(r => { if (r.data.success) setPosts(r.data.data || []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selectedTag])

  const allTags = [...new Set(posts.flatMap(p => { try { return JSON.parse(p.tags) } catch { return [] } }))]

  return (
    <div className="min-h-screen bg-white">
      <SEO title="블로그" description="유어딜 라이브 커머스 블로그 — 셀러 가이드, 트렌드, 팁" url="/blog" />

      {/* Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto flex items-center px-4 py-3">
          <button onClick={() => navigate('/')} className="p-2 rounded-full hover:bg-gray-100 mr-2">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">유어딜 블로그</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* 태그 필터 */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6">
          <button onClick={() => setSelectedTag('')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 ${!selectedTag ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
            전체
          </button>
          {allTags.map((tag: string) => (
            <button key={tag} onClick={() => setSelectedTag(tag)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 ${selectedTag === tag ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {tag}
            </button>
          ))}
        </div>

        {/* 글 목록 */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-gray-500">아직 작성된 글이 없습니다</div>
        ) : (
          <div className="space-y-4">
            {posts.map(post => {
              const tags: string[] = (() => { try { return JSON.parse(post.tags) } catch { return [] } })()
              return (
                <Link key={post.id} to={`/blog/${post.slug}`}
                  className="block bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-shadow">
                  <div className="flex gap-4">
                    <div className="flex-1 min-w-0">
                      {tags.length > 0 && (
                        <div className="flex gap-1.5 mb-2">
                          {tags.slice(0, 3).map(t => (
                            <span key={t} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{t}</span>
                          ))}
                        </div>
                      )}
                      <h2 className="text-base font-bold text-gray-900 line-clamp-2 leading-snug">{post.title}</h2>
                      <p className="text-sm text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">{post.summary}</p>
                      <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                        <span>{post.author}</span>
                        <span>·</span>
                        <span>{new Date(post.published_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      </div>
                    </div>
                    {post.thumbnail_url && (
                      <img src={post.thumbnail_url} alt="" className="w-24 h-24 rounded-xl object-cover shrink-0" />
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
