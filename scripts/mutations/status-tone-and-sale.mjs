/**
 * 🚦 상태·할인 색이 중화에 먹히지 않는다 (2026-09-29)
 * 가드: src/tests/unit/status-tone-and-sale-2026-09-29.test.ts + scripts/check-status-tone.mjs
 *
 * 되돌리려는 사고는 **색 이름은 남고 색은 없어지는 것**이다. `text-emerald-600` 이라고 적으면
 * 코드를 읽는 사람은 초록을 상상하는데 화면에는 회색이 뜬다 — 빌드도 화면도 안 깨져서
 * 제조사 정산의 `정산 대기`·`출금 가능`·`지급 완료` 셋이 픽셀 단위로 같은 채 남아 있었다.
 */
const TEST = 'src/tests/unit/status-tone-and-sale-2026-09-29.test.ts'
const TONE = 'scripts/check-status-tone.mjs'
/** 스캔 화면은 상태표가 아니라 삼항이라 `check-status-tone` 이 못 본다 — 전용 시험이 고정한다. */
const TONE_SCAN = 'src/tests/unit/status-tone-and-sale-2026-09-29.test.ts'

export default [
  {
    name: '🚦 주문 상태 색이 다시 중화되는 색조로 돌아간다 (넷이 같은 회색)',
    file: 'src/components/mypage/OrdersTab.tsx',
    find: "'취소/환불' }), cls: 'text-tone-bad' }",
    replace: "'취소/환불' }), cls: 'text-rose-600 dark:text-rose-400' }",
    test: TONE,
    why: 'rose 는 MONO 중화로 회색이 된다 — 취소가 구매완료와 구별되지 않는다(2026-09-29 실측).',
  },
  {
    name: '🚦 제조사 정산 세 상태가 다시 같은 회색이 된다 (돈 상태)',
    file: 'src/pages/supplier-dashboard/OverviewTab.tsx',
    find: "'정산 대기' }), value: b.pending_amount, cls: 'text-tone-warn' }",
    replace: "'정산 대기' }), value: b.pending_amount, cls: 'text-amber-600' }",
    test: TONE,
    why: '정산 대기·출금 가능·지급 완료가 한 화면에 나란히 뜬다 — 셋이 같은 회색이면 돈 상태를 못 읽는다.',
  },
  {
    // 🩸 2026-09-29: 처음엔 가드 파일의 `violations(i18n) !== 1` 줄을 `… && false` 로 바꿨는데
    //   **그 주입은 헛돌았다** — 시험이 그 파일을 *문자열*로 읽었고 문자열은 그대로 남았다.
    //   그래서 판정을 순수 모듈로 떼어내고, 이제 **판정 자체**를 깨뜨린다.
    name: '🚦 판정이 다시 중괄호 금지로 돌아간다 (i18n 상태표에 눈을 감는다)',
    file: 'scripts/lib/status-table-scan.mjs',
    find: '      if (src[j] === \'{\') depth++',
    replace: '      if (src[j] === \'{\') { out.length = 0; return out }',
    test: TEST,
    why: 'CLAUDE.md 가 강제하는 `t(키,{defaultValue})` 때문에 소비자 상태표는 항상 중괄호를 품는다 — 균형 파싱이 죽으면 소비자 화면이 통째로 안 보인다(2026-09-29 에 실제로 그랬다).',
  },
  {
    name: '🚦 대조 픽스처에서 i18n 형태가 빠진다 (눈먼 자리가 다시 안 보인다)',
    file: 'scripts/lib/status-table-scan.mjs',
    find: "  i18n: { src: `const S = { r: { label: t('a.b', { defaultValue: '반려' }), cls: 'text-rose-600' } }`, expect: 1 },",
    replace: "  i18n: { src: `const S = { r: { label: '반려', cls: 'text-rose-600' } }`, expect: 1 },",
    test: TEST,
    why: 'i18n 픽스처가 하드코딩 형태로 바뀌면 파서가 다시 끊겨도 가드가 스스로 못 잡는다 — 2026-09-29 이전이 정확히 그 상태였다.',
  },
  {
    name: '🚦 가드가 판정 모듈을 안 쓰게 된다 (배선 끊김)',
    file: TONE,
    find: "import { violations, FIXTURES } from './lib/status-table-scan.mjs'",
    replace: "const violations = () => 0, FIXTURES = {}",
    test: TEST,
    why: '모듈이 멀쩡해도 가드가 안 부르면 아무것도 안 막는다 — 이 레포가 반복해 당한 "조용한 부재".',
  },
  {
    name: '🔴 할인 금액이 다시 중화되는 rose 로 칠해진다 (회색 할인)',
    file: 'src/pages/my-orders/OrderDetailModal.tsx',
    find: '<span className="font-medium text-sale">-{formatNumber(discountAmount)}원</span>',
    replace: '<span className="font-medium text-rose-600">-{formatNumber(discountAmount)}원</span>',
    test: TEST,
    why: '할인은 이득이라 빨강이 규칙인데(2026-09-07 대표 확정) rose 는 회색으로 렌더된다.',
  },
  {
    name: '🔴 할인율이 다시 다크 값 없는 raw red 로 돌아간다',
    file: 'src/components/product/product-header.tsx',
    find: '<span className="text-[24px] font-extrabold text-sale">{displayDiscount}%</span>',
    replace: '<span className="text-[22px] font-extrabold text-red-500">{displayDiscount}%</span>',
    test: TEST,
    why: '`red-500`(#EF4444)은 다크 카드 위 대비가 무너진다 — `--sale` 토큰이 생긴 이유가 그 사고다.',
  },
  {
    name: '🚦 매장 스캔 결과의 "통과" 가 다시 회색이 된다 (되돌릴 수 없는 동작)',
    file: 'src/components/voucher/VoucherScanner.tsx',
    find: "${latest.ok ? 'bg-tone-ok-bg' : 'bg-tone-bad-bg'}",
    replace: "${latest.ok ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-tone-bad-bg'}",
    test: TONE_SCAN,
    why: '사용 처리는 되돌릴 수 없다 — 성공만 회색이면 매장이 "통과" 와 "오류" 중 한쪽만 읽는다(2026-09-29 실측).',
  },
  {
    name: '🧪 가드가 시험 파일까지 훑는다 (자기 픽스처를 위반으로 신고)',
    file: TONE,
    find: "  .filter((f) => !/^src\\/tests?\\//.test(f))",
    replace: "",
    test: TONE_SCAN,
    why: '이 가드의 대조 픽스처는 시험 파일 안에 문자열로 들어 있다 — 안 거르면 가드가 자기 자신을 신고해 pre-push 가 영구히 빨갛다(2026-09-29 실제 발생).',
  },
]
