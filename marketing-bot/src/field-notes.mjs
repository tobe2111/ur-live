// 현장 메모 — 대표가 보낸 실제 사진·메모를 글감으로 쓴다 (2026-11-09 대표 승인 "A: 진짜 재료 넣기").
// 보내는 법: GitHub 앱/웹에서 이 레포에 이슈를 열고 라벨 `현장메모`를 단다. 본문에 메모, 사진은 끌어다 붙인다.
// 봇은 가장 오래된 열린 메모 하나를 그날 글감으로 쓰고, 게시 뒤 링크를 댓글로 남기고 이슈를 닫는다.
//
// 🔒 공개 레포라 누구나 이슈를 열 수 있다 → 레포 주인(OWNER)이 연 이슈만 쓴다. 남이 연 이슈는 무시한다.
import { DRY, log } from './lib.mjs';

export const NOTE_LABEL = '현장메모';

// 이슈 본문에서 사진 URL 과 메모 글을 분리한다
export function parseNote(body = '') {
  const photos = [];
  const text = String(body)
    .replace(/!\[[^\]]*\]\((https:\/\/[^)\s]+)\)/g, (_, u) => { photos.push(u); return ''; })
    .replace(/<img[^>]*src=["'](https:\/\/[^"']+)["'][^>]*>/gi, (_, u) => { photos.push(u); return ''; })
    .replace(/^\s*(https:\/\/github\.com\/user-attachments\/assets\/\S+)\s*$/gm, (_, u) => { photos.push(u); return ''; })
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { text, photos: [...new Set(photos)] };
}

export function isOwnerNote(issue, owner) {
  if (!issue || issue.pull_request) return false;
  return issue.author_association === 'OWNER' || (owner && issue.user?.login === owner);
}

function gh(env = process.env) {
  const repo = env.GITHUB_REPOSITORY, token = env.GITHUB_TOKEN;
  if (!repo || !token) return null;
  return { repo, h: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'content-type': 'application/json' } };
}

// 가장 오래된 메모 하나: { number, title, text, photos, url } 또는 null
export async function nextFieldNote(env = process.env, fetchImpl = fetch) {
  const g = gh(env);
  if (!g) return null;
  try {
    // 라벨이 없으면 만들어 둔다(대표가 이슈에서 고를 수 있게). 이미 있으면 422 — 무시.
    await fetchImpl(`https://api.github.com/repos/${g.repo}/labels`, { method: 'POST', headers: g.h, body: JSON.stringify({ name: NOTE_LABEL, color: '1c69ef', description: '대표 현장 사진·메모 → 마케팅 봇 글감' }) }).catch(() => {});
    const res = await fetchImpl(`https://api.github.com/repos/${g.repo}/issues?state=open&labels=${encodeURIComponent(NOTE_LABEL)}&sort=created&direction=asc&per_page=20`, { headers: g.h });
    if (!res.ok) { log(`현장 메모 조회 실패 ${res.status}`); return null; }
    const owner = g.repo.split('/')[0];
    for (const i of await res.json()) {
      if (!isOwnerNote(i, owner)) { log(`현장 메모 #${i.number}: 레포 주인이 연 이슈가 아니라 건너뜀`); continue; }
      const { text, photos } = parseNote(i.body || '');
      const memo = [i.title, text].filter(Boolean).join('\n').trim();
      if (memo.length < 5 && !photos.length) continue;
      return { number: i.number, title: i.title, text: memo, photos, url: i.html_url };
    }
  } catch (e) { log(`현장 메모 조회 오류: ${e.message}`); }
  return null;
}

export async function closeFieldNote(note, links = [], env = process.env, fetchImpl = fetch) {
  const g = gh(env);
  if (!g || !note || DRY) return;
  const base = `https://api.github.com/repos/${g.repo}/issues/${note.number}`;
  const body = `이 메모로 게시했어요.\n${links.map((l) => `- ${l}`).join('\n')}\n\n---\n_유어딜 마케팅 봇_`;
  await fetchImpl(`${base}/comments`, { method: 'POST', headers: g.h, body: JSON.stringify({ body }) }).catch(() => {});
  await fetchImpl(base, { method: 'PATCH', headers: g.h, body: JSON.stringify({ state: 'closed', state_reason: 'completed' }) }).catch(() => {});
}
