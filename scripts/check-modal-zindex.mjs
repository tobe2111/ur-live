#!/usr/bin/env node
/**
 * 🛡️ 2026-06-26: 모달/시트가 하단 네비 뒤로 가려지는 버그 클래스 방어 (대표 "이 문제 계속 발생 — 근본적으로").
 *
 * 배경: 풀스크린 오버레이(`fixed inset-0 z-[N]`)가 BottomNav(z-[9999])보다 낮은 z(60~200 등)로
 *   달려, 하단 네비가 모달/바텀시트 위를 덮어 버튼이 안 보였다. 새 모달을 추가할 때마다 재발.
 *
 * 룰: `fixed inset-0 z-[N]` 형태의 풀스크린 오버레이는 z 가 네비(9999) 위여야 한다.
 *   표준 스케일(src/constants/z-index.ts): 모달 10500 / 시트 10600 / 토스트 20000 / 확인창 100000.
 *   → `fixed inset-0 z-[N]` 의 N 이 9999 미만이면 위반.
 *
 * 자동 제외:
 *   - 같은 줄에 `pointer-events-none` (클릭 통과 연출용 오버레이 — 콘페티/축하 등)
 *   - 같은 줄 또는 바로 윗줄에 `modal-zindex-ok` 주석 (의도적 예외 — 네비 숨김 화면 전용 등)
 *
 * 동작: 기본 warn-only. 차단: `-s` 또는 STRICT_MODAL_Z=1 (exit 1).
 */
import fs from 'fs'
import path from 'path'

const STRICT = process.argv.includes('-s') || process.env.STRICT_MODAL_Z === '1'
const ROOT = process.cwd()
const SRC = path.join(ROOT, 'src')
const EXTS = new Set(['.ts', '.tsx'])
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage'])
const NAV_Z = 9999

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const full = path.join(dir, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (EXTS.has(path.extname(name))) out.push(full)
  }
  return out
}

// `fixed inset-0 ... z-[N]` (같은 className 문자열 안). 순서 무관하게 inset-0 와 z-[N] 공존 확인.
const RE = /fixed inset-0[^"'`]*z-\[(\d+)\]|z-\[(\d+)\][^"'`]*fixed inset-0/

const violations = []
for (const file of walk(SRC)) {
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]
    const m = RE.exec(ln)
    if (!m) continue
    const n = parseInt(m[1] ?? m[2], 10)
    if (!Number.isFinite(n) || n >= NAV_Z) continue
    if (ln.includes('pointer-events-none')) continue
    // `modal-zindex-ok` 주석: 같은 줄 또는 직전 3줄(멀티라인 JSX 태그 고려) 내 허용.
    const near = [ln, lines[i - 1], lines[i - 2], lines[i - 3]].filter(Boolean).join('\n')
    if (near.includes('modal-zindex-ok')) continue
    violations.push(`${path.relative(ROOT, file)}:${i + 1}  z-[${n}] (네비 ${NAV_Z} 아래 — 모달이 가려짐)`)
  }
}

if (violations.length === 0) {
  console.log('✅ check-modal-zindex: 풀스크린 오버레이 z-index 정상 (모두 네비 위)')
  process.exit(0)
}

const tag = STRICT ? '❌' : '⚠️'
console.log(`${tag} check-modal-zindex: 네비(9999) 아래 풀스크린 오버레이 ${violations.length}건`)
for (const v of violations) console.log(`   ${v}`)
console.log('   → 표준 z 사용: 모달 z-[10500] / 바텀시트 z-[10600] (src/constants/z-index.ts).')
console.log('   의도적 예외(네비 숨김 화면 등)는 해당 줄/윗줄에 `modal-zindex-ok` 주석.')
process.exit(STRICT ? 1 : 0)
