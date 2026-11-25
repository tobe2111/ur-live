/**
 * 💸 환불 및 교환/반품 정책(`/refund`)의 **문구·구조·클래스 SSOT** (2026-11-18).
 *
 * 화면(`pages/RefundPolicyPage.tsx`)과 서버 첫 화면(`worker/utils/legal-first-screen.ts`)이 **이 파일 하나**를 읽는다.
 * 라이브 실측(폰 4G · CPU 4배): 첫 그림 1.5~3.0s — 데이터 요청이 하나도 없는 고정 문서인데 앱 코드가 다 와야 그려졌다.
 * 서버가 같은 트리로 화면 전체를 그린다(문구를 두 벌로 적으면 정책 개정 때 하나만 고쳐진다 — 이 레포가 반복해 당한 클래스).
 *
 * 모양: 순수 데이터 트리(`RefundNode`) — 태그 · 클래스 · 자식(글자 또는 요소). React 도 lucide 도 import 하지 않는다(워커가 읽는다).
 * ⚠️ 정책 문구 변경은 대표 확인 사항이다. 이 파일은 2026-11-18 화면에서 **한 글자도 바꾸지 않고** 옮겼다(렌더 결과 대조 시험).
 * 회사 값은 `COMPANY`, 유효기간 문구는 `VOUCHER_VALIDITY_LABEL` 그대로(토스 PG 심사 2026-11-17).
 */
import { COMPANY } from './company-info'
import { VOUCHER_VALIDITY_LABEL } from './voucher-validity'

export type RefundTag = 'section' | 'div' | 'p' | 'h2' | 'h3' | 'span' | 'ul' | 'li' | 'table' | 'thead' | 'tbody' | 'tr' | 'th' | 'td'
export interface RefundEl { tag: RefundTag; cls?: string; kids: RefundNode[] }
export type RefundNode = string | RefundEl

const el = (tag: RefundTag, cls: string | undefined, ...kids: RefundNode[]): RefundEl => ({ tag, cls, kids })

/** 페이지 뼈대(머리줄·본문 틀) 클래스. */
export const REFUND_CLS = {
  root: 'min-h-screen bg-warm pb-20',
  header: 'sticky top-0 md:top-14 z-40 bg-surface border-b border-rule',
  headerRow: 'ur-content-medium flex items-center justify-between px-5 py-3',
  back: 'text-ink',
  backIcon: 'w-6 h-6',
  title: 'text-[16px] font-semibold text-ink',
  spacer: 'w-6',
  content: 'ur-content-medium px-5 pt-6',
} as const

export const REFUND_COPY = { title: '환불 및 교환/반품 정책', back: '뒤로 가기' } as const

// ── 자주 쓰는 클래스 ──
const H2_3 = 'text-[15px] font-bold text-ink mb-3'
const H2_5 = 'text-[15px] font-bold text-ink mb-5'
const H3_1 = 'text-[13px] font-medium text-ink mb-1'
const CARD = 'bg-surface rounded-lg p-4'
const CARD3 = 'bg-surface rounded-lg p-3'
const BODY = 'text-[13px] text-ink-soft'
const BODY_LR = 'text-[13px] text-ink-soft leading-relaxed'
const STRONG = 'font-medium text-ink'
const NOTE = 'text-[12px] text-ink-faint mt-1'
const SEC = 'border-t border-rule pt-6 mt-8'
const BAD = 'text-tone-bad font-medium'
const OK = 'text-tone-ok font-medium'
const LI = 'flex items-start gap-2'
const UL = 'space-y-2 text-[13px] text-ink-soft leading-relaxed'

const label = (k: string, v: string) => el('p', BODY, el('span', STRONG, k), v)
const card = (title: string, ...body: RefundNode[]) => el('div', CARD, el('h3', H3_1, title), el('p', BODY_LR, ...body))
const simpleCard = (title: string, text: string, note?: string) =>
  el('div', CARD, el('h3', H3_1, title), el('p', BODY, text), ...(note ? [el('p', NOTE, note)] : []))
const bullet = (...kids: RefundNode[]) => el('li', LI, el('span', 'mt-1', '•'), el('span', undefined, ...kids))
const step = (n: string, title: string, desc: string) => el('div', 'flex items-start gap-3',
  el('div', 'flex-shrink-0 w-7 h-7 bg-gray-900 text-white rounded-full flex items-center justify-center text-[12px] font-medium', n),
  el('div', 'flex-1 pt-1', el('h3', 'text-[13px] font-medium text-ink', title), el('p', BODY, desc)))
const TD = 'border-b border-rule px-4 py-2'
const row = (reason: string, who: RefundEl, tail: string | null, last = false) =>
  el('tr', undefined, el('td', last ? 'px-4 py-2' : TD, reason), el('td', last ? 'px-4 py-2' : TD, ...(tail ? [who, tail] : [who])))
const subBlock = (title: string, ...body: RefundNode[]) => el('div', 'mb-5', el('h3', 'text-[13px] font-medium text-ink mb-2', title), el('p', BODY_LR, ...body))

