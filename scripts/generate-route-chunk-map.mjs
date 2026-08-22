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
 * 동작: dist/client/.vite/manifest.json(vite 의 build.manifest 출력)을 읽어
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
  // 🏠 2026-08-22: 홈은 `HomeRoute` 뷰포트 분기다 — lg+ = PcHomePage / 그 외 = MobileHomePage.
  //   ⚠️ 여기 `RestaurantMapPage` 가 남아 있었다(2026-07-15 "홈=지도" 결정의 잔재). 그 결과 홈 첫
  //      화면이 **안 쓰는 지도 청크 23KB(gzip)를 미리 받고**, 정작 쓰는 홈 청크는 병렬화 못 받았다
  //      — 양쪽으로 손해였고 에러가 없어 아무도 몰랐다. 지도는 `/map` 전용이다.
  home: ['src/pages/pc-home/PcHomePage.tsx', 'src/pages/mobile-home/MobileHomePage.tsx'],
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
  // 🧱 2026-08-22: 진입점이 여러 개인 표면(home = PC/모바일, linkshop = 큐레이터/셀러)은
  //   **각 진입점의 페이지 청크를 먼저** 모은 뒤 공유 청크를 붙인다.
  //   ⚠️ 예전엔 키 순서대로 폐쇄를 이어붙여서, 첫 키의 폐쇄가 MAX_LINKS 를 채우면 **두 번째
  //      진입점의 페이지 청크가 통째로 잘렸다**(실측: linkshop 에서 `SellerPublicPage` 가 빠져
  //      사업자 링크샵이 preload 를 못 받고 있었다 — 그 표면의 본체인데도).
  //      페이지 청크는 작고(2~5KB) 표면마다 유일하므로, 캡이 깎아야 할 것은 공유 청크 쪽이다.
  const pageJs = []
  const sharedJs = []
  const css = []
  const seen = new Set()
  for (const k of keys) {
    if (!manifest[k]) { console.warn(`[route-chunk-map] 매니페스트에 없음: ${k} (surface=${surface})`); continue }
    const c = closure(k, seen)
    if (c.js.length) { pageJs.push(c.js[0]); sharedJs.push(...c.js.slice(1)) }
    css.push(...c.css)
  }
  const jsOut = [...new Set([...pageJs, ...sharedJs])].filter((f) => !entryJs.has(f)).slice(0, MAX_LINKS)
  const cssOut = [...new Set(css)].filter((f) => !entryCss.has(f)).slice(0, 4)
  if (jsOut.length) out[surface] = { js: jsOut, css: cssOut }
}

emit(out)
console.log(`[route-chunk-map] 생성 완료 — ${Object.keys(out).length} surfaces:`, Object.entries(out).map(([k, v]) => `${k}(js${v.js.length}/css${v.css.length})`).join(' '))
