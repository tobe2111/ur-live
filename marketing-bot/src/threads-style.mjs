// 스레드 말투 참고 — 2026-11-09 대표 "스레드도 인기글들 참고해서 말투까지도 참고해야지".
//
// 스레드 API 로 남의 인기글을 검색(keyword_search)·조회(profile_posts)하려면 Meta 앱 심사가 필요하다
// (2026-11-09 실측: 둘 다 code 10 "Application does not have permission"). 심사 전까지 두 곳에서 예시를 모은다:
//   ① 대표가 고른 인기글: GitHub 이슈에 라벨 `스레드참고` + 본문에 글을 붙여 넣는다(여러 개면 --- 로 나눈다).
//      이슈는 닫지 않는다 — 열려 있는 동안 계속 참고 자료로 쓴다. 레포 주인이 연 이슈만 쓴다(공개 레포).
//   ② 우리 스레드 글 중 반응 좋았던 것: 주간 리뷰가 data/encore.json 의 threads_top 에 남긴다.
// 예시는 말투·길이·줄바꿈만 참고하게 하고, 글자를 베꼈는지는 검수(유사도)로 막는다.
import { log } from './lib.mjs';
import { isOwnerNote } from './field-notes.mjs';

export const STYLE_LABEL = '스레드참고';

// 이슈 본문 → 글 목록(--- 로 나눔, 링크·사진 제거, 너무 짧거나 긴 건 버림)
export function splitExamples(body = '') {
  return String(body)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/<img[^>]*>/gi, '').replace(/https?:\/\/\S+/g, '')
    .split(/^\s*-{3,}\s*$/m)
    .map((s) => s.replace(/\n{3,}/g, '\n\n').trim())
    .filter((s) => s.length >= 10)
    .map((s) => s.slice(0, 300));
}

export async function ownerExamples(env = process.env, fetchImpl = fetch) {
  const repo = env.GITHUB_REPOSITORY, token = env.GITHUB_TOKEN;
  if (!repo || !token) return [];
  const h = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'content-type': 'application/json' };
  try {
    await fetchImpl(`https://api.github.com/repos/${repo}/labels`, { method: 'POST', headers: h, body: JSON.stringify({ name: STYLE_LABEL, color: '000000', description: '대표가 고른 스레드 인기글 → 마케팅 봇 말투 참고' }) }).catch(() => {});
    const res = await fetchImpl(`https://api.github.com/repos/${repo}/issues?state=open&labels=${encodeURIComponent(STYLE_LABEL)}&per_page=30`, { headers: h });
    if (!res.ok) { log(`스레드 참고 조회 실패 ${res.status}`); return []; }
    const owner = repo.split('/')[0];
    return (await res.json()).filter((i) => isOwnerNote(i, owner)).flatMap((i) => splitExamples(i.body || ''));
  } catch (e) { log(`스레드 참고 조회 오류: ${e.message}`); return []; }
}

// 오늘 쓸 예시 n개: 대표가 고른 글 우선, 모자라면 우리 인기글. seed 로 매일 다른 조합.
export function pickExamples(owner = [], own = [], n = 3, seed = 0) {
  const rot = (a) => a.length ? [...a.slice(Math.abs(seed) % a.length), ...a.slice(0, Math.abs(seed) % a.length)] : [];
  return [...new Set([...rot(owner), ...rot(own)])].slice(0, n);
}

export function styleBlock(examples = []) {
  if (!examples.length) return '';
  return `\n\n[스레드에서 반응 좋은 글들 — 말투·길이·줄바꿈·첫 줄 리듬만 따라 한다. 문장·표현·내용은 가져오지 않는다. 사실은 [확인된 사실]만]\n${examples.map((e, i) => `(${i + 1})\n${e}`).join('\n\n')}`;
}
