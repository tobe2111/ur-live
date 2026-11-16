import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { replyIntent, replyLink, linkInstruction, replyProblems } from '../src/reply-intent.mjs';
import { PARTNER_FACTS } from '../src/lib.mjs';

test('댓글 뜻: 말이 게시물 트랙보다 우선, 신청·링크 요청을 잡는다', () => {
  assert.deepEqual(replyIntent('저희 가게도 입점하려면 어디서 신청해요?', 'consumer'), { who: 'merchant', action: true });
  assert.deepEqual(replyIntent('블로그 하는데 협업 가능할까요', null), { who: 'creator', action: false });
  assert.deepEqual(replyIntent('좋네요', 'creator'), { who: 'creator', action: false });
  assert.deepEqual(replyIntent('여기 맛있어요?', null), { who: 'consumer', action: false });
});

test('링크: 신청 요청이면 바로 등록·신청 페이지, 아니면 안내, 전부 UTM', () => {
  const d = '20261116';
  const a = replyLink({ who: 'merchant', action: true }, { platform: 'threads', commentId: '17999123456789', date: d });
  assert.match(a, /^https:\/\/urdeal\.kr\/store\/new\?/);
  assert.match(a, /utm_campaign=merchant-recruit/);
  assert.match(a, /utm_content=reply-23456789-20261116/);
  assert.match(replyLink({ who: 'creator', action: false }, { platform: 'instagram', commentId: 'x', date: d }), /\/creators\?.*utm_source=instagram/);
  assert.match(replyLink({ who: 'consumer', action: false }, { platform: 'threads', commentId: 'x', productUrl: 'https://urdeal.kr/pass/12', date: d }), /\/pass\/12\?.*consumer-deal/);
});

test('검수: 다른 주소·인스타 주소·없는 숫자를 막고, 멀쩡한 답글은 통과', () => {
  const link = 'https://urdeal.kr/store/new?utm_content=reply-1';
  assert.deepEqual(replyProblems(`등록은 10분이면 돼요. 여기서 바로 하실 수 있어요 ${link}`, { platform: 'threads', link, facts: PARTNER_FACTS }), []);
  assert.ok(replyProblems('여기로 오세요 https://evil.example/x', { platform: 'threads', link, facts: PARTNER_FACTS }).some((p) => /주어진 링크가 아닌/.test(p)));
  assert.ok(replyProblems(`프로필에 있어요 ${link}`, { platform: 'instagram', link, facts: PARTNER_FACTS }).some((p) => /인스타 댓글에 주소/.test(p)));
  assert.ok(replyProblems('수수료는 3%예요', { platform: 'instagram', link, facts: PARTNER_FACTS }).some((p) => /확인되지 않은 숫자/.test(p)));
  assert.match(linkInstruction('instagram', link), /프로필 링크/);
});

test('배선: 답글은 검수를 거치고, 두 번 걸리면 올리지 않는다', () => {
  const src = fs.readFileSync(new URL('../src/reply-comments.mjs', import.meta.url), 'utf8');
  const vet = src.indexOf('problems = replyProblems(reply, vetCtx)'), pub = src.indexOf("threadsPublish({ media_type: 'TEXT', text: reply");
  assert.ok(vet > 0 && pub > vet);
  assert.match(src, /답글 검수 두 번 실패 → 이번엔 안 올림.*skipped\+\+; continue; \}/);
});
