// 🛡️ 2026-05-07: cross-platform build:prepare (Windows + macOS + Linux 동시 지원).
//   기존 cp 명령은 PowerShell 에서 동작 안 함 → Node fs API 로 대체.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

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

console.log('✅ build:prepare done')
