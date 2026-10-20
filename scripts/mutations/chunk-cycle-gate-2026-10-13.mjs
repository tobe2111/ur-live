// 🚨 청크 순환 게이트 (2026-10-13 — 라이브 전 페이지 오류 화면)
const TEST = 'src/tests/unit/chunk-cycle-gate-2026-10-13.test.ts'
export default [
  {
    name: '🚨 청크 순환을 다시 경고로만 흘린다 (throw 제거)',
    file: 'vite.config.ts',
    find: "            throw new Error(`[chunk-cycle] 새 청크 순환",
    replace: "            console.warn(`[chunk-cycle] 새 청크 순환",
    test: TEST,
    why: 'Rollup 은 순환을 경고로만 찍고 빌드를 통과시킨다 — 그 경고가 라이브 전 페이지 TDZ 크래시였다.',
  },
  {
    name: '🚨 허용목록에 셀러 순환을 넣어 게이트를 끈다',
    file: 'vite.config.ts',
    find: "  'app-shared -> app-utils -> capacitor -> app-shared',\n",
    replace: "  'app-shared -> app-utils -> capacitor -> app-shared',\n  'app-seller-components -> app-components -> app-seller-components',\n",
    test: TEST,
    why: '허용목록을 늘리는 것은 게이트를 끄는 것과 같다.',
  },
  {
    name: '🚨 kakao-place-url 규칙이 빠진다 (셀러 봉투로 떨어진다)',
    file: 'vite.config.ts',
    find: "          if (id.includes('/src/shared/kakao-place-url')) return 'app-shared'\n",
    replace: '',
    test: TEST,
    why: '그날 순환의 직접 원인.',
  },
  {
    name: '🩸 kakao-place-url 규칙이 두 번 들어온다 (주입 앵커가 모호해져 가드가 멎는다)',
    file: 'vite.config.ts',
    find: "          if (id.includes('/src/shared/kakao-place-url')) return 'app-shared'\n",
    replace:
      "          if (id.includes('/src/shared/kakao-place-url')) return 'app-shared'\n" +
      "          if (id.includes('/src/shared/kakao-place-url')) return 'app-shared'\n",
    test: TEST,
    why: '2026-10-13 실제로 일어났다 — 두 세션이 같은 사고를 각자 고쳐 머지가 둘 다 받았고, 뒤쪽은 죽은 코드라 빌드·화면·①~③ 전부 초록인데 전수 주입이 main 에서 두 번 빨간불이 났다.',
  },
]
