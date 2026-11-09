/** 🧬 주입 — 이용권 상세 폰 썸네일 2칸의 "검은 상자" 재발을 가드가 잡는가. 가드: src/tests/unit/detail-mobile-thumbs-2026-10-27.test.tsx */
const T = 'src/tests/unit/detail-mobile-thumbs-2026-10-27.test.tsx'
export default [
  {
    name: '🖼️ 썸네일 칸 색이 다크 카드색 리터럴로 돌아간다(라이트에 검은 상자 둘)',
    file: 'src/worker/utils/detail-ssr-body.ts',
    find: 'background-color:${DETAIL_THUMB_PLACEHOLDER};',
    replace: 'background-color:#1D1F29;',
    test: T,
    why: '2026-11-09 대표 캡처 — 큰 사진 아래 두 칸이 한참 검었다. 사진이 늦게 오는 동안 보이는 색이 그 인상을 만든다.',
  },
  {
    name: '🖼️ 썸네일 preload 를 워커 배선에서 뺀다(사진이 CSS 배경이라 다시 늦게 받는다)',
    file: 'src/worker/index.ts',
    find: "if (isMobileUserAgent(c.req.header('user-agent'))) for (const th of mobileThumbPreloadHrefs(detailGalleryImagesOf(ssrPayload))) appendLcpLink(c.res.headers, th, 'auto') }",
    replace: '}',
    test: T,
    why: 'CSS background-image 는 브라우저가 낮은 우선순위로 늦게 받는다 — preload 가 없으면 첫 화면 안의 두 칸이 다시 비어 보인다.',
  },
]
