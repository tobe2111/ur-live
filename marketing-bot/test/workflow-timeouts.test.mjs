import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const yml = fs.readFileSync(new URL('../../.github/workflows/sns-daily-post.yml', import.meta.url), 'utf8');
const step = (name) => yml.split(/\n      - /).find((s) => s.includes(name)) || '';

// 2026-11-18: 준비 단계가 15분 멈춰 그날 인스타가 빠졌다. 준비 단계는 짧게 끊고 게시로 넘어가야 한다.
test('준비 단계(이미지 도구·카드 렌더러)는 단계 시간 상한과 continue-on-error 를 함께 가진다', () => {
  for (const n of ['Image tools', 'Card renderer']) {
    const s = step(n);
    assert.match(s, /timeout-minutes: [1-5]\n/, `${n} 단계 시간 상한`);
    assert.match(s, /continue-on-error: true/, `${n} 실패해도 계속`);
  }
});

test('이미지 도구의 바깥 호출(pip·apt·curl)은 각자 시간 상한이 있다', () => {
  const s = step('Image tools');
  assert.match(s, /timeout \d+ python3 -m pip/);
  assert.match(s, /timeout \d+ sudo apt-get update/);
  assert.match(s, /curl [^\n]*--max-time \d+/);
});

test('그날 마지막 안전망 회차(23:41 KST)가 있다', () => {
  assert.match(yml, /cron: '41 14 \* \* \*'/);
});
