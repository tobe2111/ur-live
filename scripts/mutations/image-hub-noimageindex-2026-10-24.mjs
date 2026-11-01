/**
 * 🧬 주입 — 이미지 허브 noimageindex(상품 사진 출처를 상세로)
 *    가드: src/tests/unit/image-hub-noimageindex-2026-10-24.test.ts
 */
const T = 'src/tests/unit/image-hub-noimageindex-2026-10-24.test.ts'
const H = 'src/shared/seo/image-hub.ts'
const S = 'src/worker/utils/surface-ssr-meta.ts'
export default [
  {
    name: '이미지허브 — 상세(/pass)까지 허브로 잡는다',
    file: H,
    find: "  /^\\/u\\/[^/]+$/,\n",
    replace: "  /^\\/u\\/[^/]+$/,\n  /^\\/pass\\/[^/]+$/,\n",
    test: T,
    why: '상세가 사진의 정당한 출처다 — 상세에 noimageindex 를 붙이면 우리 사진이 이미지 검색에서 사라진다(에러 0).',
  },
  {
    name: '이미지허브 — 배선이 사라진다',
    file: S,
    find: '  if (isHubCanonical(meta.canonical)) {\n',
    replace: '  if (false && isHubCanonical(meta.canonical)) {\n',
    test: T,
    why: '판정 함수가 있어도 붙이는 곳이 없으면 홈 제목이 계속 사진에 붙는다.',
  },
  {
    name: '이미지허브 — 페이지 자체를 noindex 로 만든다',
    file: H,
    find: `export const NOIMAGEINDEX_META = '<meta name="robots" content="noimageindex" />'`,
    replace: `export const NOIMAGEINDEX_META = '<meta name="robots" content="noindex, noimageindex" />'`,
    test: T,
    why: '사진만 빼야 한다 — 페이지까지 빼면 홈·목록이 검색에서 사라진다.',
  },
]
