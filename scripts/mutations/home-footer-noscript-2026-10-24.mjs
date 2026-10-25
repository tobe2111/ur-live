/**
 * 🧬 주입 — 홈 크롤러 푸터(폰 홈엔 푸터가 없어 크롤러가 소개·링크를 못 봤다)
 *    가드: src/tests/unit/home-footer-noscript-2026-10-24.test.ts
 */
const T = 'src/tests/unit/home-footer-noscript-2026-10-24.test.ts'
const M = 'src/worker/utils/home-footer-noscript.ts'
const W = 'src/worker/index.ts'
export default [
  {
    name: '홈푸터 — 크롤러에게 화면에 없는 링크를 준다',
    file: M,
    find: "        { href: '/faq', label: '자주 묻는 질문' },\n",
    replace: "        { href: '/faq', label: '자주 묻는 질문' },\n        { href: '/browse', label: '쇼핑' },\n",
    test: T,
    why: '화면 푸터에 없는 글자를 크롤러에게만 주면 클로킹이다 — 두 목록은 글자까지 같아야 한다.',
  },
  {
    name: '홈푸터 — noscript 를 벗겨 사람 화면에 그린다',
    file: M,
    find: "return `<noscript><footer>",
    replace: "return `<div><footer>",
    test: T,
    why: '<noscript> 를 벗기면 첫 화면에 푸터가 끼어들어 사람 화면이 바뀐다(대표 조건: 실제 페이지 영향 0).',
  },
  {
    name: '홈푸터 — 워커가 폴백(로더) 경로엔 안 붙인다',
    file: W,
    find: 'setInnerContent((homeFirst || urdealLoaderHtml) + homeFooterNoscript()',
    replace: 'setInnerContent(homeFirst ? homeFirst + homeFooterNoscript() : urdealLoaderHtml',
    test: T,
    why: '첫 화면을 못 만든 날 크롤러 본문이 다시 비게 된다.',
  },
]
