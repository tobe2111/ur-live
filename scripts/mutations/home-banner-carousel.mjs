// 🎠 홈 상단 배너 2:1 캐러셀 (2026-10-12) — docs/design/home-banner-3d.md
export default [
  {
    name: '🎠 상단 배너 그림 위에 그라데이션 덮개가 다시 깔린다',
    file: 'src/components/home/HomeBannerStrip.tsx',
    find: '      <div className={`absolute left-5 bottom-4 max-w-[58%] ${dark ?',
    replace:
      '      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/35 to-transparent" aria-hidden="true" />\n' +
      '      <div className={`absolute left-5 bottom-4 max-w-[58%] ${dark ?',
    test: 'src/tests/unit/home-top-banner-and-near-default.test.ts',
    why:
      '대표 *"배경을 그라데이션으로 하니까 촌스러운데"* — 배너 그림은 단색 바탕으로 만들고 화면은 덮개를 깔지 않는다. ' +
      '덮개는 "글자가 안 읽힐까" 하는 걱정에서 늘 다시 생긴다.',
  },
  {
    name: '🖋️ 파스텔 배너인데 글자가 흰색으로 고정된다 (밝기 판정이 반대)',
    file: 'src/components/home/banner-ink.ts',
    find: "  return withInk > withWhite ? 'dark' : 'light'",
    replace: "  return withInk > withWhite ? 'light' : 'dark'",
    test: 'src/tests/unit/banner-ink-2026-10-12.test.ts',
    why: '밝은 파스텔 위 흰 글자는 거의 안 보인다 — 에러 없이 배너 문구만 사라진다.',
  },
]
