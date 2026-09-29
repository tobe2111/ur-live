/**
 * 🔠📐 소비자 전 화면 본문 스케일 다섯 단계 + 4px 격자 (2026-09-29)
 * 가드: src/tests/unit/consumer-type-scale-2026-09-29.test.ts
 *
 * 되돌리려는 사고는 **한 단계가 반쪽 값으로 새는 것**이다. 12 와 12.5 와 13 이 한 화면에 있으면
 * 어느 두 줄도 서로 동의하지 않는데, 빌드는 초록이고 화면도 안 깨져서 42단계까지 이렇게 자랐다.
 */
const TEST = 'src/tests/unit/consumer-type-scale-2026-09-29.test.ts'

export default [
  {
    name: '🔠 본문 크기가 다시 반쪽 값으로 샌다 (12 · 12.5 · 13 이 한 화면에)',
    file: 'src/pages/curator-page/CuratorHeader.tsx',
    find: "className=\"mt-1 text-[12px] text-gray-600 dark:text-gray-300 leading-snug line-clamp-2\"",
    replace: "className=\"mt-1 text-[12.5px] text-gray-600 dark:text-gray-300 leading-snug line-clamp-2\"",
    test: TEST,
    why: '0.5px 는 눈에 거의 안 보이는데 체계는 통째로 무너진다 — 그래서 아무도 신고하지 않고 42단계까지 자랐다.',
  },
  {
    name: '🔠 tailwind 기본 단계가 다시 섞인다 (체계가 둘이 된다)',
    file: 'src/pages/curator-page/EmptyUrShop.tsx',
    find: 'className="text-[15px] text-gray-500 dark:text-gray-400"',
    replace: 'className="text-sm text-gray-500 dark:text-gray-400"',
    test: TEST,
    why: '`text-sm`(14px)은 정본 13 과 15 사이다 — 셋이 한 화면에 서면 스케일이 무의미해진다.',
  },
  {
    name: '📐 반쪽 간격이 다시 들어온다 (4px 격자 이탈)',
    file: 'src/pages/curator-page/CuratorHeader.tsx',
    find: '<div className="flex items-center gap-2 min-w-0">',
    replace: '<div className="flex items-center gap-1.5 min-w-0">',
    test: TEST,
    why: '6px 와 8px 가 섞이면 줄 사이 리듬이 화면마다 달라진다 — 개별 결함이 아니라 "덜 만든 화면" 의 인상을 만든다.',
  },
  {
    name: '🔠 본문 크기 검사가 헛돈다 (경로가 낡아 대상 0)',
    file: TEST,
    find: "  .filter((f) => !/(admin|seller|agency|wholesale|supplier|marketing|debug|design-variants|Admin|Seller|Agency|Wholesale|Supplier)/.test(f))",
    replace: "  .filter(() => false)",
    test: TEST,
    why: '경로 목록이 낡아 파일이 0개가 되면 위 검사들이 영원히 통과한다 — 이 레포가 반복해 당한 "헛도는 가드".',
  },
  {
    name: '🖼️ 디스플레이 크기가 본문으로 새어 든다 (26px 경계 무력화)',
    file: TEST,
    find: 'const DISPLAY_FROM = 26',
    replace: 'const DISPLAY_FROM = 12',
    test: TEST,
    why: '경계를 내리면 본문 검사가 아무것도 안 본다 — 12px 이상이 전부 "디스플레이" 로 면제된다.',
  },
  {
    // 🕳️ 2026-09-29: 이 시험의 **첫 판이 실제로 눈멀어 있었다.** git pathspec 의 `**` 는
    //    디렉터리를 최소 하나 요구해서 `src/pages/*.tsx` 734개가 통째로 검사 밖이었고,
    //    "459개 검사함" 처럼 보여 아무도 몰랐다. 최상위 glob 이 빠지면 빨간불이 떠야 한다.
    name: '🕳️ 최상위 페이지가 다시 검사 밖으로 나간다 (git `**` 는 최상위를 안 잡는다)',
    file: 'src/tests/unit/consumer-type-scale-2026-09-29.test.ts',
    find: "  \"git ls-files 'src/pages/*.tsx' 'src/pages/**/*.tsx' 'src/components/*.tsx' 'src/components/**/*.tsx'\",",
    replace: "  \"git ls-files 'src/pages/**/*.tsx' 'src/components/**/*.tsx'\",",
    test: TEST,
    why: '최상위가 빠지면 검사 대상이 3,576 → 1,000대로 줄어 `seen` 하한이 잡는다. 하한이 없으면 조용히 "지키는 척" 이 된다.',
  },
  {
    // 🔒 잠금표 제외가 **아무 파일이나 빠져나가는 문**이 되면 안 된다.
    name: '🔒 잠금표 제외가 아무 파일이나 받아 준다 (검사 탈출구)',
    file: 'src/tests/unit/consumer-type-scale-2026-09-29.test.ts',
    find: 'const LOCKED = files.filter((f) => LOCK_ROWS.has(f) || f in MIRRORS)',
    replace: "const LOCKED = files.filter((f) => LOCK_ROWS.has(f) || f in MIRRORS || f.includes('curator-page'))",
    test: TEST,
    why: 'CLAUDE.md 잠금표에 없는 파일이 제외 목록에 들어가면 그 화면은 조용히 정본 밖으로 나간다.',
  },
  {
    // 🪞 2026-09-29: 이 세션이 실제로 그렇게 깨뜨렸다 — 코드모드가 `TopChromeReserve` 를 정본으로
    //    이행시켜 **잠긴 `VouchersPage` 와 거울이 깨졌고**, 그 파일이 막으려던 10px 밀림이 돌아왔다.
    //    거울을 제외 목록에서 빼면 다음 세션이 같은 길로 간다.
    name: '🪞 잠금 파일의 그림자를 정본으로 끌고 간다 (거울이 깨진다)',
    file: 'src/tests/unit/consumer-type-scale-2026-09-29.test.ts',
    find: "  'src/pages/vouchers/TopChromeReserve.tsx': 'src/pages/VouchersPage.tsx',",
    replace: '',
    test: TEST,
    why: '거울이 제외에서 빠지면 그 파일을 4px 격자로 옮기게 되고, 잠긴 원본은 못 따라와 예약 높이가 어긋난다.',
  },
  {
    // 🪞 거울이 **잠기지 않은 파일**을 가리키면 그것도 탈출구다.
    name: '🪞 거울이 잠금표 밖 파일을 가리킨다 (또 하나의 탈출구)',
    file: 'src/tests/unit/consumer-type-scale-2026-09-29.test.ts',
    find: "  'src/pages/vouchers/TopChromeReserve.tsx': 'src/pages/VouchersPage.tsx',",
    replace: "  'src/pages/vouchers/TopChromeReserve.tsx': 'src/pages/vouchers/shared.tsx',",
    test: TEST,
    why: '원본이 잠겨 있지 않다면 그 파일은 정본으로 이행하면 될 일이고, 거울이라고 부를 이유가 없다.',
  },
]
