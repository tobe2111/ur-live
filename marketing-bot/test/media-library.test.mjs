import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { collect, pickMedia, resolveMediaUrl, markUsed, prune, emptyLibrary, creditLine, PIXABAY_LICENSE } from '../src/media-library.mjs';
import { reelArgs } from '../src/visual.mjs';

const json = (o) => ({ ok: true, json: async () => o, headers: new Map([['content-type', 'image/jpeg']]), arrayBuffer: async () => new ArrayBuffer(8) });
const img = (id) => ({ id, pageURL: `https://pixabay.com/photos/x-${id}/`, user: 'kim', imageWidth: 4000, imageHeight: 3000, tags: 'restaurant, owner', webformatURL: `https://cdn.pixabay.com/p/${id}.jpg`, largeImageURL: `https://cdn.pixabay.com/l/${id}.jpg` });
function fakeFetch(url) {
  if (url.startsWith('https://pixabay.com/api/videos/')) return Promise.resolve(json({ hits: [{ id: 9, pageURL: 'https://pixabay.com/videos/v-9/', user: 'lee', duration: 12, tags: 'kitchen', videos: { large: { width: 1920, height: 1080, url: 'https://cdn.pixabay.com/v/9.mp4', thumbnail: 'https://cdn.pixabay.com/t/9.jpg' } } }] }));
  if (url.startsWith('https://pixabay.com/api/?') && url.includes('&id=')) return Promise.resolve(json({ hits: [img(Number(url.split('&id=')[1]))] }));
  if (url.startsWith('https://pixabay.com/api/')) return Promise.resolve(json({ hits: [img(1), img(2)] }));
  if (url.startsWith('https://api.openverse.org/v1/audio/')) return Promise.resolve(json({ results: [
    { id: 'au1', url: 'https://x/au1.mp3', foreign_landing_url: 'https://freesound/au1', creator: 'choi', license: 'cc0', duration: 60000, title: 'sunny' },
    { id: 'au2', url: 'https://x/au2.mp3', license: 'by', duration: 60000 },
    { id: 'au3', url: 'https://x/au3.mp3', license: 'cc0', duration: 5000 },
  ] }));
  if (url.startsWith('https://api.openverse.org/')) return Promise.resolve(json({ results: [{ id: 'ov1', url: 'https://x/ov1.jpg', foreign_landing_url: 'https://flickr/ov1', creator: 'park', license: 'cc0', width: 2000, height: 1500, tags: [{ name: 'food' }] }] }));
  return Promise.resolve(json({}));
}

test('모으기: 7점 이상만 남기고 출처·라이선스를 기록한다', async () => {
  let n = 0;
  const scores = [9, 3, 8, 7];
  const claudeFn = async () => JSON.stringify({ score: scores[n++ % scores.length], reason: 'r' });
  const lib = await collect(emptyLibrary(), { key: 'k', claudeFn, fetchImpl: fakeFetch, topics: [{ q: 'restaurant owner kitchen', tracks: ['merchant'] }] });
  assert.equal(lib.items.filter((x) => x.kind !== 'audio').length, 3);
  assert.ok(lib.items.every((x) => x.score >= 7 && x.license && x.page_url));
  assert.ok(lib.items.some((x) => x.kind === 'video'));
  assert.equal(lib.items.find((x) => x.source === 'pixabay').license, PIXABAY_LICENSE);
  assert.equal(lib.rejected.length, 1);
  // 탈락한 것은 다음에 다시 채점하지 않는다
  const again = await collect(lib, { key: 'k', claudeFn: async () => '{"score":9}', fetchImpl: fakeFetch, topics: [{ q: 'restaurant owner kitchen', tracks: ['merchant'] }] });
  assert.equal(again.items.filter((x) => x.kind !== 'audio').length, 3);
});

test('키가 없으면 Openverse(CC0)만', async () => {
  const lib = await collect(emptyLibrary(), { key: '', claudeFn: async () => '{"score":8}', fetchImpl: fakeFetch, topics: [{ q: 'korean food table', tracks: ['consumer'] }] });
  assert.deepEqual(lib.items.filter((x) => x.kind === 'image').map((x) => x.source), ['openverse']);
  assert.match(creditLine(lib.items[0]), /Openverse · park · CC0/);
});

