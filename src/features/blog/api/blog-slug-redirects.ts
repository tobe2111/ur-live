/**
 * 🔗 2026-07-28 블로그 슬러그 리네임 301 맵 (대표 "yourdeal 이 아니라 urdeal 이 되어야").
 *
 * 도메인·브랜드는 urdeal 인데 대표 엔티티 글의 슬러그만 'yourdeal' 이라 URL 자체가 상충 신호를
 * 보내고 있었다(동음이의 구분이 핵심인 상황에서 특히 손해). 슬러그를 바로잡되, 이미 색인·공유된
 * 구 URL 이 404 나지 않도록 **영구 리다이렉트로 링크 자산을 승계**한다.
 *
 * ⚠️ 슬러그 추가 리네임 시 이 맵에 한 줄씩 — 구 URL 은 영구 보존이 원칙(제거 금지).
 *    시드(blog-seed.ts)의 slug 변경 + blog.routes 의 LEGACY_SEED_SLUGS 등록과 3종 세트.
 */
const RENAMED_BLOG_SLUGS: Record<string, string> = {
  'what-is-yourdeal': 'what-is-urdeal',
}

/**
 * `/blog/:slug` 경로가 리네임된 구 슬러그면 새 경로를 반환, 아니면 null.
 * @param pathname 요청 경로(예: `/blog/what-is-yourdeal`)
 */
export function resolveRenamedBlogPath(pathname: string): string | null {
  if (!pathname.startsWith('/blog/')) return null
  const oldSlug = pathname.slice('/blog/'.length).replace(/\/+$/, '')
  const next = RENAMED_BLOG_SLUGS[oldSlug]
  return next ? `/blog/${next}` : null
}
