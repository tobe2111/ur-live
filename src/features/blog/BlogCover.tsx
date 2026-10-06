/**
 * 📝 블로그 커버(배너) — 목록·상세 공용. 썸네일이 있으면 그 사진, 없으면 **주제 아이콘 커버**.
 *
 * ## 2026-09-24 — 이모지·그라디언트 커버 폐기 (대표 문서 ②)
 * 대표: *"사진 필요함 · 여기도 가독성이 떨어진다."* 실측하니 발행 글 5개 **전부 `thumbnail_url` 이
 * null** 이라 목록 전체가 폴백으로 떨어져 있었고, 그 폴백이 **이모지 스티커 + 그라디언트**였다.
 * 코레일톡 디자인 SSOT 가 금지하는 둘(⑥ 이모지 0 · 그라디언트 0)을 정확히 쓰고 있었던 셈이다.
 * ⇒ 우리 카테고리 아이콘(`components/icons/category-icons`) + 팔레트 단색 면으로 교체.
 *
 * ## ⚠️ 이건 사진의 **대체재가 아니라 빈자리**다
 * 진짜 사진은 어드민에서 넣는다 — `/admin/blog` 글 편집에 **썸네일 업로더가 이미 있다**
 * (`AdminBlogPage` 의 `thumbnail_url`). 만들 기능이 아니라 채울 내용이다.
 * 사진이 들어오면 이 커버는 자동으로 물러난다(첫 분기).
 *
 * ## 외부 이미지 의존 0
 * 폴백은 SVG 와 색 토큰뿐이라 404 가 없고 라이트/다크 모두 대응한다(종전 성질 유지).
 */
import type { ComponentType, SVGProps } from 'react'
import {
  CATEGORY_PALETTE, type CategoryHue,
  MealIcon, CafeIcon, BeautyIcon, StayIcon, GiftIcon, StoreIcon, LeisureIcon,
} from '@/components/icons/category-icons'

type CoverPost = { slug: string; tags: string; thumbnail_url: string | null }
type Ico = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>

/** 주제 → 아이콘·색. 위에서부터 먼저 맞는 것. 새 주제는 여기 한 줄. */
const COVER_TOPICS: Array<[RegExp, Ico, CategoryHue, string]> = [
  [/exchange|교환권|기프티콘/, GiftIcon, 'yellow', '교환권'],
  [/voucher|이용권/, MealIcon, 'red', '이용권'],
  [/stay|숙소|펜션/, StayIcon, 'blue', '숙소'],
  [/beauty|미용|뷰티/, BeautyIcon, 'pink', '뷰티'],
  [/dongne|동네딜|지역/, StoreIcon, 'green', '동네딜'],
  [/linkshop|유어샵|쇼핑몰|business|사업자|판매/, StoreIcon, 'teal', '유어샵'],
  [/cafe|카페|커피/, CafeIcon, 'orange', '카페'],
  [/experience|체험|액티비티/, LeisureIcon, 'purple', '체험'],
]

const parseTags = (raw: string): string[] => { try { return JSON.parse(raw) } catch { return [] } }

export function blogCover(slug: string, tags: string[]) {
  const hay = `${slug} ${tags.join(' ')}`.toLowerCase()
  const hit = COVER_TOPICS.find(([re]) => re.test(hay))
  const [, Icon, hue, label] = hit ?? [null, MealIcon, 'blue' as CategoryHue, '유어딜']
  return { Icon: Icon as Ico, hue: hue as CategoryHue, label }
}

export function CoverImg({ post, className, variant = 'thumb' }: { post: CoverPost; className: string; variant?: 'hero' | 'thumb' }) {
  const tags = parseTags(post.tags)
  if (post.thumbnail_url) {
    return <img src={post.thumbnail_url} alt="" className={`${className} object-cover`} loading="lazy" />
  }
  const { Icon, hue, label } = blogCover(post.slug, tags)
  const big = variant === 'hero'
  const c = CATEGORY_PALETTE[hue]
  return (
    <div className={`${className} relative overflow-hidden flex items-center justify-center`} style={{ backgroundColor: `${c.main}14` }}>
      <Icon size={big ? 88 : 40} aria-hidden />
      {big && (
        <span className="absolute bottom-3.5 left-4 text-[12px] font-extrabold" style={{ color: c.dark }}>유어딜 · {label}</span>
      )}
    </div>
  )
}
