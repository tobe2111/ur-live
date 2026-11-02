/**
 * 🧬 주입 — 파트너 풀 깨진 상호 + 재분류 벌크 전진 구멍 (2026-11-02)
 *    가드: src/tests/unit/company-broken-name-2026-11-02.test.ts
 *    대표: "B2B 파트너 필터링 잘 되고 있어?" → 깨진 상호 222행 · 법무사가 세무사로.
 */
const T = 'src/tests/unit/company-broken-name-2026-11-02.test.ts'
export default [
  {
    name: '깨진상호 — 사이트 이름 후보의 깨진 글자 거름을 뺀다',
    file: 'src/features/marketing/api/contact-enrich.ts',
    find: '!hasBrokenText(cand) && ',
    replace: '',
    test: T,
    why: '디코더가 없는 런타임에서 EUC-KR 제목이 `�` 상호로 저장된다.',
  },
  {
    name: '깨진상호 — 기존 행 수리를 끊는다',
    file: 'src/features/marketing/api/enrich-name-heal.ts',
    find: '  await repairBrokenNames(',
    replace: '  void (',
    test: T,
    why: '이미 저장된 222행은 name_verified=1 이라 다른 경로가 다시 집지 않는다.',
  },
  {
    name: '벌크전진 — 규칙이 바꿀 행 제외를 뺀다',
    file: 'src/features/marketing/api/reclassify-registry-fastpath.ts',
    find: '  + refinableExclusionSql()\n',
    replace: '\n',
    test: T,
    why: '표본(대부분 통신판매)이 소수 규칙을 대표하지 못해 법무사·세무·기장 행이 분류기를 안 거치고 도장만 받는다.',
  },
]
