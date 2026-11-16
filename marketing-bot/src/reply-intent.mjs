// 댓글 답글 2.0 (2026-11-16 대표 "계속 개선해줘").
// 진단: ① 답글이 검수 없이 바로 올라갔다(글은 vetPost 를 거치는데 답글만 빠져 있었다 — 없는 숫자·약속이 그대로 나갈 수 있었다)
//       ② "어디서 신청해요?·링크 주세요" 같은 댓글에도 늘 안내 페이지만 걸었고, 그 링크에 UTM 이 없어 댓글로 온 가입을 셀 수 없었다
//       ③ 인스타 댓글엔 링크가 눌리지 않는데 링크를 적었다.
// 처방: 댓글 뜻을 먼저 가르고(사장님 문의·크리에이터 문의·신청/링크 요청·손님) → 맞는 페이지 하나를 UTM 붙여 넣고 →
//       검수(vetPost + 링크 검사) 통과한 답글만 올린다. 한 번 고쳐 써도 안 되면 올리지 않는다(나쁜 답글 < 늦은 답글).
import { PARTNER_LINKS } from './lib.mjs';
import { buildUtmLink, DEFAULT_CAMPAIGNS } from './attribution.mjs';
import { vetPost } from './vet.mjs';

const MERCHANT_RE = /사장|가게|매장|식당|카페|미용실|샵|입점|수수료|정산|등록|운영/;
const CREATOR_RE = /협업|인플루언서|블로그|블로거|크리에이터|유튜브|소개\s*파트너|파트너|유어샵|체험단|제휴/;
const ACTION_RE = /링크|주소|어디서|어디로|신청|가입|등록|하고\s*싶|해\s*보고|하려면|방법|어떻게\s*(해|하)/;

// track = 그 게시물의 트랙(있으면). 댓글 말이 트랙보다 우선한다(손님 글에 사장님이 묻기도 한다).
export function replyIntent(text = '', track = null) {
  const t = String(text);
  const who = MERCHANT_RE.test(t) ? 'merchant' : CREATOR_RE.test(t) ? 'creator' : track === 'merchant' || track === 'creator' ? track : 'consumer';
  return { who, action: ACTION_RE.test(t) };
}

// 답글에 넣을 링크 하나. 신청·링크를 바라면 바로 등록/신청 페이지, 아니면 안내 페이지. 손님은 게시물 상품 링크(없으면 홈).
export function replyLink({ who, action }, { platform, commentId, productUrl = null, date }) {
  const url = who === 'merchant' ? (action ? PARTNER_LINKS.merchantSignup : PARTNER_LINKS.merchant)
    : who === 'creator' ? (action ? PARTNER_LINKS.creatorApply : PARTNER_LINKS.creator)
    : productUrl || PARTNER_LINKS.home;
  const campaign = who === 'merchant' ? DEFAULT_CAMPAIGNS.merchant : who === 'creator' ? DEFAULT_CAMPAIGNS.creator : DEFAULT_CAMPAIGNS.consumer;
  return buildUtmLink(url, { platform, campaign, contentId: `reply-${String(commentId).slice(-8)}`, date });
}

// 지시문 한 줄: 스레드는 링크를 그대로 붙이고, 인스타(댓글 링크가 안 눌린다)는 프로필 링크로 안내한다.
export function linkInstruction(platform, link) {
  return platform === 'threads'
    ? `[답글에 넣을 링크] 이 링크 하나만 그대로 끝에 붙인다(다른 주소 금지): ${link}`
    : '[링크] 인스타 댓글은 링크가 눌리지 않는다. 주소를 적지 말고 "프로필 링크에서 보실 수 있어요"처럼 안내한다.';
}

export function replyProblems(reply, { platform, link, facts = '', recent = [] }) {
  const p = vetPost(reply, { facts, recent, minLen: 5, maxLen: 300, maxParas: 2 });
  const urls = String(reply).match(/https?:\/\/\S+/g) || [];
  if (platform === 'threads') { for (const u of urls) if (u !== link) p.push(`주어진 링크가 아닌 주소: ${u.slice(0, 60)}`); }
  else if (urls.length) p.push('인스타 댓글에 주소를 적었다(눌리지 않는다)');
  return p;
}
