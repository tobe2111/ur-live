import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Clock, Share2, Tag } from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { nativeShare } from '@/lib/native'
import KakaoShareButton from '@/components/KakaoShareButton'
import { escapeHtml } from '@/shared/utils/html'

interface BlogPost {
  id: number; slug: string; title: string; summary: string; content: string
  tags: string; author: string; thumbnail_url: string | null; published_at: string
}

export default function BlogDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [post, setPost] = useState<BlogPost | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    window.scrollTo(0, 0)
    api.get(`/api/blog/public/${slug}`)
      .then(r => { if (r.data.success) setPost(r.data.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <p className="text-gray-500 mb-4">글을 찾을 수 없습니다</p>
        <Link to="/blog" className="text-blue-600 text-sm font-medium">블로그로 돌아가기</Link>
      </div>
    )
  }

  const tags: string[] = (() => { try { return JSON.parse(post.tags) } catch { return [] } })()

  function boldify(text: string) {
    return escapeHtml(text).replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-900">$1</strong>')
  }

  // 마크다운 → HTML 간단 변환
  function renderContent(content: string) {
    return content
      .split('\n\n')
      .map((block, i) => {
        const trimmed = block.trim()
        if (!trimmed) return null

        // 표 처리
        if (trimmed.includes('|') && trimmed.includes('---')) {
          const lines = trimmed.split('\n').filter(l => l.trim() && !l.trim().match(/^\|[-\s|]+\|$/))
          if (lines.length >= 2) {
            const headers = lines[0].split('|').filter(Boolean).map(h => h.trim())
            const rows = lines.slice(1).map(l => l.split('|').filter(Boolean).map(c => c.trim()))
            return (
              <div key={i} className="overflow-x-auto my-4">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>{headers.map((h, j) => <th key={j} className="text-left px-3 py-2 bg-gray-50 border-b border-gray-200 font-semibold text-gray-700">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.map((row, ri) => (
                      <tr key={ri}>{row.map((cell, ci) => <td key={ci} className="px-3 py-2 border-b border-gray-100 text-gray-600">{cell.replace(/\*\*/g, '')}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        }

        // H2
        if (trimmed.startsWith('## ')) {
          return <h2 key={i} className="text-xl font-bold text-gray-900 mt-8 mb-3">{trimmed.replace('## ', '')}</h2>
        }
        // H3
        if (trimmed.startsWith('### ')) {
          return <h3 key={i} className="text-lg font-bold text-gray-900 mt-6 mb-2">{trimmed.replace('### ', '')}</h3>
        }
        // 리스트
        if (trimmed.startsWith('- ')) {
          const items = trimmed.split('\n').filter(l => l.startsWith('- '))
          return (
            <ul key={i} className="my-3 space-y-1.5">
              {items.map((item, j) => (
                <li key={j} className="flex items-start gap-2 text-[15px] text-gray-700 leading-relaxed">
                  <span className="text-pink-500 mt-1 shrink-0">•</span>
                  <span dangerouslySetInnerHTML={{ __html: boldify(item.replace('- ', '')) }} />
                </li>
              ))}
            </ul>
          )
        }
        // 구분선
        if (trimmed === '---') {
          return <hr key={i} className="my-8 border-gray-200" />
        }
        // 일반 단락
        return (
          <p key={i} className="text-[15px] text-gray-700 leading-[1.8] my-3"
            dangerouslySetInnerHTML={{ __html: boldify(trimmed) }} />
        )
      })
      .filter(Boolean)
  }

  return (
    <div className="min-h-screen bg-white">
      <SEO title={post.title} description={post.summary} url={`/blog/${post.slug}`} />

      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-6 py-3">
          <button onClick={() => navigate('/blog')} className="p-2 rounded-full hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <button onClick={() => nativeShare({ title: post.title, url: `https://live.ur-team.com/blog/${post.slug}` })}
            className="p-2 rounded-full hover:bg-gray-100">
            <Share2 className="w-5 h-5 text-gray-700" />
          </button>
        </div>
      </div>

      {/* Article */}
      <article className="max-w-4xl mx-auto px-6 py-10">
        {/* 태그 */}
        {tags.length > 0 && (
          <div className="flex gap-1.5 mb-4">
            {tags.map(t => (
              <span key={t} className="text-xs bg-pink-50 text-pink-600 px-2.5 py-1 rounded-full font-medium">{t}</span>
            ))}
          </div>
        )}

        {/* 제목 */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">{post.title}</h1>

        {/* 요약 */}
        <p className="text-base text-gray-500 mt-3 leading-relaxed">{post.summary}</p>

        {/* 메타 */}
        <div className="flex items-center gap-3 mt-4 pb-6 border-b border-gray-100 text-sm text-gray-400">
          <span>{post.author}</span>
          <span>·</span>
          <span>{new Date(post.published_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>

        {/* 썸네일 */}
        {post.thumbnail_url && (
          <img src={post.thumbnail_url} alt="" className="w-full rounded-2xl mt-6 mb-2" />
        )}

        {/* 본문 */}
        <div className="mt-6">
          {renderContent(post.content)}
        </div>

        {/* CTA */}
        <div className="mt-12 bg-gradient-to-r from-pink-50 to-orange-50 rounded-2xl p-6 text-center">
          <p className="text-lg font-bold text-gray-900 mb-2">유어딜에서 시작하세요</p>
          <p className="text-sm text-gray-500 mb-4">라이브 커머스의 새로운 기준, 수수료 5%</p>
          <div className="flex gap-3 justify-center">
            <Link to="/" className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold">쇼핑하기</Link>
            <Link to="/seller/register" className="px-5 py-2.5 bg-pink-500 text-white rounded-xl text-sm font-bold">셀러 시작</Link>
          </div>
          <div className="mt-3">
            <KakaoShareButton title={post.title} description={post.summary} link={`/blog/${post.slug}`} buttonText="글 읽기" />
          </div>
        </div>
      </article>
    </div>
  )
}
