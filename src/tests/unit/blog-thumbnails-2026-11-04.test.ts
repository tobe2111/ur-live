/**
 * 🖼️ 블로그 글별 AI 썸네일 (2026-11-04 대표 *"사진들 썸네일 부분들 적재적소에 AI로 사진 만들어서 넣어주면 좋겠고"*)
 *
 * 지키는 것:
 *  ① 표(`BLOG_SEED_THUMBNAILS`)의 모든 사진이 `public/` 에 **실제로 있다** — 없으면 목록에 깨진 그림이 뜬다.
 *  ② 사진은 `/assets/blog/<slug>-v<N>.webp` — `/assets/*` 는 1년 immutable 캐시라 이름에 버전이 없으면 교체가 안 보인다.
 *  ③ 표의 slug 가 실제 시드 글이다(오타면 조용히 아무 글에도 안 붙는다).
 *  ④ 재시드가 사진을 DB 에 쓴다 — INSERT 는 thumbnail_url, UPDATE 는 COALESCE(시드에 없으면 기존 사진 보존).
 *  ⑤ 사진 하나가 300KB 를 넘지 않는다(목록 첫 화면 무게).
 *
 * ⚠️ 못 보는 것: 사진이 글 주제에 맞는지(그려서 봐야 한다) · 관리자가 손으로 고친 글(manually_edited=1)은 재시드가 안 건드린다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { BLOG_SEED_THUMBNAILS, blogSeedPosts } from '@/features/blog/api/blog-seed'
import { BLOG_SEED_INLINE_IMAGES } from '@/features/blog/api/blog-seed-images'
import { blogContentToHtml } from '@/features/blog/api/blog-ssr-body'

const ROOT = process.cwd()
const ROUTES = readFileSync(join(ROOT, 'src/features/blog/api/blog.routes.ts'), 'utf8')

describe('블로그 썸네일 2026-11-04', () => {
  const entries = Object.entries(BLOG_SEED_THUMBNAILS)

  it('표가 비어 있지 않다', () => {
    expect(entries.length).toBeGreaterThan(0)
  })

  it('① 모든 사진 파일이 public 에 있다 · ⑤ 300KB 이하', () => {
    for (const [slug, path] of entries) {
      const f = join(ROOT, 'public', path)
      expect(existsSync(f), `${slug} 사진 파일 없음: ${path}`).toBe(true)
      expect(statSync(f).size, `${slug} 사진이 너무 크다`).toBeLessThan(300 * 1024)
    }
  })

  it('② 경로는 /assets/blog/<slug>-v<N>.webp', () => {
    for (const [slug, path] of entries) {
      expect(path).toMatch(new RegExp(`^/assets/blog/${slug}-v\\d+\\.webp$`))
    }
  })

  it('③ 표의 slug 가 실제 시드 글이고, 시드가 그 사진을 싣는다', () => {
    const posts = blogSeedPosts()
    for (const [slug, path] of entries) {
      const p = posts.find((x) => x.slug === slug)
      expect(p, `시드에 없는 slug: ${slug}`).toBeTruthy()
      expect(p!.thumbnail).toBe(path)
    }
  })

  it('④ 재시드가 thumbnail_url 을 쓴다(INSERT) · 기존 사진을 지우지 않는다(UPDATE COALESCE)', () => {
    const i = ROUTES.indexOf('INSERT OR IGNORE INTO blog_posts')
    expect(ROUTES.slice(i, i + 500)).toMatch(/thumbnail_url/)
    expect(ROUTES.slice(i, i + 700)).toMatch(/post\.thumbnail/)
    expect(ROUTES).toMatch(/thumbnail_url=COALESCE\(\?, thumbnail_url\)/)
  })
})

// 🖼️ 본문 사이 사진 (같은 날 2차 — 대표 *"글 중간중간에도 그림들을 넣어야 안되겠어? 진짜 블로그처럼?"*)

describe('블로그 본문 사진 2026-11-04', () => {
  const posts = blogSeedPosts()

  it('⑥ 표의 모든 사진이 실제 소제목을 찾아 본문에 들어간다(문구가 바뀌면 조용히 빠지는 것을 막는다)', () => {
    for (const [slug, imgs] of Object.entries(BLOG_SEED_INLINE_IMAGES)) {
      const p = posts.find((x) => x.slug === slug)
      expect(p, `시드에 없는 slug: ${slug}`).toBeTruthy()
      for (const im of imgs) {
        expect(p!.content, `${slug}: '${im.before}' 위에 사진이 안 들어갔다`).toContain(`![${im.alt}](${im.src})\n\n${im.before}`)
      }
    }
  })

  it('⑦ 사진 파일이 있다 · 200KB 이하 · alt 가 비어 있지 않다', () => {
    for (const imgs of Object.values(BLOG_SEED_INLINE_IMAGES)) {
      for (const im of imgs) {
        const f = join(ROOT, 'public', im.src)
        expect(existsSync(f), `파일 없음: ${im.src}`).toBe(true)
        expect(statSync(f).size).toBeLessThan(200 * 1024)
        expect(im.alt.trim().length).toBeGreaterThan(4)
      }
    }
  })

  it('⑧ 크롤러 본문이 사진을 <img> 로 낸다 — `!` 와 링크로 새지 않는다', () => {
    const html = blogContentToHtml('![가게 사진](/assets/blog/x-a-v1.webp)\n\n## 제목')
    expect(html).toContain('<img src="/assets/blog/x-a-v1.webp" alt="가게 사진" loading="lazy">')
    expect(html).not.toMatch(/!<a /)
    // 반대 방향: 위험한 주소는 사진으로 승격하지 않는다
    expect(blogContentToHtml('![x](javascript:alert(1))')).not.toContain('<img')
  })
})
