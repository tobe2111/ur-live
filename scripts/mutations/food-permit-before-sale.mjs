/**
 * 🍽️ 주입 — 영업신고증을 판매 전에 본다 + **막지 않는다** (2026-09-21 대표 확정 2건).
 *
 * `src/tests/unit/food-permit-before-sale-2026-09-21.test.ts` 가 실패할 수 있는지 확인한다.
 * ⑨⑩ 은 **대표가 기각한 설계로 되돌리는 것**을 잡는다 — 다음 세션이 "갭이네" 하고 다시
 * 막아 버리는 것을 막는 자리다.
 */
const TEST = 'src/tests/unit/food-permit-before-sale-2026-09-21.test.ts'
const PAGE = 'src/pages/AdminSellerApprovalPage.tsx'
const BLOCK = 'src/pages/admin-seller-approval/FoodPermitBlock.tsx'

export default [
  {
    name: '🍽️ 승인 목록이 영업신고증을 안 얹는다 (승인하는 사람이 볼 방법이 없다)',
    file: 'src/features/admin/api/admin-sellers/enrich-rows.ts',
    find: "  await import('../seller-permit-flag').then((m) => m.attachFoodPermitFlag(DB, rows))",
    replace: '',
    test: TEST,
    why: '2026-09-21 이전 상태 — 영업신고증 칸이 화면에 아예 없었다(라이브 보유 0건인데 아무도 몰랐다).',
  },
  {
    name: '🍽️ 업종 힌트가 사라진다 (미용실과 음식점을 똑같이 다룬다)',
    file: 'src/features/admin/api/seller-permit-flag.ts',
    find: "      ;(r as Record<string, unknown>).needs_food_permit = needsFoodPermit(m?.store_category, m?.kakao_category)",
    replace: '      ;(r as Record<string, unknown>).needs_food_permit = false',
    test: TEST,
    why: '음식 업종인지 모르면 승인하는 사람이 무엇을 확인해야 하는지 알 수 없다.',
  },
  {
    name: '🍽️ 업종 판정이 모든 매장을 음식점으로 본다 (미용실 카드에 안내가 뜬다)',
    file: 'src/shared/food-permit.ts',
    find: '  if (ours && FOOD_STORE_CATEGORIES.has(ours)) return true',
    replace: '  if (ours) return true',
    test: TEST,
    why: '안 띄워야 할 곳에 띄우면 그 안내를 아무도 안 읽게 된다.',
  },
  {
    name: '🍽️ 업종을 모를 때도 음식점이라고 단정한다',
    file: 'src/shared/food-permit.ts',
    find: '  return false\n}',
    replace: '  return true\n}',
    test: TEST,
    why: '모르면 조용해야 한다 — 가입 문 밖으로 들어온 옛 매장은 카테고리가 없다.',
  },
  {
    name: '🔴 승인 버튼이 서류로 막힌다 (대표가 기각한 설계로 회귀)',
    file: PAGE,
    find: '                      <button onClick={() => approve(s.id)} disabled={actingId === s.id}',
    replace: '                      <button onClick={() => approve(s.id)} disabled={actingId === s.id || !s.business_registration_image_url}',
    test: TEST,
    why: '대표 "등록증이 없어도 승인 되게끔 해줘. 어차피 내가 보고 승인해야하잖아." — 이걸 되돌리면 대표가 승인을 못 한다.',
  },
  {
    name: '🔴 안 낸 서류 칸이 "승인 불가" 라고 거짓말한다',
    file: BLOCK,
    find: '          아직 안 냈어요. 사장님은 대시보드 › 사업자 정보 › 서류 에서 올릴 수 있어요.',
    replace: '          필수 서류입니다. 제출해야 승인 불가 상태가 풀립니다.',
    test: TEST,
    why: '실제로는 안 막으면서 막는다고 쓰면, 그 화면의 다른 말도 아무도 안 믿게 된다.',
  },
  {
    name: '🍽️ 안 낸 비음식 매장에도 빈 상자를 그린다',
    file: BLOCK,
    find: '  if (!url && !needed) return null',
    replace: '  if (false) return null',
    test: TEST,
    why: '미용실·숙박 카드마다 빈 영업신고증 상자가 늘어 승인 화면이 길어진다.',
  },
]
