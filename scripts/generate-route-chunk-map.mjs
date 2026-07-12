#!/usr/bin/env node
/**
 * 🚀 2026-07-12 (로딩 — 상세 하드로드 청크 병렬화, 대표 "이용권 페이지 로딩 아쉬워"):
 *   라우트 → lazy 페이지 청크 매핑 생성기.
 *
 * 배경(라이브 실측 /group-buy/2609): 하드로드 로더 구간(~1.2s)의 대부분이 **JS 청크 직렬 다운로드** —
 *   엔트리가 실행돼야 lazy import(페이지 청크)가 발견돼 그제서야 다운로드가 시작된다.
 *   워커가 해당 라우트의 청크를 `<link rel="modulepreload">` 로 HTML head 에 주입하면
 *   엔트리와 **병렬** 다운로드 → 로더 구간이 실행 시간 수준으로 단축.
 *
 * 동작: dist/client/.vite/manifest.json(vite build --manifest)을 읽어
 *   [라우트 표면 → 페이지 소스 모듈]의 import 폐쇄(closure)에서 엔트리(index.html) 폐쇄를 뺀
 *   잔여 청크(js+css)를 src/worker/generated/route-chunk-map.ts 로 출력.
 *   매니페스트가 없으면(로컬 워커 단독 빌드) 빈 맵으로 출력 — 주입이 조용히 생략될 뿐 안전.
 *
 * 호출: package.json build:worker 체인 선두(node scripts/generate-route-chunk-map.mjs).
 *   출력 파일은 커밋된 기본(빈 맵)을 빌드 시 덮어씀 — 산출물이므로 수동 편집 금지.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST = join(ROOT, 'dist/client/.vite/manifest.json')
const OUT = join(ROOT, 'src/worker/generated/route-chunk-map.ts')

// 표면 키 → 페이지 소스 모듈(매니페스트 키). 워커(index.ts)의 라우트 매칭과 1:1.
const ROUTES = {
  home: ['src/pages/RestaurantMapPage.tsx'],
  gbDetail: ['src/pages/GroupBuyDetailPage.tsx'],
  voucherDetail: ['src/pages/VoucherDetailPage.tsx'],
  product: ['src/pages/ProductDetailPage.tsx'],
  linkshop: ['src/pages/CuratorPage.tsx', 'src/pages/SellerPublicPage.tsx'],
  vouchers: ['src/pages/VouchersPage.tsx'],
  browse: ['src/pages/BrowsePage.tsx'],
}
const MAX_LINKS = 10 // head 링크 스팸 방지 캡(핵심 큰 청크 우선 — closure 순서 = 페이지 청크 → 공유 청크)

function emit(map) {
  const body = `// ⚠️ AUTO-GENERATED — scripts/generate-route-chunk-map.mjs 가 빌드 시 재생성. 수동 편집 금지.
// 라우트 표면별 lazy 페이지 청크(엔트리 폐쇄 제외) — 워커가 modulepreload 로 주입해 엔트리와 병렬 다운로드.
export const ROUTE_CHUNK_MAP: Record<string, { js: string[]; css: string[] }> = ${JSON.stringify(map, null, 2)}
`
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, body)
}

if (!existsSync(MANIFEST)) {
  console.log('[route-chunk-map] manifest 없음(dist/client/.vite) — 빈 맵 출력(주입 생략, graceful)')
  emit({})
  process.exit(0)
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))

/** 매니페스트 키의 import 폐쇄(자기 파일 포함) — js/css 파일 집합. */
function closure(key, seenKeys = new Set()) {
  const js = []
  const css = []
  const walk = (k) => {
    if (seenKeys.has(k)) return
    seenKeys.add(k)
    const e = manifest[k]
    if (!e) return
    if (e.file && e.file.endsWith('.js')) js.push('/' + e.file)
    for (const c of e.css || []) css.push('/' + c)
    for (const imp of e.imports || []) walk(imp)
  }
  walk(key)
  return { js, css }
}

// 엔트리(index.html) 폐쇄 — 이미 HTML 이 modulepreload 하므로 제외.
const entryKey = Object.keys(manifest).find((k) => manifest[k].isEntry)
const entry = entryKey ? closure(entryKey) : { js: [], css: [] }
const entryJs = new Set(entry.js)
const entryCss = new Set(entry.css)

const out = {}
for (const [surface, keys] of Object.entries(ROUTES)) {
  const js = []
  const css = []
  const seen = new Set()
  for (const k of keys) {
    if (!manifest[k]) { console.warn(`[route-chunk-map] 매니페스트에 없음: ${k} (surface=${surface})`); continue }
    const c = closure(k, seen)
    js.push(...c.js)
    css.push(...c.css)
  }
  const jsOut = [...new Set(js)].filter((f) => !entryJs.has(f)).slice(0, MAX_LINKS)
  const cssOut = [...new Set(css)].filter((f) => !entryCss.has(f)).slice(0, 4)
  if (jsOut.length) out[surface] = { js: jsOut, css: cssOut }
}

emit(out)
console.log(`[route-chunk-map] 생성 완료 — ${Object.keys(out).length} surfaces:`, Object.entries(out).map(([k, v]) => `${k}(js${v.js.length}/css${v.css.length})`).join(' '))
