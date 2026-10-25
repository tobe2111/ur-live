import { useState } from 'react'
import { HomeIcon } from '@/components/icons/urdeal-icons'
import { Link } from 'react-router-dom'
import { useTranslation } from '@/lib/i18n-lite'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import SEO from '@/components/SEO'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { CoverImg } from '@/features/blog/BlogCover'
// 🧱 2026-10-19 클래스·규칙은 서버 첫 화면(`worker/utils/blog-list-first-screen.ts`)과 같은 SSOT.
import { BLOG_LIST, BLOG_PER_PAGE, BLOG_FEATURED, BLOG_SEARCH_PLACEHOLDER, blogPageNums, blogAllTags } from '@/shared/blog-page'

interface BlogPost {
  id: number; slug: string; title: string; summary: string; tags: string
  author: string; thumbnail_url: string | null; published_at: string
}

// 📝 제목/요약에서 마크다운 볼드 표기(**) 제거 — 글자로 노출 방지(AI 생성/편집 글 방탄).
const stripBold = (s?: string | null) => (s || '').replace(/\*\*/g, '')

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
    <div className={BLOG_LIST.chipRow}>
      {tags[0] && (
        <span className={BLOG_LIST.tagChip}>{tags[0]}</span>
      )}
      {/* 🐛 2026-08-17 (UX 전수검사 P1): 첫 태그와 작성자가 같은 값이면(둘 다 "유어딜") 칩이
          "유어딜 · 유어딜" 로 중복돼 오타처럼 보였다 — 같으면 작성자 칩 생략. */}
      {author && author !== tags[0] && (
        <span className={BLOG_LIST.authorChip}>{author}</span>
      )}
    </div>
  )
}


const PER_PAGE = BLOG_PER_PAGE

