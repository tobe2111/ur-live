// 2026-11-10 첫 스토리가 "Media ID is not available"(9007/2207027)로 실패 — 컨테이너 FINISHED 직후에도 난다.
// igPublishContainer 가 그 오류만 다시 시도하고, 다른 오류는 바로 올리는지 확인.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
process.env.META_IG_ACCESS_TOKEN ||= 'test-dummy'; // fetch 는 아래에서 가짜로 바꾼다
const { igPublishContainer } = await import('../src/lib.mjs');

const notReady = { error: { message: 'Media ID is not available', type: 'OAuthException', code: 9007, error_subcode: 2207027 } };
function mockFetch(responses) {
  const calls = [];
  globalThis.fetch = async (u) => {
    calls.push(String(u));
    const body = responses.shift();
    return { ok: !body.error, json: async () => body };
  };
  return calls;
}

test('준비 안 됨 오류는 다시 시도해서 게시한다', async () => {
  const calls = mockFetch([notReady, notReady, { id: '999' }]);
  const r = await igPublishContainer('c1', { pauseMs: 1 });
  assert.equal(r.id, '999');
  assert.equal(calls.length, 3);
  assert.ok(calls.every((u) => u.includes('/media_publish')));
});

test('다른 오류는 다시 시도하지 않는다', async () => {
  const calls = mockFetch([{ error: { message: 'Invalid parameter', code: 100 } }]);
  await assert.rejects(igPublishContainer('c1', { pauseMs: 1 }), /Invalid parameter/);
  assert.equal(calls.length, 1);
});

test('횟수를 다 쓰면 원래 오류를 올린다', async () => {
  const calls = mockFetch([notReady, notReady]);
  await assert.rejects(igPublishContainer('c1', { tries: 2, pauseMs: 1 }), /2207027/);
  assert.equal(calls.length, 2);
});

test('피드·스토리 게시가 모두 이 도우미를 쓴다', () => {
  const src = fs.readFileSync(new URL('../src/lib.mjs', import.meta.url), 'utf8');
  assert.equal((src.match(/'POST', `\$\{IG_USER_ID\}\/media_publish`/g) || []).length, 1, 'media_publish 직접 호출은 도우미 안 한 곳뿐');
  assert.ok(src.includes('await igPublishContainer(id)') && src.includes('await igPublishContainer(c.id)'));
});
