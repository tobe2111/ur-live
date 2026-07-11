#!/usr/bin/env node
/**
 * 🛡️ 영구 방어선 — "로딩이 2번 나뉘어 보임"(로더 블링크/이중 로딩) 회귀 방지.
 *
 * 배경(2026-07-02 대표 신고, 이 클래스는 세션 내 4회+ 반복): 콜드/SPA 진입 시 로더가
 *   [정적 HTML → Suspense 청크 → 페이지 데이터] 로 여러 번 마운트되는데, 각 마운트가
 *   CSS 애니메이션을 keyframe 0 부터 재시작(breathe=로고 어두워짐, sweep=바가 화면 밖)하면
 *   같은 로더여도 "떴다 안떴다 다시 뜨는" 이중 로딩으로 보인다. + 상세 페이지가 카드
 *   prefetch 를 무시하고 자체 fetch 를 또 시작하면 로더 노출이 2배로 늘어난다.
 *
 * 연속 로딩은 4개 불변식의 조합으로 성립 — 하나라도 제거/약화되면 재발:
 *   1. BrandLoader — performance.now() 기반 음수 animation-delay(위상 전역동기) 유지,
 *      고정 200ms 지연(재마운트 시 바 사라짐의 원인) 재유입 금지.
 *   2. worker — 공구/교환권 상세(#root)에 정적 URDEAL 로더 주입(blank 흰화면 금지),
 *      정적 로더에도 고정 delay 금지(위상 0 시작 = React 로더와 정합).
 *   3. GroupBuyDetailPage — SSR/prefetch seed 즉시소비(pickSeedDetail) + freshness fetch 는
 *      RQ fetchQuery(in-flight prefetch dedupe) 유지 — raw axios 회귀 금지.
 *   4. index.css ↔ BrandLoader 주기 동기 — breathe 1.5s / sweep 1.15s 가 양쪽에서 일치해야
 *      음수 delay 위상 계산이 맞음(한쪽만 바꾸면 동기 깨져 블링크 재발).
 *
 * 기본 warn-only(exit 0). 차단: STRICT_LOADER_CONTINUITY=1 또는 `-s`.
 * 의도적 변경 시: 주기 상수를 양쪽 함께 바꾸고 이 가드도 갱신.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const STRICT = process.env.STRICT_LOADER_CONTINUITY === '1' || process.argv.includes('-s')

const read = (rel) => {
  const p = join(ROOT, rel)
  return existsSync(p) ? readFileSync(p, 'utf8') : null
}

/** @type {{file:string,name:string,must:RegExp[],mustNot?:RegExp[],hint:string}[]} */
const CHECKS = [
  {
    file: 'src/components/brand/BrandLoader.tsx',
    name: 'BrandLoader 위상 전역동기 (재마운트 연속)',
    must: [
      /performance\.now\(\)/,          // 전역 시계 기반 위상
      /%\s*1\.5/,                       // breathe 주기 동기 (index.css 와 일치)
      /%\s*1\.15/,                      // sweep 주기 동기
      /animationDelay:\s*breatheDelay/, // 음수 delay 적용
      /animationDelay:\s*sweepDelay/,
    ],
    mustNot: [
      /animationDelay:\s*['"]200ms['"]/, // 고정 지연 재유입 = 재마운트 시 바 사라짐
    ],
    hint: 'performance.now() 기반 음수 animation-delay 를 유지하세요 (고정 200ms 금지 — 재마운트 블링크 원인).',
  },
  {
    file: 'src/worker/index.ts',
    name: '모든 HTML 라우트 정적 URDEAL 로더 주입 (홈 shell 누수/blank 금지)',
    // 🖼️ 2026-07-07 (대표 신고 "로딩 중간에 이상한 페이지들" + "홈도 이상적으로"): 홈 `/`=RestaurantMapPage 라
    //   prerender 된 #root 홈 shell 이, 특례 안 된 라우트(디폴트)에서 하드로드 첫 페인트에 새어 나오던 것.
    //   → #root 체인의 **catch-all `else`** 가 홈 포함 모든 HTML 라우트(needsRootBlank/blog 선처리 후)에
    //   정적 로더 주입. 이 catch-all 이 `else if(...)` 로 좁혀지면(누가 화이트리스트로 되돌리면) 어떤
    //   라우트가 홈 shell 로 새어 재발 → 아래 must(catch-all else + 로더) + mustNot(게이트된 로더)로 고정.
    must: [
      /const\s+urdealLoaderHtml\s*=/,   // 로더 마크업 SSOT const
      /}\s*else\s*\{[\s\S]*?setInnerContent\(urdealLoaderHtml/, // catch-all else 가 로더 주입(홈 포함 전 라우트)
      /ur-loader-breathe/,                 // 주입 HTML 에 로더 존재
    ],
    mustNot: [
      // 로더 주입이 `else if (...isMainPage...)` 로 게이트되면 홈(또는 그 조건 밖 라우트)이 다시 홈 shell 노출.
      /else\s+if\s*\([^)]*isMainPage[^)]*\)\s*\{[\s\S]{0,600}?setInnerContent\(urdealLoaderHtml/,
    ],
    hint: '모든 HTML 라우트는 prerender 홈 shell 대신 catch-all `else { … urdealLoaderHtml … }` 로 정적 로더를 주입하세요(로더를 `else if(isMainPage)` 로 좁히면 그 조건 밖 라우트에 홈 shell 이 샙니다).',
  },
  {
    file: 'src/pages/GroupBuyDetailPage.tsx',
    name: '상세 seed 즉시소비 + fetch dedupe (이중 fetch/로더 금지)',
    must: [
      /pickSeedDetail/,      // SSR/prefetch seed 첫 render 소비
      /qc\.fetchQuery\(/,    // in-flight prefetch dedupe (raw axios 회귀 금지)
    ],
    hint: 'freshness fetch 는 qc.fetchQuery(groupBuyProduct 키) 로 — raw axios 로 되돌리면 prefetch 와 중복됩니다.',
  },
  {
    file: 'src/index.css',
    name: '로더 주기 상수 동기 (breathe 1.5s / sweep 1.15s)',
    must: [
      /ur-loader-breathe\s+1\.5s/,  // BrandLoader 의 % 1.5 와 일치해야 위상 계산 유효
      /ur-loader-sweep\s+1\.15s/,   // BrandLoader 의 % 1.15 와 일치
    ],
    hint: '주기를 바꾸려면 index.css 와 BrandLoader.tsx(% 상수) 를 함께 바꾸고 이 가드도 갱신하세요.',
  },
  {
    file: 'src/hooks/useOnlineStatus.ts',
    name: 'OfflineBanner SSR-safe (프리렌더 오프라인 오판 금지)',
    // 🛡️ 2026-07-07 (대표 신고 — 로딩 중 "인터넷 연결이 끊겼습니다"): prerender(Node)엔 navigator.onLine 이
    //   undefined → 기존 `navigator.onLine`(falsy) 초기값이 오프라인으로 오판 → 정적 HTML 에 배너가 구워짐.
    //   초기값은 반드시 `=== false` 일 때만 오프라인(그 외 online). 이 불변식이 깨지면 배너가 전 페이지 첫 paint 노출.
    must: [
      /navigator\.onLine\s*===\s*false/, // 명시적 offline 일 때만 오프라인(undefined=online)
    ],
    mustNot: [
      /useState<boolean>\(\s*typeof navigator[^)]*\?\s*navigator\.onLine\s*:/, // 옛 버그: onLine(undefined) 을 초기값으로
    ],
    hint: 'useOnlineStatus 초기값은 `!(typeof navigator!==\'undefined\' && navigator.onLine === false)` 형태로 — SSR/undefined 는 online 으로 간주(프리렌더에 오프라인 배너가 구워지지 않게).',
  },
  {
    file: 'src/i18n-critical.ts',
    name: '홈 above-the-fold i18n 키 critical 포함 (raw 키 flash 금지)',
    // 🗺️ 2026-07-07 (대표 신고 — 홈 로딩 중 'restaurantMap.nearMe' 등 원본 키 노출): 홈=동네딜 지도라 그 상단
    //   라벨이 critical 셋에 없으면 full translation.json 도착 전 raw 키 노출. 홈 above-the-fold 키는 critical 필수.
    must: [
      /restaurantMap:\s*\{/,   // restaurantMap 네임스페이스가 critical 에 존재
      /nearMe:/,               // '내 주변' 칩(홈 최상단, 항상 렌더)
      /sort:\s*\{[^}]*discount:/, // 기본 정렬 라벨
    ],
    hint: "홈 상단 라벨(restaurantMap.nearMe / sort.*)을 CRITICAL_I18N(6개 언어)에 유지하세요 — 빼면 홈 로딩 중 원본 키가 노출됩니다.",
  },
  {
    file: 'src/App.tsx',
    name: '쿼리 내비 전체 리마운트 금지 (key=location.key 재유입 차단)',
    // 🚑 2026-07-10 (대표 신고 "로딩→새로고침→다시 로딩" — 라이브 Playwright 재현으로 특정): 라우트 서브트리를
    //   key={location.key} 로 감싸면 **쿼리만 바뀌는 setSearchParams**(정렬/카테고리/브랜드 칩, /vouchers
    //   자동 카테고리 선택)에도 페이지 전체가 리마운트 → enter 페이드 재생 + SSR 시드 미매칭 풀 로더 재등장.
    //   페이지 전환 페이드는 key={location.pathname}(실제 경로 이동만)으로 구현할 것.
    must: [
      /key=\{location\.pathname\}/,
    ],
    mustNot: [
      /key=\{location\.key\}/,
    ],
    hint: '라우트 래퍼 key 는 location.pathname 으로 — location.key 는 쿼리-전용 내비에도 리마운트를 일으켜 "칩 클릭마다 새로고침" 클래스를 재발시킵니다.',
  },
  {
    file: 'src/hooks/usePrefetchProduct.ts',
    name: '상품 prefetch 키 String 정규화 (number/string 캐시 미스 금지)',
    // 🚑 2026-07-10: 카드는 숫자 id, 상세(useProduct)는 useParams 문자열 키 — String 정규화가 빠지면
    //   ['product',123] ≠ ['product','123'] 로 프리페치가 전부 버려져 카드 탭마다 풀 로더 + 중복 왕복.
    must: [
      /const\s+productId\s*=\s*String\(/,
    ],
    hint: "prefetch 쿼리 키의 id 는 반드시 String() 정규화 — RQ 키는 123 ≠ '123' 입니다.",
  },
  {
    file: 'src/pages/VouchersPage.tsx',
    name: '교환권 카드 prefetch = 상세와 동일 세계 (group-buy 키/엔드포인트)',
    // 🚑 2026-07-10: 카드 목적지 /vouchers/:id 는 /api/group-buy/products/:id + groupBuyProduct 키.
    //   usePrefetchProduct(/api/products/:id, ['product'] 키)로 되돌리면 프리페치 100% 낭비 재발.
    must: [
      /usePrefetchGroupBuyProduct/,
    ],
    hint: '교환권 카드(VoucherCard/VoucherRow)의 prefetch 는 usePrefetchGroupBuyProduct 를 사용하세요 — 상세(VoucherDetailPage fetchQuery)와 키/엔드포인트가 일치해야 탭 즉시표시가 됩니다.',
  },
  {
    file: 'src/hooks/queries/useMapProducts.ts',
    name: '홈 SSR 시드 소비 (첫 페인트 스켈레톤 금지)',
    // 🚑 2026-07-10: 홈(RestaurantMapPage)이 __SSR_INITIAL_MAIN__ 을 동기 시드 — 제거되면 워커 self-fetch 가
    //   순수 낭비로 돌아가고 홈 첫 페인트가 다시 스켈레톤부터 시작.
    must: [
      /__SSR_INITIAL_MAIN__/,
      /peekSsrMainSeed/,
    ],
    hint: 'useMapProducts 의 __SSR_INITIAL_MAIN__ 동기 시드를 유지하세요 — 빼면 홈 하드로드가 [로더→스켈레톤→콘텐츠] 3단으로 회귀합니다.',
  },
  {
    file: 'src/utils/kakao-login-overlay.ts',
    name: '카카오 로그인 오버레이 = BrandLoader 클래스/위상 재사용 (별도 keyframes 금지)',
    // 🚑 2026-07-10 (대표 "카카오 로그인 스플래시도 모두 이상적으로"): 순수 DOM 오버레이(iOS freeze 제약)가
    //   번들 클래스(ur-loader-breathe/sweep) + FCP-기준 음수 delay 를 재사용해야 전체 로더와 픽셀·위상 일치.
    //   자체 keyframes(위상 0 리셋)로 되돌리면 로그인 순간만 "다른 로더" 블링크가 재발.
    must: [
      /ur-loader-breathe/,
      /ur-loader-sweep/,
      /%\s*1\.5/,
      /%\s*1\.15/,
    ],
    hint: '카카오 오버레이는 번들 클래스(ur-loader-breathe/sweep) + BrandLoader 와 동일한 음수 delay 계산을 유지하세요 — 자체 keyframes 재유입 금지.',
  },
]

let failures = 0
for (const c of CHECKS) {
  const src = read(c.file)
  if (src == null) {
    console.error(`❌ [loader-continuity] ${c.file} 없음 — ${c.name}`)
    failures++
    continue
  }
  const missing = c.must.filter((re) => !re.test(src))
  const forbidden = (c.mustNot || []).filter((re) => re.test(src))
  if (missing.length || forbidden.length) {
    failures++
    console.error(`❌ [loader-continuity] ${c.name} (${c.file})`)
    for (const re of missing) console.error(`   누락: ${re}`)
    for (const re of forbidden) console.error(`   금지 패턴 재유입: ${re}`)
    console.error(`   → ${c.hint}`)
  }
}

if (failures) {
  console.error(`\n로더 연속성 불변식 ${failures}건 위반 — "로딩이 2번 나뉘어 보임" 재발 위험 (2026-07-02 대표 신고 클래스).`)
  process.exit(STRICT ? 1 : 0)
}
console.log('✅ loader-continuity: 로더 연속성 11불변식(위상동기·전-라우트정적로더·seed+dedupe·주기동기·offline-SSR-safe·홈critical-i18n·pathname-key·prefetch키정규화·교환권prefetch세계일치·홈SSR시드·카카오오버레이동기) 모두 존재.')
