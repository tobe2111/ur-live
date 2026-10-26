/**
 * 🧬 주입 — 생활 참여권: 마이 잔액 줄 · 내역 · 공유 페이지 바로 로그인 (2026-10-26 대표)
 *    가드: src/tests/unit/life-credits-my-2026-10-26.test.ts
 */
const T = 'src/tests/unit/life-credits-my-2026-10-26.test.ts'
export default [
  {
    name: '생활참여권 — 생활 업체가 아니어도 0장으로 줄이 뜬다',
    file: 'src/features/seller/api/seller-operators.routes.ts',
    find: 'life_credits: lMap.has(s.seller_id) ? lMap.get(s.seller_id)! : null,',
    replace: 'life_credits: lMap.get(s.seller_id) ?? 0,',
    test: T,
    why: '생활 견적을 안 하는 모든 매장 마이에 "참여권 0장" 줄이 생긴다.',
  },
  {
    name: '생활참여권 — 내역을 안 그린다',
    file: 'src/pages/life/pro/ProCredits.tsx',
    find: '      <CreditHistory rows={me.history ?? []} />\n',
    replace: '',
    test: T,
    why: '사장님이 참여권이 왜 줄었는지 볼 곳이 없다.',
  },
  {
    name: '생활참여권 — 공유 페이지가 모집 랜딩을 다시 거친다',
    file: 'src/pages/life/LifeSharePage.tsx',
    find: "        navigate(`/login?returnUrl=${encodeURIComponent('/life/pro')}`); return\n",
    replace: "        navigate(`/life/pro?${q}`); return\n",
    test: T,
    why: '공유로 온 업체가 버튼을 한 번 더 눌러야 카카오 로그인으로 간다.',
  },
]
