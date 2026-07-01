import { useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Clock, Share2, Tag } from 'lucide-react'
import SEO, { breadcrumbJsonLd } from '@/components/SEO'
import { nativeShare } from '@/lib/native'
import KakaoShareButton from '@/components/KakaoShareButton'
import { escapeHtml } from '@/shared/utils/html'
import api from '@/lib/api'
import { useBlogPost, type BlogPost } from '@/hooks/queries/useBlogPost'
import { useApiQuery } from '@/hooks/queries/useApiQuery'

// 📝 2026-07-01 SSR 시드(__SSR_INITIAL_BLOGPOST__) — 서버가 주입한 글을 0-RTT 로 즉시 사용.
function readBlogSeed(slug?: string): BlogPost | null {
  if (typeof document === 'undefined' || !slug) return null
  const el = document.getElementById('__SSR_INITIAL_BLOGPOST__')
  if (!el?.textContent) return null
  try {
    const post = (JSON.parse(el.textContent) as { data?: BlogPost })?.data
    return post && post.slug === slug ? post : null
  } catch { return null }
}

export default function BlogDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  // 🛡️ 2026-06-01 Tier2: 수동 페칭 → React Query (public 콘텐츠, slug별 캐시). SSR 시드 즉시 사용.
  const { data: post = null, isLoading: loading } = useBlogPost(slug, readBlogSeed(slug))

  // 📝 관련 글(같은 태그) — 내부 링크로 회유·SEO 크롤 깊이 개선.
  const { data: allPosts = [] } = useApiQuery<BlogPost[]>(
    ['blog', 'public', ''], '/api/blog/public?limit=100',
    { select: (r: any) => (r?.success ? (r.data || []) : []) },
  )

  useEffect(() => { window.scrollTo(0, 0) }, [slug])

  // 🔁 되먹임: 조회수 기록(세션당 slug 1회). 성과 신호 → AI 주제 우선순위에 반영됨.
  useEffect(() => {
    if (!slug) return
    const key = `blog_viewed_${slug}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch { /* storage 불가 시 그냥 1회 시도 */ }
    api.post(`/api/blog/public/${slug}/view`).catch(() => {})
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-300 dark:border-[#3A3A3A] border-t-gray-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0A0A0A] flex flex-col items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400 mb-4">{t('blogDetail.notFound', { defaultValue: '글을 찾을 수 없습니다' })}</p>
        <Link to="/blog" className="text-blue-600 text-sm font-medium">{t('blogDetail.backToBlog', { defaultValue: '블로그로 돌아가기' })}</Link>
      </div>
    )
  }

  const tags: string[] = (() => { try { return JSON.parse(post.tags) } catch { return [] } })()

  function boldify(text: string) {
    return escapeHtml(text).replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-900 dark:text-white">$1</strong>')
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
                    <tr>{headers.map((h, j) => <th key={j} className="text-left px-3 py-2 bg-gray-50 dark:bg-[#1A1A1A] border-b border-gray-200 dark:border-[#2A2A2A] font-semibold text-gray-700 dark:text-gray-200">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.map((row, ri) => (
                      <tr key={ri}>{row.map((cell, ci) => <td key={ci} className="px-3 py-2 border-b border-gray-100 dark:border-[#1A1A1A] text-gray-600 dark:text-gray-300">{cell.replace(/\*\*/g, '')}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        }

        // H2
        if (trimmed.startsWith('## ')) {
          return <h2 key={i} className="text-xl font-bold text-gray-900 dark:text-white mt-8 mb-3">{trimmed.replace('## ', '')}</h2>
        }
        // H3
        if (trimmed.startsWith('### ')) {
          return <h3 key={i} className="text-lg font-bold text-gray-900 dark:text-white mt-6 mb-2">{trimmed.replace('### ', '')}</h3>
        }
        // 리스트
        if (trimmed.startsWith('- ')) {
          const items = trimmed.split('\n').filter(l => l.startsWith('- '))
          return (
            <ul key={i} className="my-3 space-y-1.5">
              {items.map((item, j) => (
                <li key={j} className="flex items-start gap-2 text-[15px] text-gray-700 dark:text-gray-200 leading-relaxed">
                  <span className="text-pink-500 mt-1 shrink-0">•</span>
                  <span dangerouslySetInnerHTML={{ __html: boldify(item.replace('- ', '')) }} />
                </li>
              ))}
            </ul>
          )
        }
        // 구분선
        if (trimmed === '---') {
          return <hr key={i} className="my-8 border-gray-200 dark:border-[#2A2A2A]" />
        }
        // 일반 단락
        return (
          <p key={i} className="text-[15px] text-gray-700 dark:text-gray-200 leading-[1.8] my-3"
            dangerouslySetInnerHTML={{ __html: boldify(trimmed) }} />
        )
      })
      .filter(Boolean)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A]">
      <SEO
        title={post.title}
        description={post.summary}
        url={`/blog/${post.slug}`}
        jsonLd={breadcrumbJsonLd([
          { name: '홈', url: '/' },
          { name: '블로그', url: '/blog' },
          { name: post.title, url: `/blog/${post.slug}` },
        ])}
      />

      {/* Header */}
      <div className="sticky top-0 md:top-14 z-40 bg-white/90 dark:bg-[#0A0A0A]/90 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-6 py-3">
          <button onClick={() => navigate('/blog')} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#1A1A1A]">
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-200" />
          </button>
          <button onClick={() => nativeShare({ title: post.title, url: `https://live.ur-team.com/blog/${post.slug}` })}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#1A1A1A]">
            <Share2 className="w-5 h-5 text-gray-700 dark:text-gray-200" />
          </button>
        </div>
      </div>

      {/* Article */}
      {/* 🛡️ 2026-05-20: 블로그 본문 ur-content-medium (1024px) — 읽기 편한 폭. */}
      <article className="ur-content-medium px-6 lg:px-10 py-10 lg:py-16">
        {/* 태그 */}
        {tags.length > 0 && (
          <div className="flex gap-1.5 mb-4">
            {tags.map(t => (
              <span key={t} className="text-xs bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 px-2.5 py-1 rounded-full font-medium">{t}</span>
            ))}
          </div>
        )}

        {/* 제목 */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white leading-tight">{post.title}</h1>

        {/* 요약 */}
        <p className="text-base text-gray-500 dark:text-gray-400 mt-3 leading-relaxed">{post.summary}</p>

        {/* 메타 */}
        <div className="flex items-center gap-3 mt-4 pb-6 border-b border-gray-100 dark:border-[#1A1A1A] text-sm text-gray-400 dark:text-gray-500">
          <span>{post.author}</span>
          <span>·</span>
          <span>{new Date(post.published_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>

        {/* 썸네일 */}
        {post.thumbnail_url && (
          <img src={post.thumbnail_url} alt="" className="w-full rounded-2xl mt-6 mb-2" loading="lazy" />
        )}

        {/* 본문 */}
        <div className="mt-6">
          {renderContent(post.content)}
        </div>

        {/* 관련 글 — 같은 태그 우선, 내부 링크(회유·SEO) */}
        {(() => {
          const myTags: string[] = (() => { try { return JSON.parse(post.tags) } catch { return [] } })()
          const related = (allPosts as BlogPost[])
            .filter((p) => p.slug !== post.slug)
            .map((p) => {
              const pt: string[] = (() => { try { return JSON.parse(p.tags) } catch { return [] } })()
              return { p, overlap: pt.filter((t) => myTags.includes(t)).length }
            })
            .sort((a, b) => b.overlap - a.overlap)
            .slice(0, 4)
            .map((x) => x.p)
          if (related.length === 0) return null
          return (
            <section className="mt-12">
              <h2 className="text-base font-bold text-gray-900 dark:text-white mb-3">함께 보면 좋은 글</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {related.map((r) => (
                  <Link key={r.slug} to={`/blog/${r.slug}`}
                    className="block p-4 rounded-xl border border-gray-200 dark:border-[#2A2A2A] hover:border-gray-300 dark:hover:border-[#3A3A3A] hover:shadow-sm transition">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2">{r.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{r.summary}</p>
                  </Link>
                ))}
              </div>
            </section>
          )
        })()}

        {/* CTA */}
        <div className="mt-12 bg-gradient-to-r from-gray-50 to-gray-50 dark:from-gray-900/20 dark:to-gray-900/20 rounded-2xl p-6 text-center">
          <p className="text-lg font-bold text-gray-900 dark:text-white mb-2">유어딜에서 시작하세요</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">이용권·교환권·동네딜을 한곳에, 나만의 링크샵까지</p>
          <div className="flex gap-3 justify-center">
            <Link to="/" className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold">둘러보기</Link>
            <Link to="/u/me" className="px-5 py-2.5 bg-pink-500 text-white rounded-xl text-sm font-bold">내 링크샵 만들기</Link>
          </div>
          <div className="mt-3">
            <KakaoShareButton title={post.title} description={post.summary} link={`/blog/${post.slug}`} buttonText={t('blog.readBtn', { defaultValue: '글 읽기' })} />
          </div>
        </div>
      </article>
    </div>
  )
}