/** 본문(`REFUND_CLS.content` 안의 자식들) — 화면 순서 그대로. */
export const REFUND_BODY: RefundNode[] = [
  el('p', 'text-[12px] text-ink-faint mb-8', '시행일자: 2026년 10월 13일'),

  el('section', undefined,
    el('h2', H2_3, '운영 회사 정보'),
    el('div', 'bg-surface rounded-lg p-4 space-y-2',
      label('상호명:', ' 유어팀 (UrTeam)'),
      label('대표:', ' 정지원'),
      label('사업자등록번호:', ` ${COMPANY.bizRegNo}`),
      label('주소:', ` ${COMPANY.address}`),
      label('이메일:', ' jiwon@ur-team.com'),
      label('운영시간:', ' 평일 09:00 - 18:00 (주말 및 공휴일 휴무)'))),

  el('section', SEC,
    el('h2', H2_5, '이용권 환불'),
    el('div', 'space-y-3',
      card('이용권 유효기간', '모든 이용권(응모 후 당첨되어 결제한 이용권 포함)의 유효기간은 ', el('span', STRONG, VOUCHER_VALIDITY_LABEL),
        '을 넘지 않습니다. 매장이 더 짧은 기한을 정한 경우 그 날짜까지이며, 이용권 상세와 내 이용권 화면에 표시됩니다.'),
      card('유효기간 안에 쓰지 않은 이용권', '따로 신청하지 않아도 ', el('span', STRONG, '결제 금액 전액'),
        '이 자동으로 환불됩니다. 회사는 매일 한 번 만료된 이용권을 확인해 환불하고, 처리되면 알림으로 알려드립니다.',
        el('span', 'text-ink-faint', ' 일할 계산이나 수수료 공제는 없습니다.')),
      // 🏡 2026-11-25 — 위 자동 환불의 예외 둘을 같은 자리에 적는다. 종전엔 "모든 미사용 이용권이 자동 환불" 로만 읽혀 실제 처리와 달랐다
      //   (숙소: 대표 확정 2026-11-25 · `stay-no-show.ts` / 발송된 교환권: `KT_DELIVERED`).
      card('자동 환불에서 빠지는 것', el('span', STRONG, '숙소 이용권'),
        '은 유효기간(또는 예약한 날짜)이 지나면 이용한 것으로 처리되어 환불되지 않습니다. ',
        el('span', STRONG, '교환권(기프티콘)'), '은 발송된 뒤에는 취소·환불되지 않습니다. 두 경우 모두 구매 화면과 내 이용권에서 미리 안내합니다.'),
      card('돌려받는 방법', el('span', STRONG, '결제한 수단 그대로'),
        ' 돌려드립니다. 카드로 결제했으면 카드 결제가 취소되고(카드사 사정에 따라 영업일 3~5일), 딜로 결제했으면 딜로 돌아갑니다. 딜은 ',
        el('span', STRONG, '쓸 때와 같은 종류'), '로 복원됩니다 — 충전한 딜은 충전 딜로, 리워드로 받은 딜은 리워드 딜로.'),
      card('이미 사용한 이용권', '매장에서 사용 처리가 끝난 이용권은 ', el('span', 'text-tone-bad font-medium', '환불 대상이 아닙니다'),
        '. 매장이 이미 제공한 상품·서비스이기 때문입니다. 제공받은 내용에 문제가 있었다면 고객센터로 알려주세요. 개별적으로 확인해 처리해 드립니다.'),
      card('유효기간 전에 취소하고 싶을 때', '아직 사용하지 않았다면 고객센터로 요청해 주세요. 확인 후 주문 단위로 취소·환불해 드립니다. 기다리셔도 괜찮습니다 — 유효기간이 지나면 위와 같이 자동으로 전액 환불됩니다.'))),

  el('section', SEC,
    el('h2', H2_5, '딜(충전 잔액) 환급'),
    el('div', 'space-y-3',
      el('div', CARD, el('p', BODY_LR, '직접 ', el('span', STRONG, '충전하고 아직 쓰지 않은 딜'),
        '은 현금으로 환급을 신청할 수 있습니다 (이용약관 제12조). 마이 페이지에서 신청하시면 확인 후 등록하신 계좌로 입금해 드립니다.')),
      el('ul', UL,
        bullet('환급 한도는 ', el('span', STRONG, '충전하신 금액'), '까지입니다.'),
        bullet('이벤트·리워드로 받은 딜은 환급 대상이 아닙니다.'),
        bullet('충전한 돈을 돌려드리는 것이므로 ', el('span', STRONG, '원천징수를 하지 않습니다'), '. 소개비 출금과는 별개의 절차입니다.')))),

  el('section', SEC,
    el('h2', H2_5, '배송 상품 교환 및 반품'),
    subBlock('신청 방법', '상품을 수령하신 날로부터 ', el('span', STRONG, '7일 이내'), ' 메신저 및 홈페이지 Q&A게시판 접수'),
    subBlock('배송 비용', '단순 변심은 왕복 택배비 ', el('span', 'font-medium text-tone-bad', '6,000원')),
    subBlock('반품 주소', '부산광역시 금정구 놀이마당로 26, 1402호(청룡동, 금정산롯데인벤스84)'),
    el('div', undefined,
      el('h3', 'text-[13px] font-medium text-ink mb-3', '유의 사항'),
      el('div', 'space-y-2',
        el('div', CARD3, el('p', BODY_LR, el('span', OK, '단순 변심'), '의 경우 수령일로부터 7일 이내까지 교환·반품이 가능합니다.',
          el('span', 'text-tone-bad', ' (교환/반품비 고객 부담)'))),
        el('div', CARD3, el('p', BODY_LR, el('span', OK, '상품 하자'), ' 또는 ', el('span', OK, '오배송'), '의 경우 수령일로부터 7일 이내 교환·반품이 가능합니다.',
          el('span', 'text-tone-ok', ' (교환/반품비 무료)'))),
        el('div', CARD3, el('p', BODY_LR, el('span', BAD, '제품 특성상'), ' 단순 변심, 부주의에 의한 제품 손상 및 파손, 사용 및 개봉한 경우 교환/반품이',
          el('span', BAD, ' 불가'), '합니다.'))))),

  el('section', SEC,
    el('h2', H2_5, '배송 안내'),
    el('div', 'space-y-3',
      simpleCard('배송 업체', '대한통운 (1588-1255)', '* 판매 환경에 따라 변경될 수 있음'),
      simpleCard('배송 지역', '대한민국 전 지역'),
      el('div', CARD, el('h3', H3_1, '배송 비용'), el('p', BODY, '3,000원 / 구매 금액 ', el('span', STRONG, '50,000원 이상 시 무료 배송')),
        el('p', NOTE, '* 도서산간 지역 별도 추가 금액 발생')),
      simpleCard('배송 기간', '주말·공휴일 제외 2-5일')),
    el('div', 'mt-5 bg-surface rounded-lg p-4',
      el('h3', 'text-[13px] font-medium text-ink mb-2', '유의 사항'),
      el('ul', UL,
        bullet('주문 폭주 및 공휴 사정으로 인하여 지연 및 품절이 발생될 수 있습니다.'),
        bullet('기본 배송기간 이상 소요되는 상품이거나, 품절 상품은 개별 연락을 드립니다.')))),

  el('section', SEC,
    el('h2', H2_5, '환불 처리 절차'),
    el('div', 'space-y-3',
      step('1', '취소/반품 신청', '마이페이지에서 신청 또는 고객센터 문의'),
      step('2', '판매자 확인', '판매자가 신청 내용 확인 (1-2 영업일)'),
      step('3', '상품 반송 (반품 시)', '지정된 주소로 상품 반송'),
      step('4', '환불 처리', '상품 회수 확인 후 환불 (3-7 영업일)'))),

  el('section', SEC,
    el('h2', H2_5, '배송비 부담 안내'),
    el('div', 'overflow-x-auto rounded-lg border border-rule',
      el('table', 'w-full text-[13px]',
        el('thead', undefined, el('tr', 'bg-surface',
          el('th', 'border-b border-rule px-4 py-2 text-left font-medium text-ink', '사유'),
          el('th', 'border-b border-rule px-4 py-2 text-left font-medium text-ink', '배송비 부담'))),
        el('tbody', 'text-ink-soft',
          row('단순 변심', el('span', BAD, '구매자 부담'), ' (왕복 배송비 6,000원)'),
          row('상품 하자', el('span', OK, '판매자 부담'), null),
          row('오배송', el('span', OK, '판매자 부담'), null),
          row('상품 불일치', el('span', OK, '판매자 부담'), null, true))))),

  el('section', SEC,
    el('h2', H2_5, '환불 방법 및 소요기간'),
    el('div', 'space-y-2',
      simpleCard('신용카드', '카드사 승인 취소 (3-7 영업일)'),
      simpleCard('계좌이체', '구매자 계좌로 직접 입금 (영업일 기준 3일)'),
      simpleCard('가상계좌', '구매자 계좌로 직접 입금 (영업일 기준 3일)'),
      simpleCard('간편결제', '결제 수단에 따라 3-7 영업일'))),

  el('section', SEC,
    el('h2', H2_3, '고객센터 문의'),
    el('div', 'bg-surface rounded-lg p-4 space-y-2',
      label('운영시간:', ' 평일 09:00 - 18:00 (주말 및 공휴일 휴무)'),
      label('이메일:', ' jiwon@ur-team.com'))),

  el('div', 'border-t border-rule pt-6 mt-8 text-center space-y-1',
    label('상호명:', ' 유어팀 (UrTeam)'),
    label('대표:', ' 정지원'),
    el('p', 'text-[12px] text-ink-faint mt-3', '본 정책은 전자상거래 등에서의 소비자보호에 관한 법률을 준수합니다.')),
]

/** 트리의 글자만(시험·크롤러 대조용). */
export function refundText(nodes: RefundNode[] = REFUND_BODY): string {
  return nodes.map((n) => (typeof n === 'string' ? n : refundText(n.kids))).join('')
}
