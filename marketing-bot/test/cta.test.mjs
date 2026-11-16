import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CTA_VARIANTS, ctaFor } from '../src/cta.mjs';
import { PARTNER_LINKS } from '../src/lib.mjs';

test('모집 끝 문장: 트랙마다 안내 페이지와 바로 등록·신청 페이지를 둘 다 시험한다', () => {
  const m = CTA_VARIANTS.merchant.map((c) => c.target);
  assert.ok(m.includes(PARTNER_LINKS.merchant) && m.includes(PARTNER_LINKS.merchantSignup));
  const c = CTA_VARIANTS.creator.map((x) => x.target);
  assert.ok(c.includes(PARTNER_LINKS.creator) && c.includes(PARTNER_LINKS.creatorApply));
  assert.equal(CTA_VARIANTS.consumer, undefined, '손님 딜 글은 상품 링크 그대로');
});

test('끝 문장은 확인된 사실만 쓴다(수익·방문자 약속 없음)', () => {
  for (const v of Object.values(CTA_VARIANTS).flat()) {
    assert.doesNotMatch(v.text, /보장|만원 벌|매출 \d|방문자 \d|업계 최저|자동 승인/);
    assert.ok(v.text.length <= 60, v.text);
  }
});

test('ctaFor: 없는 id 는 첫 번째로', () => {
  assert.equal(ctaFor('merchant', 'nope').id, 'guide');
  assert.equal(ctaFor('consumer', 'x'), null);
});

test('배선: 고른 끝 문장이 링크 대상이 되고, 기록·학습에 남는다', () => {
  const src = fs.readFileSync(new URL('../src/daily-post.mjs', import.meta.url), 'utf8');
  assert.match(src, /url: cta\?\.target \|\| T\.target/);
  assert.match(src, /exclude: \[lastCta\]/);
  assert.equal((src.match(/cta: ctaKey \|\| undefined/g) || []).length, 2, '스레드·인스타 기록 둘 다');
  assert.match(fs.readFileSync(new URL('../src/learn.mjs', import.meta.url), 'utf8'), /'cta'\]/);
});

import { withClicks, rewards } from '../src/learn.mjs';
test('학습 점수: 스레드 링크 클릭을 크게 얹는다(같은 utm_content)', () => {
  const rows = [
    { id: 'a', platform: 'threads', link: 'https://urdeal.kr/store/new?utm_content=th-20261116', metrics: { score: 100 } },
    { id: 'b', platform: 'threads', link: 'https://urdeal.kr/partners?utm_content=th-20261115', metrics: { score: 100 } },
    { id: 'c', platform: 'instagram', metrics: { score: 100 } },
  ];
  const out = withClicks(rows, { 'https://urdeal.kr/store/new?utm_source=threads&utm_content=th-20261116': 2 });
  assert.equal(out[0].metrics.score, 160);
  assert.equal(out[1].metrics.score, 100);
  assert.equal(withClicks(rows, null), rows, '클릭을 못 읽으면 그대로');
  const rw = rewards(out);
  assert.ok(rw.get('a') > rw.get('b'));
  const src = fs.readFileSync(new URL('../src/weekly-review.mjs', import.meta.url), 'utf8');
  assert.match(src, /rewards\(withClicks\(rows, clicks\)\)/);
});
