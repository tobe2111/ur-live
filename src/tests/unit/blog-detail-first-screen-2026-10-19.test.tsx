/**
 * 📝 블로그 상세 서버 첫 화면 — 2026-10-19 (대표 *"지도랑 블로그도 상세히 진행해줘"*)
 *
 * 불변식
 *  ① 본문: 워커 문자열 렌더러(`blogMarkdownHtml`)와 React `BlogMarkdown` 이 **같은 DOM**(태그·클래스·id·href·글자)을 낸다.
 *  ② 골격 클래스·날짜·읽는 시간·커버 주제는 화면과 워커가 같은 상수/함수(`shared/blog-page.ts`)를 쓴다.
 *  ③ 첫 화면은 본문 **전부**를 담는다(크롤러가 읽는 글자가 종전보다 줄지 않는다) · 원문은 탈출한다.
 *  ④ 워커는 폰(+크롤러)에서만 그리고, 실패하면 종전 크롤러용 본문으로 돌아간다. CSS 먼저 표면에 `/blog/:slug`.
 *
 * ⚠️ 못 보는 것: 실제 박스 — 브라우저로 대조했다(2026-10-19 라이브 글 둘 · 아이폰 13 · 라이트·다크 — 머리글·태그·
 *    제목·요약·메타·커버·목차·본문 첫 여섯 블록 **전부 일치**). PC 는 그리지 않는다.
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import fs from 'node:fs'
import { BlogMarkdown } from '@/features/blog/BlogMarkdown'
import { blogMarkdownHtml, BLOG_DETAIL, blogDateLabel, blogReadMin, blogHasToc } from '@/shared/blog-page'
import { blogToc } from '@/features/blog/BlogMarkdown'
import { buildBlogDetailFirstScreen } from '@/worker/utils/blog-detail-first-screen'
import { cssFirstApplies } from '@/worker/utils/css-first-boot'
import { stripComments } from '../helpers/source-text'

const MD = [
  '첫 문단 **굵게** 와 [내부](/vouchers) 링크, [외부](https://example.com) 링크, [나쁜](javascript:alert(1)) 링크.',
  '## 첫 제목 **강조**',
  '- 하나 **굵게**\n- 둘 & <b>태그</b>',
  '1. 첫째\n2. 둘째',
  '> 인용 한 줄\n> 둘째 줄',
  '### 소제목',
  '| 이름 | 값 |\n|---|---|\n| a | **b** |',
  '---',
  '![사진](/assets/a.webp) 끝',
  '짝 안 맞는 ** 마커',
].join('\n\n')

type Node0 = { tag: string; cls: string | null; id: string | null; href: string | null; target: string | null; text: string; kids: Node0[] }
function tree(el: Element): Node0 {
  return {
    tag: el.tagName, cls: el.getAttribute('class'), id: el.getAttribute('id'), href: el.getAttribute('href') ?? el.getAttribute('src'),
    target: el.getAttribute('target'), text: [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(''),
    kids: [...el.children].map(tree),
  }
}

describe('① 본문 — React 와 같은 DOM', () => {
  it('태그·클래스·id·주소·글자가 같다', () => {
    const { container } = render(<div><BlogMarkdown content={MD} /></div>)
    const react = tree(container.firstElementChild as Element)
    const host = document.createElement('div'); host.innerHTML = blogMarkdownHtml(MD)
    expect(tree(host)).toEqual(react)
  })
  it('위험한 주소·태그는 글자로만', () => {
    const html = blogMarkdownHtml(MD)
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('<b>')
    expect(html).toContain('&lt;b&gt;')
  })
  it('목차 유무 판정이 blogToc 와 같다', () => {
    for (const c of [MD, '문단만\n\n둘째 문단', '### 하나만', '본문\n## 줄 중간이면 아님']) expect(blogHasToc(c), c).toBe(blogToc(c).length > 0)
  })
})

describe('② 같은 상수 — 화면과 워커', () => {
  it('상세 화면이 골격 클래스·날짜·읽는 시간을 손으로 적지 않는다', () => {
    const page = stripComments(fs.readFileSync('src/pages/BlogDetailPage.tsx', 'utf8'))
    for (const k of ['header', 'headerInner', 'logo', 'grid', 'article', 'tags', 'tag', 'h1', 'summary', 'meta', 'cover', 'tocBox', 'tocBtn', 'body'] as const) {
      expect(page, k).toContain(`BLOG_DETAIL.${k}`)
    }
    expect(page).toContain('blogDateLabel(post.published_at)')
    expect(page).toContain('blogReadMin(post.content)')
  })
  it('BlogMarkdown 도 상수에서 받는다', () => {
    const md = stripComments(fs.readFileSync('src/features/blog/BlogMarkdown.tsx', 'utf8'))
    expect(md).not.toMatch(/className="[^"]*leading-\[1\.85\]/)
    expect(md).toContain('BLOG_MD.p')
  })
  it('커버 주제 표는 한 벌', () => {
    expect(stripComments(fs.readFileSync('src/features/blog/BlogCover.tsx', 'utf8'))).not.toMatch(/COVER_TOPICS/)
  })
  it('날짜는 한국 시간 · 읽는 시간은 500자당 1분(최소 1)', () => {
    expect(blogDateLabel('2026-09-23 16:30:00')).toBe('2026년 9월 24일')
    expect(blogReadMin('')).toBe(1)
    expect(blogReadMin('x'.repeat(1600))).toBe(3)
  })
})

describe('③ 첫 화면 — 본문 전부 · 탈출', () => {
  const seed = (o: Record<string, unknown> = {}) => JSON.stringify({ success: true, data: { slug: 'voucher-guide', title: '이용권 **가이드**', summary: '요약 <i>x</i>', content: MD, tags: '["이용권"]', author: '유어딜 팀', published_at: '2026-09-23 16:30:00', thumbnail_url: null, ...o } })
  const html = buildBlogDetailFirstScreen(seed())
  it('React 골격 클래스로 머리글·제목·요약·메타·커버·목차·본문을 그린다', () => {
    expect(html.startsWith('<div id="ur-first-screen">')).toBe(true)
    for (const k of ['header', 'h1', 'summary', 'meta', 'tocBox', 'body'] as const) expect(html, k).toContain(`class="${BLOG_DETAIL[k]}"`)
    expect(html).toContain('<h1 class="' + BLOG_DETAIL.h1 + '">이용권 가이드</h1>')
    expect(html).toContain('2026년 9월 24일')
    expect(html).toContain(blogMarkdownHtml(MD))
  })
  it('원문 탈출', () => {
    expect(html).not.toContain('<i>x</i>')
    expect(html).toContain('&lt;i&gt;')
  })
  it('목차가 없으면 목차 버튼도 없다 · 사진이 있으면 사진', () => {
    const noToc = buildBlogDetailFirstScreen(seed({ content: '문단 하나' }))
    expect(noToc).not.toContain(BLOG_DETAIL.tocBox)
    expect(buildBlogDetailFirstScreen(seed({ thumbnail_url: 'https://media.ur-team.com/a.webp' }))).toContain('src="https://media.ur-team.com/a.webp"')
  })
  it("깨진 시드는 ''", () => {
    expect(buildBlogDetailFirstScreen('{')).toBe('')
    expect(buildBlogDetailFirstScreen(JSON.stringify({ success: true, data: { slug: 'a', title: 't' } }))).toBe('')
  })
})

describe('④ 배선', () => {
  it('워커는 폰(+크롤러)에서만, 없으면 종전 본문', () => {
    const w = stripComments(fs.readFileSync('src/worker/index.ts', 'utf8'))
    expect(w).toMatch(/const blogFirst = ssrSlot === 'BLOGPOST' && ssrPayload && shouldRenderMobileFirstScreen\(c\.req\.header\('user-agent'\)\) \? buildBlogDetailFirstScreen\(ssrPayload\) : ''/)
    expect(w).toMatch(/const blogBody = blogFirst \? blogFirst : ssrSlot === 'BLOGPOST' && ssrPayload \? buildBlogPostBody\(ssrPayload\)/)
  })
  it('CSS 먼저 적용 — /blog/:slug 폰에서만(목록 /blog 는 아니다)', () => {
    const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
    expect(cssFirstApplies('/blog/voucher-guide', PHONE)).toBe(true)
    expect(cssFirstApplies('/blog/voucher-guide', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(false)
  })
})
