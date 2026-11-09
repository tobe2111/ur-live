// 올리기 전 고르기·검사 (2026-11-09 대표 "계속 개선해줘").
// ① 여러 개 써서 고르기: 글을 후보 3개로 쓰고(검수 통과한 것만), 편집장 역할의 Claude 가 가장 사람 같고 짧고 첫 줄이 힘 있는 걸 고른다.
// ② 표지 눈 검사: 무료 사진(Pixabay·Pexels·Openverse)을 쓴 표지를 Claude 가 이미지로 보고, 주제와 안 어울리거나
//    워터마크·다른 브랜드 로고·글자 잘림이 보이면 사진 없이(브랜드 블루 면) 다시 그린다.
import fs from 'node:fs';

export const JUDGE_SYSTEM = `너는 큰 브랜드 SNS 계정의 편집장이다. 같은 내용의 후보 글 중 하나를 고른다.
기준(순서대로): ① 사람이 폰으로 직접 쓴 것 같다(AI 티·설명조·상투구가 없다) ② 짧고 메시지가 하나다 ③ 첫 줄만 읽어도 끌린다 ④ 아래 [배운 점]에 맞는다.
고른 후보 번호 숫자 하나만 출력한다.`;

export function parsePick(text, n) {
  const m = String(text || '').match(/\d+/);
  const k = m ? Number(m[0]) - 1 : -1;
  return k >= 0 && k < n ? k : 0;
}

// cands: 검수 통과한 글 목록. 하나면 그대로. 고르기 실패하면 첫 번째.
export async function pickBest(cands = [], claudeFn, lessons = []) {
  if (cands.length <= 1) return 0;
  try {
    const user = `${lessons.length ? `[배운 점]\n${lessons.map((l) => `- ${l}`).join('\n')}\n\n` : ''}${cands.map((c, i) => `후보 ${i + 1}:\n${c}`).join('\n\n---\n\n')}`;
    return parsePick(await claudeFn(JUDGE_SYSTEM, user, 50), cands.length);
  } catch { return 0; }
}

export const COVER_SYSTEM = `너는 인스타그램 표지 이미지 검수자다. 이미지를 보고 JSON 하나만 출력한다: {"ok": true|false, "reason": "한 줄"}
false 인 경우: 사진이 글 주제(동네 가게·음식·사장님·뷰티 등)와 동떨어짐, 워터마크·다른 회사 로고·간판 글자가 크게 보임, 사람 얼굴이 크게 나와 초상권이 걱정됨, 글자가 잘리거나 사진 때문에 읽기 어려움, 불쾌하거나 어색한 장면.`;

export function parseCoverReview(text) {
  try {
    const j = JSON.parse(String(text || '').replace(/^[^{]*/, '').replace(/[^}]*$/, ''));
    return { ok: j.ok !== false, reason: String(j.reason || '').slice(0, 120) };
  } catch { return { ok: true, reason: '판정 실패 — 통과로 둠' }; }
}

// file: 표지 jpg. topic: 글 주제 한 줄. 실패하면 통과(게시를 막지 않는다).
export async function reviewCover(file, topic, claudeFn) {
  try {
    const data = fs.readFileSync(file).toString('base64');
    const content = [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } },
      { type: 'text', text: `글 주제: ${topic}` },
    ];
    return parseCoverReview(await claudeFn(COVER_SYSTEM, content, 200));
  } catch (e) { return { ok: true, reason: `검사 실패 — 통과로 둠(${e.message.slice(0, 60)})` }; }
}
export const STOCK_SOURCES = ['pixabay', 'pexels', 'openverse'];
