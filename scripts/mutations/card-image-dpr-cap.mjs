/**
 * 🖼️ 카드 사진 밀도 상한 2x (2026-10-12, 대표 "이용권 사진들도 너무 늦게 뜨고") — 주입 매니페스트.
 * 가드: src/tests/unit/home-card-preload.test.ts
 */
const TEST = 'src/tests/unit/home-card-preload.test.ts'

export default [
  {
    name: '🖼️ 카드가 다시 3x 사진을 받는다(상한을 안 넘긴다)',
    file: 'src/components/deal/DealCardMedia.tsx',
    find: 'cfSrcSet(src, width, HOME_CARD_MAX_DPR)',
    replace: 'cfSrcSet(src, width)',
    test: TEST,
    why: '아이폰이 175px 카드에 600px 사진을 받는다 — 장당 약 37% 더 받고, 워커 preload 와 URL 이 갈려 같은 사진을 두 번 받는다.',
  },
  {
    name: '🖼️ 워커 preload 만 상한을 잊는다(이중 다운로드)',
    file: 'src/worker/utils/home-card-preload.ts',
    find: 'cfSrcSet(src, w, HOME_CARD_MAX_DPR)',
    replace: 'cfSrcSet(src, w)',
    test: TEST,
    why: 'preload 의 imagesrcset 이 카드와 다르면 브라우저가 preload 를 안 쓰고 같은 사진을 다시 받는다.',
  },
  {
    name: '🖼️ 상한 인자가 무시된다(필터 소실)',
    file: 'src/utils/cf-image.ts',
    find: '    .filter(dpi => dpi <= maxDpr)\n',
    replace: '',
    test: TEST,
    why: '상한을 넘겨도 3x 가 남으면 처방 전체가 조용히 무효가 된다.',
  },
]
