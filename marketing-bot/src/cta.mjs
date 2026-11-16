// 모집 문구 2.0 (2026-11-16 대표 "계속 개선해줘").
// 진단: 사장님 글은 늘 같은 끝 문장("입점 안내는 urdeal.kr/partners 에서…")에 같은 안내 페이지로만 보냈다.
//       크리에이터도 마찬가지(/creators). 바로 등록·신청 페이지(/store/new, /creators/apply)로 보내 본 적이 없어
//       "읽고 끝" 과 "바로 해 보기" 중 어느 쪽이 가입으로 이어지는지 알 수 없었다.
// 처방: 트랙마다 끝 문장 + 링크 대상을 몇 가지로 두고 돌리며 성과로 학습(learn.mjs 'cta').
//       문구는 lib.mjs PARTNER_FACTS 안의 사실만 쓴다(10분 등록·초안 대신 만들어 드림·카카오 1분 등).
import { PARTNER_LINKS } from './lib.mjs';

export const CTA_VARIANTS = {
  merchant: [
    { id: 'guide', target: PARTNER_LINKS.merchant, text: '입점 조건은 urdeal.kr/partners 에 다 적어 뒀어요' },
    { id: 'signup', target: PARTNER_LINKS.merchantSignup, text: '등록은 10분이면 끝나요. urdeal.kr/store/new 에서 바로 시작할 수 있어요' },
    { id: 'draft', target: PARTNER_LINKS.merchantSignup, text: '첫 이용권 초안은 저희가 만들어 드려요. 가게만 등록해 주세요' },
    { id: 'ask', target: PARTNER_LINKS.merchant, text: '궁금한 건 카카오 채널로 편하게 물어봐 주세요' },
  ],
  creator: [
    { id: 'guide', target: PARTNER_LINKS.creator, text: '소개 파트너 안내는 urdeal.kr/creators 에 있어요' },
    { id: 'apply', target: PARTNER_LINKS.creatorApply, text: '카카오 로그인 1분이면 내 유어샵이 생겨요. urdeal.kr/creators/apply' },
    { id: 'try', target: PARTNER_LINKS.creatorApply, text: '시작 비용 0원이니 유어샵부터 만들어 보세요' },
  ],
};

export function ctaFor(track, id) {
  const list = CTA_VARIANTS[track];
  if (!list) return null;
  return list.find((c) => c.id === id) || list[0];
}
