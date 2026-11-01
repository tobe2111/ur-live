/**
 * 🧬 주입 — 데모 사진 AI 판정(2026-10-27). 가드: src/tests/unit/demo-photo-judge-2026-10-27.test.ts
 */
const T = 'src/tests/unit/demo-photo-judge-2026-10-27.test.ts'
export default [
  {
    name: 'demo-photo-judge — 판정 실패를 "통과" 로 읽는다',
    file: 'src/worker/utils/demo-photo-set.ts',
    find: '  if (!verdict) return { photos: [], known: false }',
    replace: '  if (!verdict) return { photos: cands.slice(0, want), known: true }',
    test: T,
    why: 'AI 가 안 봤는데 매장주 사진을 그대로 걸어 메뉴판·로고가 다시 뜬다.',
  },
  {
    name: 'demo-photo-judge — 통과 여부를 무시한다',
    file: 'src/worker/utils/demo-photo-set.ts',
    find: '  return { photos: cands.filter((_, i) => verdict[i]).slice(0, want), known: true }',
    replace: '  return { photos: cands.slice(0, want), known: true }',
    test: T,
    why: 'AI 가 떨어뜨린 사진까지 쓴다(판정이 헛돈다).',
  },
  {
    name: 'demo-photo-judge — 손님·블로그 사진도 후보로',
    file: 'src/worker/utils/kakao-place-photos.ts',
    find: "    if (photos.length >= want) break\n    if (p.type !== 'MYSTORE') continue",
    replace: '    if (photos.length >= want) break',
    test: T,
    why: '매장주 제공이 아닌 사진이 데모에 들어간다(대표 지시 위반).',
  },
  {
    name: 'demo-photo-judge — 키 없이도 판정 모드',
    file: 'src/worker/utils/demo-photo-judge.ts',
    find: '  return !!(env as unknown as { ANTHROPIC_API_KEY?: string }).ANTHROPIC_API_KEY',
    replace: '  return true',
    test: T,
    why: '키가 없는 라이브에서 판정이 전부 실패해 데모가 통째로 내려간다.',
  },
  {
    name: 'demo-photo-judge — 모르는데 숨긴다',
    file: 'src/worker/cron/demo-image-rehost.ts',
    find: '      if (!judged.known) {',
    replace: '      if (false) {',
    test: T,
    why: '카카오·AI 가 잠깐 실패한 날 멀쩡한 데모가 교체·숨김된다.',
  },
  {
    name: 'demo-photo-judge — 형식 오류를 빈 통과로',
    file: 'src/worker/utils/demo-photo-judge.ts',
    find: '  if (!Array.isArray(keep)) return null',
    replace: '  if (!Array.isArray(keep)) return new Array<boolean>(n).fill(false)',
    test: T,
    why: 'AI 응답이 깨진 날 "전부 탈락" 으로 읽혀 데모가 대량 숨김된다.',
  },
]
