/**
 * 📧 **이메일 난독화 해제** — `influencer-discovery.ts` 에서 분리(2026-07-29, 600줄 래칫).
 *
 *   한국 크리에이터는 이메일을 그대로 안 쓴다: `abc골뱅이naver쩜com` · `hello[at]daum[dot]net` ·
 *   `biz @ gmail . com`. 이걸 복원하지 못하면 **연락 가능한 사람을 연락 불가로 세게 된다** —
 *   풀에서 가장 비싼 실패다(이미 수집은 다 해놓고 마지막 한 걸음에서 버린다).
 *
 *   ⚠️ 규칙을 느슨하게 만들면 **가짜 이메일을 날조**한다("products at home.com" → 가짜 주소).
 *   아래 각 단계의 부정 조건은 전부 실제로 밟았던 오탐이다 — 지우기 전에 유닛부터 볼 것.
 *   ⚠️ 로직은 옮기지 않았다(순수 이동). 동작이 바뀌면 `ads-influencer-extract` 가 빨간불이 된다.
 */
export function deobfuscateEmail(text: string): string {
  let t = String(text || '')
  // ① 괄호/대괄호 마커: [at] (at) {at} → @ · [dot] (dot) {dot} → .  (영문 at/dot + 한글 골뱅이/앳/엣/점)
  t = t.replace(/\s*[[({]\s*(?:at|@|골뱅이|앳|엣)\s*[\])}]\s*/gi, '@')
  t = t.replace(/\s*[[({]\s*(?:dot|점|쩜)\s*[\])}]\s*/gi, '.') // '쩜' = 구어체 dot — 한국 블로거가 실제로 가장 많이 쓰는 표기
  // ② 한글 골뱅이/전각 @ → @ · 전각 점(．·)·가운뎃점 → .
  t = t.replace(/골뱅이|앳|＠/g, '@').replace(/[．]/g, '.')
  // ③ 단어형 " at " — **뒤에 " dot " 난독화가 이어질 때만** @로(영어 전치사 "at" 오탐 방지: "products at home.com"→가짜 이메일 금지). 공백 낀 리터럴 @ 는 ④가 처리.
  t = t.replace(/([A-Za-z0-9._%+-])\s+at\s+(?=[A-Za-z0-9][A-Za-z0-9\-]*\s+dot\s+)/gi, '$1@')
  t = t.replace(/([A-Za-z0-9])\s+dot\s+([A-Za-z]{2,})/gi, '$1.$2')
  // ③-b 한글 구어체: "abc골뱅이naver쩜com" — 네이버 블로그 프로필에서 가장 흔한 난독화다.
  //   ⚠️ '쩜' 은 '점'과 달리 문장 속 일반어로 쓰이지 않아(오탐 위험이 낮아) 공백 없이도 받는다.
  t = t.replace(/([A-Za-z0-9])\s*쩜\s*([A-Za-z]{2,})/g, '$1.$2')
  // ④ @ 주변 공백 제거 + @ 뒤 도메인의 점 주변 공백 제거(@ 있는 토큰 한정 — 일반 마침표 미접촉).
  //   "biz @ daum . net" 처럼 점 양옆 공백도 흡수(도메인 마지막 라벨 앞 `\s*\.\s*`).
  t = t.replace(/([A-Za-z0-9._%+-]+)\s*@\s*([A-Za-z0-9][A-Za-z0-9\-]*?(?:\s*\.\s*[A-Za-z]{2,})+)/g, (_m, a, b) => `${a}@${String(b).replace(/\s+/g, '')}`) // 도메인 라벨에 공백 불허(과거 "DM @ourteam for rates . more"→가짜메일 방지). 점 양옆 공백만 \s*\.\s* 로 흡수.
  return t
}
