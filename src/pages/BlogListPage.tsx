import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
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

export default function BlogListPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [selectedTag, setSelectedTag] = useState('')

  // 🛡️ 2026-05-31: 수동 fetch → useApiQuery (RQ).
  // 📝 2026-07-01: 전체 글을 한 번에 받아(limit=100) 태그 필터는 클라이언트에서 처리.
  //   (a) 기본 limit=9 라 시드 글 일부가 목록에서 누락되던 버그 수정
  //   (b) 태그 클릭 시 재조회하면 allTags 가 필터 결과에서 파생돼 다른 태그 칩이 사라지던 버그 수정
  //   BlogDetailPage 의 관련글 쿼리와 같은 키를 써 캐시를 공유한다.
  const { data: allPosts = [], isLoading: loading } = useApiQuery<BlogPost[]>(
    ['blog', 'public', ''],
    '/api/blog/public?limit=100',
    {
      select: (raw) => ((raw as { success?: boolean; data?: BlogPost[] })?.success ? ((raw as { data: BlogPost[] }).data || []) : []),
      // 📝 2026-07-01 SSR 시드로 0-RTT 첫 페인트 + 마운트 시 백그라운드 최신화(신선도 가드: initialData 는 always 재검증).
      initialData: readBlogListSeed(),
      refetchOnMount: 'always',
    },
  )

  // 태그 목록은 항상 전체 글에서 파생 → 필터 중에도 칩이 안정적으로 유지됨.
  const allTags = [...new Set(allPosts.flatMap(p => { try { return JSON.parse(p.tags) } catch { return [] } }))]
  const posts = selectedTag
    ? allPosts.filter(p => { try { return (JSON.parse(p.tags) as string[]).includes(selectedTag) } catch { return false } })
    : allPosts

  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-[#0A0A0A]">
      <SEO title={t('blog.listSeoTitle', { defaultValue: '블로그' })} description={t('blog.listSeoDesc', { defaultValue: '유어딜 블로그 — 이용권·교환권·동네딜·링크샵 가이드와 서비스 소식' })} url="/blog" />

      {/* Header */}
      <div className="bg-white dark:bg-[#0A0A0A] border-b border-gray-200 dark:border-[#1A1A1A]">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#1A1A1A]">
              <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-200" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">유어딜 블로그</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">이용권 · 동네딜 · 링크샵 · 서비스 소식</p>
            </div>
          </div>
          <Link to="/seller/register" className="px-4 py-2 bg-pink-500 text-white rounded-lg text-sm font-bold hover:bg-pink-600">
            판매 시작하기
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
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
          // 📝 2026-07-01: 스피너-온리 → 스켈레톤 그리드(첫 페인트 표준). 실제 카드와 같은 레이아웃.
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-200 dark:border-[#2A2A2A] overflow-hidden">
                <div className="w-full h-48 bg-gray-100 dark:bg-[#2A2A2A] animate-pulse" />
                <div className="p-5 space-y-3">
                  <div className="h-3 w-16 bg-gray-100 dark:bg-[#2A2A2A] rounded-full animate-pulse" />
                  <div className="h-4 w-full bg-gray-100 dark:bg-[#2A2A2A] rounded animate-pulse" />
                  <div className="h-4 w-2/3 bg-gray-100 dark:bg-[#2A2A2A] rounded animate-pulse" />
                  <div className="h-3 w-1/3 bg-gray-100 dark:bg-[#2A2A2A] rounded animate-pulse mt-4" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">아직 작성된 글이 없습니다</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {posts.map(post => {
              const tags: string[] = (() => { try { return JSON.parse(post.tags) } catch { return [] } })()
              return (
                <Link key={post.id} to={`/blog/${post.slug}`}
                  className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-200 dark:border-[#2A2A2A] overflow-hidden hover:shadow-lg dark:hover:shadow-black/40 transition-shadow group">
                  {post.thumbnail_url ? (
                    <img src={post.thumbnail_url} alt="" className="w-full h-48 object-cover" loading="lazy" />
                  ) : (
                    <div className={`w-full h-48 bg-gradient-to-br ${blogCover(post.slug, tags).gradient} flex items-center justify-center`}>
                      <span className="text-5xl drop-shadow-sm">{blogCover(post.slug, tags).emoji}</span>
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
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-2 leading-snug group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">{stripBold(post.title)}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-2 leading-relaxed">{stripBold(post.summary)}</p>
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
