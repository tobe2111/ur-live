/**
 * 🎨 셀러 2차 페이지 정리 — 색 정보상자·이모지·버튼 체계 (2026-09-15) 주입 매니페스트.
 * 가드: src/tests/unit/seller-tones-2026-09-15.test.ts
 */
const TEST = 'src/tests/unit/seller-tones-2026-09-15.test.ts'

export default [
  {
    name: '🕳️ 버튼 체계 가드의 글로브가 `:(glob)` 을 잃어 seller-*/ 하위 54개 파일이 검사 밖으로 나간다',
    file: 'scripts/check-dashboard-button-system.mjs',
    find: "':(glob)src/pages/seller-*/**/*.tsx'",
    replace: "'src/pages/seller-*/**/*.tsx'",
    test: TEST,
    why: 'git 은 `**` 를 :(glob) 없이 안 푼다 — 그 글로브는 0개를 돌려주고 가드는 "62개 검사" 라고 초록을 찍었다(실사고).',
  },
  {
    name: '🎨 셀러 가이드 안내 상자가 파랑 정보상자로 되돌아간다',
    file: 'src/pages/SellerGuidePage.tsx',
    find: 'className="bg-white border border-rule rounded-xl p-3 text-xs text-gray-700"',
    replace: 'className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800"',
    test: TEST,
    why: '🎫 표면 규칙 ⑥ 색깔 정보상자 0 — 한 곳이 돌아오면 파일마다 제각각 색이 다시 자란다.',
  },
  {
    name: '🎨 ko 로케일 셀러 문구에 이모지가 돌아온다',
    file: 'public/locales/ko/translation.json',
    find: '"sentLabel": "발송됨",',
    replace: '"sentLabel": "✓ 발송됨",',
    test: TEST,
    why: '코드에서 이모지를 지워도 로케일 값이 이기므로, 로케일까지 잠가야 화면에서 실제로 사라진다.',
  },
  {
    name: '🎨 코드모드의 배지 규칙이 꺼져 상태 배지가 흰 카드가 된다',
    file: 'scripts/codemods/adopt-dashboard-tones.mjs',
    find: '  if (pill) {',
    replace: '  if (false) {',
    test: TEST,
    why: '어드민 PR 이 같은 코드모드를 다시 쓴다 — 규칙이 조용히 죽으면 상태 배지 수백 개가 테두리 상자로 바뀐다.',
  },
]
