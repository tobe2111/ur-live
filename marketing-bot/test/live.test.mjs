// 실행: node --test test/live.test.mjs  (marketing-bot 폴더에서)
// 중복 판정이 저장 파일이 아니라 실물(Threads·인스타·GitHub)에서 오는지 — 되돌아가면 같은 글·같은 답글이 두 번 나간다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { metaTime, kstDateOf, postedOn, findMyReplies, escalatedIdsFromIssues, utmFromText } from '../src/live.mjs';

const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('Meta 시각(+0000 오프셋)을 읽고 KST 날짜로 바꾼다', () => {
  const ms = metaTime('2026-10-20T15:30:00+0000'); // = 10-21 00:30 KST
  assert.ok(Number.isFinite(ms));
  assert.equal(kstDateOf(ms), '2026-10-21');
  assert.equal(kstDateOf(metaTime('2026-10-20T14:59:00+0000')), '2026-10-20');
  assert.ok(Number.isNaN(metaTime(undefined)));
});

test('오늘 올렸나 — 플랫폼·KST 날짜로만 판정', () => {
  const live = [{ platform: 'threads', date_kst: '2026-10-20' }, { platform: 'instagram', date_kst: '2026-10-19' }];
  assert.equal(postedOn(live, 'threads', '2026-10-20'), true);
  assert.equal(postedOn(live, 'instagram', '2026-10-20'), false);
  assert.equal(postedOn([], 'threads', '2026-10-20'), false);
});

test('댓글에 내 답글이 있으면 답한 것으로 본다', () => {
  const own = new Set(['urdeal_official']);
  assert.deepEqual(findMyReplies([{ username: 'kim', text: '?' }], own), { replied: false, mine: [] });
  const r = findMyReplies([{ username: 'kim', text: '?' }, { username: 'urdeal_official', text: '네 맞아요' }], own);
  assert.equal(r.replied, true);
  assert.deepEqual(r.mine, ['네 맞아요']);
});

test('needs-owner 이슈 본문에서 댓글 ID 를 모은다', () => {
  const ids = escalatedIdsFromIssues([{ body: '- 플랫폼: threads\n- 댓글 ID: 1789\n- 게시물 ID: 55' }, { body: '- 댓글 ID: abc-1' }, { body: null }]);
  assert.deepEqual([...ids].sort(), ['1789', 'abc-1']);
});

test('Threads 글 끝 UTM 에서 캠페인을 되찾는다', () => {
  const u = utmFromText('본문입니다.\n\nhttps://urdeal.kr/partners?utm_source=threads&utm_medium=social&utm_campaign=merchant-recruit&utm_content=th-20261020');
  assert.equal(u.campaign, 'merchant-recruit');
  assert.equal(u.content, 'th-20261020');
  assert.equal(utmFromText('링크 없음'), null);
});

test('봇이 저장 파일로 중복을 판정하지 않는다(배선)', () => {
  // 저장(marketing-data 브랜치, #1969)은 로그·학습값만이다. 판정은 실물 조회로 한다 — 저장이 실패해도 중복이 안 나게.
  for (const f of ['src/reply-comments.mjs', 'src/weekly-review.mjs']) {
    const src = read(f);
    assert.doesNotMatch(src, /data\/posts\.json/, `${f} 가 posts.json 을 다시 읽는다`);
    assert.doesNotMatch(src, /data\/comments\.json/, `${f} 가 comments.json 을 다시 읽는다`);
  }
  assert.doesNotMatch(read('src/reply-comments.mjs'), /writeJson\(/, '댓글 응답이 다시 상태 파일을 쓴다');
  const weeklyWrites = [...read('src/weekly-review.mjs').matchAll(/writeJson\('([^']+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(weeklyWrites, ['data/mix-state.json', 'data/schedule.json'], '주간 리뷰는 학습값만 저장한다');
  // 일일 게시: posts.json 은 맨 끝에서 덧붙이기만 한다. 그 밖의 자리에서 읽으면 판정에 쓰는 것이다.
  const daily = read('src/daily-post.mjs').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const reads = daily.match(/data\/posts\.json/g) || [];
  assert.equal(reads.length, 2, 'posts.json 참조는 덧붙이는 한 줄(읽기+쓰기)뿐이어야 한다');
  assert.match(daily, /if \(!DRY && runLog\.length\) writeJson\('data\/posts\.json', \[\.\.\.readJson\('data\/posts\.json', \[\]\), \.\.\.runLog\]/);
  assert.match(daily, /const postedToday = \(platform\) => postedOn\(live, platform, today\)/, '오늘 게시 여부는 실물로 판정해야 한다');
  assert.match(read('src/daily-post.mjs'), /live = await myRecentPosts\(/, '게시 전에 실물을 조회해야 한다');
  assert.match(read('src/reply-comments.mjs'), /findMyReplies\(await repliesOf\(/, '답글 전에 그 댓글의 답글을 확인해야 한다');
  assert.match(read('src/reply-comments.mjs'), /if \(mine\.replied\) \{ skipped\+\+; continue; \}/, '내 답글이 있으면 건너뛰어야 한다');
  assert.match(read('src/reply-comments.mjs'), /await escalatedCommentIds\(\)/, '이슈 중복 확인이 빠졌다');
});

test('조회 실패는 "안 올렸다" 로 넘기지 않는다', () => {
  const daily = read('src/daily-post.mjs');
  // myRecentPosts 를 catch 로 감싸 빈 배열로 넘기면 조회 실패 = 미게시 = 중복 게시가 된다
  assert.doesNotMatch(daily, /myRecentPosts\([^)]*\)\s*\.catch/);
  assert.doesNotMatch(read('src/live.mjs'), /escalatedIdsFromIssues\(\[\]\)/);
});

test('워크플로는 main 이 아니라 marketing-data 브랜치에만 저장한다(main 은 룰셋이 막는다)', () => {
  for (const w of ['sns-daily-post', 'sns-reply-comments', 'sns-weekly-review', 'sns-influencer']) {
    const y = fs.readFileSync(new URL(`../../.github/workflows/${w}.yml`, import.meta.url), 'utf8');
    for (const m of y.matchAll(/git push[^\n]*/g)) {
      assert.doesNotMatch(m[0], /\bmain\b/, `${w} 가 main 에 push 한다`);
      assert.match(m[0], /\$BR|marketing-data/, `${w} 의 push 대상이 marketing-data 가 아니다`);
    }
    if (/git push/.test(y)) assert.match(y, /BR="marketing-data"/, `${w} 의 저장 브랜치가 marketing-data 가 아니다`);
    // 🩸 2026-10-24: 첫 orphan 커밋이 레포 전체(7,654파일)를 담았다 — 인덱스 비우기가 작업 디렉터리(marketing-bot)
    //   기준이라 실패해도 `|| true` 가 삼켰다. cwd 무관한 read-tree --empty 로, 실패를 삼키지 않게.
    if (/--orphan/.test(y)) {
      assert.match(y, /--orphan[^\n]*&& git read-tree --empty/, `${w} 의 orphan 생성이 인덱스를 비우지 않는다`);
      assert.doesNotMatch(y, /git rm -rq --cached/, `${w} 에 옛 인덱스 비우기가 남았다`);
    }
  }
});
