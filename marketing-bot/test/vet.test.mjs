// 실행: node --test test/vet.test.mjs  (marketing-bot 폴더에서)
import test from 'node:test';
import assert from 'node:assert/strict';
import { vetPost, similarity } from '../src/vet.mjs';
import { PARTNER_FACTS } from '../src/lib.mjs';

const ctx = { facts: PARTNER_FACTS };
const GOOD = `사장님, 광고비 걱정 많으시죠. 유어딜은 가입비·월 이용료·광고비가 0원이고, 이용권이 팔려서 손님이 실제로 쓴 뒤에만 수수료를 받습니다. 직접 입점이면 수수료 10%, 사장님 몫은 90%예요. 카드 수수료는 유어딜이 냅니다. 등록은 10분 정도면 끝나요.`;

test('정상 글은 통과한다(사실에 있는 숫자만)', () => {
  assert.deepEqual(vetPost(GOOD, ctx), []);
});

test('빈 글·너무 짧은 글은 막는다', () => {
  assert.ok(vetPost('', ctx).some((p) => p.includes('짧다')));
  assert.ok(vetPost('좋아요 https://urdeal.kr/partners', ctx).some((p) => p.includes('짧다')));
});

test('지어낸 숫자를 막는다', () => {
  const p = vetPost(GOOD + ' 지금 등록하면 수수료 3%!', ctx);
  assert.ok(p.some((x) => x.includes('"3%"')), p.join(' | '));
});

test('금지 표현·성과 약속을 막는다', () => {
  assert.ok(vetPost(GOOD + ' 업계 최저 수수료입니다.', ctx).some((p) => p.includes('업계 최저')));
  assert.ok(vetPost(GOOD + ' 입점 후 매출 30% 증가했어요.', ctx).some((p) => p.includes('약속')));
});

test('이모지·느낌표 남발을 막는다', () => {
  assert.ok(vetPost(GOOD + ' 🎉🎉🔥', ctx).some((p) => p.includes('이모지')));
  assert.ok(vetPost(GOOD + ' 꼭 보세요!!', ctx).some((p) => p.includes('느낌표')));
});

test('최근 글과 거의 같은 글을 막는다', () => {
  assert.ok(similarity(GOOD, GOOD) > 0.99);
  assert.ok(vetPost(GOOD, { ...ctx, recent: [GOOD + ' 감사합니다.'] }).some((p) => p.includes('최근 글')));
  assert.deepEqual(vetPost(GOOD, { ...ctx, recent: ['크리에이터 여러분, 내 유어샵에 동네 딜을 담아 보세요. 시작 비용은 없습니다.'] }), []);
});

test('상품 가격이 없는 소비자 글에서 가격을 지어내면 막는다', () => {
  const p = vetPost('달빛한스푼 닭도리탕, 제가 직접 먹어 보고 고른 집입니다. 퇴근길에 둘이 가기 좋아요. 지금 12,900원에 드려요.', { facts: '상품: 달빛한스푼 닭도리탕 (https://urdeal.kr/pass/2919)' });
  assert.ok(p.some((x) => x.includes('12,900원')), p.join(' | '));
});

import fs from 'node:fs';
test('게시 흐름이 검수를 거친다(두 플랫폼 모두, 게시 호출보다 먼저)', () => {
  const src = fs.readFileSync(new URL('../src/daily-post.mjs', import.meta.url), 'utf8');
  const th = src.indexOf("writeVetted(`${info}\\nThreads"), thPost = src.indexOf("threadsPublish({ media_type: 'TEXT', text })"); // 게시 호출은 lib.threadsPublish 로 옮겨갔다
  const ig = src.indexOf("writeVetted(`${info}\\n인스타그램"), igPost = src.indexOf('igPublish(media');
  assert.ok(th > 0 && thPost > th, 'Threads 는 검수 뒤에 게시');
  assert.ok(ig > 0 && igPost > ig, 'Instagram 은 검수 뒤에 게시');
  const main = src.slice(src.indexOf('async function main'));
  assert.equal((main.match(/if \(problems\.length\) \{/g) || []).length, 2, '두 곳 모두 걸리면 게시하지 않는다');
  assert.match(src, /if \(qualityError\) throw qualityError/);
});
