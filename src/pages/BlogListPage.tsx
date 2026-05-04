import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
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
      .catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
      .finally(() => setLoading(false))
  }, [selectedTag])

  const allTags = [...new Set(posts.flatMap(p => { try { return JSON.parse(p.tags) } catch { return [] } }))]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0A]">
      <SEO title="블로그" description="유어딜 라이브 커머스 블로그 — 셀러 가이드, 트렌드, 팁" url="/blog" />

      {/* Header */}
      <div className="bg-white dark:bg-[#0A0A0A] border-b border-gray-200 dark:border-[#1A1A1A]">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#1A1A1A]">
              <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-200" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">유어딜 블로그</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">셀러 가이드 · 트렌드 · 서비스 소식</p>
            </div>
          </div>
          <Link to="/seller/register" className="px-4 py-2 bg-pink-500 text-white rounded-lg text-sm font-bold hover:bg-pink-600">
            셀러 시작하기
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* 태그 필터 */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-8">
          <button onClick={() => setSelectedTag('')}
            className={`px-4 py-2 rounded-full text-sm font-medium shrink-0 ${!selectedTag ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-white dark:bg-[#1C1C1E] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-[#2A2A2A]'}`}>
            전체
          </button>
          {allTags.map((tag: string) => (
            <button key={tag} onClick={() => setSelectedTag(tag)}
              className={`px-4 py-2 rounded-full text-sm font-medium shrink-0 ${selectedTag === tag ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-white dark:bg-[#1C1C1E] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-[#2A2A2A]'}`}>
              {tag}
            </button>
          ))}
        </div>

        {/* 글 목록 — PC 그리드 */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-gray-300 dark:border-[#2A2A2A] border-t-gray-900 dark:border-t-white rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">아직 작성된 글이 없습니다</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map(post => {
              const tags: string[] = (() => { try { return JSON.parse(post.tags) } catch { return [] } })()
              return (
                <Link key={post.id} to={`/blog/${post.slug}`}
                  className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-200 dark:border-[#2A2A2A] overflow-hidden hover:shadow-lg dark:hover:shadow-black/40 transition-shadow group">
                  {post.thumbnail_url ? (
                    <img src={post.thumbnail_url} alt="" className="w-full h-48 object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-48 bg-gradient-to-br from-pink-100 dark:from-pink-900/20 to-orange-100 dark:to-orange-900/20 flex items-center justify-center">
                      <span className="text-4xl">📝</span>
                    </div>
                  )}
                  <div className="p-5">
                    {tags.length > 0 && (
                      <div className="flex gap-1.5 mb-2">
                        {tags.slice(0, 3).map(t => (
                          <span key={t} className="text-[10px] bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 px-2 py-0.5 rounded-full font-medium">{t}</span>
                        ))}
                      </div>
                    )}
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-2 leading-snug group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">{post.title}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-2 leading-relaxed">{post.summary}</p>
                    <div className="flex items-center gap-2 mt-4 text-xs text-gray-400 dark:text-gray-500">
                      <span>{post.author}</span>
                      <span>·</span>
                      <span>{new Date(post.published_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}</span>
                    </div>
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
