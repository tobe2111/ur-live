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
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST = join(ROOT, 'dist/client/.vite/manifest.json')
const OUT = join(ROOT, 'src/worker/generated/route-chunk-map.ts')

// 표면 키 → 페이지 소스 모듈(매니페스트 키). 워커(index.ts)의 라우트 매칭과 1:1.
// 🧩 2026-10-13: vite.config.ts 도 이 표를 쓴다(손님 페이지별 청크 묶음 — `surfaceChunkName`). 그래서 export 하고,
//   아래 생성 본체는 이 파일을 **직접 실행했을 때만** 돈다(import 만 해도 맵을 덮어쓰면 안 된다).
export const ROUTES = {
  // 🏠 2026-08-22: 홈은 `HomeRoute` 뷰포트 분기다 — lg+ = PcHomePage / 그 외 = MobileHomePage.
  //   ⚠️ 여기 `RestaurantMapPage` 가 남아 있었다(2026-07-15 "홈=지도" 결정의 잔재). 그 결과 홈 첫
  //      화면이 **안 쓰는 지도 청크 23KB(gzip)를 미리 받고**, 정작 쓰는 홈 청크는 병렬화 못 받았다
  //      — 양쪽으로 손해였고 에러가 없어 아무도 몰랐다. 지도는 `/map` 전용이다.
  //   📱 2026-10-13: 폰과 PC 를 나눈다 — 한 표면이면 폰이 PC 홈 청크(실측 ~9KB br)까지 미리 받는다.
  //   워커가 UA 로 고른다(`isMobileUserAgent`). 태블릿처럼 UA 와 뷰포트가 어긋나면 preload 가 빗나갈 뿐 동작은 같다.
  home: ['src/pages/mobile-home/MobileHomePage.tsx'],
  homePc: ['src/pages/pc-home/PcHomePage.tsx'],
  gbDetail: ['src/pages/GroupBuyDetailPage.tsx'],
  voucherDetail: ['src/pages/VoucherDetailPage.tsx'],
  product: ['src/pages/ProductDetailPage.tsx'],
  linkshop: ['src/pages/CuratorPage.tsx', 'src/pages/SellerPublicPage.tsx'],
  vouchers: ['src/pages/VouchersPage.tsx'],
  browse: ['src/pages/BrowsePage.tsx'],
  // 🗺️ 2026-10-11 지도 — 피드 홈의 배너·하단 탭 목적지이고 공유 링크로도 들어온다(하드로드 진입점).
  map: ['src/pages/RestaurantMapPage.tsx'],
  // 🎬 2026-09-21 유어쇼츠 전체 보기 — 홈 레일의 「전체 보기」·상단 네비가 여기로 온다(하드로드 진입점).
  urshorts: ['src/pages/UrShortsBrowsePage.tsx'],
}
/**
 * 🐢 2026-10-15 (대표 "각 페이지마다도 느리고" — 18곳 실측): **preload 만** 받는 표면.
 *   이 페이지들은 맵에 없어서 페이지 청크가 앱 부팅(느린 4G 약 2.5초) **뒤에야** 출발했다. 장바구니·로그아웃 마이는
 *   그 뒤 20여 파일을 받느라 "로그인하세요" 안내 하나를 5.1~5.6초에 띄웠고, 그 사이 `load` 가 지나 센트리(129KB)가
 *   같은 회선을 나눠 썼다 — preload 는 `load` 를 붙들므로 등재하면 센트리도 페이지 뒤로 밀린다.
 *   ⚠️ `ROUTES` 와 따로 두는 이유: `ROUTES` 는 vite 묶음기(`surface-chunks.mjs`)의 입력이기도 하다. 여기 넣으면
 *      묶음이 다시 짜여 기존 화면이 무거워지거나(공용 기준 4 → 전 화면 +7~9KB) 파일이 늘었다(기준을 올리면 +2~5개).
 *      preload 만이면 청크 구성은 1바이트도 안 바뀌고 출발 시점만 당겨진다.
 *   로그인 화면(UserProfilePage·MyVouchersPage)은 셀러 도구와 코드를 나눠 써서 넣지 않는다.
 */
