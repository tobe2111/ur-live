/**
 * 🖼️ 2026-11-08 대표 *"계속 최적화"* — 블로그 사진을 보이는 크기로 받는다.
 *
 * 라이브 실측: `/blog` 가 원본(1200×675) 7장을 그대로 받아 485KB(96px 썸네일 한 장 40~86KB), 상세 커버 139KB(lazy).
 * 처방: `blogCoverSrc`(커버 960 · 썸네일 240, 리사이저) 를 워커 첫 화면·React 가 **같이** 쓴다. 큰 커버는 즉시 + high.
 * ⚠️ 못 보는 것: 리사이저가 라이브에서 실제로 줄였는지(배포 뒤 바이트로 잰다).
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { blogCoverSrc, BLOG_COVER_WIDTH, blogMarkdownHtml } from '@/shared/blog-page'
import { CoverImg } from '@/features/blog/BlogCover'
import { buildBlogDetailFirstScreen } from '@/worker/utils/blog-detail-first-screen'

const SRC = '/assets/blog/what-is-urdeal-v1.webp'

describe('blogCoverSrc', () => {
  it('리사이저 주소로 바꾸고 폭이 변형마다 다르다', () => {
    expect(blogCoverSrc(SRC, 'hero')).toContain(`width=${BLOG_COVER_WIDTH.hero}`)
    expect(blogCoverSrc(SRC, 'thumb')).toContain(`width=${BLOG_COVER_WIDTH.thumb}`)
    expect(blogCoverSrc(SRC, 'hero')).toContain('/cdn-cgi/image/')
    expect(blogCoverSrc(null, 'hero')).toBe('')
  })
})

describe('워커 첫 화면 = React 같은 주소', () => {
  it('상세 커버: 서버 img src === CoverImg src, 즉시 + high', () => {
    const html = buildBlogDetailFirstScreen(JSON.stringify({ success: true, data: { slug: 'a', title: '제목', content: '본문', thumbnail_url: SRC, tags: '[]' } }))
    const tag = (html.match(/<img[^>]*what-is-urdeal-v1[^>]*>/) || [''])[0]
    expect(tag).toContain('fetchpriority="high"')
    expect(tag).not.toContain('loading="lazy"')
    const { container } = render(<CoverImg post={{ slug: 'a', tags: '[]', thumbnail_url: SRC }} variant="hero" className="x" />)
    const img = container.querySelector('img')!
    expect(tag.replace(/&amp;/g, '&')).toContain(`src="${img.getAttribute('src')}"`)
    expect(img.getAttribute('loading')).toBeNull()
  })
  it('썸네일(React)은 lazy · 240 폭', () => {
    const { container } = render(<CoverImg post={{ slug: 'a', tags: '[]', thumbnail_url: SRC }} className="x" />)
    const img = container.querySelector('img')!
    expect(img.getAttribute('loading')).toBe('lazy')
    expect(img.getAttribute('src')).toContain('width=240')
  })
  it('본문 사진도 줄인 주소', () => {
    expect(blogMarkdownHtml(`![설명](${SRC})`)).toContain(`/cdn-cgi/image/width=${BLOG_COVER_WIDTH.hero}`)
  })
})
