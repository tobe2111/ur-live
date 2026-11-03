/** 🧬 주입 — 마이 부품도 글자·아이콘 체계 안(2026-11-03). 가드: src/tests/unit/my-surface-type-system-2026-11-03.test.ts */
const TEST = 'src/tests/unit/my-surface-type-system-2026-11-03.test.ts'
export default [
  {
    name: '🧱 마이 체계 — 굵기 가드가 다시 마이 부품을 뺀다',
    file: 'src/tests/unit/weight-scale-2026-10-25.test.ts',
    find: '  .filter((f) => MY_SURFACE.test(f) || !/',
    replace: '  .filter((f) => !/',
    test: TEST,
    why: '내 가게 판·에이전시 구역이 다시 굵기 체계 밖으로 — 대표가 짚은 "통일감 없음"이 조용히 돌아온다.',
  },
  {
    name: '🧱 마이 체계 — 에이전시 줄이 아이콘 없이 그려진다',
    file: 'src/pages/agency-console/AgencySection.tsx',
    find: '<FlatRow icon={<PeopleIcon className="h-[18px] w-[18px]" aria-hidden="true" />} label="직원"',
    replace: '<FlatRow icon={null} label="직원"',
    test: TEST,
    why: '한 목록에 아이콘 있는 줄과 없는 줄이 섞인다.',
  },
  {
    name: '🧱 마이 체계 — 에이전시 이름이 다시 흐린 구역 제목이 된다',
    file: 'src/pages/user-profile/AgencyMergedTitle.tsx',
    find: 'text-[16px] font-semibold tracking-[-0.01em] text-gray-900 dark:text-white truncate">{agencyName',
    replace: 'text-[16px] font-semibold tracking-[-0.01em] text-gray-500 dark:text-white/45 truncate">{agencyName',
    test: TEST,
    why: '대표가 "잘 안 보이게 하면 안 돼" 라고 짚은 그 회색.',
  },
]
