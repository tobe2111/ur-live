/** 🧬 주입 — 문서 사진 빠른 길. 가드: src/tests/unit/doc-upload-fast-2026-11-11.test.ts */
const T = 'src/tests/unit/doc-upload-fast-2026-11-11.test.ts'
export default [
  { name: '문서빠른길 — 빠른 길을 뺀다(2MB 미만 원본을 그대로 올리던 때로)', file: 'src/lib/image-compress.ts', find: "  const fast = await encodeDocumentFast(file).catch(() => null); if (fast) return fast\n", replace: "", test: T, why: '2026-11-11 대표 신고 — 사진 올리기가 느리다.' },
  { name: '문서빠른길 — 긴 변을 상품 사진 크기로 내린다(등록증 글자가 뭉개진다)', file: 'src/lib/image-compress.ts', find: "export const DOCUMENT_FAST_MAX_SIDE = 2000", replace: "export const DOCUMENT_FAST_MAX_SIDE = 1280", test: T, why: '2026-09-15 — 심사 담당이 사업자번호를 못 읽는다.' },
  { name: '문서빠른길 — 건너뛰는 크기를 2MB 로 되돌린다', file: 'src/lib/image-compress.ts', find: "export const DOCUMENT_FAST_SKIP_BYTES = 400 * 1024", replace: "export const DOCUMENT_FAST_SKIP_BYTES = 2 * 1024 * 1024", test: T, why: '1.9MB 원본이 폰 회선으로 그대로 올라간다.' },
  { name: '문서빠른길 — 진행률을 뺀다(멈춘 것처럼 보인다)', file: 'src/pages/store-new/StoreBizCertPage.tsx', find: "${pct > 0 ? ` ${pct}%` : ''}", replace: "", test: T, why: '올리는 동안 아무 변화가 없으면 사장님이 다시 누른다.' },
]
