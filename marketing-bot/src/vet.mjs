// 올리기 전 검수 — AI 가 쓴 글을 게시하기 전에 결정론으로 거른다(외부 의존 없음).
// 2026-10-20: 빈 글·링크만 있는 글이 실제로 올라간 뒤 생겼다. HARD_RULES 는 *부탁*이고 이건 *문*이다.
// 규칙이 바뀌면 lib.mjs 의 HARD_RULES 와 함께 고친다.

// HARD_RULES 가 금지한 말 — 모델이 어겨도 여기서 막는다
export const BANNED_WORDS = [
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
  // 2026-11-09 실제 게시분: "딜 목록을 정리하다가 ○○이 눈에 들어와서" — 없던 장면
  /(?:정리|보|살펴보)(?:하)?다가\s[^.\n]{0,30}눈에\s*(?:들어|띄)/,
  // 운영자가 맛·취향을 말하는 것 = 먹어본 척(실제 게시분 "저는 … 쪽이 취향이거든요")
  /저는\s[^.\n]{0,40}(?:취향이|좋아하는\s*편|좋아해요)/,
  /장면이\s*(?:바로\s*)?떠오르/,
];
// 누구나 알아보는 AI 상투 마무리·표현
const FORMULA_RE = [
  [/[가-힣]+(?:파|이)세요\s*,\s*[가-힣\s]+(?:파|이)세요\s*\?\s*$/, '양자택일 질문 마무리("A파세요, B파세요?")'],
  [/여러분은?\s*어떠(?:세요|신가요)\s*\?/, '"여러분은 어떠세요?" 마무리'],
  [/—/, '줄표(—)'],
  [/솔직히 말씀드리면|사실 저도|결론부터 말하면/, 'AI 상투구'],
  // 자기 글에 대한 말 — 사람은 "보여드리고 싶었어요"라고 쓰지 않고 그냥 보여 준다
  [/보여\s*드리고\s*싶었|말씀\s*드리고\s*싶었|소개해\s*드리고\s*싶|(?:바뀌면|달라지면)\s*(?:그대로|바로|꼭)\s*(?:말씀|알려)/, '자기 글에 대한 말("보여드리고 싶었어요" 등)'],
];

/**
 * @param {string} body  링크를 붙이기 전 본문
 * @param {{facts?: string, recent?: string[], minLen?: number, maxLen?: number}} ctx
 * @returns {string[]} 문제 목록(비면 통과)
 */
export function vetPost(body, { facts = '', recent = [], minLen = 80, maxLen = 2100, maxPlain = Infinity, maxParas = Infinity, fieldNote = false } = {}) {
  const problems = [];
  const text = String(body || '').trim();
  const plain = text.replace(/https?:\/\/\S+/g, '').replace(/#\S+/g, '').trim();
  if (plain.length < minLen) problems.push(`본문이 너무 짧다(${plain.length}자, 최소 ${minLen}자)`);
  if (text.length > maxLen) problems.push(`본문이 너무 길다(${text.length}자, 최대 ${maxLen}자)`);
  // 2026-11-09 대표 "길게 쓴다고 다가 아니야" — 링크·해시태그 뺀 본문 길이와 문단 수를 막는다
  if (plain.length > maxPlain) problems.push(`길다(${plain.length}자, 최대 ${maxPlain}자) — 문장을 빼서 줄여라`);
  const paras = plain.split(/\n\s*\n/).filter((x) => x.trim()).length;
  if (paras > maxParas) problems.push(`문단이 많다(${paras}개, 최대 ${maxParas}개)`);
  for (const w of BANNED_WORDS) if (text.includes(w)) problems.push(`금지 표현: "${w}"`);
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
