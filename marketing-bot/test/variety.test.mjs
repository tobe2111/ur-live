// 실행: node --test test/variety.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickLeastRecent, rotateImages, pickHook, recentOpeners } from '../src/variety.mjs';

const sets = [{ set: 'a' }, { set: 'b' }, { set: 'a' }, { set: 'c' }];
test('최근에 쓴 세트는 피한다', () => {
  const hist = [{ media_set: 'a' }, { media_set: 'b' }];
  assert.equal(pickLeastRecent(sets, hist, 'media_set', (m) => m.set, 0).set, 'c');
  const hist2 = [...hist, { media_set: 'c' }];
  assert.equal(pickLeastRecent(sets, hist2, 'media_set', (m) => m.set, 0).set, 'a');
});
test('건너뛴 기록은 사용으로 치지 않는다', () => {
  const hist = [{ media_set: 'a' }, { media_set: 'b' }, { media_set: 'c', skipped: 'error' }];
  assert.equal(pickLeastRecent(sets, hist, 'media_set', (m) => m.set, 5).set, 'c');
});
test('표지 회전', () => {
  assert.deepEqual(rotateImages([1, 2, 3], 1), [2, 3, 1]);
  assert.deepEqual(rotateImages([1, 2, 3], 3), [1, 2, 3]);
});
test('같은 훅 연속 금지', () => {
  const h1 = pickHook([], 0);
  const h2 = pickHook([{ hook: h1.id }], 0);
  assert.notEqual(h1.id, h2.id);
});
test('첫 문장 추출', () => {
  assert.deepEqual(recentOpeners(['안녕. 두번째', '한줄\n둘']), ['안녕', '한줄']);
});
