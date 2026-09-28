/**
 * 🚪 판매 문 정리 (2026-09-28, 대표 "끝까지 해줘") — 주입 매니페스트.
 * 가드: src/tests/unit/my-sell-doors-2026-09-28.test.ts
 *
 * 되돌리려는 사고: **같은 곳으로 가는 문이 다시 늘어나는 것.** 문이 둘이 되면 한쪽만 고쳐지고
 * (실측: 타일은 `<Link>` · 전환 버튼은 `active_role` 을 심고 하드 내비게이션 — 같은 곳에 가면서
 * 하는 일이 달랐다) 에러가 안 나서 아무도 모른다.
 */
const TEST = 'src/tests/unit/my-sell-doors-2026-09-28.test.ts'

export default [
  {
    name: '🚪 `/my-store` 버튼이 마이 최하단에 되살아난다 (로그아웃 바로 위)',
    file: 'src/pages/UserProfilePage.tsx',
    find: "      {/* 🚪 2026-09-28 (대표 확정) — **'내 매장' 버튼을 없앴다.**",
    replace: "      {!!localStorage.getItem('seller_token') && (\n        <button type=\"button\" onClick={() => navigate('/my-store')}>내 매장</button>\n      )}\n      {/* 🚪 2026-09-28 (대표 확정) — **'내 매장' 버튼을 없앴다.**",
    test: TEST,
    why: '맨 위 `내 가게` 섹션과 같은 일을 하는 297줄짜리 별도 페이지로 가는 문이다 — 도구가 하나 늘면 두 곳을 고쳐야 한다.',
  },
  {
    name: '🚪 `RoleCtaGrid` 에 `/seller` 타일이 되살아난다 (최하단 전환 버튼과 목적지 중복)',
    file: 'src/pages/user-profile/RoleCtaGrid.tsx',
    find: "      // 🚪 2026-09-28 (대표 확정 — 판매로 가는 문이 넷이고 셋이 복제였다): '셀러 대시보드' 타일 제거.",
    replace: "      { Icon: Store, title: '셀러 대시보드', desc: '', to: '/seller', show: () => hasSellerToken, accent: true },\n      // 🚪 2026-09-28 (대표 확정 — 판매로 가는 문이 넷이고 셋이 복제였다): '셀러 대시보드' 타일 제거.",
    test: TEST,
    why: '최하단 전환 버튼과 **목적지가 같다** — 같은 일을 하는 문이 둘이면 한쪽만 고쳐지는 날이 온다.',
  },
  {
    name: '🚪 `/my-store` 가 다시 별도 페이지를 렌더한다 (마이와 타일 여섯이 중복)',
    file: 'src/App.tsx',
    find: '<Route path="/my-store" element={<Navigate to="/user/profile" replace />} />',
    replace: '<Route path="/my-store" element={<MyStorePage />} />',
    test: 'src/tests/unit/seller-all-in-my-2026-09-26.test.ts',
    why: '그 페이지가 있던 이유는 마이 `내 가게` 섹션이 대신한다 — 되살리면 도구가 늘 때 두 곳을 고쳐야 하고 반드시 한쪽을 잊는다.',
  },
  {
    name: '🚪 넓은 화면으로 가는 **유일한** 문(최하단 전환)이 사라진다',
    file: 'src/pages/UserProfilePage.tsx',
    find: "              localStorage.setItem('active_role', 'seller')",
    replace: "              // 지워졌다",
    test: TEST,
    why: '②③ 를 없앤 지금 이 문이 하나뿐이다 — 사라지면 대시보드가 닿을 수 없는 화면이 된다(조용한 부재).',
  },
]
