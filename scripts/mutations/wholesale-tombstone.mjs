/**
 * 🧬 주입 — ur-wholesale 묘비 (2026-10-12).
 * 각 항목은 "되돌리면 운영 DB 가 붙은 앱 사본이 다시 뜨거나, 모니터가 상시 빨간불이 된다" 형태다.
 */
const TEST = 'src/tests/unit/wholesale-tombstone-2026-10-12.test.ts'

export default [
  {
    name: 'wholesale-tombstone: 묘비 대신 앱을 배포한다',
    file: '.github/workflows/deploy-wholesale.yml',
    find: 'OUT=$(npx --yes wrangler@3 pages deploy deploy/ur-wholesale-tombstone \\',
    replace: 'OUT=$(npx --yes wrangler@3 pages deploy dist/client \\',
    test: TEST,
    why: '앱을 올리면 ur-wholesale.pages.dev 에 운영 D1·KV 가 붙은 소비자 앱 사본이 다시 뜬다.',
  },
  {
    name: 'wholesale-tombstone: 묘비가 200 을 준다',
    file: 'deploy/ur-wholesale-tombstone/_worker.js',
    find: '      status: 410,',
    replace: '      status: 200,',
    test: TEST,
    why: '200 이면 크롤러가 빈 페이지를 색인하고 "사라졌다" 가 전달되지 않는다.',
  },
  {
    name: 'wholesale-tombstone: prod-smoke 가 도매 사본을 다시 두드린다',
    file: '.github/workflows/prod-smoke.yml',
    find: '          for p in /wholesale /supplier; do',
    replace: '          check "도매 카탈로그" "/api/wholesale/catalog" \'"success":true\' "https://ur-wholesale.pages.dev"\n          for p in /wholesale /supplier; do',
    test: TEST,
    why: '철거된 도매를 두드리면 매 회차 실패해 상시 빨간불 — 진짜 소비자 회귀가 가려진다.',
  },
  {
    name: 'wholesale-tombstone: 앱 변경마다 다시 배포한다',
    file: '.github/workflows/deploy-wholesale.yml',
    find: "      - 'deploy/ur-wholesale-tombstone/**'\n",
    replace: '',
    test: TEST,
    why: '묘비 경로가 빠지면 묘비를 고쳐도 배포가 안 된다(자기참조 사각지대).',
  },
  {
    name: 'wholesale-tombstone: 빌드 게이트가 ur-live 빌드까지 묘비로 바꾼다',
    file: 'scripts/pages-tombstone-gate.mjs',
    find: "  if (env.CF_PAGES !== '1') return false",
    replace: "  if (env.CF_PAGES !== '1') return true",
    test: TEST,
    why: '판정이 넓어지면 소비자 사이트 빌드가 410 묘비가 된다.',
  },
  {
    name: 'wholesale-tombstone: 빌드 게이트가 배선에서 빠진다',
    file: 'scripts/build-prepare.mjs',
    find: "runTombstoneGate()\n",
    replace: "\n",
    test: TEST,
    why: 'GitHub 연결 빌드가 main push 마다 앱 사본을 다시 올려 묘비를 덮는다.',
  },
]
