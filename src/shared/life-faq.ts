/**
 * 🏠 생활 서비스 자주 묻는 질문 — 화면(`LifePage`)·크롤러 본문·`FAQPage` JSON-LD 가 **같은 배열**을 쓴다
 * (2026-10-25 대표 "1~3 다 하자"). 두 벌이면 화면과 구조화 데이터가 갈려 구글이 내용-스키마 불일치로 본다.
 *
 * 🔒 숫자는 규칙 SSOT(`home-service.ts`)에서 받는다 — 손으로 적으면 어드민·코드가 바뀐 날 답이 거짓말이 된다.
 * 🔒 화면에 없는 Q&A 를 구조화 데이터로만 내지 않는다(`/life` 허브만 — 그 페이지가 이 목록을 그린다).
 */
import { MAX_OPEN_REQUESTS_PER_USER, MAX_QUOTES_PER_REQUEST, SIGNUP_FREE_CREDITS, UNVIEWED_REFUND_HOURS } from './home-service'

export interface LifeFaq { question: string; answer: string }

export const LIFE_FAQ: readonly LifeFaq[] = [
  {
    question: '견적을 받는 데 돈이 드나요?',
    answer: '아니요. 요청서를 올리고 견적을 비교하는 것은 무료예요. 업체를 고르면 그 업체와 직접 계약하고 비용을 치러요.',
  },
  {
    question: '내 연락처는 누구에게 가나요?',
    answer: '견적을 보낸 업체 중 직접 고른 한 곳에만 이름·휴대폰 번호·상세 주소가 전달돼요. 고르기 전에는 동까지만 보여요.',
  },
  {
    question: '견적은 몇 곳에서 받을 수 있나요?',
    answer: `요청 하나에 최대 ${MAX_QUOTES_PER_REQUEST}곳까지 먼저 보낸 순서대로 받아요. 금액과 업체 정보를 나란히 보고 고르면 돼요.`,
  },
  {
    question: '어떤 업체가 견적을 보내나요?',
    answer: '유어딜에 가게를 등록한 사업자 중 그 일과 지역을 고른 업체가 알림을 받고 견적을 보내요.',
  },
  {
    question: '아직 업체가 없는 일도 요청할 수 있나요?',
    answer: '네. 요청은 보관해 두었다가 그 지역에 업체가 들어오는 대로 보내 드려요.',
  },
  {
    question: '요청은 언제까지 열려 있나요?',
    answer: `요청서에 적은 날짜가 지나면 닫혀요. 진행 중인 요청은 한 번에 ${MAX_OPEN_REQUESTS_PER_USER}건까지 둘 수 있어요.`,
  },
  {
    question: '간판·인테리어처럼 큰 공사는 무엇을 챙겨야 하나요?',
    answer: '유어딜은 업체를 연결해 드리고 계약과 시공은 직접 해요. 계약 전에 사업자등록·면허, 항목별 견적서, 계약서를 꼭 받아 두세요.',
  },
  {
    question: '업체로 참여하려면 어떻게 하나요?',
    answer: `생활 요청 받기 화면에서 할 일과 지역을 고르면 돼요. 처음 등록하면 참여권 ${SIGNUP_FREE_CREDITS}장을 드리고, 손님이 요청을 취소하거나 ${UNVIEWED_REFUND_HOURS}시간 안에 견적을 한 번도 열어 보지 않으면 그 참여권을 돌려드려요.`,
  },
]
