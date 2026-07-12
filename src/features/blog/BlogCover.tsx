/**
 * 📝 블로그 커버(배너) — 목록·상세 공용. 썸네일 있으면 이미지, 없으면 주제별 디자인 배너
 *   (그라디언트 + 장식 블롭 + 이모지 스티커). 외부 이미지 의존 0(404 없음), 라이트/다크 대응.
 */
type CoverPost = { slug: string; tags: string; thumbnail_url: string | null }

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
const parseTags = (raw: string): string[] => { try { return JSON.parse(raw) } catch { return [] } }

export function blogCover(slug: string, tags: string[]) {
  const hay = `${slug} ${tags.join(' ')}`.toLowerCase()
  const emoji = COVER_EMOJI.find(([re]) => re.test(hay))?.[1] ?? '📝'
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0
  return { emoji, gradient: COVER_GRADIENTS[h % COVER_GRADIENTS.length] }
}

export function CoverImg({ post, className, variant = 'thumb' }: { post: CoverPost; className: string; variant?: 'hero' | 'thumb' }) {
  const tags = parseTags(post.tags)
  if (post.thumbnail_url) {
    return <img src={post.thumbnail_url} alt="" className={`${className} object-cover`} loading="lazy" />
  }
  const { emoji, gradient } = blogCover(post.slug, tags)
  const big = variant === 'hero'
  return (
    <div className={`${className} relative overflow-hidden bg-gradient-to-br ${gradient}`}>
      <div className="absolute -top-6 -right-6 w-2/3 aspect-square rounded-full bg-white/40 dark:bg-white/10 blur-2xl" />
      <div className="absolute -bottom-8 -left-6 w-2/3 aspect-square rounded-full bg-black/5 dark:bg-black/25 blur-2xl" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={`${big ? 'w-20 h-20 sm:w-24 sm:h-24 text-4xl sm:text-5xl rounded-3xl' : 'w-14 h-14 text-2xl rounded-2xl'} bg-white/70 dark:bg-white/10 backdrop-blur-sm flex items-center justify-center shadow-sm ring-1 ring-black/5 dark:ring-white/10`}>
          <span className="drop-shadow-sm">{emoji}</span>
        </div>
      </div>
      {big && tags[0] && (
        <span className="absolute bottom-3.5 left-4 text-xs font-bold text-gray-700/70 dark:text-white/70">유어딜 · {tags[0]}</span>
      )}
    </div>
  )
}
