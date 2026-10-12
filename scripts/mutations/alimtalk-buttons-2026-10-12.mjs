/**
 * 🧬 주입 — 알림톡 버튼 (2026-10-12 대표 "각각 링크 넣어줘")
 *
 * 되돌리면 전부 조용하다: 버튼이 템플릿과 어긋나면 카카오가 그 알림을 거절하는데, 에러는 SENS 응답에만 남는다.
 */
const T = 'src/tests/unit/alimtalk-buttons-2026-10-12.test.ts'
export default [
  {
    name: '알림톡버튼 — 발송이 버튼을 안 싣는다',
    file: 'src/lib/text-notice.ts',
    find: "content: n.text, ...(buttons.length ? { buttons } : {}),",
    replace: 'content: n.text,',
    test: T,
    why: '버튼을 등록한 템플릿에 버튼 없이 보내면 "템플릿 불일치"로 전부 거절된다.',
  },
  {
    name: '알림톡버튼 — 매장 번호가 없어도 그냥 보낸다',
    file: 'src/lib/text-notice.ts',
    find: '  if (buttons === null) {',
    replace: '  if (false) {',
    test: T,
    why: '매장 번호 없는 버튼은 등록 모양(s=#{매장번호})과 달라 거절된다 — 실패 기록도 없이 사라진다.',
  },
  {
    name: '알림톡버튼 — 판매 알림이 매장 번호를 안 넘긴다',
    file: 'src/features/group-buy/api/helpers.ts',
    find: "tpl: 'seller_voucher_sold', title: '이용권 판매', text: message, sellerId: data.sellerId })",
    replace: "tpl: 'seller_voucher_sold', title: '이용권 판매', text: message })",
    test: T,
    why: '사장님 판매 알림이 매번 매장 번호 누락으로 멈춘다.',
  },
  {
    name: '알림톡버튼 — 승인 알림이 매장 번호를 안 넘긴다',
    file: 'src/features/admin/api/admin-sellers/seller-decision-notify.ts',
    find: '    { sellerId }, // 🔘',
    replace: '    // 🔘',
    test: T,
    why: '매장 승인 알림톡이 [이용권 등록하기] 버튼을 못 만들어 안 나간다.',
  },
  {
    name: '알림톡버튼 — 버튼 이름이 문서(등록본)와 갈린다',
    file: 'src/lib/alimtalk-buttons.ts',
    find: "{ name: '판매 내역', link: { kind: 'store', to: 'orders' } },",
    replace: "{ name: '판매내역', link: { kind: 'store', to: 'orders' } },",
    test: T,
    why: '콘솔에 등록한 이름과 한 글자만 달라도 그 템플릿 발송이 전부 거절된다.',
  },
  {
    name: '알림톡버튼 — 버튼 링크의 화면이 문서와 갈린다',
    file: 'src/lib/alimtalk-buttons.ts',
    find: "seller_approved: [{ name: '이용권 등록하기', link: { kind: 'store', to: 'vouchers' } }],",
    replace: "seller_approved: [{ name: '이용권 등록하기', link: { kind: 'store', to: 'home' } }],",
    test: T,
    why: '등록한 링크 모양과 다르면 거절된다.',
  },
  {
    name: '알림톡버튼 — 본문에 주소를 되살린다',
    file: 'src/worker/cron/voucher-expire.ts',
    find: '`매장에서 아래 [내 이용권 보기]를 눌러 QR 을 보여주세요.`',
    replace: '`매장에서 내 이용권 QR 을 보여주세요: https://urdeal.kr/my-vouchers`',
    test: T,
    why: '등록 본문과 달라져 거절되고, 버튼과 같은 링크를 두 번 쓴다.',
  },
]
