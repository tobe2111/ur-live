// 🔓 잠금 파일 줄표 3곳 + 유어샵 설명 폴백 한 벌 — 결재 `2026-10-14-locked-emdash` 안 1 (2026-10-18)
const TEST = 'src/tests/unit/meta-copy-no-emdash-2026-10-14.test.ts'

export default [
  {
    name: '🔓 잠금 줄표: 유어샵 설명 폴백을 다시 손으로 적는다',
    file: 'src/worker/index.ts',
    find: "const cDesc = String(cur.bio || '').slice(0, 200) || ushopDescFallback(cName);",
    replace: "const cDesc = String(cur.bio || '').slice(0, 200) || `${cName}님의 추천 — 교환권·이용권 모음`;",
    test: TEST,
    why: '두 자리가 따로 적으면 다시 갈리고(이미 한 번 갈렸다) 소개글 없는 유어샵 검색 설명에 줄표가 돌아온다.',
  },
  {
    name: '🔓 잠금 줄표: 폴백 문구에 줄표를 되살린다',
    file: 'src/shared/ushop-share-card.ts',
    find: '  return `${name}님이 고른 교환권·이용권 모음`',
    replace: '  return `${name}님의 추천 — 교환권·이용권 모음`',
    test: TEST,
    why: '검색결과·카톡 미리보기에 AI 티 나는 줄표가 그대로 실린다.',
  },
  {
    name: '🔓 잠금 줄표: /blog 제목에 줄표를 되살린다',
    file: 'src/worker/index.ts',
    find: "const bt = '유어딜 블로그, 이용권·교환권·동네딜·유어샵 가이드';",
    replace: "const bt = '유어딜 블로그 — 이용권·교환권·동네딜·유어샵 가이드';",
    test: TEST,
    why: '/blog 검색결과 제목이 다시 줄표로 나간다.',
  },
]
