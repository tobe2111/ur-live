/**
 * 🖼️ 2026-11-04 — 블로그 글별 AI 썸네일 주입.
 * 시험: src/tests/unit/blog-thumbnails-2026-11-04.test.ts
 */
const BLOG = 'src/features/blog/api/blog.routes.ts'
const TEST = 'src/tests/unit/blog-thumbnails-2026-11-04.test.ts'

export default [
  {
    name: '🖼️ 재시드가 표에 없는 글의 사진을 지운다(COALESCE 제거)',
    why: '어드민 업로더로 넣은 사진이나 이전 버전 사진이, 표에 없다는 이유로 NULL 로 덮인다.',
    file: BLOG,
    find: 'thumbnail_url=COALESCE(?, thumbnail_url)',
    replace: 'thumbnail_url=?',
    test: TEST,
  },
  {
    name: '🖼️ 새 글 INSERT 가 사진을 안 싣는다',
    why: '새로 추가되는 시드 글은 사진이 표에 있어도 커버 아이콘으로만 뜬다.',
    file: BLOG,
    find: 'BLOG_SEED_VERSION, post.thumbnail ?? null).run()',
    replace: 'BLOG_SEED_VERSION, null).run()',
    test: TEST,
  },
]
