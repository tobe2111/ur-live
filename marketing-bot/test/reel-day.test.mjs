import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pickReelDay } from '../src/learn.mjs';

test('릴스 날: 월요일·강제는 늘 릴스, 직전 두 번이 릴스면 캐러셀', () => {
  assert.equal(pickReelDay({ dow: 1 }), true);
  assert.equal(pickReelDay({ dow: 3, forced: true, lastIgMedia: ['reel', 'reel'] }), true);
  assert.equal(pickReelDay({ dow: 5, lastIgMedia: ['carousel', 'reel', 'reel'] }), false);
});

test('릴스 날: 수·금은 성과로 — 릴스가 확실히 앞서면 대부분 릴스, 뒤지면 대부분 캐러셀', () => {
  const good = { reel: { mean: 1.9, n: 20 }, carousel: { mean: 0.7, n: 20 } };
  const bad = { reel: { mean: 0.6, n: 20 }, carousel: { mean: 1.5, n: 20 } };
  const share = (arms) => Array.from({ length: 200 }, (_, i) => pickReelDay({ dow: 3, mediaArms: arms, lastIgMedia: ['carousel'], seed: i })).filter(Boolean).length / 200;
  assert.ok(share(good) > 0.8);
  assert.ok(share(bad) < 0.2);
});

test('배선: 학습 기록에 스레드 형식·CTA 가 남는다(빠지면 그 둘은 영영 못 배운다)', () => {
  const src = fs.readFileSync(new URL('../src/daily-post.mjs', import.meta.url), 'utf8');
  const save = src.slice(src.indexOf("writeJson('data/variety.json'"));
  assert.match(save.slice(0, 600), /topic_tag, tformat, cta \}\)\)/);
  assert.match(src, /const reelDay = pickReelDay\(/);
});
