/**
 * 🌐 번역 손님용/대시보드용 분리 (2026-10-11) — 주입 매니페스트.
 * 가드: src/tests/unit/i18n-core-dash-split-2026-10-11.test.ts
 * 빠진 키는 에러 없이 화면에 키 이름으로 뜬다 — 그래서 결함을 심어 가드가 실제로 잡는지 본다.
 */
const TEST = 'src/tests/unit/i18n-core-dash-split-2026-10-11.test.ts'
const SPLIT = 'scripts/i18n-split.mjs'

export default [
  {
    name: '[i18n분리] 손님 화면이 쓰는 대시보드 키를 core 에 안 남긴다',
    file: SPLIT,
    find: "    if (exact.has(p)) return true\n    for (const x of exact)",
    replace: "    if (exact.has(p) && false) return true\n    for (const x of exact)",
    test: TEST,
    why: '유어샵·마이 판매 구역에 seller.* 키 이름이 그대로 뜬다.',
  },
  {
    name: '[i18n분리] 유어샵(SellerPublicPage)을 대시보드 전용으로 분류한다',
    file: SPLIT,
    find: "  if (/^src\\/pages\\/(SellerPublicPage|seller-public\\/)/.test(p)) return false\n",
    replace: '',
    test: TEST,
    why: '사업자 유어샵이 쓰는 키가 core 에서 빠진다.',
  },
  {
    name: '[i18n분리] 빠진 키 안전망을 끈다',
    file: 'src/i18n.ts',
    find: "!dashLoaded.has((i18n.language || initialLanguage).split('-')[0] as Lang)) void ensureDashStrings()",
    replace: "!dashLoaded.has((i18n.language || initialLanguage).split('-')[0] as Lang)) void 0",
    test: TEST,
    why: '분류가 틀린 키가 있으면 영영 안 불러온다.',
  },
  {
    name: '[i18n분리] 마이 판매 시트가 dash 를 안 부른다',
    file: 'src/pages/user-profile/seller-section/ToolPageSheet.tsx',
    find: '  useEffect(() => { void ensureDashStrings() }, [])\n',
    replace: '',
    test: TEST,
    why: '시트 안 대시보드 화면이 안전망에만 기대 잠깐씩 기본값 문구로 보인다.',
  },
]
