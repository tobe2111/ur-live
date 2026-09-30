/**
 * 🎬 2026-09-30 ④ — 라이브커머스 영구 중단(2026-06-17 대표 확정) 잔여 문구 주입.
 *
 * 되돌리려는 사고: **기능은 내려갔는데 문구가 남는 것.** 3개월 동안 실제로 그랬고,
 * 신규 가입 첫 화면이 *"한국 1위 라이브 커머스"* 라고 말하고 있었다. 에러가 없어 아무도 신고하지 않는다.
 *
 * 가드: src/tests/unit/live-commerce-copy-2026-09-30.test.ts
 */
const TEST = 'src/tests/unit/live-commerce-copy-2026-09-30.test.ts'

export default [
  {
    name: '🎬 라이브 문구가 locale 로 되살아난다 (ko 온보딩 첫 화면)',
    file: 'public/locales/ko/translation.json',
    find: '"welcomeDesc2": "할인가로 사고 바로 쓰는 곳"',
    replace: '"welcomeDesc2": "한국 1위 라이브 커머스"',
    test: TEST,
    why: '**이것이 실제로 라이브에 있던 문구다.** 신규 가입자가 처음 보는 문장이 없는 서비스를 광고했다.',
  },
  {
    name: '🎬 라이브 문구가 다른 언어로만 되살아난다 (zh 메타)',
    file: 'public/locales/zh/translation.json',
    find: '"seoTitle": "UrDeal - 本地团购（美食·美容·住宿）"',
    replace: '"seoTitle": "Ur-Deal - 直播电商美食团购"',
    test: TEST,
    why:
      '한국어만 고치고 끝내는 것이 이 클래스의 전형이다 — 다른 언어 locale 이 **검색 결과에 그대로** 뜬다. ' +
      '실제로 ko 는 현행이고 zh·ja·es·fr 만 라이브커머스 시절에 멈춰 있었다.',
  },
  {
    name: '🎬 라이브 문구가 defaultValue 로 되살아난다 (locale 로딩 전 폴백)',
    file: 'src/pages/PointsChargePage.tsx',
    find: "defaultValue: '교환권 구매와 상품 결제에만 사용 가능합니다.'",
    replace: "defaultValue: '라이브 방송 후원 및 상품 결제에만 사용 가능합니다.'",
    test: TEST,
    why: 'locale 만 고치면 폴백이 되살린다 — 2026-09-01 audit log 가 값을 치르고 배운 규칙의 반대 방향.',
  },
  {
    name: '🎬 사전이 비어 검사가 헛돈다',
    file: TEST,
    find: "  es: ['comercio en vivo', 'Comercio en vivo', 'en vivo en'],",
    replace: '  es: [],',
    test: TEST,
    why:
      '문구 사전에서 한 언어를 비우면 **그 언어는 조용히 검사 밖으로 나간다.** ' +
      '🩸 첫 판은 평평한 배열이라 es·fr 5개를 지워도 전체 개수 하한(>15)을 통과했다 — ' +
      '주입 러너가 그 구멍을 잡아 언어별 지도로 바꾸고 "언어마다 최소 하나" 를 요구하게 했다.',
  },
  {
    name: '🎬 키 추출이 헛돌아 아무것도 안 본다',
    file: TEST,
    find: "    for (const m of src.matchAll(/\\bt\\(\\s*'([A-Za-z][\\w.]*\\.[\\w.]+)'/g)) keys.add(m[1])",
    replace: '',
    test: TEST,
    why:
      "이 레포가 반복해 당한 **헛도는 가드**. 작은따옴표 추출을 빼면 부르는 키가 1,748 → 수십 개로 " +
      '줄어드는데, 그러면 위 검사들이 "위반 0" 으로 초록을 낸다. 키 수 하한이 그것을 잡는다.',
  },
]
