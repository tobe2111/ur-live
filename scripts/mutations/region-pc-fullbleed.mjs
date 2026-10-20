/**
 * 🧬 지역 페이지 PC 풀너비 — 되돌려-검증 주입 (2026-09-21).
 *
 * 지키는 계약은 `src/tests/unit/region-pc-fullbleed-2026-09-21.test.ts` 머리말에 있다.
 *
 * ⚠️ 2026-09-21(같은 날 오후) 앵커 3개 재조준 — 같은 파일에 PC 액자 해제 3묶음이 추가되면서
 *   원래 앵커(`'/region',\n])` 등)가 전부 사라졌다. 러너의 '복원 실패 의심'이 그걸 잡았다.
 *   **낡은 앵커는 조용히 아무것도 주입하지 않는다** — 가드가 지키는 척만 하게 된다.
 * 여기서 확인하는 것은 **그 테스트가 실제로 실패할 수 있는가** 다.
 */
const T = 'src/tests/unit/region-pc-fullbleed-2026-09-21.test.ts'

export default [
  {
    name: '🗺️ /region 인덱스가 다시 430px 액자에 갇힌다',
    file: 'src/shared/pc-fullbleed.ts',
    find: `  '/region',\n`,
    replace: ``,
    test: T,
    why:
      '에러가 안 난다 — 화면은 "모바일 최적화" 처럼 보이고, 푸터에서 넘어온 사용자만 폭이 ' +
      '1440 → 430 으로 접히는 것을 본다. 그게 대표가 신고한 바로 그 증상이다.',
  },
  {
    name: '🗺️ 시/도·시군구 상세가 다시 액자에 갇힌다 (접두사 소실)',
    file: 'src/shared/pc-fullbleed.ts',
    find: `'/stays/', '/region/',`,
    replace: `'/stays/',`,
    test: T,
    why:
      '인덱스만 풀리고 정작 클릭해서 가는 `/region/부산` 은 액자에 남는다 — 목록 한 줄 차이라 ' +
      '리뷰에서 가장 놓치기 쉬운 형태다.',
  },
  {
    name: '🗺️ 접두사를 줄여 가입·추천 페이지까지 액자를 벗긴다',
    file: 'src/shared/pc-fullbleed.ts',
    find: `'/region/',`,
    replace: `'/re',`,
    test: T,
    why:
      '`/register`·`/refund` 처럼 글자만 겹치는 경로가 함께 풀린다. `/register` 는 폰 폭으로 만든 ' +
      '가입 화면이라 액자에 남아야 한다(접두사를 줄이는 실수가 실제로 가장 흔하다).',
  },
  {
    name: '🗺️ 지역 딜 그리드가 PC 모드를 잃는다',
    file: 'src/pages/region/RegionPage.tsx',
    find: `        <GroupBuyFeed\n          pc\n`,
    replace: `        <GroupBuyFeed\n`,
    test: T,
    why:
      '액자를 벗긴 직후라 더 위험하다 — 1440px 에 모바일 한 줄 카드가 늘어져서, 고친 것이 ' +
      '오히려 이상해 보인다(에러는 여전히 0).',
  },
  {
    name: '🗺️ 지역 본문이 다시 좁은 컨테이너로 조여진다',
    file: 'src/pages/region/RegionPage.tsx',
    find: `max-w-[1600px] mx-auto px-4 lg:px-10`,
    replace: `max-w-xl mx-auto px-4`,
    test: T,
    why: '풀너비로 풀어 놓고 본문만 폰 폭으로 남기면 "넓어진 모바일" 이 된다(액자와 결과가 같다).',
  },
]
