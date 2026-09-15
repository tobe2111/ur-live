/**
 * 🔥 탭 재진입 웜 시드 (2026-09-15) — 주입 매니페스트.
 * 가드: src/tests/unit/vouchers-warm-seed-2026-09-15.test.ts
 *
 * 이 결함은 에러를 안 낸다 — 화면이 잠깐 덮일 뿐이라 로그에도 안 남는다.
 */
const TEST = 'src/tests/unit/vouchers-warm-seed-2026-09-15.test.ts'
const SEED = 'src/pages/vouchers/warm-seed.ts'
const PAGE = 'src/pages/VouchersPage.tsx'

export default [
  {
    name: '[웜시드] 시드를 아예 안 준다 (탭 누를 때마다 화면이 덮인다)',
    file: SEED,
    find: '  return cached.products.slice(0, pageSize)',
    replace: '  return null',
    test: TEST,
    why: '대표가 지적한 그 증상으로 되돌아간다 — 1·2·3회차 전부 풀스크린 로더.',
  },
  {
    name: '[웜시드] 자르지 않고 통째로 준다 (곧 올 1페이지 응답이 목록을 도로 짧게 만든다)',
    file: SEED,
    find: 'return cached.products.slice(0, pageSize)',
    replace: 'return cached.products.slice(0)',
    test: TEST,
    why: '2026-09-13 이 POP 에서 겪은 "목록이 도로 짧아짐" 을 PUSH 에서 재현한다.',
  },
  {
    name: '[웜시드] POP 복원본이 있어도 덮어쓴다 (스크롤 복원이 깨진다)',
    file: SEED,
    find: '  if (restored != null) return null',
    replace: '  if (false) return null',
    test: TEST,
    why: '복원본은 페이지·펼친 개수·높이까지 되살린다 — 1페이지분으로 덮으면 문서가 짧아져 스크롤이 잘린다.',
  },
  {
    name: '[웜시드] 빈 목록도 시드한다 ("없음"을 로더보다 먼저 그린다)',
    file: SEED,
    find: '  if (!cached || !Array.isArray(cached.products) || cached.products.length === 0) return null',
    replace: '  if (!cached || !Array.isArray(cached.products)) return null',
    test: TEST,
    why: '이 세션이 PR #1451·#1453 에서 고친 그 거짓말 클래스로 되돌아간다.',
  },
  {
    name: '[웜시드] 페이지가 시드를 안 읽는다 (모듈은 멀쩡한데 화면은 그대로)',
    file: PAGE,
    find: '?? warm ??',
    replace: '?? null ??',
    test: TEST,
    why: '배선이 끊기면 모듈 시험만 초록이고 화면은 안 바뀐다 — 이 레포가 반복해 당한 자리.',
  },
]
