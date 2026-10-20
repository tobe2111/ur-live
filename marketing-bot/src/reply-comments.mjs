// 2시간마다: 내 게시물 댓글 수집 → 분류 → 일반 댓글은 짧게 답글, 민감/불만/환불은 답글 없이 needs-owner 이슈.
import { DRY, log, readJson, writeJson, claude, humanize, threads, insta, createIssue, THREADS_USER_ID, PARTNER_FACTS, PARTNER_LINKS , opsAlert } from './lib.mjs';

const posts = readJson('data/posts.json', []);
const state = readJson('data/comments.json', { replied: [], escalated: [] });
state.recent_replies ||= [];
const seen = new Set([...state.replied, ...state.escalated]);
const cutoff = Date.now() - 14 * 86400e3;
const recent = posts.filter((p) => p.id && !p.dry && !p.skipped && Date.parse(p.posted_at) > cutoff);
const SENSITIVE = /환불|취소|불만|최악|사기|신고|고소|위생|배탈|식중독|아팠|결제\s*오류|안\s*돼요|안돼요|연락\s*안|답변\s*없|개인정보|소비자원/;

async function fetchComments() {
  const out = [];
  for (const p of recent) {
    try {
      if (p.platform === 'threads') {
        const r = await threads('GET', `${p.id}/replies`, { fields: 'id,text,username,timestamp' });
        for (const c of r.data || []) if (c.username !== 'urdeal_official') out.push({ platform: 'threads', id: c.id, text: c.text || '', user: c.username, post: p });
      } else {
        const r = await insta('GET', `${p.id}/comments`, { fields: 'id,text,username,timestamp' });
        for (const c of r.data || []) if (c.username !== 'urdeal_official') out.push({ platform: 'instagram', id: c.id, text: c.text || '', user: c.username, post: p });
      }
    } catch (e) { log(`댓글 조회 실패 ${p.platform} ${p.id}: ${e.message}`); }
  }
  if (DRY) out.push({ platform: 'threads', id: 'dry-c1', text: '여기 맛있어요?', user: 'sample', post: { id: 'x' } }, { platform: 'threads', id: 'dry-c3', text: '저희 가게도 입점하려면 수수료가 얼마예요?', user: 'owner_sample', post: { id: 'x' } }, { platform: 'threads', id: 'dry-c2', text: '환불 어떻게 해요? 답변이 없네요', user: 'sample2', post: { id: 'x' } });
  return out;
}

const REPLY_SYSTEM = `너는 유어딜 운영자 본인이다. 내 게시물에 달린 댓글에 운영자가 폰으로 직접 답하듯 짧게(보통 1문장, 길어야 2문장) 답한다. 고객인 척, 제3자인 척 절대 금지.
- 댓글 내용을 콕 집어 반응한다. "소중한 댓글 감사합니다", "좋은 하루 되세요", "많은 관심 부탁드려요" 같은 템플릿 문구 금지.
- 편한 존댓말(~요). 이모지 0~1개, 해시태그 금지, 느낌표 최대 1개. 같은 표현 반복 금지 — 아래 [최근 내 답글]과 다른 말로 시작한다.
- 사장님(가게 운영자)의 입점·수수료·정산·등록 문의: 아래 [확인된 사실] 범위에서만 짧게 답하고 입점 안내 ${PARTNER_LINKS.merchant} 를 안내한다. 사실에 없는 조건(특별 수수료, 노출 보장, 방문자 수, 계약 기간 등)은 약속하지 말고 "카카오 채널로 물어봐 주시면 정확히 안내드릴게요"로 넘긴다.
- 인플루언서·크리에이터의 협업·소개 파트너 문의: 사실 범위에서 답하고 ${PARTNER_LINKS.creator} 를 안내한다. 수익 금액을 약속하지 않는다.
- 손님 문의: 모르는 사실(재고, 가격 변경, 영업시간)은 지어내지 말고 상품 페이지 확인을 안내.

[확인된 사실]
${PARTNER_FACTS}`;

async function classify(text) {
  if (SENSITIVE.test(text)) return 'sensitive';
  const r = await claude('댓글을 분류한다. 출력은 normal, sensitive, spam 중 한 단어만. 불만/환불/결제/건강/법적/개인정보/공격적 내용은 sensitive.', text, 5);
  const w = r.toLowerCase();
  return w.includes('sensitive') ? 'sensitive' : w.includes('spam') ? 'spam' : 'normal';
}

async function main() {
  const comments = (await fetchComments()).filter((c) => !seen.has(c.id));
  log(`새 댓글 ${comments.length}개`);
  for (const c of comments) {
    const kind = await classify(c.text);
    if (kind === 'sensitive') {
      await createIssue(`[needs-owner] ${c.platform} 댓글 확인 필요 (@${c.user})`,
        `자동 답글을 달지 않았습니다. 사장님이 직접 확인해 주세요.\n\n- 플랫폼: ${c.platform}\n- 작성자: @${c.user}\n- 댓글 ID: ${c.id}\n- 게시물 ID: ${c.post.id}\n\n> ${c.text.replace(/\n/g, '\n> ')}`, ['needs-owner']);
      state.escalated.push(c.id);
      continue;
    }
    if (kind === 'spam') { state.replied.push(c.id); log(`스팸 무시 ${c.id}`); continue; }
    const ctx = c.post.track ? `게시물 주제: ${c.post.track === 'merchant' ? '사장님 입점 안내' : c.post.track === 'creator' ? '크리에이터 파트너 안내' : '소비자 딜 소개'}\n` : '';
    const recentR = state.recent_replies.slice(-8).map((r) => `- ${r}`).join('\n') || '- (없음)';
    const reply = (await humanize(await claude(`${REPLY_SYSTEM}\n\n[최근 내 답글 — 이 말투/첫마디 반복 금지]\n${recentR}`, `${ctx}@${c.user} 댓글: ${c.text}`, 220), '댓글 답글')).slice(0, 300);
    state.recent_replies = [...state.recent_replies, reply].slice(-20);
    log(`답글(${c.platform} ${c.id}): ${reply}`);
    if (c.platform === 'threads') {
      const cr = await threads('POST', `${THREADS_USER_ID}/threads`, { media_type: 'TEXT', text: reply, reply_to_id: c.id });
      await threads('POST', `${THREADS_USER_ID}/threads_publish`, { creation_id: cr.id });
    } else {
      await insta('POST', `${c.id}/replies`, { message: reply });
    }
    state.replied.push(c.id);
  }
  if (!DRY) writeJson('data/comments.json', state);
}
main().catch(async (e) => { console.error(e.message); await opsAlert('마케팅 봇 댓글 응답 실패', e.message); process.exit(1); });
