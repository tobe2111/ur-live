// 참고 스타일 가이드(config/reference-styles.json) + "AI 티 지우기" 2차 패스.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CONFIG = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'config', 'reference-styles.json');
const LEARNED = path.join(path.dirname(CONFIG), '..', 'data', 'reference-patterns.json');
const LEARNED_MAX_AGE_DAYS = 30;

// 주간 수집(reference-accounts.mjs)이 만든 패턴을 기본 패턴에 더한다. 오래됐거나 깨졌으면 무시.
export function mergeLearned(base, learned, now = Date.now()) {
  if (!learned?.patterns?.length || !learned.updated_at) return base;
  if ((now - Date.parse(learned.updated_at)) / 864e5 > LEARNED_MAX_AGE_DAYS) return base;
  const ids = new Set(base.patterns.map((p) => p.id));
  const extra = learned.patterns.filter((p) => p.id && p.hook && p.how && p.example && !ids.has(p.id));
  return { ...base, patterns: [...base.patterns, ...extra] };
}

let cache;
export function loadStyles(file = CONFIG, learnedFile = LEARNED) {
  if (file === CONFIG && cache) return cache;
  let s = JSON.parse(fs.readFileSync(file, 'utf8'));
  try { s = mergeLearned(s, JSON.parse(fs.readFileSync(learnedFile, 'utf8'))); } catch { /* 아직 없음 */ }
  if (file === CONFIG) cache = s;
  return s;
}

// 패턴 n개를 무작위로 뽑는다 (매번 다른 결로 쓰이게)
export function pickPatterns(n = 3, rand = Math.random, styles = loadStyles()) {
  const pool = [...styles.patterns];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, Math.min(n, pool.length));
}

export function referenceStyleBlock(n = 3, rand = Math.random, styles = loadStyles()) {
  const g = styles.general;
  const lines = pickPatterns(n, rand, styles).map((p) => `- ${p.hook}: ${p.how} (느낌만 참고: "${p.example}")`);
  return `[잘 되는 사장님 대상 계정들의 글 패턴 — 이 중 하나를 골라 쓰고, 예시 문장은 베끼지 않는다]
${lines.join('\n')}
분량: ${g.length} 말투: ${g.tone} 이모지: ${g.emoji} 마무리: ${g.cta}
피할 것: ${styles.avoid.join(', ')}`;
}

// 바뀌면 안 되는 것: 링크(UTM 포함), 해시태그, 숫자
export function protectedTokens(text) {
  const urls = text.match(/https?:\/\/\S+/g) || [];
  const rest = text.replace(/https?:\/\/\S+/g, ' ');
  const tags = rest.match(/#[\p{L}\p{N}_]+/gu) || [];
  const nums = rest.replace(/#[\p{L}\p{N}_]+/gu, ' ').match(/\d[\d,.]*/g) || [];
  return { urls, tags, nums: nums.map((x) => x.replace(/[.,]+$/, '')) };
}
export function keepsFacts(before, after) {
  const a = protectedTokens(before), b = protectedTokens(after);
  const same = (x, y) => [...x].sort().join('\n') === [...y].sort().join('\n');
  return same(a.urls, b.urls) && same(a.tags, b.tags) && a.nums.every((n) => b.nums.includes(n));
}

export const DEAI_SYSTEM = `너는 소상공인 플랫폼 운영자의 SNS 글을 다듬는 편집자다. 아래 초안에서 AI가 쓴 티를 지운다.
- 지울 것: "~해 보세요!" 류 권유 느낌표, 과한 이모지(최대 1개), 뻔한 마무리("함께 성장해요", "기다릴게요!"), 번호·불릿 나열식 정리, 과장("최고", "완벽한", "놀라운").
- 운영자 1인칭의 자연스러운 한국어 존댓말. 문장 길이를 섞고, 말하듯 문단 1~3개.
- 사실·숫자·조건·링크·UTM·해시태그는 글자 하나 바꾸지 않고 그대로 둔다. 새 사실을 더하지 않는다.
- 길이는 초안과 비슷하게. 다듬은 본문만 출력한다.`;

// 초안을 항상 한 번 더 다듬는다. 실패하거나 사실/링크가 바뀌면 초안을 그대로 쓴다.
export async function deAi(draft, kind, claudeFn) {
  try {
    const out = (await claudeFn(`${DEAI_SYSTEM}\n(글 종류: ${kind})`, draft, 900))?.trim();
    if (!out || !keepsFacts(draft, out)) return draft;
    return out;
  } catch {
    return draft;
  }
}
