/** 🧬 주입 — 블로그 PC 맨 글자 본문 감추기. 가드: src/tests/unit/blog-detail-first-screen-2026-10-19.test.tsx */
export default [
  { name: '블로그PC — 맨 글자 본문을 다시 그대로 보인다(CLS 0.14)', file: 'src/worker/index.ts', find: '!blogPhone && blogBody ? `<noscript>${blogBody}</noscript>` + urdealLoaderHtml : blogBody', replace: 'blogBody', test: 'src/tests/unit/blog-detail-first-screen-2026-10-19.test.tsx', why: '2026-11-12 PC 실측 — 스타일 없는 본문이 마운트 때 갈려 CLS 0.14.' },
]
