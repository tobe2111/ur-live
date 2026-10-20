// 실행: node --test test/claude-body.test.mjs  (marketing-bot 폴더에서)
// 2026-10-19 빈 글 사고: 모델의 기본 '생각'이 작은 max_tokens 를 다 써 본문이 0자였다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { claudeBody } from '../src/lib.mjs';

test('Sonnet 5.5 는 thinking 을 between_tools 로 끈다 (disabled 는 400)', () => {
  delete process.env.CLAUDE_MODEL;
  const b = claudeBody('s', 'u', 600);
  assert.equal(b.model, 'claude-sonnet-5-5');
  assert.deepEqual(b.thinking, { type: 'between_tools' });
});

test('max_tokens 는 생각이 다 쓰지 못할 만큼 넉넉하다', () => {
  assert.ok(claudeBody('s', 'u', 5).max_tokens >= 4000);
  assert.ok(claudeBody('s', 'u', 600).max_tokens >= 4000);
});

test('between_tools 를 못 받는 모델에는 보내지 않는다', () => {
  process.env.CLAUDE_MODEL = 'claude-opus-5-5';
  const b = claudeBody('s', 'u', 600);
  assert.equal(b.thinking, undefined);
  delete process.env.CLAUDE_MODEL;
});

import { threadsText } from '../src/lib.mjs';
const LINK = 'https://urdeal.kr/partners?utm_source=threads&utm_medium=social&utm_campaign=merchant-recruit&utm_content=th-001-20261020';

test('Threads 글은 500자 안이고 링크는 절대 잘리지 않는다', () => {
  const t = threadsText('가'.repeat(399) + '.', LINK);
  assert.ok(t.length <= 500, `길이 ${t.length}`);
  assert.ok(t.endsWith(LINK));
});

test('긴 본문은 문장 끝에서 자른다', () => {
  const body = ('사장님 가게를 유어딜에 올려 보세요. ').repeat(30);
  const t = threadsText(body, LINK);
  assert.ok(t.length <= 500 && t.endsWith(LINK));
  assert.match(t.split('\n\n')[0], /\.$/);
});

test('짧은 본문은 그대로 둔다', () => {
  assert.equal(threadsText('짧은 글', LINK), `짧은 글\n\n${LINK}`);
});
