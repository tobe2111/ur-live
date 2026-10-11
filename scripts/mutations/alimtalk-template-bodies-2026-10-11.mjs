/**
 * 🧬 주입 — 알림톡 본문은 **등록한 본문과 같은 모양**이어야 한다 (2026-10-11 템플릿 정리)
 * 조건부 줄이 돌아오면 값이 비는 날만 "템플릿 불일치"로 거절된다 — 우리 쪽엔 에러가 안 남는다.
 */
const T = 'src/tests/unit/alimtalk-template-bodies-2026-10-11.test.ts'
export default [
  {
    name: '알림톡 본문 — 사장님 사용 알림의 사용 시각 줄을 조건부로 되돌린다',
    file: 'src/features/group-buy/api/helpers.ts',
    find: '"${data.productName}"\n사용 시각: ${ts || \'-\'}\n\n손님이 매장에서 셀프 사용 처리했어요.',
    replace: '"${data.productName}"${ts ? `\n사용 시각: ${ts}` : \'\'}\n\n손님이 매장에서 셀프 사용 처리했어요.',
    test: T,
    why: '시각이 비는 건만 줄 수가 달라져 등록 본문과 어긋난다.',
  },
  {
    name: '알림톡 본문 — 내일 예약 안내의 주소 줄을 조건부로 되돌린다',
    file: 'src/worker/cron/appointment-reminder.ts',
    find: "\\n📍 ${apt.restaurant_address || '-'}\\n예약 확인",
    replace: "${apt.restaurant_address ? `\\n📍 ${apt.restaurant_address}` : ''}\\n예약 확인",
    test: T,
    why: '주소 없는 매장만 줄이 빠져 등록 본문과 어긋난다.',
  },
  {
    name: '알림톡 — 교환권(딜 결제)에도 이용권 발급 알림을 보낸다',
    file: 'src/features/group-buy/api/group-buy.routes.ts',
    find: 'if (userRow?.phone && Number((product as { deal_only?: number | null }).deal_only) !== 1) {',
    replace: 'if (userRow?.phone) {',
    test: T,
    why: '교환권은 "매장에서 QR 보여주세요" 안내가 틀리다(기프티콘은 바코드로 쓴다).',
  },
  {
    name: '알림톡 — 알리고가 붙인 코드 대신 우리 이름을 tpl_code 로 보낸다',
    file: 'src/lib/text-notice.ts',
    find: '      templateCode: approved.get(n.tpl) || n.tpl,',
    replace: '      templateCode: n.tpl,',
    test: 'src/tests/unit/aligo-text-notice-2026-10-11.test.ts',
    why: '알리고는 등록 시 자기 코드(UA_1234)를 붙인다 — 우리 이름으로 보내면 승인된 템플릿도 없는 템플릿으로 거절된다.',
  },
  {
    name: '알림톡 — 만료 안내를 7·3·1일 전에도 알림톡으로 보낸다',
    file: 'src/worker/cron/voucher-expire.ts',
    find: 'if (r.user_phone && daysLeft === 30) {',
    replace: 'if (r.user_phone) {',
    test: T,
    why: '대표 확정 "30일 전만" — 나머지 셋은 돈이 드는데 앱 알림이 같은 일을 한다.',
  },
  {
    name: '알림톡 — 대표가 끈 알림도 발송 경로로 들어간다',
    file: 'src/lib/text-notice.ts',
    find: "  if (!n.forceAlimtalk && isAlimtalkOff(n.tpl)) return { ok: false, skipped: 'turned_off' }\n",
    replace: '',
    test: 'src/tests/unit/aligo-text-notice-2026-10-11.test.ts',
    why: '끈 알림이 등록돼 있으면 그대로 돈이 나간다.',
  },
]