export default function BlogListPage() {
  const { t } = useTranslation()
  const [selectedTag, setSelectedTag] = useState('')
  const [query, setQuery] = useState('')
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
  const allTags = blogAllTags(allPosts)
  // 클라이언트 필터 — 태그 + 검색어(제목/요약/태그). 전량 로드(limit=100)라 즉시 반영.
  //   ⚠️ 글이 수백 편으로 늘면 서버 페이지네이션/검색(엔드포인트 page/limit/tag/q 지원)으로 전환 권장.
  const q = query.trim().toLowerCase()
  const searching = q.length > 0
  const filtered = allPosts.filter(p => {
    if (selectedTag && !parseTags(p.tags).includes(selectedTag)) return false
    if (q) {
      const hay = `${p.title} ${p.summary} ${p.tags} ${p.author}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  // 히어로 = 최신 글 상위 5개(태그·검색 없을 때만 노출).
  const featured = allPosts.slice(0, BLOG_FEATURED)
  const hero = featured[heroIdx % (featured.length || 1)]
  const moveHero = (d: number) => setHeroIdx(i => (i + d + featured.length) % featured.length)

  const pickTag = (tag: string) => { setSelectedTag(tag); setPage(1) }
  const onSearch = (v: string) => { setQuery(v); setPage(1) }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const curPage = Math.min(page, totalPages)
  const pagePosts = filtered.slice((curPage - 1) * PER_PAGE, curPage * PER_PAGE)
  // 페이지 버튼 윈도우(최대 7개, 현재 중심).
  const pageNums = blogPageNums(totalPages, curPage)

  return (
    <div className={BLOG_LIST.root}>
      <SEO title={t('blog.listSeoTitle', { defaultValue: '블로그' })} description={t('blog.listSeoDesc', { defaultValue: '유어딜 블로그. 이용권과 교환권, 동네딜, 유어샵 가이드와 서비스 소식' })} url="/blog" />

      {/* Header — 뒤로가기 제거, 유어딜 홈 버튼 추가, non-sticky(오버랩 방지) */}
      <div className={BLOG_LIST.bar}>
        <div className={BLOG_LIST.barInner}>
          <Link to="/blog" className={BLOG_LIST.logo}>유어딜 블로그</Link>
          <div className={BLOG_LIST.actions}>
            <Link to="/" className={BLOG_LIST.home}>
              <HomeIcon className="w-4 h-4" /><span className={BLOG_LIST.homeText}>유어딜 홈</span>
            </Link>
            <Link to="/store/new" className={BLOG_LIST.cta}>
              내 가게 등록
            </Link>
          </div>
        </div>
      </div>

      <div className={BLOG_LIST.wrap}>
        {/* ── 히어로 캐러셀 (태그·검색 없을 때) ── */}
        {!selectedTag && !searching && !loading && hero && (
          <section className={BLOG_LIST.hero}>
            <Link to={`/blog/${hero.slug}`} className={BLOG_LIST.heroLink}>
              <div className={BLOG_LIST.heroText}>
                <ChipRow tags={parseTags(hero.tags)} author={hero.author} />
                <h2 className={BLOG_LIST.heroTitle}>
                  {stripBold(hero.title)}
                </h2>
                <p className={BLOG_LIST.heroSummary}>{stripBold(hero.summary)}</p>
              </div>
              <div className={BLOG_LIST.heroCoverWrap}>
                <CoverImg post={hero} variant="hero" className={BLOG_LIST.heroCover} />
              </div>
            </Link>
            {featured.length > 1 && (
              <div className={BLOG_LIST.heroNav}>
                <button onClick={() => moveHero(-1)} aria-label="이전" className={BLOG_LIST.heroBtn}>
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={() => moveHero(1)} aria-label="다음" className={BLOG_LIST.heroBtn}>
                  <ChevronRight className="w-5 h-5" />
                </button>
                <span className={BLOG_LIST.heroCount}>{(heroIdx % featured.length) + 1} / {featured.length}</span>
              </div>
            )}
          </section>
        )}

        {/* ── 검색 ── */}
        <div className={BLOG_LIST.searchWrap}>
          <div className="relative">
            <Search className={BLOG_LIST.searchIcon} />
            <input
              value={query}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={BLOG_SEARCH_PLACEHOLDER}
              className={BLOG_LIST.search}
            />
            {query && (
              <button onClick={() => onSearch('')} aria-label="검색어 지우기" className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-[#2C2F35]">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── 태그 필터 ── */}
        <div className={BLOG_LIST.chips}>
          <button onClick={() => pickTag('')}
            className={`${BLOG_LIST.chip} ${!selectedTag ? BLOG_LIST.chipOn : BLOG_LIST.chipOff}`}>
            전체
          </button>
          {allTags.map((tag: string) => (
            <button key={tag} onClick={() => pickTag(tag)}
              className={`${BLOG_LIST.chip} ${selectedTag === tag ? BLOG_LIST.chipOn : BLOG_LIST.chipOff}`}>
              {tag}
            </button>
          ))}
        </div>

        {/* ── 전체 아티클 리스트 ── */}
        <section className={BLOG_LIST.listSection}>
          <h3 className={BLOG_LIST.listTitle}>
            {searching ? `‘${query.trim()}’ 검색 결과` : selectedTag ? `#${selectedTag}` : '전체 아티클'}
            {(searching || selectedTag) && <span className="ml-2 text-[15px] font-medium text-gray-400 dark:text-gray-500">{filtered.length}</span>}
          </h3>

          {loading ? (
            <div className="divide-y divide-gray-100 dark:divide-[#2C2F35]">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start justify-between gap-6 py-6">
                  <div className="flex-1 space-y-3">
                    <div className="h-3 w-24 bg-gray-100 dark:bg-[#1D1F29] rounded animate-pulse" />
                    <div className="h-5 w-3/4 bg-gray-100 dark:bg-[#1D1F29] rounded animate-pulse" />
                    <div className="h-4 w-1/2 bg-gray-100 dark:bg-[#1D1F29] rounded animate-pulse" />
                  </div>
                  <div className="w-28 h-28 rounded-xl bg-gray-100 dark:bg-[#1D1F29] animate-pulse shrink-0" />
                </div>
              ))}
            </div>
          ) : pagePosts.length === 0 ? (
            <div className="text-center py-16 text-gray-500 dark:text-gray-400">
              {searching ? `‘${query.trim()}’에 대한 검색 결과가 없어요` : selectedTag ? '이 태그의 글이 아직 없어요' : '아직 작성된 글이 없습니다'}
            </div>
          ) : (
            <div className={BLOG_LIST.rows}>
              {pagePosts.map(post => {
                const tags = parseTags(post.tags)
                return (
                  <Link key={post.id} to={`/blog/${post.slug}`} className={BLOG_LIST.row}>
                    <div className={BLOG_LIST.rowText}>
                      <ChipRow tags={tags} author={post.author} />
                      <h4 className={BLOG_LIST.rowTitle}>
                        {stripBold(post.title)}
                      </h4>
                      <p className={BLOG_LIST.rowSummary}>{stripBold(post.summary)}</p>
                    </div>
                    <CoverImg post={post} className={BLOG_LIST.rowCover} />
                  </Link>
                )
              })}
            </div>
          )}

          {/* ── 페이지네이션 ── */}
          {!loading && totalPages > 1 && (
            <div className={BLOG_LIST.pager}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={curPage === 1} aria-label="이전 페이지"
                className={BLOG_LIST.pagerArrow}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              {pageNums.map(n => (
                <button key={n} onClick={() => setPage(n)}
                  className={`${BLOG_LIST.pagerNum} ${n === curPage ? BLOG_LIST.pagerOn : BLOG_LIST.pagerOff}`}>
                  {n}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={curPage === totalPages} aria-label="다음 페이지"
                className={BLOG_LIST.pagerArrow}>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
