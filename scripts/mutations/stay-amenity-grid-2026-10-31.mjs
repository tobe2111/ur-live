/** 🧬 주입 — 숙소 부대시설 그리드(2026-10-31). 가드: src/tests/unit/stay-amenity-grid-2026-10-31.test.tsx */
const T = 'src/tests/unit/stay-amenity-grid-2026-10-31.test.tsx'
export default [
  {
    name: 'stay-amenity-grid — 없는 칸에 없음을 안 쓴다',
    file: 'src/pages/stay-detail/AmenityGrid.tsx',
    find: "{off && <span className=\"block mt-1 text-gray-400 dark:text-gray-500\">없음</span>}",
    replace: '',
    test: T,
    why: '대표 "없으면 없다고 표시되고" — 흐린 아이콘만으론 없다는 뜻이 안 읽힌다.',
  },
  {
    name: 'stay-amenity-grid — 정보가 없어도 전부 없음으로 칠한다',
    file: 'src/pages/stay-detail/AmenityGrid.tsx',
    find: 'const off = known && !c.has',
    replace: 'const off = !c.has',
    test: T,
    why: '시설을 아직 안 적은 숙소가 "주차 없음·조식 없음…" 으로 보인다 — 모르는 것과 없는 것은 다르다.',
  },
  {
    name: 'stay-amenity-grid — 객실 시설을 버린다',
    file: 'src/pages/StayDetailPage.tsx',
    find: ", ...parseAmenities((stay as { room_amenities?: string | null } | null)?.room_amenities)]",
    replace: ']',
    test: T,
    why: '셀러 폼은 취사·냉난방·금연을 객실 시설로 따로 저장한다 — 안 합치면 고른 시설이 없음으로 뜬다.',
  },
]
