import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { momentFor, seasonBlock, MOMENTS } from '../src/season.mjs';

const kst = (s) => new Date(`${s}T09:00:00Z`); // getUTC* 를 KST 값으로 쓰는 약속

test('시기: 날짜·트랙에 맞는 장면을 고르고, 안 맞으면 비운다', () => {
  assert.equal(momentFor(kst('2026-11-16'), 'merchant').moment, '연말 모임 예약이 슬슬 잡히는 때');
  assert.equal(momentFor(kst('2026-11-08'), 'consumer').moment, '빼빼로데이 앞둔 주');
  assert.equal(momentFor(kst('2026-11-08'), 'merchant').moment, null);
  assert.equal(momentFor(kst('2026-11-16'), 'merchant').season, '가을');
  assert.equal(momentFor(kst('2026-11-16'), null).day, '한 주가 시작되는 월요일');
});

test('시기: 해마다 바뀌는 날(설·추석·수능)은 넣지 않는다', () => {
  for (const [, , scene] of MOMENTS) assert.doesNotMatch(scene, /설날|추석|수능/);
});

test('시기 블록: 매출·손님 증가를 말하지 말라는 규칙이 같이 간다', () => {
  const b = seasonBlock(kst('2026-12-05'), 'merchant');
  assert.match(b, /연말 회식·송년회 시즌/);
  assert.match(b, /매출이 오른다 같은 말은 하지 않는다/);
});

test('배선: 인스타 프롬프트와 스레드 예시 블록 둘 다 시기를 받는다', () => {
  const src = fs.readFileSync(new URL('../src/daily-post.mjs', import.meta.url), 'utf8');
  assert.ok((src.match(/seasonBlock\(k, track\)/g) || []).length >= 2);
});