export const PRELOAD_ONLY_ROUTES = {
  cart: ['src/pages/CartPage.tsx'],
  search: ['src/pages/SearchPage.tsx'],
  faq: ['src/pages/FAQPage.tsx'],
  stays: ['src/pages/StaysSearchPage.tsx'],
  stayDetail: ['src/pages/StayDetailPage.tsx'],
  // 🏨 2026-10-15 블로그 목록·글 — 색인 진입점(같은 날 다른 세션이 함께 등재)
  blog: ['src/pages/BlogListPage.tsx'],
  blogPost: ['src/pages/BlogDetailPage.tsx'],
  region: ['src/pages/region/RegionPage.tsx', 'src/pages/region/RegionIndexPage.tsx'],
  guestMy: ['src/pages/guest/GuestMyPage.tsx'],
  guestPass: ['src/pages/guest/GuestPassPage.tsx'],
  guestUShop: ['src/pages/guest/GuestUrShopPage.tsx'],
  // 🏠 2026-10-26 (대표 "/life/pro 로딩이 상대적으로 많이 길어"): 생활 허브·업체 등록 — 색인되는 하드로드 진입점.
  life: ['src/pages/life/LifePage.tsx'],
  lifePro: ['src/pages/life/LifeProPage.tsx'],
}
// head 링크 스팸 방지 캡(핵심 큰 청크 우선 — closure 순서 = 페이지 청크 → 공유 청크).
// 🗺️ 2026-10-19 (대표 *"지도랑 블로그도 상세히"*) 10 → 16: 이 목록은 그 페이지의 **정적 import 폐쇄**라 잘린 청크도
//   렌더 전에 반드시 받는다. 다만 잘리면 페이지 청크가 실행된 **뒤에야** 발견돼 왕복 하나가 직렬로 붙는다(라이브 /map 실측:
//   `SiteFooter`·`in-app-warning` 두 조각이 3.05초에 출발 → 지도 생성·타일이 그만큼 늦었다). 10 에서 잘리던 표면이
//   다섯이었다(지도·이용권 상세·유어샵·검색·지역 — 지역은 **자기 페이지 청크**가 잘렸다). 16 이면 전부 들어간다.
//   잘림이 다시 생기면 빌드 로그에 경고가 찍힌다(아래 `cut`).
const MAX_LINKS = 16

function emit(map, entryCssFiles = [], bootJs = []) {
  const body = `// ⚠️ AUTO-GENERATED — scripts/generate-route-chunk-map.mjs 가 빌드 시 재생성. 수동 편집 금지.
// 라우트 표면별 lazy 페이지 청크(엔트리 폐쇄 제외) — 워커가 modulepreload 로 주입해 엔트리와 병렬 다운로드.
export const ROUTE_CHUNK_MAP: Record<string, { js: string[]; css: string[] }> = ${JSON.stringify(map, null, 2)}
// 🚦 2026-10-12 엔트리(index.html) CSS — 워커가 HTML 응답에 \`Link: rel=preload\` 헤더로 싣는다(Early Hints 103 원천).
export const ENTRY_CSS: string[] = ${JSON.stringify(entryCssFiles)}
// 🈯 2026-10-15 손님 화면이 부팅 직후 **반드시** 부르는 동적 청크(한국어 번역) — 워커가 라우트 청크와 함께 modulepreload.
export const BOOT_JS: string[] = ${JSON.stringify(bootJs)}
`
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, body)
}

function main() {
  if (!existsSync(MANIFEST)) {
    console.log('[route-chunk-map] manifest 없음(dist/client/.vite) — 빈 맵 출력(주입 생략, graceful)')
    emit({})
    return
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
  for (const [surface, keys] of Object.entries({ ...ROUTES, ...PRELOAD_ONLY_ROUTES })) {
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
    const jsAll = [...new Set([...pageJs, ...sharedJs])].filter((f) => !entryJs.has(f))
    if (jsAll.length > MAX_LINKS) console.warn(`[route-chunk-map] ${surface}: 정적 폐쇄 ${jsAll.length}개 중 ${jsAll.length - MAX_LINKS}개가 캡에 잘렸다 — 그 청크는 페이지가 실행된 뒤 직렬로 받는다:`, jsAll.slice(MAX_LINKS).join(' '))
    const jsOut = jsAll.slice(0, MAX_LINKS)
    const cssOut = [...new Set(css)].filter((f) => !entryCss.has(f)).slice(0, 4)
    if (jsOut.length) out[surface] = { js: jsOut, css: cssOut }
  }

  // 🈯 2026-10-15 (대표 *"계속 개선점 찾아줘"* — /stays 폭포 실측): 한국어 번역 청크(locale-ko, 약 35KB)는 i18n 이 **엔트리를
  //   다 실행한 뒤에야** 동적으로 부른다(실측 3.2초 도착). 그 사이 화면은 임시 문구로 그렸다가 다시 그린다.
  //   손님 화면은 전부 이 청크를 쓰므로 라우트 청크와 함께 미리 받는다(국문 기본 — 다른 언어는 그대로 동적).
  const koKey = Object.keys(manifest).find((k) => k.includes('locales/ko/translation.json') && k.endsWith('?i18n-core'))
  const bootJs = koKey && manifest[koKey]?.file ? ['/' + manifest[koKey].file] : []
  if (!bootJs.length) console.warn('[route-chunk-map] 한국어 번역 청크를 매니페스트에서 못 찾았다 — 미리받기 생략')
  emit(out, entry.css, bootJs)
  console.log(`[route-chunk-map] 생성 완료 — ${Object.keys(out).length} surfaces:`, Object.entries(out).map(([k, v]) => `${k}(js${v.js.length}/css${v.css.length})`).join(' '))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
