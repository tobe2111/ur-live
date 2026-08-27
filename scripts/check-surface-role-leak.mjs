#!/usr/bin/env node
/**
 * 🚧 소비자 표면 preload 에 **역할 전용 청크**가 섞이는 것 차단.
 *
 * ## 왜 별도 가드인가 — 기존 가드가 이 자리를 안 본다
 * `check-critical-chunks.mjs` 는 **`index.html` 의 entry + modulepreload** 만 본다.
 * 그런데 2026-07-12 부터 워커가 표면별로 **추가 modulepreload 를 주입**한다
 * (`src/worker/generated/route-chunk-map.ts` — 하드로드 청크 병렬화).
 * 즉 홈의 실제 첫 페인트 바이트 = index.html **＋ 이 맵**인데, 후자는 어느 가드도 안 봤다.
 *
 * 그래서 2026-08-27 실측에서 이런 것들이 조용히 나가고 있었다:
 *   · 홈    → `app-seller-components` **65KB**(SellerLayout·BulkUploadModal·SellerKpiDashboard…)
 *             원인: 공용 `RoleGate.tsx` → `shared/seller-roles.ts` 가 셀러 청크에 묶여 있었다
 *   · 홈    → `app-wholesale-hooks`(도매 채팅 훅) · admin/wholesale/marketing 컴포넌트 다수
 *   · /browse → `app-seller-components` 65KB
 *             원인: `lib/seller-tracking.ts` — **이름만 셀러**이고 실제론 소비자 4개 페이지가 쓰는 70줄 유틸
 *
 * 전부 **에러가 없다.** 화면도 멀쩡하다. 바이트만 조용히 샌다 — 이 레포가 반복해 만난 클래스다.
 *
 * ## 무엇을 고정하나
 * 소비자 표면의 preload 목록에 **역할 전용 청크 이름이 등장하면 실패**한다.
 * 바이트가 아니라 **이름**으로 본다: 총합 예산은 후행 감지기라 여유가 있는 동안 조용히 지나간다.
 *
 * ## 이 가드가 못 잡는 것
 * · 역할 전용이 아닌 청크가 **내부에서 커지는 것**(이름은 그대로) → `check-bundle-size` 의 몫
 * · `MAX_LINKS` 캡에 잘려 맵에 안 실린 청크 → 브라우저는 결국 받지만 여기선 안 보인다
 *   (그래서 캡이 판정을 가릴 수 있다는 것도 알고 있어야 한다)
 *
 * ## 사용
 *   node scripts/check-surface-role-leak.mjs     # 빌드 후 실행
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MAP = path.join(root, 'src/worker/generated/route-chunk-map.ts')
const BUILT = path.join(root, 'dist/client/index.html')

/** 소비자가 보는 표면 — `generate-route-chunk-map.mjs` 의 ROUTES 키와 같은 이름. */
const CONSUMER_SURFACES = ['home', 'gbDetail', 'voucherDetail', 'product', 'linkshop', 'vouchers', 'browse']

/**
 * 소비자 첫 페인트에 절대 있으면 안 되는 청크.
 * ⚠️ `app-seller-components` 는 **셀러 대시보드** 봉투다 — 소비자용 셀러 storefront
 *    (`/u/{handle}` 링크샵)와 헷갈리지 말 것. 링크샵이 쓰는 건 페이지 청크지 이 봉투가 아니다.
 */
const ROLE_ONLY = /^app-(seller-components|admin-components|agency-components|wholesale|dashboard|marketing|live-components|streaming)/

const chunkName = (f) => f.split('/').pop().replace(/-[A-Za-z0-9_-]{8}\.js$/, '').replace(/\.js$/, '')

if (!fs.existsSync(MAP)) {
  console.error('❌ surface-role-leak: route-chunk-map.ts 가 없다 — 생성기 경로가 바뀌었다(가드가 무력화된 상태).')
  process.exit(1)
}

