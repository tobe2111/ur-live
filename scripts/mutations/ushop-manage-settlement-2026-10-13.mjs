/**
 * 🧬 주입 — 유어샵 관리 흐름 · 매장 소개 정산 화면 (2026-10-13 대표 "전체적으로 이상적이질 못해")
 */
const T = 'src/tests/unit/ushop-manage-settlement-2026-10-13.test.ts'
export default [
  {
    name: '🧭 관리 — 프로필 줄이 다시 마이로 화면을 넘긴다',
    file: 'src/pages/UShopManagePage.tsx',
    find: "hint={t('ushop.manageEdit', { defaultValue: '편집' })} onClick={() => setEditOpen(true)} />",
    replace: "hint={t('ushop.manageEdit', { defaultValue: '편집' })} to=\"/user/profile\" />",
    test: T,
    why: '누르면 마이 화면 전체로 넘어가고 시트는 안 열린다 — 두 번 눌러야 편집이 나온다.',
  },
  {
    name: '🧭 관리 — 수익 화면 링크를 줄로 또 둔다',
    file: 'src/pages/UShopManagePage.tsx',
    find: "        <ListPlate className=\"mt-3\">\n          <ListRow icon={rowIco(ReceiptIcon)}",
    replace: "        <ListPlate className=\"mt-3\">\n          <ListRow icon={rowIco(ReceiptIcon)} label=\"대시보드\" to=\"/u/me/earnings\" />\n          <ListRow icon={rowIco(ReceiptIcon)}",
    test: T,
    why: '같은 화면이 두 이름으로 두 번 링크된다(종전 "콘솔"·"대시보드").',
  },
  {
    name: '🧾 정산 — 문의를 prompt() 로 되돌린다',
    file: 'src/pages/InfluencerSettlementPage.tsx',
    find: "onClick={() => setSheet('dispute')}",
    replace: "onClick={() => { prompt('분쟁 유형 (unfair_block / commission_dispute / other)') }}",
    test: T,
    why: '사람에게 영문 코드를 치라고 한다.',
  },
  {
    name: '🧾 정산 — 제목을 옛 이름으로',
    file: 'src/pages/InfluencerSettlementPage.tsx',
    find: '<h1 className="text-[15px] font-medium text-gray-900 dark:text-white">매장 소개 정산</h1>',
    replace: '<h1 className="text-[15px] font-medium text-gray-900 dark:text-white">인플루언서 정산</h1>',
    test: T,
    why: '쓰지 않기로 한 이름이 화면 제목에 박힌다.',
  },
  {
    name: '🧾 정산 — 대비 가드가 시트를 안 연다',
    file: 'src/pages/InfluencerSettlementPage.tsx',
    find: ' testId="settle-info-open" />',
    replace: ' />',
    test: T,
    why: '입력이 시트 뒤로 숨어 다크 대비 가드가 닫힌 화면만 재고 초록을 낸다.',
  },
]
