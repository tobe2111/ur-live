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
    // ⚠️ 재조준(2026-09-30): 이름이 두 줄까지 늘 수 있게 되며 `items-center` → `items-start` 로
    //   바뀌었다(렌더 실측 — 주인 화면에서 "지원의 동네가게" 가 잘렸다). 지키는 것은 정렬이 아니라
    //   **4px 격자**(gap-2) 이므로 앵커만 현재 줄로 옮긴다.
    find: '<div className="flex items-start gap-2 min-w-0">',
    replace: '<div className="flex items-start gap-1.5 min-w-0">',
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



  // ── 🖼️ 디스플레이 스케일 (2026-09-30 대표 결정으로 이행) ──
  {
    name: '🖼️ 디스플레이 크기가 다시 스케일 밖으로 샌다 (28 옆에 30)',
    file: 'src/pages/CreatorsPage.tsx',
    find: '<h1 className="text-[28px] sm:text-[40px] lg:text-[48px] xl:text-[60px] leading-[1.22] font-extrabold tracking-[-0.035em]">',
    replace: '<h1 className="text-[30px] sm:text-[40px] lg:text-[48px] xl:text-[60px] leading-[1.22] font-extrabold tracking-[-0.035em]">',
    test: TEST,
    why: '28 과 30 은 눈에 거의 안 보이는 차이인데 체계는 무너진다 — 이행 전 25단계가 정확히 그렇게 자랐다.',
  },
  {
    name: '🖼️ tailwind 디스플레이 단계가 다시 섞인다 (디스플레이도 체계가 둘)',
    file: 'src/pages/CreatorsPage.tsx',
    find: 'text-[17px] lg:text-[34px] font-extrabold text-ink leading-[1.35] tracking-[-0.025em]',
    replace: 'text-[17px] lg:text-4xl font-extrabold text-ink leading-[1.35] tracking-[-0.025em]',
    test: TEST,
    why: '본문은 `text-[Npx]` 인데 디스플레이만 tailwind 단계를 쓰면 같은 화면에 두 체계가 선다.',
  },
  {
    // 🕳️ 96 초과 예외가 **진짜 글자의 탈출구**가 되는 자리.
    // 🦦 2026-10-07: 앵커를 404 글리프 → 소개 페이지 워터마크로 옮겼다. 404 의 거대한 '404' 글자는
    //   유달이(길 잃은 얼굴)로 바뀌어 사라졌고, 남은 96px 초과 그래픽은 이 워터마크다(불변식은 그대로).
    name: '🖼️ 그래픽 예외로 진짜 글자가 샌다 (select-none 없는 100px)',
    file: 'src/pages/IntroducePage.tsx',
    find: 'text-[100px] font-black opacity-[0.04] text-white select-none',
    replace: 'text-[100px] font-black opacity-[0.04] text-white',
    test: TEST,
    why: '`select-none` 을 떼면 그것은 읽는 글자다 — 그러면 스케일 밖 크기를 "그래픽이라" 며 통과시킬 수 없어야 한다.',
  },
  {
    // 🩸 코드모드가 실제로 만든 결함 클래스 — 브레이크포인트가 아무 일도 안 한다.
    name: '🖼️ 반응형 사다리가 다시 붕괴한다 (sm 과 lg 가 같은 값)',
    file: 'src/pages/partners/PartnerHero.tsx',
    find: '<h1 className="text-[34px] sm:text-[48px] lg:text-[60px] leading-[1.14] font-extrabold tracking-[-0.035em]">',
    replace: '<h1 className="text-[34px] sm:text-[60px] lg:text-[60px] leading-[1.14] font-extrabold tracking-[-0.035em]">',
    test: TEST,
    why: 'sm 과 lg 가 같으면 그 브레이크포인트는 존재하지 않는 것과 같은데 빌드도 화면도 안 깨진다 — 조용한 결함.',
  },
  {
    // 🛡️ 가드가 **자기 기준을 헐겁게** 만드는 길을 막는다(래칫 상향·허용목록 확장과 같은 클래스).
    name: '🛡️ 가드가 스스로 디스플레이 스케일을 넓힌다 (문서와 갈린다)',
    file: TEST,
    find: 'const DISPLAY = new Set([28, 34, 40, 48, 60, 76, 96])',
    replace: 'const DISPLAY = new Set([28, 30, 34, 40, 48, 60, 76, 96])',
    test: TEST,
    why: '정본은 CLAUDE.md 규칙 ⑧ 에 있다 — 코드가 거기서 벗어나면 문서를 믿는 다음 세션이 오판한다.',
  },
  /**
   * 🗑️ 2026-09-30 — 잠금표 제외·거울 주입 3건을 **지웠다**(재조준이 아니다).
   * 대표 승인으로 잠금표 12파일을 정본으로 옮기면서 `LOCKED`·`MIRRORS`·`LOCKED_BASELINE` 자체가
   * 가드에서 사라졌다 — **지키던 대상이 없어진 주입**은 남겨 둬도 아무것도 검증하지 않는다.
   * 제외 목록이 없어졌다고 탈출구가 없는 건 아니다: 범위 필터(`.filter(admin|seller|…)`)가 그
   * 자리를 대신하고, 그건 위 '경로가 낡아 대상 0' 주입이 이미 지킨다.
   */
]
