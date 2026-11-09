// 올리기 전 검수 — AI 가 쓴 글을 게시하기 전에 결정론으로 거른다(외부 의존 없음).
// 2026-10-20: 빈 글·링크만 있는 글이 실제로 올라간 뒤 생겼다. HARD_RULES 는 *부탁*이고 이건 *문*이다.
// 규칙이 바뀌면 lib.mjs 의 HARD_RULES 와 함께 고친다.

// HARD_RULES 가 금지한 말 — 모델이 어겨도 여기서 막는다
const BANNED = [
  '업계 최저', '최저 수수료', '마감 임박', '놓치지 마세요', '지금 바로', '자동 승인', '자동 송금',
  '트래픽 보장', '매출 보장', '수익 보장', '방문자 보장', '무조건', '100% 성공', '대박',
];
// 성과·수익 약속(숫자와 함께) — "매출 30% 증가", "월 300만원 수익"
const PROMISE_RE = [
  /\d[\d,.]*\s*%\s*(?:증가|상승|성장|늘)/,
  /(?:월|하루|주)\s*\d[\d,.]*\s*(?:만\s*)?원\s*(?:수익|벌|매출)/,
  /\d[\d,.]*\s*(?:명|팀)\s*(?:방문|이상\s*방문|이 찾)/,
];

// 글 안의 금액·비율이 [확인된 사실] 에 실제로 있는 값인지 — 지어낸 숫자를 막는다
const NUM_UNIT_RE = /(\d[\d,.]*)\s*(%|만\s*원|원)/g;
function factNumbers(facts) {
  const set = new Set();
  for (const m of String(facts).matchAll(NUM_UNIT_RE)) set.add(norm(m[1], m[2]));
  return set;
}
function norm(n, unit) { return `${n.replace(/,/g, '')}${unit.replace(/\s/g, '')}`; }

// 글자 바이그램 자카드 — 최근 글과 거의 같은 글을 막는다
function bigrams(s) {
  const t = String(s).replace(/https?:\/\/\S+/g, '').replace(/\s+/g, '');
  const out = new Set();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}
export function similarity(a, b) {
  const A = bigrams(a), B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

const EMOJI_RE = /\p{Extended_Pictographic}/gu;

// 2026-11-09: 봇이 없던 장면을 지어냈다("주방 마감하고 앉아 계신 사장님이랑 수수료 얘기를 하다가").
// 현장 메모(대표가 보낸 실제 일)가 없으면 일화·대사 표현을 막는다.
const FABRICATION_RE = [
  /(?:들은|들었던)\s*(?:말|얘기|이야기)/,
  /말씀하시더라|하시더라고요|그러시더라/,
  /(?:얘기|이야기)를?\s*(?:하다가|나누다가)/,
  /(?:지난주|지난달|어제|오늘 아침|그저께)에?\s/,
  /(?:만난|찾아뵌|다녀온|뵈었던)\s*사장님/,
  /먹어\s*봤는데|가\s*봤는데|다녀왔는데/,
];
// 누구나 알아보는 AI 상투 마무리·표현
const FORMULA_RE = [
  [/[가-힣]+(?:파|이)세요\s*,\s*[가-힣\s]+(?:파|이)세요\s*\?\s*$/, '양자택일 질문 마무리("A파세요, B파세요?")'],
  [/여러분은?\s*어떠(?:세요|신가요)\s*\?/, '"여러분은 어떠세요?" 마무리'],
  [/—/, '줄표(—)'],
  [/솔직히 말씀드리면|사실 저도|결론부터 말하면/, 'AI 상투구'],
];

/**
 * @param {string} body  링크를 붙이기 전 본문
 * @param {{facts?: string, recent?: string[], minLen?: number, maxLen?: number}} ctx
 * @returns {string[]} 문제 목록(비면 통과)
 */
export function vetPost(body, { facts = '', recent = [], minLen = 80, maxLen = 2100, fieldNote = false } = {}) {
  const problems = [];
  const text = String(body || '').trim();
  const plain = text.replace(/https?:\/\/\S+/g, '').replace(/#\S+/g, '').trim();
  if (plain.length < minLen) problems.push(`본문이 너무 짧다(${plain.length}자, 최소 ${minLen}자)`);
  if (text.length > maxLen) problems.push(`본문이 너무 길다(${text.length}자, 최대 ${maxLen}자)`);
  for (const w of BANNED) if (text.includes(w)) problems.push(`금지 표현: "${w}"`);
  for (const re of PROMISE_RE) { const m = text.match(re); if (m) problems.push(`성과·수익 약속: "${m[0]}"`); }
  const known = factNumbers(facts);
  for (const m of text.matchAll(NUM_UNIT_RE)) {
    const v = norm(m[1], m[2]);
    if (!known.has(v)) problems.push(`확인되지 않은 숫자: "${m[0].trim()}"`);
  }
  if (!fieldNote) for (const re of FABRICATION_RE) { const m = plain.match(re); if (m) problems.push(`지어낸 일화로 보임: "${m[0].trim()}"`); }
  const body2 = plain.replace(/\s+$/, '');
  for (const [re, label] of FORMULA_RE) if (re.test(body2)) problems.push(`상투 표현: ${label}`);
  const emoji = text.match(EMOJI_RE) || [];
  if (emoji.length > 2) problems.push(`이모지가 많다(${emoji.length}개, 최대 2개)`);
  if (/[!！]{2,}/.test(text)) problems.push('느낌표 남발("!!")');
  if (/^\s*["'“]|["'”]\s*$/.test(text)) problems.push('따옴표로 감싼 메타 출력');
  for (const r of recent) {
    const s = similarity(text, r);
    if (s >= 0.6) { problems.push(`최근 글과 거의 같다(유사도 ${s.toFixed(2)})`); break; }
  }
  return [...new Set(problems)];
}
