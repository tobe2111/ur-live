import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUtmLink, pickTrackByWeights, adjustWeights, categoryPerformance, DEFAULT_BOUNDS, TRACKS } from '../src/attribution.mjs';

test('UTM link is unique per post', () => {
  const a = new URL(buildUtmLink('https://urdeal.kr/partners', { platform: 'threads', campaign: 'merchant-recruit', contentId: 'th-1', date: '20261019' }));
  assert.equal(a.searchParams.get('utm_source'), 'threads');
  assert.equal(a.searchParams.get('utm_medium'), 'social');
  assert.equal(a.searchParams.get('utm_campaign'), 'merchant-recruit');
  assert.equal(a.searchParams.get('utm_content'), 'th-1-20261019');
  const b = buildUtmLink('https://urdeal.kr/partners', { platform: 'instagram', campaign: 'merchant-recruit', contentId: 'ig-1', date: '20261019' });
  assert.notEqual(a.toString(), b);
});

test('pickTrackByWeights follows weights long-run', () => {
  const c = { merchant: 0, creator: 0, consumer: 0 };
  for (let i = 0; i < 1000; i++) c[pickTrackByWeights(i, { merchant: 60, creator: 25, consumer: 15 })]++;
  assert.ok(Math.abs(c.merchant - 600) < 30 && Math.abs(c.creator - 250) < 30 && Math.abs(c.consumer - 150) < 30);
});

test('adjustWeights moves toward best, stays bounded, sums 100', () => {
  const perf = { merchant: { posts: 4, clicks: 1, signups: 0 }, creator: { posts: 3, clicks: 50, signups: 2 }, consumer: { posts: 2, clicks: 2, signups: 0 } };
  let w = { merchant: 60, creator: 25, consumer: 15 };
  for (let i = 0; i < 20; i++) w = adjustWeights(w, perf).weights;
  for (const t of TRACKS) assert.ok(w[t] >= DEFAULT_BOUNDS[t][0] && w[t] <= DEFAULT_BOUNDS[t][1], t);
  assert.equal(w.creator, 35);
  assert.equal(TRACKS.reduce((s, t) => s + w[t], 0), 100);
});

test('adjustWeights holds with too little data', () => {
  const r = adjustWeights({ merchant: 60, creator: 25, consumer: 15 }, { merchant: { posts: 1 }, creator: {}, consumer: {} });
  assert.equal(r.changed, false);
  assert.deepEqual(r.weights, { merchant: 60, creator: 25, consumer: 15 });
});

test('categoryPerformance maps UTM rows to category conversions', () => {
  const perf = categoryPerformance({ posts: [{ track: 'merchant' }], utmRows: [
    { campaign: 'merchant-recruit', landings: 3, signups: 1, store_applies: 2, creator_applies: 0 },
    { campaign: 'todaydeal', landings: 1, signups: 4, store_applies: 0, creator_applies: 0 },
  ], campaigns: { merchant: 'merchant-recruit', creator: 'creator-recruit', consumer: 'todaydeal' } });
  assert.equal(perf.merchant.signups, 2);
  assert.equal(perf.merchant.clicks, 3);
  assert.equal(perf.consumer.signups, 4);
});
