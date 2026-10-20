/**
 * 📮 자동 안내 셋(일일 리포트 · 후기 요청 · 서류 보완, 2026-10-18 대표 "4,5,6번 하자") — 주입 매니페스트.
 * 가드: src/tests/unit/owner-nudges-2026-10-18.test.ts
 */
const TEST = 'src/tests/unit/owner-nudges-2026-10-18.test.ts'

export default [
  {
    name: '📮 일일 리포트가 다시 active 만 본다(승인 매장 누락)',
    file: 'src/worker/cron/seller-daily-report.ts',
    find: "? `status IN ('approved','active')`",
    replace: "? `status = 'active'`",
    test: TEST,
    why: "라이브 매장은 'approved' 라 active 만 보면 대상이 0 이다 — 한 통도 안 나가던 원인 ②.",
  },
  {
    name: '📮 어제 범위가 ISO 형식으로 돌아간다',
    file: 'src/worker/utils/owner-nudges.ts',
    find: "toISOString().slice(0, 19).replace('T', ' ')",
    replace: 'toISOString()',
    test: TEST,
    why: "D1 은 공백 구분이라 'T' 가 섞이면 하루 경계 비교가 어긋난다.",
  },
  {
    name: '📮 후기 요청이 이미 후기 쓴 손님에게도 간다',
    file: 'src/worker/cron/review-request.ts',
    find: '    AND NOT EXISTS (SELECT 1 FROM product_reviews pr WHERE pr.product_id = p.id AND CAST(pr.user_id AS TEXT) = CAST(v.user_id AS TEXT))\n',
    replace: '',
    test: TEST,
    why: '이미 후기를 쓴 손님에게 다시 부탁하면 소음이다.',
  },
  {
    name: '📮 후기 요청이 같은 이용권으로 매일 반복된다',
    file: 'src/worker/cron/review-request.ts',
    find: "    AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = v.user_id AND n.type = 'review_request_' || v.id)\n",
    replace: '',
    test: TEST,
    why: '이용권당 1회 — 이 줄이 빠지면 24~48시간 창 안에서 두 번 갈 수 있다.',
  },
  {
    name: '📮 서류 안내가 2회차 뒤에도 계속 간다',
    file: 'src/worker/utils/owner-nudges.ts',
    find: '  if (sentCount === 1) return ageDays >= 7 && (daysSinceLast ?? 0) >= 4\n  return false',
    replace: '  if (sentCount === 1) return ageDays >= 7 && (daysSinceLast ?? 0) >= 4\n  return (daysSinceLast ?? 0) >= 4',
    test: TEST,
    why: '두 번 뒤에는 멈춘다 — 끝없는 안내는 스팸이다.',
  },
  {
    name: '📮 서류 안내 게이트 기본값이 켜짐으로',
    file: 'src/features/admin/api/admin-system-monitoring.routes.ts',
    find: "label: '서류 빠진 사장님 보완 안내', default_value: 'false'",
    replace: "label: '서류 빠진 사장님 보완 안내', default_value: 'true'",
    test: TEST,
    why: '밖으로 나가는 메시지는 등급 C — 대표가 켠다.',
  },
]
