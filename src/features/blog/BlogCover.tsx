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
  MealIcon, CafeIcon, BeautyIcon, StayIcon, GiftIcon, StoreIcon, LeisureIcon,
} from '@/components/icons/category-icons'
// 🧱 2026-10-19 주제 표·색·크기는 서버 첫 화면과 같은 SSOT(`shared/blog-page.ts`) — 여기엔 아이콘 그림만 남는다.
import { BLOG_COVER, blogCoverTopic, blogCoverBg, blogCoverInk, parseBlogTags, type BlogCoverIcon } from '@/shared/blog-page'

type CoverPost = { slug: string; tags: string; thumbnail_url: string | null }
type Ico = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>

const ICONS: Record<BlogCoverIcon, Ico> = {
  gift: GiftIcon as Ico, meal: MealIcon as Ico, stay: StayIcon as Ico, beauty: BeautyIcon as Ico,
  store: StoreIcon as Ico, cafe: CafeIcon as Ico, leisure: LeisureIcon as Ico,
}

export function blogCover(slug: string, tags: string[]) {
  const { icon, hue, label } = blogCoverTopic(slug, tags)
  return { Icon: ICONS[icon], hue, label }
}

export function CoverImg({ post, className, variant = 'thumb' }: { post: CoverPost; className: string; variant?: 'hero' | 'thumb' }) {
  const tags = parseBlogTags(post.tags)
  if (post.thumbnail_url) {
    return <img src={post.thumbnail_url} alt="" className={`${className} object-cover`} loading="lazy" />
  }
  const { Icon, hue, label } = blogCover(post.slug, tags)
  const big = variant === 'hero'
  return (
    <div className={`${className} ${BLOG_COVER.box}`} style={{ backgroundColor: blogCoverBg(hue) }}>
      <Icon size={big ? BLOG_COVER.heroIcon : BLOG_COVER.thumbIcon} aria-hidden />
      {big && (
        <span className={BLOG_COVER.label} style={{ color: blogCoverInk(hue) }}>유어딜 · {label}</span>
      )}
    </div>
  )
}
