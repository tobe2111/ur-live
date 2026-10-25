// 🏠 생활 이용권 업종(2차 카테고리) (2026-10-25) — `life-deal-subcat-2026-10-25.test.ts` 가 잡아야 하는 결함.
const TEST = 'src/tests/unit/life-deal-subcat-2026-10-25.test.ts'
export default [
  {
    name: '🏠 업종 저장이 생활이 아닌 이용권에도 남는다',
    file: 'src/features/home-service/api/life-deal-subcat-store.ts',
    find: "=== 'home_voucher' ? normalizeLifeSubcat(raw) : null",
    replace: "!== '' ? normalizeLifeSubcat(raw) : null",
    test: TEST,
    why: '식사로 바꾼 이용권에 옛 업종이 남아 엉뚱한 칩에 뜰 근거가 된다.',
  },
  {
    name: '🏠 값이 안 온 수정이 업종을 지운다',
    file: 'src/features/home-service/api/life-deal-subcat-store.ts',
    find: '  if (raw === undefined || !Number.isFinite(productId) || productId <= 0) return\n',
    replace: '  if (!Number.isFinite(productId) || productId <= 0) return\n',
    test: TEST,
    why: '업종 칸이 없는 옛 화면·복사 경로로 수정하면 사장님이 고른 업종이 조용히 사라진다.',
  },
  {
    name: '🏠 이름 추정이 저장값을 이긴다',
    file: 'src/shared/life-deal-subcat.ts',
    find: 'return normalizeLifeSubcat(stored) ?? guessLifeSubcat(name)',
    replace: 'return guessLifeSubcat(name) ?? normalizeLifeSubcat(stored)',
    test: TEST,
    why: '사장님이 고친 업종이 이름 추정에 덮여 다시 엉뚱한 칩으로 간다.',
  },
  {
    name: '🏠 생활인데 업종 없이 등록된다',
    file: 'src/pages/seller-meal-voucher/voucher-form.ts',
    find: "return f.category === 'home_voucher' && !normalizeLifeSubcat(f.life_subcat)",
    replace: 'return false',
    test: TEST,
    why: '업종 없는 생활 이용권이 쌓여 칩을 누르면 안 보인다(전체에만 뜬다).',
  },
  {
    name: '🏠 칩이 거르기는 하는데 다시 거르지 않는다',
    file: 'src/pages/main-home/GroupBuyFeed.tsx',
    find: 'feedFiltersKey(filters), life.key])',
    replace: 'feedFiltersKey(filters)])',
    test: TEST,
    why: '칩을 눌러도 목록이 그대로다 — 에러 0, 화면만 안 바뀐다.',
  },
  {
    name: '🏠 생활 아닌 탭도 업종으로 거른다',
    file: 'src/pages/main-home/life-subcat.tsx',
    find: '    if (!active) return true\n',
    replace: '    if (!on) return true\n',
    test: TEST,
    why: '생활 탭을 떠나도 거르기가 남으면 다른 탭이 이유 없이 빈다.',
  },
]
