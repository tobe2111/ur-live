// 2시간마다: 내 게시물 댓글 수집 → 분류 → 일반 댓글은 짧게 답글, 민감/불만/환불은 답글 없이 needs-owner 이슈.
// "이미 답했나·이미 올렸나"는 저장 파일이 아니라 실물로 판정한다(live.mjs 머리말):
//   답했나 = 그 댓글의 답글 중 내 계정이 있는가 · 올렸나 = needs-owner 이슈 본문에 그 댓글 ID 가 있는가.
import { DRY, log, claude, humanize, threads, insta, threadsPublish, createIssue, PARTNER_FACTS, PARTNER_LINKS, opsAlert } from './lib.mjs';
import { campaignToTrack } from './attribution.mjs';
import { myRecentPosts, myUsernames, repliesOf, findMyReplies, escalatedCommentIds, utmFromText, metaTime } from './live.mjs';

const SENSITIVE = /환불|취소|불만|최악|사기|신고|고소|위생|배탈|식중독|아팠|결제\s*오류|안\s*돼요|안돼요|연락\s*안|답변\s*없|개인정보|소비자원/;
// 이보다 오래된 댓글은 다시 보지 않는다 — 스팸은 기록이 없어 회차마다 다시 분류되므로 창을 좁게 둔다
const COMMENT_WINDOW_MS = 7 * 86400e3;

async function fetchComments(posts, own) {
  const out = [];
  const since = Date.now() - COMMENT_WINDOW_MS;
  for (const p of posts) {
    try {
      const r = p.platform === 'threads'
        ? await threads('GET', `${p.id}/replies`, { fields: 'id,text,username,timestamp' })
        : await insta('GET', `${p.id}/comments`, { fields: 'id,text,username,timestamp' });
      for (const c of r.data || []) {
        if (own.has(c.username)) continue;
        const ms = metaTime(c.timestamp);
        if (Number.isFinite(ms) && ms < since) continue;
        out.push({ platform: p.platform, id: c.id, text: c.text || '', user: c.username, post: p });
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

const TRACK_LABEL = { merchant: '사장님 입점 안내', creator: '크리에이터 파트너 안내', consumer: '소비자 딜 소개' };

async function main() {
  const own = await myUsernames();
  const posts = await myRecentPosts({ days: 14 });
  // 못 읽으면 실패시킨다(escalatedCommentIds 가 던진다) — 같은 민감 댓글로 이슈가 2시간마다 쌓이는 것보다 낫다
  const escalated = await escalatedCommentIds();
  const comments = (await fetchComments(posts, own)).filter((c) => !escalated.has(c.id));
  log(`게시물 ${posts.length}개 · 아직 이슈 안 만든 댓글 ${comments.length}개`);
  const recentReplies = [];
  let replied = 0, skipped = 0;
  for (const c of comments) {
    if (!DRY) {
      // 답글을 달기 전에 그 댓글에 내 답글이 이미 있는지 직접 본다 — 이게 "같은 댓글에 두 번" 을 막는 유일한 판정이다.
      // 조회가 실패하면 이 댓글은 건너뛴다(답을 못 단 날 < 같은 답 두 번).
      let mine;
      try { mine = findMyReplies(await repliesOf(c.platform, c.id), own); }
      catch (e) { log(`답글 확인 실패 → 이번엔 건너뜀 ${c.platform} ${c.id}: ${e.message}`); skipped++; continue; }
      recentReplies.push(...mine.mine);
      if (mine.replied) { skipped++; continue; }
    }
    const kind = await classify(c.text);
    if (kind === 'sensitive') {
      await createIssue(`[needs-owner] ${c.platform} 댓글 확인 필요 (@${c.user})`,
        `자동 답글을 달지 않았습니다. 사장님이 직접 확인해 주세요.\n\n- 플랫폼: ${c.platform}\n- 작성자: @${c.user}\n- 댓글 ID: ${c.id}\n- 게시물 ID: ${c.post.id}\n\n> ${c.text.replace(/\n/g, '\n> ')}`, ['needs-owner']);
      continue;
    }
    if (kind === 'spam') { log(`스팸 무시 ${c.id}`); continue; }
    const utm = c.platform === 'threads' ? utmFromText(c.post.text) : null;
    const track = utm ? campaignToTrack(utm.campaign) : null;
    const ctx = track ? `게시물 주제: ${TRACK_LABEL[track]}\n` : '';
    const recentR = recentReplies.slice(-8).map((r) => `- ${r}`).join('\n') || '- (없음)';
    const reply = (await humanize(await claude(`${REPLY_SYSTEM}\n\n[최근 내 답글 — 이 말투/첫마디 반복 금지]\n${recentR}`, `${ctx}@${c.user} 댓글: ${c.text}`, 220), '댓글 답글')).slice(0, 300);
    recentReplies.push(reply);
    log(`답글(${c.platform} ${c.id}): ${reply}`);
    if (c.platform === 'threads') await threadsPublish({ media_type: 'TEXT', text: reply, reply_to_id: c.id });
    else await insta('POST', `${c.id}/replies`, { message: reply });
    replied++;
  }
  log(`답글 ${replied}개 · 이미 답했거나 확인 실패로 건너뜀 ${skipped}개`);
}
main().catch(async (e) => { console.error(e.message); await opsAlert('마케팅 봇 댓글 응답 실패', e.message); process.exit(1); });
