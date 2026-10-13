// 🛡️ 2026-05-07: cross-platform build:prepare (Windows + macOS + Linux 동시 지원).
//   기존 cp 명령은 PowerShell 에서 동작 안 함 → Node fs API 로 대체.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

function copy(src, dest) {
  if (!existsSync(src)) return false
  const dir = dirname(dest)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  copyFileSync(src, dest)
  return true
}

// Worker 번들 → Pages output 디렉토리
if (!copy('dist/_worker.js', 'dist/client/_worker.js')) {
  console.error('❌ dist/_worker.js not found — npm run build:worker 먼저 실행')
  process.exit(1)
}

// _routes.json: dist 우선, 없으면 public 에서 복사
if (!copy('dist/_routes.json', 'dist/client/_routes.json')) {
  if (!copy('public/_routes.json', 'dist/client/_routes.json')) {
    console.warn('⚠️  _routes.json not found in dist/ or public/ — skipping')
  }
}

// 📄 대외 소개서 PDF → `/static/proposals/*.pdf` (어드민 `/admin/proposals` 가 iframe 으로 띄운다)
//   ⚠️ **`public/` 에 사본을 두지 않는다.** 소개서의 집은 `docs/business/proposals/` 이고(생성기 `.build.mjs`
//      와 `.pptx` 가 거기 산다) 사본을 만들면 PDF 를 다시 뽑을 때 한쪽만 갱신돼 **어드민이 옛 소개서를
//      조용히 서빙한다** — 2026-10-12 에 덱 다섯을 라이브와 맞추며 바로잡은 드리프트와 같은 클래스다.
//      그래서 배포 때 **복사만** 한다(빌드 산출물 → 사본이 저장소에 남지 않는다).
//   ⚠️ 경로는 `/static/` 아래여야 한다 — `_routes.json` 이 그 접두사만 워커에서 제외하므로 Pages 가
//      파일을 직접 서빙한다. 다른 경로면 워커가 SPA 셸을 돌려주고 미리보기가 빈 화면이 된다.
//   ℹ️ dev 서버에는 이 복사가 없다 — `vite.config.ts` 의 `proposalPdfDevPlugin` 이 같은 주소를
//      원본 파일로 이어 준다(배포와 주소가 같다).
const PROPOSAL_SRC = 'docs/business/proposals'
const PROPOSAL_DEST = 'dist/client/static/proposals'
let pdfs = 0
if (existsSync(PROPOSAL_SRC)) {
  for (const name of readdirSync(PROPOSAL_SRC)) {
    if (!name.endsWith('.pdf')) continue
    if (copy(join(PROPOSAL_SRC, name), join(PROPOSAL_DEST, name))) pdfs++
  }
}
console.log(`📄 소개서 PDF ${pdfs}개 → ${PROPOSAL_DEST}`)

// 🪦 2026-10-12: ur-wholesale(GitHub 직접 연결) 빌드면 산출물을 410 묘비로 — scripts/pages-tombstone-gate.mjs
const { runTombstoneGate } = await import('./pages-tombstone-gate.mjs')
runTombstoneGate()

console.log('✅ build:prepare done')
