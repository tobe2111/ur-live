import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { repeatProblems, threadsPrompt, THREADS_FORMATS } from '../src/threads-angle.mjs';

test('최근 3개 중 2개에 쓴 "0원" 을 또 쓰면 반려', () => {
  const recent = ['가입비 0원이에요', '수수료 5%만', '처음 0원으로 시작'];
  const p = repeatProblems('오늘도 0원으로 시작하세요', recent, '사진 3장이면 등록 끝');
  assert.equal(p.length, 1);
  assert.match(p[0], /0원/);
});

test('오늘 주제가 그 사실이면 허용', () => {
  const recent = ['가입비 0원', '0원 시작', '0원'];
  assert.deepEqual(repeatProblems('가입비 0원입니다', recent, '가입비 0원'), []);
});

test('한 번만 썼으면 통과', () => {
  assert.deepEqual(repeatProblems('수수료 5%', ['수수료 5%', '사진 이야기', '노쇼 이야기'], ''), []);
});

test('프롬프트에 오늘 주제와 형식이 들어간다', () => {
  const f = THREADS_FORMATS.find((x) => x.id === 'myth');
  const s = threadsPrompt({ info: '[확인된 사실]', topic: '정산은 다음 주', format: f, len: '3~4문장' });
  assert.match(s, /정산은 다음 주/);
  assert.match(s, /흔한 오해/);
  assert.match(s, /이 사실 하나만/);
});

test('daily-post 가 반복 검사와 형식 기록을 쓴다', () => {
  const src = fs.readFileSync(new URL('../src/daily-post.mjs', import.meta.url), 'utf8');
  assert.match(src, /repeatProblems\(/);
  assert.match(src, /tformat/);
  const learn = fs.readFileSync(new URL('../src/learn.mjs', import.meta.url), 'utf8');
  assert.match(learn, /'tformat'/);
});