let map
try {
  const src = fs.readFileSync(MAP, 'utf8')
  map = JSON.parse(src.slice(src.indexOf('= {') + 2).trim())
} catch (e) {
  console.error(`❌ surface-role-leak: route-chunk-map.ts 를 못 읽었다 — ${e.message}`)
  console.error('   생성기 출력 형식이 바뀌었다. 파서를 고칠 것(측정 실패는 통과가 아니다).')
  process.exit(1)
}

const surfaces = Object.keys(map)
if (surfaces.length === 0) {
  // 커밋본은 **빈 맵**이다(빌드 시 생성). 빌드 산출물이 있는데도 비었으면 그건 고장이다.
  if (fs.existsSync(BUILT)) {
    console.error('❌ surface-role-leak: 빌드 산출물은 있는데 맵이 비었다 — 생성기가 안 돌았거나 실패했다.')
    process.exit(1)
  }
  console.log('⏭️  surface-role-leak: SKIP — 빌드 전(맵이 비어 있음). 상주 지점은 verify.yml 의 build 직후.')
  process.exit(0)
}

/**
 * 🕐 이 맵이 **이번 빌드의 것인가**.
 *
 * 레포에는 예전 빌드의 맵이 커밋돼 있을 수 있다(실제로 그랬다 — 2026-08-09 산출물). 그걸 읽으면
 * 옛 청크 구성으로 판정해 **없는 누수를 신고하거나 있는 누수를 놓친다.** 파일이 참조하는 자산이
 * 실제로 `dist/client` 에 있는지로 신선도를 본다. 없으면 "낡은 맵"이지 "위반"이 아니다.
 */
const distRoot = path.join(root, 'dist/client')
const allJs = surfaces.flatMap((s) => map[s].js ?? [])
const missing = allJs.filter((f) => !fs.existsSync(path.join(distRoot, f.replace(/^\//, ''))))
if (missing.length > 0) {
  console.error(`❌ surface-role-leak: 맵이 이번 빌드의 것이 아니다 — 참조 자산 ${missing.length}/${allJs.length}개가 dist 에 없다.`)
  console.error(`   예: ${missing[0]}`)
  console.error('   `npm run build`(build:worker 체인이 생성기를 돌린다) 후 다시 실행할 것.')
  console.error('   ⚠️ 낡은 맵으로 내린 판정은 신고도 통과도 전부 못 믿는다.')
  process.exit(1)
}

// 표면 이름이 통째로 바뀌면 검사 대상이 0이 되어 **조용히 통과**한다 — 그것도 실패로 본다.
const checked = CONSUMER_SURFACES.filter((s) => map[s])
if (checked.length === 0) {
  console.error(`❌ surface-role-leak: 검사한 소비자 표면이 0개다(맵 키: ${surfaces.join(', ')}).`)
  console.error('   ROUTES 키가 바뀐 것이다. CONSUMER_SURFACES 를 맞출 것 — 0건 통과는 통과가 아니다.')
  process.exit(1)
}

const bad = []
for (const s of checked) {
  for (const f of map[s].js ?? []) {
    const n = chunkName(f)
    if (ROLE_ONLY.test(n)) bad.push([s, n])
  }
}

if (bad.length > 0) {
  console.error(`\n❌ surface-role-leak: 소비자 표면 preload 에 역할 전용 청크 ${bad.length}건`)
  for (const [s, n] of bad) console.error(`   ${s} → ${n}`)
  console.error('\n   원인은 대개 **작은 공용 모듈이 역할 전용 청크 안에 들어 있는 것**이다.')
  console.error('   그 모듈 하나를 소비자가 import 하면 봉투가 통째로 첫 페인트로 온다.')
  console.error('   조치 ① 그 공용 모듈을 vite.config manualChunks 에서 app-shared 로 뺄 것')
  console.error('        (실제 사례: shared/seller-roles.ts · lib/seller-tracking.ts — 둘 다 이름만 셀러였다)')
  console.error('        ② 정말 역할 전용이면 소비자 쪽 import 를 lazy 로 내릴 것')
  process.exit(1)
}

console.log(`✅ surface-role-leak: 소비자 표면 ${checked.length}개 — 역할 전용 청크 0건`)
