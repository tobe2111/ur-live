/** 🧬 주입 — 문서 사진 빠른 길. 가드: src/tests/unit/doc-upload-fast-2026-11-11.test.ts */
const T = 'src/tests/unit/doc-upload-fast-2026-11-11.test.ts'
export default [
  { name: '문서빠른길 — 빠른 길을 뺀다(2MB 미만 원본을 그대로 올리던 때로)', file: 'src/lib/image-compress.ts', find: "  const fast = await encodeDocumentFast(file).catch(() => null); if (fast) return fast\n", replace: "", test: T, why: '2026-11-11 대표 신고 — 사진 올리기가 느리다.' },
  { name: '문서빠른길 — 긴 변을 상품 사진 크기로 내린다(등록증 글자가 뭉개진다)', file: 'src/lib/image-compress.ts', find: "export const DOCUMENT_FAST_MAX_SIDE = 2000", replace: "export const DOCUMENT_FAST_MAX_SIDE = 1280", test: T, why: '2026-09-15 — 심사 담당이 사업자번호를 못 읽는다.' },
  { name: '문서빠른길 — 건너뛰는 크기를 2MB 로 되돌린다', file: 'src/lib/image-compress.ts', find: "export const DOCUMENT_FAST_SKIP_BYTES = 400 * 1024", replace: "export const DOCUMENT_FAST_SKIP_BYTES = 2 * 1024 * 1024", test: T, why: '1.9MB 원본이 폰 회선으로 그대로 올라간다.' },
  { name: '문서빠른길 — 진행률을 뺀다(멈춘 것처럼 보인다)', file: 'src/pages/store-new/StoreBizCertPage.tsx', find: "${pct > 0 ? ` ${pct}%` : ''}", replace: "", test: T, why: '올리는 동안 아무 변화가 없으면 사장님이 다시 누른다.' },
  { name: '문서빠른길 — 일반 사진의 빠른 길을 뺀다(올릴 때마다 라이브러리와 외부 CDN 을 받는다)', file: 'src/lib/image-compress.ts', find: "  if (toWebP) { const fast = await encodeFast(file, maxWidthOrHeight, 0.82, maxSizeMB * 1024 * 1024).catch(() => null); if (fast) return fast }\n", replace: "", test: T, why: '라이브 실측 — 압축 2회에 jsdelivr 요청 2번.' },
  { name: '문서빠른길 — 움직이는 그림도 빠른 길로 보낸다(첫 장면만 남는다)', file: 'src/lib/image-compress.ts', find: "  if (!file.type.startsWith('image/') || /gif|svg/.test(file.type)) return null\n  if (typeof createImageBitmap", replace: "  if (!file.type.startsWith('image/')) return null\n  if (typeof createImageBitmap", test: T, why: '캔버스는 GIF 의 첫 장면만 그린다.' },
  { name: '문서빠른길 — 세 크기를 다시 차례로 올린다', file: 'src/lib/image-sized.ts', find: "  const others = await Promise.all(rest.map((w) => send(w, head.batch as string)))", replace: "  const others: Array<Awaited<ReturnType<typeof send>>> = []; for (const w of rest) others.push(await send(w, head.batch as string))", test: T, why: '사진 한 장에 왕복 3번 — 폰 회선에서 그대로 대기 시간.' },
]
