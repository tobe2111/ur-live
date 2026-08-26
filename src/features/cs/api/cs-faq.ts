/**
 * 💬 2026-07-19 CS FAQ SSOT (운영 자동화 백로그 ③ — "CS의 80%는 같은 질문 5개").
 *
 * 카카오채널 자동응답 봇(kakao-skill-webhook.routes.ts)이 사용하는 FAQ 데이터.
 * 소비자 홍보/안내 사실만 담는다 — 🚫 운영 수치(수수료율·원천징수·커미션·매출) 금지(블로그 AI brief 와 동일 원칙).
 *
 * ⚠️ 서비스 사실 변경 시 이 파일도 같은 커밋에서 갱신할 것 (블로그 시드 최신성 룰과 동일 철학):
 *   - 딜 충전 종료(2026-07-18 TOPUP_DISABLED) 반영됨 — 충전 안내 재유입 금지.
 *   - 명칭 SSOT: 이용권/교환권/동네딜/유저/사업자 유저 (식사권·공구권 폐기어 금지).
 */

export interface CsFaqEntry {
  id: string
  /** 버튼/퀵리플라이 라벨 (짧게) */
  label: string
  /** utterance 매칭 키워드 — 소문자·공백제거 후 includes 매칭 */
  keywords: string[]
  answer: string
}

export const CS_FAQ_ENTRIES: readonly CsFaqEntry[] = [
  {
    id: 'qr_usage',
    label: 'QR 사용법',
    keywords: ['qr', '큐알', '사용법', '사용방법', '어떻게사용', '어떻게써', '매장에서', '바코드', 'pin', '핀번호'],
    answer:
      '이용권 QR 사용 방법이에요.\n\n' +
      '1) 유어딜 앱(또는 urdeal.kr) 로그인\n' +
      '2) 하단 [마이] → [내 지갑]에서 구매한 이용권 선택\n' +
      '3) 매장 직원에게 QR(또는 PIN 번호)을 보여주시면 확인 후 바로 이용 완료!\n\n' +
      '사용 완료되면 이용권 상태가 "사용됨"으로 바뀌어요.',
  },
  {
    id: 'refund',
    label: '환불 안내',
    keywords: ['환불', '취소', '반품', '돈돌려', '결제취소', '환급'],
    answer:
      '환불 안내예요.\n\n' +
      '· 미사용 이용권: 앱 [마이] → [주문 내역]에서 환불을 신청하실 수 있어요.\n' +
      '· 유효기간이 지난 미사용 이용권: 결제액 100%가 자동 환불돼요(별도 신청 불필요).\n' +
      '· 이미 사용한 이용권은 환불이 어려워요.\n\n' +
      '환불 처리 결과는 앱 알림으로 알려드리며, 카드 환불은 카드사 사정에 따라 3~7일 걸릴 수 있어요.',
  },
  {
    id: 'settlement',
    label: '정산일(사장님)',
    keywords: ['정산', '정산일', '입금', '언제들어', '지급', '판매대금', '사장님', '정산주기'],
    answer:
      '사장님(사업자 유저) 정산 안내예요.\n\n' +
      '· 판매 대금은 매주 자동으로 정산이 생성되고, 검토 후 등록하신 계좌로 지급돼요.\n' +
      '· 정산 내역은 [셀러 대시보드] → [정산] 메뉴에서 언제든 확인하실 수 있어요.\n' +
      '· 계좌 변경은 셀러 대시보드 → 계정 설정에서 가능해요.\n\n' +
      '정산 관련 자세한 문의는 상담원 연결을 요청해 주세요.',
  },
  {
    id: 'expiry',
    label: '유효기간',
    keywords: ['유효기간', '만료', '기한', '언제까지', '기간연장', '연장'],
    answer:
      '이용권 유효기간 안내예요.\n\n' +
      '· 유효기간은 이용권 상세와 [내 지갑]에서 확인할 수 있어요.\n' +
      '· 만료 30일/7일/3일/1일 전에 알림으로 미리 알려드려요.\n' +
      '· 유효기간이 지난 미사용 이용권은 결제액 100%가 자동 환불되니 안심하세요.',
  },
  {
    id: 'deal_points',
    label: '딜 포인트',
    keywords: ['딜포인트', '포인트', '적립', '딜이뭐', '충전', '딜사용'],
    answer:
      '딜 포인트 안내예요.\n\n' +
      '· 딜은 유어딜 활동으로 모으는 리워드 포인트예요 — 친구 초대, 유어샵 추천, 리뷰, 이벤트 참여로 적립돼요.\n' +
      '· 모은 딜은 이용권·교환권 결제 시 현금처럼 사용할 수 있어요.\n' +
      '· 현금 충전은 운영하지 않아요(적립 전용).\n\n' +
      '내 딜 잔액과 적립 내역은 [마이] → [딜 내역]에서 확인하세요.',
  },
] as const

/** 상담원 연결/미매칭 폴백 안내. */
export const CS_FAQ_FALLBACK =
  '문의하신 내용을 바로 안내드리지 못했어요. 아래 자주 묻는 질문을 선택하시거나,\n' +
  '"상담원 연결"이라고 입력하시면 운영시간 내에 순차적으로 답변드릴게요. 🙏'

/** utterance → FAQ 매칭 (키워드 최다 매칭 항목, 0개면 null). */
export function matchCsFaq(utterance: string): CsFaqEntry | null {
  const norm = (utterance || '').toLowerCase().replace(/\s+/g, '')
  if (!norm) return null
  let best: CsFaqEntry | null = null
  let bestScore = 0
  for (const entry of CS_FAQ_ENTRIES) {
    let score = 0
    for (const kw of entry.keywords) {
      if (norm.includes(kw.toLowerCase().replace(/\s+/g, ''))) score++
    }
    if (score > bestScore) { best = entry; bestScore = score }
  }
  return best
}
