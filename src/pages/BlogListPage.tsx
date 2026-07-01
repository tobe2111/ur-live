import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import SEO from '@/components/SEO'
import { useApiQuery } from '@/hooks/queries/useApiQuery'

interface BlogPost {
  id: number; slug: string; title: string; summary: string; tags: string
  author: string; thumbnail_url: string | null; published_at: string
}

// 📝 2026-07-01: 썸네일 없는 글의 커버 — slug/태그 기반 결정적 그라디언트 + 이모지.
//   외부 이미지 의존 0(404 위험 없음), 글마다 시각이 달라 목록이 단조롭지 않음.
const COVER_GRADIENTS = [
  'from-rose-100 to-orange-100 dark:from-rose-900/30 dark:to-orange-900/20',
  'from-sky-100 to-indigo-100 dark:from-sky-900/30 dark:to-indigo-900/20',
  'from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/20',
  'from-violet-100 to-fuchsia-100 dark:from-violet-900/30 dark:to-fuchsia-900/20',
  'from-amber-100 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/20',
  'from-cyan-100 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/20',
]
const COVER_EMOJI: Array<[RegExp, string]> = [
  [/what-is|유어딜/, '✨'],
  [/exchange|교환권|기프티콘/, '🎁'],
  [/voucher|이용권/, '🎟️'],
  [/dongne|동네딜/, '📍'],
  [/linkshop|링크샵|쇼핑몰/, '🛍️'],
  [/business|사업자|판매/, '🏪'],
  [/deal-points|포인트|딜/, '💰'],
  [/payment|결제/, '💳'],
  [/review|리뷰/, '⭐'],
  [/settlement|정산/, '📊'],
  [/agency|에이전시/, '🤝'],
]
// 📝 제목/요약에서 마크다운 볼드 표기(**) 제거 — 글자로 노출 방지(AI 생성/편집 글 방탄).
const stripBold = (s?: string | null) => (s || '').replace(/\*\*/g, '')

function blogCover(slug: string, tags: string[]) {
  const hay = `${slug} ${tags.join(' ')}`.toLowerCase()
  const emoji = COVER_EMOJI.find(([re]) => re.test(hay))?.[1] ?? '📝'
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0
  return { emoji, gradient: COVER_GRADIENTS[h % COVER_GRADIENTS.length] }
}

const parseTags = (raw: string): string[] => { try { return JSON.parse(raw) } catch { return [] } }

// 📝 2026-07-01 SSR 시드(__SSR_INITIAL_BLOG__) — 서버가 주입한 목록을 0-RTT 로 즉시 사용(콜드 fetch 워터폴 제거).
function readBlogListSeed(): BlogPost[] | undefined {
  if (typeof document === 'undefined') return undefined
  const el = document.getElementById('__SSR_INITIAL_BLOG__')
  if (!el?.textContent) return undefined
  try {
    const raw = JSON.parse(el.textContent) as { success?: boolean; data?: BlogPost[] }
    return raw?.success ? (raw.data || []) : undefined
  } catch { return undefined }
}

// 카테고리 칩(파란) + 작성자 칩(회색) — 토스 테크 스타일.
function ChipRow({ tags, author }: { tags: string[]; author?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags[0] && (
        <span className="text-[11px] font-semibold bg-blue-50 dark:bg-blue-900/25 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded-md">{tags[0]}</span>
      )}
      {author && (
        <span className="text-[11px] font-medium bg-gray-100 dark:bg-[#1C1C1E] text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-md">{author}</span>
      )}
    </div>
  )
}

function CoverImg({ post, className }: { post: BlogPost; className: string }) {
  const tags = parseTags(post.tags)
  if (post.thumbnail_url) {
    return <img src={post.thumbnail_url} alt="" className={`${className} object-cover`} loading="lazy" />
  }
  const { emoji, gradient } = blogCover(post.slug, tags)
  return (
    <div className={`${className} bg-gradient-to-br ${gradient} flex items-center justify-center`}>
      <span className="text-5xl drop-shadow-sm">{emoji}</span>
    </div>
  )
}

