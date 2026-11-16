/**
 * 🧬 주입 — 커밋 검사 출력 줄이기 (2026-11-16) · 가드: src/tests/unit/hook-quiet-output-2026-11-16.test.ts
 */
const T = 'src/tests/unit/hook-quiet-output-2026-11-16.test.ts'
const F = 'scripts/hook-quiet-filter.mjs'
export default [
  {
    name: '🤫 이번 커밋 파일에 걸린 경고까지 숨긴다',
    file: F,
    find: "      if (paths.some((p) => set.has(p))) { hitLines.push(line); prev = 'kept-path' } else { dropped++; prev = 'dropped-path' }",
    replace: "      dropped++; prev = 'dropped-path'",
    test: T,
    why: '세션이 자기가 방금 만든 문제를 못 보고 커밋한다 — 줄이는 목적은 남의 잔여지 내 경고가 아니다.',
  },
  {
    name: '🤫 무관한 기존 잔여를 다시 통째로 찍는다 (커밋마다 7,500 토큰)',
    file: F,
    find: "      if (paths.some((p) => set.has(p))) { hitLines.push(line); prev = 'kept-path' } else { dropped++; prev = 'dropped-path' }",
    replace: "      hitLines.push(line); prev = 'kept-path'",
    test: T,
    why: '인증 누락 202건 · 다크 보더 350건 목록이 커밋마다 대화에 들어간다.',
  },
  {
    name: '🤫 이모지 판정이 반쪽 문자로 쪼개져 🔍 를 경고로 읽는다',
    file: F,
    find: 'const MARKER = /[⚠❌🔴🚧]/u',
    replace: 'const MARKER = /[⚠❌🔴🚧]/',
    test: T,
    why: '경고가 없는 검사도 머리줄(🔍)이 요약으로 남아 출력이 다시 늘어난다.',
  },
  {
    name: '🤫 막는 검사의 출력까지 거른다 (실패 이유가 안 보인다)',
    file: 'scripts/install-git-hooks.sh',
    find: 'node scripts/check-conflict-markers.mjs -s || {',
    replace: 'quiet_warn node scripts/check-conflict-markers.mjs -s || {',
    test: T,
    why: '충돌 마커가 어느 파일 몇째 줄인지가 안 보이면 세션이 엉뚱한 곳을 고친다.',
  },
]
