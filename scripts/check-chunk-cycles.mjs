#!/usr/bin/env node
/**
 * 🔁 빌드된 청크끼리 서로 import 하는 **순환**을 0 으로 유지한다 (2026-10-13 — 대표 *"대기업 수준으로"*).
 *
 * 왜: ESM 은 순환하는 두 모듈 중 한쪽을 **먼저** 평가한다. 먼저 도는 쪽이 아직 초기화 안 된 상대의 값을
 *   최상위에서 읽으면 `Cannot access 'x' before initialization` 으로 터진다. 2026-10-13 실측 — 묶음기가
 *   `prop-types` 를 페이지 봉투(lz-…)로 옮기자 `stripe` ↔ `lz-boot-gbDetailL-mapL-productL` 가 서로 import 했고,
 *   **결제 화면(/checkout) 전체가 오류 화면**이 됐다. 빌드·타입·단위시험 전부 초록이었고, 다크 대비 검사가
 *   "글자가 4개뿐" 이라고 알려 주고서야 드러났다(그 검사는 PR 게이트도 아니다).
 *   ⇒ 순환은 *대부분* 무해하지만 어느 것이 터지는지는 평가 순서에 달려 있어 정적으로 판정할 수 없다.
 *     그래서 **순환 자체를 0 으로** 동결한다(실측 기준 0 — 늘면 실패).
 *
 * 판정: dist/client/assets/*.js 의 **정적** import(`import … from "./x.js"`)로 그래프를 만들어 강연결요소를 센다.
 *   동적 import(`import("./x.js")`)는 평가 순서를 묶지 않으므로 세지 않는다.
 *   측정한 청크가 20개 미만이면 **통과가 아니라 실패**(빌드가 깨졌거나 경로가 낡았다).
 *   빌드 산출물이 없으면 SKIP(눈에 보이게) — 상주 실행 지점은 verify.yml 의 build 직후다.
 *
 * ⚠️ 못 보는 것: 청크 **안**의 모듈 순환(번들러가 순서를 맞춘다) · 실제로 터지는지(브라우저 렌더의 몫).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** assets 디렉터리의 청크 정적 import 그래프에서 순환(크기 2 이상 강연결요소)을 돌려준다. */
export function findChunkCycles(assetsDir) {
  const files = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'))
  const g = new Map()
  for (const f of files) {
    const s = fs.readFileSync(path.join(assetsDir, f), 'utf8')
    const deps = new Set()
    // 정적 import 는 압축 결과에서 파일 머리의 `import{…}from"./x.js";` · `import"./x.js";` 꼴이다.
    for (const m of s.matchAll(/(?:^|[;}\n])\s*import\s*(?:[^'"()]*?from\s*)?["']\.\/([^"']+\.js)["']/g)) deps.add(m[1])
    g.set(f, [...deps].filter((d) => d !== f))
  }
  let idx = 0
  const st = []; const on = new Set(); const I = new Map(); const L = new Map(); const out = []
  const visit = (v) => {
    I.set(v, idx); L.set(v, idx); idx++; st.push(v); on.add(v)
    for (const w of g.get(v) || []) {
      if (!g.has(w)) continue
      if (!I.has(w)) { visit(w); L.set(v, Math.min(L.get(v), L.get(w))) }
      else if (on.has(w)) L.set(v, Math.min(L.get(v), I.get(w)))
    }
    if (L.get(v) === I.get(v)) {
      const c = []; let w
      do { w = st.pop(); on.delete(w); c.push(w) } while (w !== v)
      if (c.length > 1) out.push(c.sort())
    }
  }
  for (const v of g.keys()) if (!I.has(v)) visit(v)
  return { cycles: out, chunks: files.length }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const dir = ['dist/client/assets', 'dist/assets'].find((p) => fs.existsSync(p))
  if (!dir) {
    console.log('⏭️  chunk-cycles: SKIP — 빌드 산출물 없음 (npm run build:client 후 실행).')
    process.exit(0)
  }
  const { cycles, chunks } = findChunkCycles(dir)
  if (chunks < 20) {
    console.log(`❌ chunk-cycles: 청크가 ${chunks}개뿐 — 빌드가 깨졌거나 경로가 낡았다(통과 아님).`)
    process.exit(1)
  }
  if (cycles.length) {
    console.log(`❌ chunk-cycles: 청크 순환 ${cycles.length}건 — 평가 순서에 따라 화면이 통째로 오류가 된다.`)
    for (const c of cycles) console.log('   ' + c.join(' <-> '))
    console.log('   흔한 원인: 묶음기(scripts/surface-chunks.mjs)·manualChunks 가 라이브러리 의존을 다른 봉투로 옮겼다.')
    process.exit(1)
  }
  console.log(`✅ chunk-cycles: 청크 ${chunks}개 · 순환 0`)
}