const PER_PAGE = 7

export default function BlogListPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [selectedTag, setSelectedTag] = useState('')
  const [heroIdx, setHeroIdx] = useState(0)
  const [page, setPage] = useState(1)

  // 🛡️ 2026-05-31: 수동 fetch → useApiQuery (RQ).
  // 📝 2026-07-01: 전체 글을 한 번에 받아(limit=100) 태그 필터/페이지네이션은 클라이언트에서 처리.
  const { data: allPosts = [], isLoading: loading } = useApiQuery<BlogPost[]>(
    ['blog', 'public', ''],
    '/api/blog/public?limit=100',
    {
      select: (raw) => ((raw as { success?: boolean; data?: BlogPost[] })?.success ? ((raw as { data: BlogPost[] }).data || []) : []),
      // 📝 SSR 시드로 0-RTT 첫 페인트 + 마운트 시 백그라운드 최신화(신선도 가드: initialData 는 always 재검증).
      initialData: readBlogListSeed(),
      refetchOnMount: 'always',
    },
  )

  // 태그 목록은 항상 전체 글에서 파생 → 필터 중에도 칩이 안정적으로 유지됨.
  const allTags = [...new Set(allPosts.flatMap(p => parseTags(p.tags)))]
  const filtered = selectedTag
    ? allPosts.filter(p => parseTags(p.tags).includes(selectedTag))
    : allPosts

  // 히어로 = 최신 글 상위 5개(태그 필터 없을 때만 노출).
  const featured = allPosts.slice(0, 5)
  const hero = featured[heroIdx % (featured.length || 1)]
  const moveHero = (d: number) => setHeroIdx(i => (i + d + featured.length) % featured.length)

  const pickTag = (tag: string) => { setSelectedTag(tag); setPage(1) }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const curPage = Math.min(page, totalPages)
  const pagePosts = filtered.slice((curPage - 1) * PER_PAGE, curPage * PER_PAGE)
  // 페이지 버튼 윈도우(최대 7개, 현재 중심).
  const pageNums = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    let s = Math.max(1, curPage - 3), e = Math.min(totalPages, s + 6)
    s = Math.max(1, e - 6)
    return Array.from({ length: e - s + 1 }, (_, i) => s + i)
  })()

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#0A0A0A]">
      <SEO title={t('blog.listSeoTitle', { defaultValue: '블로그' })} description={t('blog.listSeoDesc', { defaultValue: '유어딜 블로그 — 이용권·교환권·동네딜·링크샵 가이드와 서비스 소식' })} url="/blog" />

      {/* Header */}
      <div className="bg-white dark:bg-[#0A0A0A] border-b border-gray-100 dark:border-[#1A1A1A] sticky top-0 md:top-14 z-30 backdrop-blur">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-5 lg:px-8 py-3.5">
          <div className="flex items-center gap-2.5">
            <button onClick={() => navigate('/')} aria-label="뒤로" className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#1A1A1A]">
              <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-200" />
            </button>
            <span className="text-lg font-extrabold text-gray-900 dark:text-white tracking-tight">유어딜 블로그</span>
          </div>
          <Link to="/seller/register" className="px-3.5 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-bold hover:opacity-90">
            판매 시작하기
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 lg:px-8">
        {/* ── 히어로 캐러셀 (태그 필터 없을 때) ── */}
        {!selectedTag && !loading && hero && (
          <section className="pt-8 lg:pt-12 pb-10">
            <Link to={`/blog/${hero.slug}`} className="group grid lg:grid-cols-2 gap-6 lg:gap-10 items-center">
              <div className="order-2 lg:order-1">
                <ChipRow tags={parseTags(hero.tags)} author={hero.author} />
                <h2 className="mt-4 text-[26px] leading-tight sm:text-4xl sm:leading-[1.15] font-extrabold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-3">
                  {stripBold(hero.title)}
                </h2>
                <p className="mt-3 text-base text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">{stripBold(hero.summary)}</p>
              </div>
              <div className="order-1 lg:order-2">
                <CoverImg post={hero} className="w-full aspect-[16/10] rounded-2xl" />
              </div>
            </Link>
            {featured.length > 1 && (
              <div className="flex items-center gap-2 mt-6">
                <button onClick={() => moveHero(-1)} aria-label="이전" className="w-10 h-10 rounded-full border border-gray-200 dark:border-[#2A2A2A] flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#1A1A1A]">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={() => moveHero(1)} aria-label="다음" className="w-10 h-10 rounded-full border border-gray-200 dark:border-[#2A2A2A] flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#1A1A1A]">
                  <ChevronRight className="w-5 h-5" />
                </button>
                <span className="ml-2 text-xs text-gray-400 dark:text-gray-500 tabular-nums">{(heroIdx % featured.length) + 1} / {featured.length}</span>
              </div>
            )}
          </section>
        )}

        {/* ── 태그 필터 ── */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-4 border-t border-gray-100 dark:border-[#1A1A1A]">
          <button onClick={() => pickTag('')}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium shrink-0 ${!selectedTag ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-50 dark:bg-[#1C1C1E] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-[#2A2A2A]'}`}>
            전체
          </button>
          {allTags.map((tag: string) => (
            <button key={tag} onClick={() => pickTag(tag)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium shrink-0 ${selectedTag === tag ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-50 dark:bg-[#1C1C1E] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-[#2A2A2A]'}`}>
              {tag}
            </button>
          ))}
        </div>

        {/* ── 전체 아티클 리스트 ── */}
        <section className="py-8">
          <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">
            {selectedTag ? `#${selectedTag}` : '전체 아티클'}
          </h3>

          {loading ? (
            <div className="divide-y divide-gray-100 dark:divide-[#1A1A1A]">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start justify-between gap-6 py-6">
                  <div className="flex-1 space-y-3">
                    <div className="h-3 w-24 bg-gray-100 dark:bg-[#1A1A1A] rounded animate-pulse" />
                    <div className="h-5 w-3/4 bg-gray-100 dark:bg-[#1A1A1A] rounded animate-pulse" />
                    <div className="h-4 w-1/2 bg-gray-100 dark:bg-[#1A1A1A] rounded animate-pulse" />
                  </div>
                  <div className="w-28 h-28 rounded-xl bg-gray-100 dark:bg-[#1A1A1A] animate-pulse shrink-0" />
                </div>
              ))}
            </div>
          ) : pagePosts.length === 0 ? (
            <div className="text-center py-16 text-gray-500 dark:text-gray-400">아직 작성된 글이 없습니다</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-[#1A1A1A]">
              {pagePosts.map(post => {
                const tags = parseTags(post.tags)
                return (
                  <Link key={post.id} to={`/blog/${post.slug}`} className="group flex items-start justify-between gap-5 sm:gap-8 py-6">
                    <div className="flex-1 min-w-0">
                      <ChipRow tags={tags} author={post.author} />
                      <h4 className="mt-2.5 text-lg sm:text-xl font-bold text-gray-900 dark:text-white leading-snug line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {stripBold(post.title)}
                      </h4>
                      <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">{stripBold(post.summary)}</p>
                    </div>
                    <CoverImg post={post} className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl shrink-0" />
                  </Link>
                )
              })}
            </div>
          )}

          {/* ── 페이지네이션 ── */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-10">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={curPage === 1} aria-label="이전 페이지"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1A1A1A] disabled:opacity-30 disabled:hover:bg-transparent">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {pageNums.map(n => (
                <button key={n} onClick={() => setPage(n)}
                  className={`min-w-9 h-9 px-2 rounded-lg text-sm font-semibold tabular-nums ${n === curPage ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'}`}>
                  {n}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={curPage === totalPages} aria-label="다음 페이지"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1A1A1A] disabled:opacity-30 disabled:hover:bg-transparent">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
