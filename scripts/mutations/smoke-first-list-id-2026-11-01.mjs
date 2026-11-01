/**
 * 🧬 주입 — 배포 후 상품 상세 스모크가 **조용히 skip 되던 것** (2026-11-01, 모든 배포에서 실측)
 *    가드: src/tests/unit/smoke-first-list-id-2026-11-01.test.ts
 *
 *    ⚠️ 양방향이다 — 파서를 되돌리면 검사가 다시 안 돌고, 실패 분기를 지우면 "못 찾았다" 가
 *       또 조용한 skip 이 된다.
 */
const T = 'src/tests/unit/smoke-first-list-id-2026-11-01.test.ts'
const F = 'scripts/first-list-id.mjs'
const W = '.github/workflows/main.yml'
export default [
  {
    name: '스모크id — 라이브 모양(data 가 리스트) 분기를 제거한다',
    file: F,
    find: '  if (Array.isArray(data)) items = data ',
    replace: '  if (false) items = data ',
    test: T,
    why:
      '라이브 `/api/products` 는 `{success, data:[…]}` 라 이 분기가 유일하게 맞는 길이다. ' +
      '빼면 `data.products`(undefined) → 최상위 `products`(undefined) 로 떨어져 "못 찾았다" 가 되고, ' +
      '상품 상세 스모크가 **다시 모든 배포에서 건너뛰어진다** — 2026-06-10 상세 500 사고를 잡으려고 ' +
      '만든 검사가 발화할 수 없게 된다.',
  },
  {
    name: '스모크id — "비었다" 와 "못 찾았다" 를 같은 값으로 뭉갠다',
    file: F,
    find: "    return { fail: `목록을 못 찾았다(최상위 키: ${Object.keys(doc).join(',') || '없음'})` }",
    replace: '    return { empty: true }',
    test: T,
    why:
      '종전 일행은 둘 다 빈 문자열을 내보내 호출부가 구분할 수 없었고, 그래서 **파서 고장이 ' +
      '"상품이 없다" 로 위장**됐다. 뭉개면 워크플로가 실패 대신 조용한 skip 으로 돌아간다.',
  },
  {
    name: '스모크id — 숫자가 아닌 id 도 통과시킨다',
    file: F,
    find: '  if (typeof id === \'number\' && Number.isFinite(id)) return { id }',
    replace: '  if (id !== undefined) return { id }',
    test: T,
    why:
      '`id` 가 `undefined`·객체면 호출부가 `/api/products/undefined` 를 찌르고 그건 **404 로 ' +
      '"정상" 처리**된다(스모크는 5xx 만 실패로 본다) — 검사가 돌고 있는데 아무것도 안 재는 상태.',
  },
  {
    name: '스모크id — 워크플로의 실패 집계를 경고로 낮춘다',
    file: W,
    find: '              FAIL=$((FAIL + 1)); FAIL_DETAILS="$FAIL_DETAILS\\n  - products 목록에서 id 추출: $P_OUT"',
    replace: '              echo "(경고만)"',
    test: T,
    why:
      '"못 찾았다" 를 경고로 두면 2026-11-01 이전과 같아진다 — 가드는 매 배포 돌지만 결과를 ' +
      '아무도 못 보고, 침묵과 통과가 구분되지 않는다.',
  },
]
