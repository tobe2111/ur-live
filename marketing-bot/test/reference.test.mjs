// 실행: node --test test/reference.test.mjs  (marketing-bot 폴더에서)
import test from 'node:test';
import assert from 'node:assert/strict';
import { topPosts, parsePatterns, copiesSource } from '../src/reference-accounts.mjs';
import { mergeLearned } from '../src/style.mjs';

test('상위 게시물은 팔로워 대비 반응순, 계정당 최대 2개', () => {
  const accounts = [
    { username: 'big', followers_count: 100000, posts: [{ caption: 'a', like_count: 1000 }, { caption: 'b', like_count: 900 }, { caption: 'c', like_count: 800 }] },
    { username: 'small', followers_count: 1000, posts: [{ caption: 'd', like_count: 50, comments_count: 10 }] },
    { username: 'bad', error: 'x' },
  ];
  const t = topPosts(accounts);
  assert.equal(t[0].account, 'small');
  assert.equal(t.filter((p) => p.account === 'big').length, 2);
});

test('원문을 옮긴 예시는 버린다', () => {
  const caps = ['오늘 점심 피크에 노쇼가 세 건이나 났어요'];
  assert.ok(copiesSource('점심 피크에 노쇼가 세 건', caps));
  const out = parsePatterns('```json\n[{"id":"x","hook":"h","how":"w","example":"점심 피크에 노쇼가 세 건"},{"id":"y","hook":"h","how":"w","example":"비 오는 날엔 배달이 먼저 움직여요"}]\n```', caps);
  assert.deepEqual(out.map((p) => p.id), ['learned-y']);
  assert.deepEqual(parsePatterns('no json', caps), []);
});

test('학습 패턴은 30일 안에만 섞인다', () => {
  const base = { patterns: [{ id: 'a', hook: 'h', how: 'w', example: 'e' }] };
  const learned = { updated_at: '2026-10-20T00:00:00Z', patterns: [{ id: 'learned-b', hook: 'h', how: 'w', example: 'e' }] };
  assert.equal(mergeLearned(base, learned, Date.parse('2026-10-25')).patterns.length, 2);
  assert.equal(mergeLearned(base, learned, Date.parse('2026-12-25')).patterns.length, 1);
});
