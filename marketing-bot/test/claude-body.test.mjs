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
