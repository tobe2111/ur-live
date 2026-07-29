import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Clock, Share2, Search, Home, List, ChevronDown } from 'lucide-react'
import SEO, { breadcrumbJsonLd } from '@/components/SEO'
import { nativeShare } from '@/lib/native'
import KakaoShareButton from '@/components/KakaoShareButton'
import { BlogMarkdown, blogToc } from '@/features/blog/BlogMarkdown'
import { CoverImg } from '@/features/blog/BlogCover'
import BrandLoader from '@/components/brand/BrandLoader'
import api from '@/lib/api'
import { useBlogPost, type BlogPost } from '@/hooks/queries/useBlogPost'
import { useApiQuery } from '@/hooks/queries/useApiQuery'

// 📝 제목/요약 등 일반 텍스트에서 마크다운 볼드 표기(**) 제거 — 글자로 노출 방지(AI 생성/편집 글 방탄).
const stripBold = (s?: string | null) => (s || '').replace(/\*\*/g, '')
const parseTags = (raw: string): string[] => { try { return JSON.parse(raw) } catch { return [] } }

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
  const { t } = useTranslation()
  // 🛡️ 2026-06-01 Tier2: 수동 페칭 → React Query (public 콘텐츠, slug별 캐시). SSR 시드 즉시 사용.
  const { data: post = null, isLoading: loading } = useBlogPost(slug, readBlogSeed(slug))
  const { data: allPosts = [] } = useApiQuery<BlogPost[]>(
    ['blog', 'public', ''], '/api/blog/public?limit=100',
    { select: (r: any) => (r?.success ? (r.data || []) : []) },
  )

  const [activeId, setActiveId] = useState('')
  const [tocOpen, setTocOpen] = useState(false)

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

  const toc = post ? blogToc(post.content) : []

  // 목차 스크롤스파이 — 현재 화면 상단의 섹션을 활성 표시.
  useEffect(() => {
    if (!toc.length) return
    const els = toc.map(x => document.getElementById(x.id)).filter(Boolean) as HTMLElement[]
    if (!els.length) return
    const obs = new IntersectionObserver((entries) => {
      const vis = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (vis[0]) setActiveId(vis[0].target.id)
    }, { rootMargin: '-80px 0px -72% 0px', threshold: 0 })
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [post?.slug, toc.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    // 🚑 2026-07-10 (로딩 전수조사 — 로더 전면 통일): ad-hoc 스피너 → BrandLoader.
    return (
      <div className="min-h-[100dvh] bg-white dark:bg-[#0F151D]">
        <BrandLoader fullScreen />
      </div>
    )
  }

  if (!post) {
    return (
      <div className="min-h-[100dvh] bg-white dark:bg-[#0F151D] flex flex-col items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400 mb-4">{t('blogDetail.notFound', { defaultValue: '글을 찾을 수 없습니다' })}</p>
        <Link to="/blog" className="text-blue-600 text-sm font-medium">{t('blogDetail.backToBlog', { defaultValue: '블로그로 돌아가기' })}</Link>
      </div>
    )
  }

  const tags = parseTags(post.tags)
  const readMin = Math.max(1, Math.round((post.content?.length || 0) / 500))

  const related = (allPosts as BlogPost[])
    .filter((p) => p.slug !== post.slug)
    .map((p) => ({ p, overlap: parseTags(p.tags).filter((tg) => tags.includes(tg)).length }))
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 5)
    .map((x) => x.p)

  const scrollToId = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setActiveId(id)
    setTocOpen(false)
  }

  const TocList = ({ onNav }: { onNav?: () => void }) => (
    <nav className="space-y-0.5">
      {toc.map((x) => (
        <a key={x.id} href={`#${x.id}`}
          onClick={(e) => { e.preventDefault(); scrollToId(x.id); onNav?.() }}
          className={`block py-1.5 text-[13px] leading-snug transition-colors ${x.level === 3 ? 'pl-4' : ''} ${
            activeId === x.id ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}>
          {x.text}
        </a>
      ))}
    </nav>
  )

  const RelatedList = () => (
    <div className="space-y-4">
      {related.map((r) => (
        <Link key={r.slug} to={`/blog/${r.slug}`} className="flex gap-3 group items-start">
          <CoverImg post={r} className="w-14 h-14 rounded-lg shrink-0" />
          <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 leading-snug line-clamp-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{stripBold(r.title)}</p>
        </Link>
      ))}
    </div>
  )

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#0F151D]">
      <SEO
        title={post.title}
        description={stripBold(post.summary)}
        url={`/blog/${post.slug}`}
        jsonLd={breadcrumbJsonLd([
          { name: '홈', url: '/' },
          { name: '블로그', url: '/blog' },
          { name: post.title, url: `/blog/${post.slug}` },
        ])}
      />

      {/* 상단 네비 — 로고 | 검색·유어딜 홈·공유·CTA */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#0F151D]/90 backdrop-blur border-b border-gray-100 dark:border-[#2A3446]">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 lg:px-8 h-14">
          <Link to="/blog" className="flex items-center gap-2 text-lg font-extrabold text-gray-900 dark:text-white tracking-tight">
            유어딜 <span className="text-gray-300 dark:text-[#333] font-light">|</span> <span className="text-gray-500 dark:text-gray-400 text-base font-bold">Blog</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-1.5">
            <Link to="/blog" aria-label="블로그 검색" className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1A2334]">
              <Search className="w-4 h-4" />
            </Link>
            <button onClick={() => nativeShare({ title: post.title, url: `https://urdeal.kr/blog/${post.slug}` })}
              aria-label="공유" className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1A2334]">
              <Share2 className="w-4 h-4" />
            </button>
            <Link to="/" className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1A2334]">
              <Home className="w-4 h-4" />유어딜 홈
            </Link>
            <Link to="/seller/register" className="px-3.5 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-bold hover:opacity-90">판매 시작하기</Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 lg:py-12
        lg:grid lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_260px] lg:gap-8 xl:gap-10">

        {/* ── 좌측: 목차 ── */}
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <p className="text-sm font-bold text-gray-900 dark:text-white mb-3">Contents</p>
            <TocList />
          </div>
        </aside>

        {/* ── 중앙: 본문 ── */}
        <article className="min-w-0">
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {tags.map(tg => (
                <span key={tg} className="text-xs bg-blue-50 dark:bg-blue-900/25 text-blue-600 dark:text-blue-300 px-2.5 py-1 rounded-md font-semibold">{tg}</span>
              ))}
            </div>
          )}
          <h1 className="text-2xl sm:text-4xl font-extrabold text-gray-900 dark:text-white leading-tight">{stripBold(post.title)}</h1>
          <p className="text-base sm:text-lg text-gray-500 dark:text-gray-400 mt-3 leading-relaxed">{stripBold(post.summary)}</p>
          <div className="flex items-center gap-3 mt-4 pb-6 text-sm text-gray-400 dark:text-gray-500">
            <span>{post.author}</span>
            <span>·</span>
            <span>{new Date(post.published_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{readMin}분 읽기</span>
          </div>

          {/* 히어로 배너 */}
          <CoverImg post={post} variant="hero" className="w-full aspect-[16/7] rounded-2xl mb-8" />

          {/* 모바일 목차 (접이식) */}
          {toc.length > 0 && (
            <div className="lg:hidden mb-8 border border-gray-200 dark:border-[#2A3446] rounded-xl overflow-hidden">
              <button onClick={() => setTocOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-[#141414]">
                <span className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white"><List className="w-4 h-4" />목차</span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${tocOpen ? 'rotate-180' : ''}`} />
              </button>
              {tocOpen && <div className="px-4 py-3"><TocList onNav={() => setTocOpen(false)} /></div>}
            </div>
          )}

          {/* 본문 — 공유 안전 렌더러(BlogMarkdown): 링크·이미지·인용구 지원, dangerouslySetInnerHTML 미사용 */}
          <BlogMarkdown content={post.content} />

          {/* 모바일 추천글 */}
          {related.length > 0 && (
            <section className="mt-12 lg:hidden">
              <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">추천 글</h2>
              <RelatedList />
            </section>
          )}

          {/* CTA */}
          <div className="mt-12 bg-gray-50 dark:bg-[#141414] rounded-2xl p-6 text-center">
            <p className="text-lg font-bold text-gray-900 dark:text-white mb-2">유어딜에서 시작하세요</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">이용권·교환권·동네딜을 한곳에, 나만의 링크샵까지</p>
            <div className="flex gap-3 justify-center">
              <Link to="/" className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl text-sm font-bold hover:opacity-90">둘러보기</Link>
              <Link to="/u/me" className="px-5 py-2.5 bg-pink-500 text-white rounded-xl text-sm font-bold hover:bg-pink-600">내 링크샵 만들기</Link>
            </div>
            <div className="mt-3">
              <KakaoShareButton title={stripBold(post.title)} description={stripBold(post.summary)} link={`/blog/${post.slug}`} buttonText={t('blog.readBtn', { defaultValue: '글 읽기' })} />
            </div>
          </div>
        </article>

        {/* ── 우측: 추천글 (xl+) ── */}
        <aside className="hidden xl:block">
          <div className="sticky top-20">
            <p className="text-sm font-bold text-gray-900 dark:text-white mb-4">추천 글</p>
            <RelatedList />
          </div>
        </aside>
      </div>
    </div>
  )
}
