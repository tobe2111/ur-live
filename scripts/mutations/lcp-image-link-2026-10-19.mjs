/**
 * 🧬 주입 — 화면의 가장 큰 그림(LCP)을 응답 헤더로 (2026-10-19 대표 "홈 부분 우선적으로")
 */
const T = 'src/tests/unit/lcp-image-link-2026-10-19.test.ts'
export default [
  {
    name: 'LCP헤더 — 홈 배너 주소를 다른 폭으로 만든다(preload 가 버려진다)',
    file: 'src/worker/utils/lcp-image-link.ts',
    find: "return stripBannerImageUrl(stripBannersOf(JSON.parse(sectionsSeedJson))[0]?.image_url, 'strip')",
    replace: "return stripBannerImageUrl(stripBannersOf(JSON.parse(sectionsSeedJson))[0]?.image_url, 'vouchers')",
    test: T,
    why: '주소가 한 글자만 달라도 브라우저는 그 preload 를 버리고 같은 사진을 다시 받는다 — 에러 0, 트래픽 두 배.',
  },
  {
    name: 'LCP헤더 — 교환권이 머리 배너가 아닌 자리를 고른다',
    file: 'src/worker/utils/lcp-image-link.ts',
    find: "bannersOfSlot(JSON.parse(bannersJson), 'vouchers')[0]",
    replace: "bannersOfSlot(JSON.parse(bannersJson), 'strip')[0]",
    test: T,
    why: '교환권 첫 화면엔 없는 사진을 받는다(헛받기).',
  },
  {
    name: 'LCP헤더 — 외부 주소 차단을 지운다',
    file: 'src/worker/utils/lcp-image-link.ts',
    find: "if (!href || !href.startsWith('/') || href.startsWith('//') || /[<>;\\s]/.test(href)) return",
    replace: 'if (!href) return',
    test: T,
    why: '시드 값이 Link 헤더 문법을 깨거나 외부 주소를 미리 받게 만든다.',
  },
  {
    name: 'LCP헤더 — 홈 첫 화면을 안 그렸는데도 헤더를 싣는다',
    file: 'src/worker/index.ts',
    find: 'if (homeFirst) appendLcpLink(c.res.headers, homeLcpImage(ssrExtraPayload))',
    replace: 'appendLcpLink(c.res.headers, homeLcpImage(ssrExtraPayload))',
    test: T,
    why: '첫 화면이 없으면 React 가 그 사진을 늦게, 다른 맥락에서 그린다 — 미리받기가 회선만 먹는다.',
  },
  {
    name: 'LCP헤더 — 숙소 상세가 PC 에도 폰 주소를 당긴다',
    file: 'src/worker/index.ts',
    find: "if (stayFirst && isMobileUserAgent(c.req.header('user-agent'))) appendLcpLink",
    replace: 'if (stayFirst) appendLcpLink',
    test: T,
    why: 'PC 는 다른 폭의 사진을 그린다 — 폰 주소를 당기면 PC 가 사진을 두 번 받는다.',
  },
]
