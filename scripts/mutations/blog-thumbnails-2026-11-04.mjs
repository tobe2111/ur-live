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
  {
    name: '🖼️ 본문 사진 소제목이 낡는다(한 글자 차이) — 사진이 조용히 빠진다',
    why: '소제목을 고치면 표의 before 가 안 맞아 사진이 에러 없이 사라진다.',
    file: 'src/features/blog/api/blog-seed-images.ts',
    find: "'## 결제가 안전한 이유'",
    replace: "'## 결제가 안전한 이유!'",
    test: TEST,
  },
  {
    name: '🖼️ 크롤러 본문이 사진 문법을 모른다 — `!` + 링크로 샌다',
    why: '검색엔진·AI 크롤러가 받는 본문에 깨진 문자열이 남는다.',
    file: 'src/features/blog/api/blog-ssr-body.ts',
    find: '(_m, alt: string, src: string) => `<img src="${src}" alt="${alt}" loading="lazy">`)',
    replace: '(m: string) => m)',
    test: TEST,
  },
]
