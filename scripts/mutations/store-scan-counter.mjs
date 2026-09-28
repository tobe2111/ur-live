/**
 * 🧾 매장 계산대(`/store/scan`) 되돌려-검증 주입 (2026-09-28).
 * 가드: src/tests/unit/store-scan-counter-2026-09-28.test.ts
 * 규약: `export default [ … ]` 하나. 이름은 전체에서 유일.
 */
const TEST = 'src/tests/unit/store-scan-counter-2026-09-28.test.ts'
const PAGE = 'src/pages/StoreScanPage.tsx'

export default [
  {
    name: '🧾계산대 PC 에서 다시 소비자 액자에 넣는다',
    file: 'src/shared/pc-fullbleed.ts',
    find: "  '/store/scan',\n])",
    replace: '])',
    test: TEST,
    why: '카운터 화면 좌우가 소비자 앱 광고가 된다 — 사장님 PC 에 "모바일로 보기" QR 이 뜬다.',
  },
  {
    name: '🧾계산대 `/store/` 를 통째로 접두사로 벗긴다',
    file: 'src/shared/pc-fullbleed.ts',
    find: "const FULLBLEED_PC_PREFIXES = ['/vouchers/', '/pass/', '/stays/', '/region/',",
    replace: "const FULLBLEED_PC_PREFIXES = ['/store/', '/vouchers/', '/pass/', '/stays/', '/region/',",
    test: TEST,
    why: '앞으로 생길 `/store/*` 가 검토 없이 따라 벗겨진다(이 파일이 `/referral/` 에서 두 번 겪은 함정).',
  },
  {
    name: '🧾계산대 주소의 마이 표시를 안 읽는다',
    file: PAGE,
    find: '  if (typeof window !== \'undefined\') noteMyReturn(window.location.search)',
    replace: '  /* 표시를 안 읽는다 */',
    test: TEST,
    why: '`?from=my` 가 실려 와도 아무도 안 읽으면 사장님은 계산대에서 마이로 나갈 길이 없다.',
  },
  {
    name: '🧾계산대 마이에서 와도 브라우저 뒤로만 한다',
    file: PAGE,
    find: '            if (backToMy) { clearMyReturn(); window.location.assign(MY_PATH); return }',
    replace: '            /* 늘 브라우저 뒤로 */',
    test: TEST,
    why: '계산대 안에서 한 번만 움직여도 히스토리가 쌓여 뒤로가 마이로 안 간다.',
  },
  {
    name: '🧾계산대 마이 주소를 손으로 적는다',
    file: PAGE,
    find: '    if (!allowed) navigate(MY_PATH, { replace: true })',
    replace: "    if (!allowed) navigate('/user/profile', { replace: true })",
    test: TEST,
    why: '같은 목적지를 두 벌로 적으면 마이 주소가 바뀌는 날 한쪽만 따라간다.',
  },
]
