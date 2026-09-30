/**
 * 🔎 검색 바인드 순서 (2026-09-30, 대표 "검색기능도 지금 완벽한지 확인해줘") — 주입 매니페스트.
 * 가드: src/tests/unit/search-bind-order-2026-09-30.test.ts
 *
 * 이 결함의 성질: **에러가 없다.** 개수가 맞아 예외가 안 나고 값도 전부 LIKE 패턴이라,
 * 되돌리면 CI 는 초록인데 검색만 조용히 틀린다 — 그래서 주입으로 고정한다.
 */
const TEST = 'src/tests/unit/search-bind-order-2026-09-30.test.ts'
const REPO = 'src/features/products/repositories/ProductRepository.ts'
const SSOT = 'src/features/products/repositories/search-query.ts'

export default [
  {
    name: '🔎 검색 바인드를 다시 where → rank 순으로 넘긴다 (라이브 결함 원상복구)',
    file: REPO,
    find: 'params.push(...rankParams, ...whereParams)',
    replace: 'params.push(...whereParams, ...rankParams)',
    test: TEST,
    why: '랭킹 식은 SELECT 에 있어 SQL 텍스트에서 먼저 나온다 — 반대로 넣으면 값이 통째로 어긋나 "홍대 홍대" 가 0건이 된다(에러 없음).',
  },
  {
    name: '🔎 랭킹 값을 아예 안 넘긴다 (where 만)',
    file: REPO,
    find: 'params.push(...rankParams, ...whereParams)',
    replace: 'params.push(...whereParams)',
    test: TEST,
    why: '개수가 모자라면 D1 이 예외를 던지고 폴백(findAll)으로 새어, 랭킹 없는 전체문자열 검색으로 조용히 강등된다.',
  },
  {
    name: '🔎 SSOT 가 두 묶음을 다시 한 배열로 합쳐 돌려준다',
    file: SSOT,
    find: 'return { where: whereParts.join(\' AND \'), rank, whereParams, rankParams }',
    replace: 'return { where: whereParts.join(\' AND \'), rank, whereParams: [...whereParams, ...rankParams], rankParams: [] }',
    test: TEST,
    why: '합쳐서 주면 어느 자리에 넣어야 하는지 아무도 모른다 — 그게 이 결함의 원인이었다.',
  },
  {
    name: '🔎 랭킹 식의 값 하나를 빠뜨린다 (`?` 5개 · 값 4개)',
    file: SSOT,
    find: 'const rankParams = [whole, `${esc}%`, `%${esc}%`, `%${esc}%`, `%${esc}%`]',
    replace: 'const rankParams = [whole, `${esc}%`, `%${esc}%`, `%${esc}%`]',
    test: TEST,
    why: '식과 값의 개수가 갈리면 그 뒤 모든 바인드가 한 칸씩 밀린다 — 같은 클래스의 재발.',
  },
  {
    name: '🔎 매칭 조건에서 앞뒤 `%` 를 떼어 접두사 매칭으로 되돌린다',
    file: SSOT,
    find: 'const like = `%${escapeLike(v)}%`',
    replace: 'const like = `${escapeLike(v)}%`',
    test: TEST,
    why: '"치즈돈가스" 를 `돈가스` 로 못 찾던 2026-09-03 이전 동작 — 이 파일이 실제로 실행해 잡는다.',
  },
]
