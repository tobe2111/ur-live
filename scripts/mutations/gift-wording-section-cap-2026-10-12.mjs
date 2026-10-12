/**
 * 🧬 주입 — 선물 "보내기 취소" 문구 · 홈 섹션 갤러리 자르기 (2026-10-12)
 */
const T = 'src/tests/unit/gift-wording-section-cap-2026-10-12.test.ts'
export default [
  {
    name: '선물 문구 — 버튼을 "회수" 로 되돌린다',
    file: 'src/pages/my-vouchers/GiftVoucherSheet.tsx',
    find: "'선물 보내기를 취소했어요. 이용권은 그대로 내 지갑에 있어요'",
    replace: "'선물을 회수했어요. 이용권은 그대로 내 지갑에 있어요'",
    test: T,
    why: '대표가 고른 말("선물 보내기 취소")과 화면 말이 갈린다.',
  },
  {
    name: '홈 섹션 — 갤러리를 안 자른다',
    file: 'src/features/sections/api/sections.routes.ts',
    find: "products: capRowGalleries(normalizeSectionSource(s.source) === 'manual'",
    replace: "products: ((x: unknown[]) => x)(normalizeSectionSource(s.source) === 'manual'",
    test: T,
    why: '홈 섹션만 원본 갤러리 전량을 SSR 시드·엣지 캐시에 싣는다.',
  },
]