test('고르기: 트랙이 맞고 최근 30일 안 쓴 것', () => {
  const now = new Date('2026-11-16T00:00:00Z');
  const lib = { items: [
    { id: 'a', kind: 'image', tracks: ['merchant'], query: 'restaurant owner kitchen', tags: '', score: 9, used: [{ at: '2026-11-10T00:00:00Z' }] },
    { id: 'b', kind: 'image', tracks: ['merchant'], query: 'cafe owner barista', tags: '', score: 7, used: [] },
    { id: 'c', kind: 'image', tracks: ['creator'], query: 'vlogger cafe', tags: '', score: 10, used: [] },
  ] };
  assert.equal(pickMedia(lib, { kind: 'image', track: 'merchant', query: 'restaurant kitchen', now }).id, 'b');
  markUsed(lib, 'b', 'k1', now);
  assert.equal(pickMedia(lib, { kind: 'image', track: 'merchant', now }), null);
});

test('Pixabay 는 쓸 때 id 로 새 주소를 받는다(핫링크 금지)', async () => {
  assert.equal(await resolveMediaUrl({ source: 'pixabay', kind: 'image', source_id: 5 }, 'k', fakeFetch), 'https://cdn.pixabay.com/l/5.jpg');
  assert.equal(await resolveMediaUrl({ source: 'openverse', url: 'https://x/a.jpg' }), 'https://x/a.jpg');
});

test('상한: 점수 높은 것부터 남긴다', () => {
  const items = Array.from({ length: 5 }, (_, i) => ({ id: String(i), kind: 'image', score: i, used: [] }));
  assert.deepEqual(prune(items, 2, 0).map((x) => x.id), ['4', '3']);
});

test('릴스 배경 영상은 표지 장 뒤에만 깐다', () => {
  const a = reelArgs(['1.jpg', '2.jpg'], 'o.mp4', { broll: 'b.mp4' }).join(' ');
  assert.match(a, /-stream_loop -1 -i b\.mp4/);
  assert.match(a, /\[3:v\]scale=1080:1920/);
  assert.ok(!reelArgs(['1.jpg', '2.jpg'], 'o.mp4').join(' ').includes('stream_loop'));
});

test('가게 글(noStock)에는 자료 창고를 쓰지 않는다', () => {
  const src = fs.readFileSync(new URL('../src/visual.mjs', import.meta.url), 'utf8');
  assert.match(src, /const libPick = !noStock && library \?/);
  assert.match(src, /if \(reel && !noStock && library\)/);
});

test('음악: CC0·20초~4분만, 하루 3곡까지, 같은 곡은 다시 안 넣는다', async () => {
  const lib = await collect(emptyLibrary(), { key: '', claudeFn: async () => '{"score":8}', fetchImpl: fakeFetch, topics: [] });
  const au = lib.items.filter((x) => x.kind === 'audio');
  assert.deepEqual(au.map((x) => x.source_id), ['au1']);
  assert.match(au[0].license, /CC0/);
  const again = await collect(lib, { key: '', claudeFn: async () => '{"score":8}', fetchImpl: fakeFetch, topics: [] });
  assert.equal(again.items.filter((x) => x.kind === 'audio').length, 1);
  assert.ok(Object.keys(again.topics_last).some((k) => k.startsWith('audio:')));
});

test('릴스 음악: 작게 깔고 끝을 줄인다, 없으면 무음 트랙', () => {
  const a = reelArgs(['1.jpg', '2.jpg'], 'o.mp4', { music: 'm.mp3' }).join(' ');
  assert.match(a, /-stream_loop -1 -i m\.mp3/);
  assert.match(a, /\[3:a\]atrim=0:[\d.]+,asetpts=PTS-STARTPTS,volume=0\.35/);
  assert.match(a, /-map \[aout\]/);
  const both = reelArgs(['1.jpg', '2.jpg'], 'o.mp4', { broll: 'b.mp4', music: 'm.mp3' }).join(' ');
  assert.match(both, /\[4:a\]atrim/, '배경 영상이 있으면 음악은 그 다음 입력');
  assert.match(reelArgs(['1.jpg', '2.jpg'], 'o.mp4').join(' '), /-map 2:a/);
});

test('음악은 실패해도 릴스는 음악 없이 다시 만든다', () => {
  const src = fs.readFileSync(new URL('../src/visual.mjs', import.meta.url), 'utf8');
  assert.match(src, /if \(reel && !video && music\) \{[^}]*makeReel\(files, dir, \{ broll: broll\?\.file \}\)/);
});
