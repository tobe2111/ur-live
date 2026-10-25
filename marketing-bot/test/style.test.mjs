// 실행: node --test test/style.test.mjs  (marketing-bot 폴더에서)
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadStyles, pickPatterns, referenceStyleBlock, keepsFacts, deAi } from '../src/style.mjs';

test('참고 스타일 파일은 패턴마다 hook/how/example 이 있다', () => {
  const s = loadStyles();
  assert.ok(s.patterns.length >= 5);
  for (const p of s.patterns) assert.ok(p.id && p.hook && p.how && p.example);
});

test('패턴은 겹치지 않게 n개만 뽑힌다', () => {
  const ps = pickPatterns(3, () => 0.42);
  assert.equal(ps.length, 3);
  assert.equal(new Set(ps.map((p) => p.id)).size, 3);
  assert.match(referenceStyleBlock(2, () => 0.1), /피할 것/);
});

const draft = '등록비 0원이에요! 지금 바로 확인해 보세요!! 🎉🎉\nhttps://urdeal.kr/p?utm_source=ig&utm_campaign=a #유어딜';

test('deAi: 링크·숫자·해시태그가 그대로면 다듬은 글을 쓴다', async () => {
  const out = await deAi(draft, '게시글', async () => '등록비는 0원이에요. 조건은 링크에 있어요.\nhttps://urdeal.kr/p?utm_source=ig&utm_campaign=a #유어딜');
  assert.match(out, /^등록비는 0원이에요\./);
});

test('deAi: UTM 이 바뀌거나 숫자가 빠지면 초안 유지', async () => {
  assert.equal(await deAi(draft, 'x', async () => '등록비 0원. https://urdeal.kr/p #유어딜'), draft);
  assert.equal(await deAi(draft, 'x', async () => '등록비 없어요. https://urdeal.kr/p?utm_source=ig&utm_campaign=a #유어딜'), draft);
});

test('deAi: 오류·빈 응답이면 초안 유지', async () => {
  assert.equal(await deAi(draft, 'x', async () => { throw new Error('500'); }), draft);
  assert.equal(await deAi(draft, 'x', async () => ''), draft);
  assert.ok(keepsFacts('a 1', 'b 1') && !keepsFacts('a 1', 'b 2'));
});
