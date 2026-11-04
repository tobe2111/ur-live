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
