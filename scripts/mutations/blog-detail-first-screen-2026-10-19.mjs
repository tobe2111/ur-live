/**
 * 🧬 주입 — 블로그 상세 서버 첫 화면 (2026-10-19 대표 "지도랑 블로그도 상세히")
 */
const T = 'src/tests/unit/blog-detail-first-screen-2026-10-19.test.tsx'
export default [
  {
    name: '블로그첫화면 — 서버 본문 문단 클래스가 화면과 갈린다',
    file: 'src/shared/blog-page.ts',
    find: "return `<p class=\"${BLOG_MD.p}\">${inlineHtml(t)}</p>`",
    replace: "return `<p class=\"text-[15px] my-3\">${inlineHtml(t)}</p>`",
    test: T,
    why: '마운트 때 본문 줄 높이가 달라져 첫 화면 아래가 통째로 움직인다.',
  },
  {
    name: '블로그첫화면 — 헤딩 id 번호를 안 매긴다(목차 앵커가 깨진다)',
    file: 'src/shared/blog-page.ts',
    find: 'return `<h2 id="sec-${hIdx++}" class="${BLOG_MD.h2}">',
    replace: 'return `<h2 class="${BLOG_MD.h2}">',
    test: T,
    why: '서버 첫 화면에서 목차를 누르면 갈 곳이 없다.',
  },
  {
    name: '블로그첫화면 — 원문을 탈출하지 않는다',
    file: 'src/shared/blog-page.ts',
    find: "const pushText = (s: string) => { if (s) out += esc(s.replace(/\\*\\*/g, '')) }",
    replace: "const pushText = (s: string) => { if (s) out += s.replace(/\\*\\*/g, '') }",
    test: T,
    why: '글 본문의 < 가 태그로 해석된다(XSS).',
  },
  {
    name: '블로그첫화면 — 위험한 주소를 링크로 만든다',
    file: 'src/shared/blog-page.ts',
    find: '      if (SAFE_HREF.test(m[4])) {',
    replace: '      if (true) {',
    test: T,
    why: 'javascript: 링크가 서버 HTML 에 그대로 나간다.',
  },
  {
    name: '블로그첫화면 — PC 에도 폰 모양을 그린다',
    file: 'src/worker/index.ts',
    find: "const blogFirst = !blogPhone ? '' :",
    replace: "const blogFirst = false ? '' :",
    test: T,
    why: 'PC 는 왼쪽 목차 칸이 그려져야 해서 다른 마크업이다 — 마운트 때 본문이 옆으로 밀린다.',
  },
  {
    name: '블로그첫화면 — 날짜를 UTC 로 쓴다',
    file: 'src/shared/blog-page.ts',
    find: "timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' })\n}",
    replace: "timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' })\n}",
    test: T,
    why: '자정 근처 글의 날짜가 하루 어긋난다.',
  },
  {
    name: '블로그목록첫화면 — 크롤러용 전체 목록을 빼먹는다',
    file: 'src/worker/utils/blog-list-first-screen.ts',
    find: "    + (crawl ? `<noscript>${crawl}</noscript>` : '')",
    replace: "",
    test: T,
    why: '첫 쪽 밖의 글로 가는 링크가 서버 HTML 에서 사라진다(네이버 Yeti·AI 크롤러가 못 찾는다).',
  },
  {
    name: '블로그목록첫화면 — 첫 쪽을 다른 개수로 자른다',
    file: 'src/worker/utils/blog-list-first-screen.ts',
    find: '  const page = posts.slice(0, BLOG_PER_PAGE)',
    replace: '  const page = posts.slice(0, 5)',
    test: T,
    why: '마운트 때 목록 아래가 늘어나며 쪽 번호가 움직인다.',
  },
  {
    name: '블로그목록첫화면 — 칩 순서를 바꾼다',
    file: 'src/shared/blog-page.ts',
    find: '  return [...new Set(posts.flatMap(p => parseBlogTags(p.tags)))]',
    replace: '  return [...new Set(posts.flatMap(p => parseBlogTags(p.tags)))].sort()',
    test: T,
    why: '서버와 화면의 칩 순서가 갈리면 마운트 때 칩이 뒤섞여 보인다(화면도 같은 함수를 쓰므로 정렬은 둘 다 바뀐다 — 시험은 처음 나온 순을 고정).',
  },
]
