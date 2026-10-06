/**
 * 📄📩 등록증 선택 전환 + 통보 링크 둘 (2026-09-21) 되돌려-검증 주입.
 * 가드: src/tests/unit/bizcert-optional-2026-09-21.test.ts
 * 규약: `export default [ … ]` 하나. 이름은 전체에서 유일.
 */
const TEST = 'src/tests/unit/bizcert-optional-2026-09-21.test.ts'
const BADGE = 'src/shared/seller-cert-badge.ts'
const MODAL = 'src/components/seller/StoreRegisterModal.tsx'
const ROUTE = 'src/features/seller/api/seller-stores.routes.ts'
const NOTICE = 'src/worker/utils/store-owner-notice.ts'
const ADMIN = 'src/pages/AdminSellerApprovalPage.tsx'

export default [
  {
    name: '🧾등록증배지 파일이 없어도 제출됨으로 본다',
    file: BADGE,
    find: "  return String(certUrl || '').trim() ? 'submitted' : 'missing'",
    replace: "  return 'submitted'",
    test: TEST,
    why: '어드민이 서류 없는 신청을 구분 못 한 채 승인한다 — 선택으로 바꾼 대가를 아무도 못 본다.',
  },
  {
    name: '🧾등록증배지 심사 결과를 파일 유무가 덮는다',
    file: BADGE,
    find: "  if (s === 'verified' || s === 'pending' || s === 'rejected') return s",
    replace: '  void s',
    test: TEST,
    why: '반려된 등록증이 파일만 있으면 "제출됨" 으로 보인다 — 심사 이력이 사라진다.',
  },
  {
    name: '🧾등록증배지 어드민이 함수를 안 쓰고 되돌아간다',
    file: ADMIN,
    find: '              const bizLabel = SELLER_CERT_LABEL[bizView]',
    replace: "              const bizLabel = '사업자 미제출'",
    test: TEST,
    why: '서류를 올린 사람도 안 올린 사람도 똑같이 보인다 — 고치기 전 그 상태로 되돌아간다.',
  },
  {
    name: '📄앞문 등록증이 다시 필수가 된다',
    file: MODAL,
    find: '    return null\n  }\n  // 🗺️ 지도가 보이는 단계인가',
    replace: "    return certOk ? null : '사업자등록증 사진을 첨부해주세요'\n  }\n  // 🗺️ 지도가 보이는 단계인가",
    test: TEST,
    why: '다 적은 사장님을 마지막 문턱에서 되돌려 보낸다 — 가장 잃기 비싼 자리다.',
  },
  {
    name: '📄앞문 제출 가드가 다시 등록증을 본다',
    file: MODAL,
    find: '    if (!picked || !channel || !managerOk || submitting) return',
    replace: '    if (!picked || !channel || !managerOk || !certOk || submitting) return',
    test: TEST,
    why: '버튼은 활성인데 눌러도 아무 일이 안 난다 — 이유를 말해 주지 않는 최악의 막힘.',
  },
  {
    name: '📄앞문 제목이 선택임을 숨긴다',
    file: MODAL,
    find: "title: '사업자등록증을 올려주세요 (선택)'",
    replace: "title: '사업자등록증을 올려주세요'",
    test: TEST,
    why: '사장님이 "안 올리면 못 넘어가나" 를 고민하다 그 자리에서 이탈한다.',
  },
  {
    name: '📄앞문 건너뛴 대가를 숨긴다',
    file: MODAL,
    find: '승인 전까지는 메인에 노출되지 않고',
    replace: '언제든 올릴 수 있고',
    test: TEST,
    why: '"선택" 이라고만 알려 주면, 승인이 늦어졌을 때 우리가 말 안 해 준 게 된다.',
  },
  {
    name: '🔒서버 등록증 경로 검사를 통째로 없앤다',
    file: ROUTE,
    find: "    if (certUrl && !/^\\/api\\/media\\/uploads\\/biz-cert\\//.test(certUrl)) return",
    replace: '    if (false) return',
    test: TEST,
    why: '임의 URL 을 심사 자료로 들이밀 수 있다 — 어드민이 남의 서버 이미지를 보고 승인한다.',
  },
  {
    name: '🔒서버 등록증이 다시 필수가 된다',
    file: ROUTE,
    find: "    if (certUrl && !/^\\/api\\/media\\/uploads\\/biz-cert\\//.test(certUrl)) return",
    replace: "    if (!/^\\/api\\/media\\/uploads\\/biz-cert\\//.test(certUrl)) return",
    test: TEST,
    why: '화면은 통과시키는데 서버가 400 을 낸다 — 앞문과 뒷문이 갈려 조용히 등록이 실패한다.',
  },
  {
    name: '🔒서버 빈 등록증을 컬럼에 쓴다',
    file: ROUTE,
    find: '    if (certUrl) await c.env.DB.prepare("UPDATE sellers SET business_registration_image_url',
    replace: '    await c.env.DB.prepare("UPDATE sellers SET business_registration_image_url',
    test: TEST,
    why: '빈 문자열이 서류 칸에 들어가 "제출됨" 판정을 흐린다.',
  },
  {
    name: '📩사장님통보 대시보드 링크가 빠진다',
    file: NOTICE,
    find: "    `내 매장 관리: ${OWNER_NOTICE_DASHBOARD_URL}`,",
    replace: "    '',",
    test: TEST,
    why: '방금 등록한 본인에게 "등록됐다" 고만 알리고 할 일을 안 준다 — 수신자 대부분이 그 경우다.',
  },
  {
    name: '📩사장님통보 순서가 뒤집힌다',
    file: NOTICE,
    find: "    '이제 이용권을 만들고 주문을 받으실 수 있어요.',\n    `내 매장 관리: ${OWNER_NOTICE_DASHBOARD_URL}`,\n    '',\n    '직접 등록하지 않으셨다면 알려 주세요.',\n    OWNER_NOTICE_CLAIM_URL,",
    replace: "    '직접 등록하지 않으셨다면 알려 주세요.',\n    OWNER_NOTICE_CLAIM_URL,\n    '',\n    '이제 이용권을 만들고 주문을 받으실 수 있어요.',\n    `내 매장 관리: ${OWNER_NOTICE_DASHBOARD_URL}`,",
    test: TEST,
    why: '대부분의 수신자에게 필요 없는 링크가 먼저 온다 — 읽히는 건 첫 줄이다.',
  },
  {
    name: '📩사장님통보 대시보드 주소가 /seller 로 바뀐다',
    file: NOTICE,
    find: "export const OWNER_NOTICE_DASHBOARD_URL = 'https://urdeal.kr/seller/waiting'",
    replace: "export const OWNER_NOTICE_DASHBOARD_URL = 'https://urdeal.kr/seller'",
    test: TEST,
    why: 'requireSeller 가 이메일·비번 로그인으로 튕긴다 — 카카오로 가입한 사장님에겐 낯선 막다른 길.',
  },
  {
    name: '📩사장님통보 버튼이 하나만 남는다',
    file: NOTICE,
    find: "      { name: '내가 등록한 게 아니에요', type: 'WL', url_mobile: OWNER_NOTICE_CLAIM_URL, url_pc: OWNER_NOTICE_CLAIM_URL },",
    replace: '',
    test: TEST,
    why: '사기 방어의 출구가 버튼에서 사라진다 — 이 통보가 존재하는 이유가 반쪽이 된다.',
  },
  {
    name: '📩사장님통보 버튼을 발송기에 안 넘긴다',
    file: NOTICE,
    find: '        button_1: ownerNoticeButtonsJson(),',
    replace: '',
    test: TEST,
    why: '문구만 맞고 버튼이 빠진다 — 카카오 화면에 누를 곳이 없다.',
  },
]
