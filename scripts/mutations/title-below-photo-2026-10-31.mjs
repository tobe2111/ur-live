/** 🧬 주입 — 숙소 상세 PC 제목이 다시 사진 위로 올라간다(2026-10-31). 가드: groupon-detail-map.test.ts */
export default [
  {
    name: 'title-below-photo — 숙소 PC 제목이 갤러리 위로 돌아간다',
    file: 'src/pages/StayDetailPage.tsx',
    find: '      <div className={STAY_GRID}>\n',
    replace: '      <DetailTitleHeader name={stay.name} />\n      <div className={STAY_GRID}>\n',
    test: 'src/tests/unit/groupon-detail-map.test.ts',
    why: '대표 "이용권 이름을 사진 밑으로"(여기어때) — 숙소만 사진 위 제목으로 돌아가면 두 상세가 갈린다.',
  },
]
