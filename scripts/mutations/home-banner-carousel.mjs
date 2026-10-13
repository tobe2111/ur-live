// 🎠 홈 상단 배너 2:1 캐러셀 (2026-10-12) — docs/design/home-banner-3d.md
export default [
  {
    name: '🎠 밝은(파스텔) 배너 그림 위에도 검은 덮개가 깔린다',
    file: 'src/components/home/HomeBannerStrip.tsx',
    find: '      {bg && !dark && <div className="absolute inset-0 -z-10 bg-gradient-to-t',
    replace: '      {bg && <div className="absolute inset-0 -z-10 bg-gradient-to-t',
    test: 'src/tests/unit/banner-ink-2026-10-12.test.ts',
    why:
      '대표 *"배경을 그라데이션으로 하니까 촌스러운데"* — 파스텔 그림은 짙은 글자로 읽히고 덮개가 그림을 탁하게 만든다. ' +
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
