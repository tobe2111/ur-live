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
    name: '상세(detail) 정적 URDEAL 로더 주입 (blank 흰화면 금지)',
    must: [
      /isLinkshopSurface\s*\|\|\s*isDetailSurface/, // 상세도 정적 로더 분기
      /ur-loader-breathe/,                            // 주입 HTML 에 로더 존재
    ],
    hint: '공구/교환권 상세 #root 는 비우지 말고 링크샵과 동일 정적 URDEAL 로더를 주입하세요.',
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
console.log('✅ loader-continuity: 로더 연속성 4불변식(위상동기·정적로더·seed+dedupe·주기동기) 모두 존재.')
