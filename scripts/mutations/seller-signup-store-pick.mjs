/**
 * 🏪 주입 — 가입 앞문 "가게부터"(안 B, 2026-09-21 대표 확정).
 *
 * `src/tests/unit/seller-signup-store-pick-2026-09-21.test.ts` 가 **실패할 수 있는지** 확인한다.
 * 이 레포가 반복해 당한 사고는 "검사가 실패한다" 가 아니라 **"검사가 실패할 수 없다"** 였다.
 * 여기 주입은 전부 **실제로 일어났던 결함의 복원**이다 — ①은 어제까지의 라이브 코드다.
 */
const TEST = 'src/tests/unit/seller-signup-store-pick-2026-09-21.test.tsx'
const META = 'src/features/seller/api/seller-signup-meta.ts'
const ROUTE = 'src/features/seller/api/seller-registration.routes.ts'

export default [
  {
    name: '가게고르기 — 서버가 place 를 버린다(호출만 남기고 인자 제거)',
    file: ROUTE,
    find: `      kakao_place_id: body.kakao_place_id,`,
    replace: `      kakao_place_id: undefined,`,
    test: TEST,
    why: 'place_id 가 없으면 매장 등록 문의 중복 검사가 같은 가게를 못 알아본다.',
  },
  {
    name: '가게고르기 — 가게 대표번호로 담당자 휴대폰을 덮는다',
    file: META,
    find: `  if (address) {
    await db.prepare("UPDATE sellers SET address = ? WHERE id = ? AND COALESCE(address, '') = ''")`,
    replace: `  if (address) {
    await db.prepare("UPDATE sellers SET address = ?, phone = ? WHERE id = ? AND COALESCE(address, '') = ''")`,
    test: TEST,
    why: '주문·정산 알림톡이 가게 유선번호로 간다 — 사장님은 아무 알림도 못 받는다.',
  },
  {
    name: '가게고르기 — 주소를 덮어쓴다',
    file: META,
    find: `WHERE id = ? AND COALESCE(address, '') = ''"`,
    replace: `WHERE id = ?"`,
    test: TEST,
    why: '사장님이 고쳐 놓은 주소를 나중 호출이 되돌린다.',
  },
  {
    name: '가게고르기 — 좌표를 검사 없이 넣는다',
    file: META,
    find: `    const n = Number(String(v ?? '').trim())
    return Number.isFinite(n) && n !== 0 ? String(n) : undefined`,
    replace: `    const t = String(v ?? '').trim()
    return t || undefined`,
    test: TEST,
    why: '숫자가 아닌 값이 들어가면 지도가 엉뚱한 곳을 가리킨다.',
  },
  {
    name: '가게고르기 — 업종 매핑 순서를 뒤집는다(음식점이 카페를 먹는다)',
    file: 'src/shared/store-place.ts',
    find: `  [/카페|베이커리|제과|디저트|커피/, 'cafe'],`,
    replace: `  [/베이커리|제과/, 'cafe'],`,
    test: TEST,
    why: "카카오는 카페를 `음식점 > 카페 …` 로 단다 — 모든 카페가 '음식점' 이 된다.",
  },
]
