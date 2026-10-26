// 실물 조회 — "올렸나·답했나"를 저장 파일이 아니라 Threads·인스타·GitHub 에 직접 묻는다.
//
// 🩸 왜(2026-10-20): 봇은 data/posts.json·comments.json 을 main 에 직접 push 해서 기억했는데,
//    main 룰셋이 Verify 필수 체크를 요구하고 우회 0 이라 그 push 는 원리상 한 번도 성공할 수 없었다.
//    결과: 게시물 목록이 늘 [] → 댓글 답글 0건, "오늘 이미 올렸나"를 몰라 백업 회차가 같은 날 또 올린다.
//    저장소를 고쳐도 저장이 깨지는 날 같은 사고가 난다 ⇒ 중복 판정은 실물로 한다(저장이 없어도 안 겹친다).
//
// 🔴 조회가 실패하면 "안 올렸다"로 보지 않는다 — 게시 쪽은 멈춘다(빠뜨린 하루 < 같은 글 두 번).
import { DRY, IG_USER_ID, THREADS_USER_ID, threads, insta, kstNow } from './lib.mjs';

export const OWN_FALLBACK = 'urdeal_official';

// Meta 는 "2026-10-20T08:35:12+0000" 처럼 콜론 없는 오프셋을 준다 — 표준 ISO 로 바꿔 읽는다.
export function metaTime(s) {
  if (!s) return NaN;
  return Date.parse(String(s).replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
}
export function kstDateOf(ms) {
  return Number.isFinite(ms) ? kstNow(new Date(ms)).toISOString().slice(0, 10) : null;
}

// Threads 본문 끝의 UTM 링크에서 트랙(utm_campaign)과 글 id(utm_content)를 되찾는다.
export function utmFromText(text) {
  const m = String(text || '').match(/https?:\/\/\S+/g) || [];
  for (const raw of m) {
    try {
      const u = new URL(raw);
      const campaign = u.searchParams.get('utm_campaign');
      if (campaign) return { link: u.toString(), campaign, content: u.searchParams.get('utm_content') };
    } catch {}
  }
  return null;
}

/** 내 최근 게시물(본 글만 — 답글 제외). 반환: [{platform,id,text,ms,date_kst,media_type,permalink}] */
export async function myRecentPosts({ days = 14, now = Date.now() } = {}) {
  const since = now - days * 86400e3;
  const out = [];
  const th = await threads('GET', `${THREADS_USER_ID}/threads`, { fields: 'id,text,timestamp,media_type,permalink', limit: '50', since: String(Math.floor(since / 1000)) });
  for (const p of th.data || []) {
    const ms = metaTime(p.timestamp);
    if (ms >= since) out.push({ platform: 'threads', id: p.id, text: p.text || '', ms, date_kst: kstDateOf(ms), media_type: p.media_type, permalink: p.permalink });
  }
  const ig = await insta('GET', `${IG_USER_ID}/media`, { fields: 'id,caption,timestamp,media_type,permalink', limit: '50' });
  for (const p of ig.data || []) {
    const ms = metaTime(p.timestamp);
    if (ms >= since) out.push({ platform: 'instagram', id: p.id, text: p.caption || '', ms, date_kst: kstDateOf(ms), media_type: p.media_type, permalink: p.permalink });
  }
  return out.sort((a, b) => a.ms - b.ms);
}

export function postedOn(livePosts, platform, dateKst) {
  return livePosts.some((p) => p.platform === platform && p.date_kst === dateKst);
}

/** 내 계정 이름 — 상수에 기대지 않는다(바뀌면 내 답글을 남의 댓글로 읽어 내 글에 답글을 단다). */
export async function myUsernames() {
  const names = new Set([OWN_FALLBACK]);
  if (DRY) return names;
  const th = await threads('GET', 'me', { fields: 'username' }).catch(() => ({}));
  const ig = await insta('GET', IG_USER_ID, { fields: 'username' }).catch(() => ({}));
  for (const n of [th.username, ig.username]) if (n) names.add(n);
  return names;
}

/** 댓글에 내 답글이 이미 있는가. 반환: { replied: bool, mine: [내 답글 텍스트] } */
export function findMyReplies(replies, own) {
  const mine = (replies || []).filter((r) => own.has(r.username)).map((r) => r.text || '');
  return { replied: mine.length > 0, mine };
}

export async function repliesOf(platform, commentId) {
  const r = platform === 'threads'
    ? await threads('GET', `${commentId}/replies`, { fields: 'id,text,username,timestamp' })
    : await insta('GET', `${commentId}/replies`, { fields: 'id,text,username,timestamp' });
  return r.data || [];
}

/** needs-owner 이슈 본문의 "댓글 ID: X" 를 모은다 — 같은 댓글로 이슈를 두 번 만들지 않는다. */
export function escalatedIdsFromIssues(issues) {
  const ids = new Set();
  for (const i of issues || []) for (const m of String(i.body || '').matchAll(/댓글 ID:\s*([\w-]+)/g)) ids.add(m[1]);
  return ids;
}

export async function escalatedCommentIds(env = process.env) {
  const repo = env.GITHUB_REPOSITORY, token = env.GITHUB_TOKEN;
  if (DRY || !repo || !token) return new Set();
  const res = await fetch(`https://api.github.com/repos/${repo}/issues?labels=needs-owner&state=all&per_page=100`, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' },
  });
  // 못 읽으면 실패시킨다 — 빈 집합으로 넘기면 같은 민감 댓글로 2시간마다 이슈가 쌓인다
  if (!res.ok) throw new Error(`needs-owner 이슈 조회 실패 ${res.status}`);
  return escalatedIdsFromIssues(await res.json());
}
