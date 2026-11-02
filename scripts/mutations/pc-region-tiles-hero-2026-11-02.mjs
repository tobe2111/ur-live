/** 🧬 주입 — PC 「어디로 갈까요?」 타일이 홈 머리 지역 사진을 먼저 쓴다(2026-11-02). 가드: src/tests/unit/pc-home-s6-2026-10-14.test.ts */
const TEST = 'src/tests/unit/pc-home-s6-2026-10-14.test.ts'
export default [
  {
    name: '🗺️ 지역 타일 — 머리 사진보다 배너·이용권 사진이 먼저다',
    file: 'src/pages/pc-home/region-tiles.ts',
    find: '    const photo = hero || fromBanner || deals.find(',
    replace: '    const photo = fromBanner || deals.find((p) => p.image_url && p.deal_only !== 1 && addressInRegion(p.restaurant_address, { sido: r.sido }))?.image_url || hero || deals.find(',
    test: TEST,
    why: "'경기' 칸에 헬스장 광고 사진이 다시 뜬다 — 대표가 \"이 부분들도 같이 적용\" 하라고 한 그 모양.",
  },
  {
    name: '🗺️ 지역 타일 — 세종·충남이 머리 사진을 못 찾는다',
    file: 'src/shared/home-region-hero.ts',
    find: "  const key = sido === '세종' || sido === '충남' ? '충남세종' : sido",
    replace: '  const key = sido',
    test: TEST,
    why: '고르기 칸 키(충남세종)와 정규화 시·도(세종)가 달라 세종 타일만 다른 사진이 된다.',
  },
  {
    name: '🗺️ 지역 타일 — 정적 지역 사진을 리사이저로 줄인다',
    file: 'src/pages/pc-home/PcRegionTiles.tsx',
    find: '          const src = t.hero ? t.photo : cfImage(t.photo, { width: 400, quality: 76 })',
    replace: '          const src = cfImage(t.photo, { width: 400, quality: 76 })',
    test: TEST,
    why: '1080×360 을 400 폭으로 줄이면 높이 133px — 4:3 칸을 채우려 다시 늘려 흐려진다.',
  },
]
