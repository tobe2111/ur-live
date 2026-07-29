#!/usr/bin/env node
/**
 * 🛡️ [INV-CB] 커미션 예산 아비터 우회 가드 — 2026-07-04 대표 승인 "수수료율 동결·재원 구조 수정".
 *
 * 배경: 플랫폼 부담 성장 커미션(어필리에이트 2%·멀티티어 10/3/1%·영입자 1.5%·에이전시 1~2%)이
 * 서로 캡을 모른 채 GMV % 로 얹혀 최악 스택 시 거래당 플랫폼 손익이 마이너스(트리 경유 −14%)였음.
 * 해법: creditOrderCommissions(order-commissions.ts) 가 **단일 오케스트레이터** — 3P 주문당
 * 예산(플랫폼수수료 − PG준비금) 안에서 비례 배분(commission-budget.ts, 유닛테스트가 수학 보장).
 *
 * 이 가드의 역할 = **영구성**: 미래 코드가 적립 헬퍼를 직접 호출(아비터 우회)하거나 적립 테이블에
 * 새 INSERT 경로를 만들면 예산 캡이 구멍남 → 결정론으로 차단.
 *
 * 불변식 (위반 = exit 1):
 *  R1. 적립 진입 함수(creditAgencyStoreIntroCommission / creditInfluencerStoreIntroCommission /
 *      calculateMultiTierCommission / creditAffiliateFromIntent / creditAffiliateForOrder)의
 *      호출/임포트는 **allowlist 파일 + 상한 개수** 안에서만. 새 호출은 creditOrderCommissions 경유.
 *  R2. 플랫폼 부담 적립 테이블(affiliate_earnings / influencer_attributions /
 *      agency_store_intro_commissions / referral_commissions)에 INSERT 하는 파일은
 *      **베이스라인 파일 목록**만. 새 파일의 직접 INSERT 금지(SSOT 헬퍼 경유).
 *
 * 기존 예외(베이스라인 — 카운트 래칫):
 *  - (해소됨 2026-07-04) group-buy.routes.ts 의 agency credit 2곳 → F7 로 오케스트레이터(only 필터) 경유
 *  - affiliate.routes.ts: /track 경로의 creditAffiliateForOrder (설계 F6)
 *  - payment.routes.ts: 숙소(stay) referral 의 affiliate_earnings 직접 INSERT (설계 F5)
 *  - group-buy helpers.ts / group-buy.routes.ts: 이용권 인플 attribution INSERT (별개 source)
 *  - cron agency-store-intro-monthly-bonus.ts: 월간 보너스 INSERT
 * 의도적 확장이 정말 필요하면: 대표 승인 + 이 파일 베이스라인 갱신 + commit 메시지에 사유.
 * 설계 SSOT: docs/design/commission-funding-restructure.md
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const violations = []

// ── 파일 수집 (src/**/*.ts, tests 제외) ─────────────────────────────────────
function collect(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) {
      if (p.includes('src/tests') || name === 'node_modules') continue
      collect(p, out)
    } else if (/\.tsx?$/.test(name)) {
      out.push(p)
    }
  }
  return out
}
const files = collect('src')

// 주석 제거(라인 // + 블록 /* */) — 주석 속 함수명 언급은 위반 아님.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((l) => {
      const idx = l.indexOf('//')
      return idx >= 0 ? l.slice(0, idx) : l
    })
    .join('\n')
}

// ── R1: 적립 진입 함수 호출/임포트 allowlist ────────────────────────────────
const ENTRY_FNS = [
  'creditAgencyStoreIntroCommission',
  'creditInfluencerStoreIntroCommission',
  'calculateMultiTierCommission',
  'creditAffiliateFromIntent',
  'creditAffiliateForOrder',
]
// path suffix → { fn: 최대 허용 등장 수 } ('*' = 무제한, 정의 파일/오케스트레이터)
const R1_ALLOW = {
  'src/worker/utils/agency-store-intro-commission.ts': { creditAgencyStoreIntroCommission: '*' },
  'src/worker/utils/influencer-store-intro-commission.ts': { creditInfluencerStoreIntroCommission: '*' },
  'src/worker/utils/affiliate-credit.ts': { creditAffiliateFromIntent: '*', creditAffiliateForOrder: '*' },
  'src/features/referral/api/referral-tree.routes.ts': { calculateMultiTierCommission: '*' },
  'src/worker/utils/order-commissions.ts': {
    creditAgencyStoreIntroCommission: '*', creditInfluencerStoreIntroCommission: '*',
    calculateMultiTierCommission: '*', creditAffiliateFromIntent: '*',
  },
  // 기존 예외 (래칫 — 늘어나면 위반)
  'src/features/affiliate/api/affiliate.routes.ts': { creditAffiliateForOrder: 2 },          // import 1 + /track 1
}

for (const file of files) {
  const rel = file.replace(/\\/g, '/')
  let src
  try { src = stripComments(readFileSync(file, 'utf8')) } catch { continue }
  for (const fn of ENTRY_FNS) {
    const count = (src.match(new RegExp(`\\b${fn}\\b`, 'g')) || []).length
    if (count === 0) continue
    const allowEntry = Object.entries(R1_ALLOW).find(([suffix]) => rel.endsWith(suffix))
    const allowed = allowEntry?.[1]?.[fn]
    if (allowed === '*') continue
    if (typeof allowed === 'number' && count <= allowed) continue
    violations.push(
      `   - [R1] ${rel} — ${fn} ${count}회 (허용 ${allowed ?? 0}) — 적립은 creditOrderCommissions(오케스트레이터) 경유해야 예산 캡이 적용됨`,
    )
  }
}

// ── R2: 적립 테이블 직접 INSERT 베이스라인 ──────────────────────────────────
const R2_TABLES = {
  affiliate_earnings: [
    'src/worker/utils/affiliate-credit.ts',      // SSOT
    'src/worker/routes/payment.routes.ts',       // 숙소(stay) referral — 설계 F5
  ],
  influencer_attributions: [
    'src/worker/utils/influencer-store-intro-commission.ts', // SSOT
    'src/features/group-buy/api/helpers.ts',                 // 이용권 인플 attribution(별개 source)
    'src/features/group-buy/api/group-buy.routes.ts',        // 동일
  ],
  agency_store_intro_commissions: [
    'src/worker/utils/agency-store-intro-commission.ts',     // SSOT
    'src/worker/cron/agency-store-intro-monthly-bonus.ts',   // 월간 보너스
  ],
  referral_commissions: [
    'src/features/referral/api/referral-tree.routes.ts',     // SSOT
  ],
}

for (const file of files) {
  const rel = file.replace(/\\/g, '/')
  let src
  try { src = stripComments(readFileSync(file, 'utf8')) } catch { continue }
  for (const [table, allowFiles] of Object.entries(R2_TABLES)) {
    const re = new RegExp(`INSERT\\s+(?:OR\\s+IGNORE\\s+)?INTO\\s+${table}\\b`, 'i')
    if (!re.test(src)) continue
    if (allowFiles.some((suffix) => rel.endsWith(suffix))) continue
    violations.push(
      `   - [R2] ${rel} — ${table} 직접 INSERT — SSOT 적립 헬퍼(+오케스트레이터) 경유 필수`,
    )
  }
}

// ── R3: F2 이중 커미션 dedup 회귀 방지 ───────────────────────────────────────
//   ledger.ts 의 사용시점 셰어 2함수(recordAgencyCommissionShare/recordIntroductionCommissionShare)는
//   결제확정 시 GMV 커미션과의 주문 단위 dedup([INV-CB-DEDUP] 마커 블록)을 반드시 보유해야 함.
//   제거되면 같은 주문에 두 시스템이 이중 적립(최대 GMV 6% > 수수료 5%) — 2026-07-04 F2 실감사 확정.
try {
  const ledgerSrc = readFileSync('src/worker/utils/ledger.ts', 'utf8')
  const dedupCount = (ledgerSrc.match(/\[INV-CB-DEDUP\]/g) || []).length
  if (dedupCount < 2) {
    violations.push(
      `   - [R3] src/worker/utils/ledger.ts — [INV-CB-DEDUP] 마커 ${dedupCount}개(<2) — 사용시점 셰어의 확정-커미션 dedup 이 제거됨(이중 적립 회귀)`,
    )
  }
} catch {
  violations.push('   - [R3] src/worker/utils/ledger.ts 읽기 실패')
}

// ── R4: 불변식 #44 — owner-redirect 무결성 (2026-07-12 S7, 8월 flip) ─────────────
//   "성장 커미션이 원장 platform:revenue 를 debit 해 5% 를 잠식하지 않는다."
//   범위(현 단계): **딜 지급 축(확정시점 C1~C4)** 헬퍼는 user_points 로만 지급(platform:revenue
//   debit 0). owner 되갚기(debitOwnerPromoForOrder)는 merchant→platform:revenue 를 **credit**(회수).
//   ⚠️ 사용시점 셰어(recordAgency/IntroductionCommissionShare, creditUserCommission)는 아직
//   platform:revenue 를 debit → **S4b(직접 redirect + 환불 대칭 rework, staging 검증) 후** R4 범위 확장.
//   그 전까지 범위 밖(false-positive 방지 — 설계 SSOT §불변식 #44 "리팩토링 후 추가" 지침).
const R4_DEALFUNDED_FILES = [
  'src/worker/utils/affiliate-credit.ts',
  'src/worker/utils/influencer-store-intro-commission.ts',
  'src/worker/utils/agency-store-intro-commission.ts',
]
const PLATREV_DEBIT_RE = /debit_account\s*:\s*['"]platform:revenue['"]/
for (const suffix of R4_DEALFUNDED_FILES) {
  const file = files.find((f) => f.replace(/\\/g, '/').endsWith(suffix))
  if (!file) { violations.push(`   - [R4] ${suffix} 미발견 — 딜지급 축 파일 이동?`); continue }
  const src = stripComments(readFileSync(file, 'utf8'))
  if (PLATREV_DEBIT_RE.test(src)) {
    violations.push(
      `   - [R4] ${suffix} — 딜지급 축이 platform:revenue 를 debit(5% 잠식) — #44 위반. 딜(user_points) 지급 유지 + owner 되갚기(debitOwnerPromoForOrder)로.`,
    )
  }
}
// owner 되갚기는 promo_fee 를 platform:revenue 로 **credit**(회수)해야 함 — debit 이면 방향 역전.
try {
  const ledgerSrc = stripComments(readFileSync('src/worker/utils/ledger.ts', 'utf8'))
  const promoBlock = ledgerSrc.slice(ledgerSrc.indexOf('event_type: \'promo_fee\''), ledgerSrc.indexOf('event_type: \'promo_fee\'') + 400)
  if (promoBlock && !/credit_account\s*:\s*['"]platform:revenue['"]/.test(promoBlock)) {
    violations.push('   - [R4] ledger.ts debitOwnerPromoForOrder — promo_fee 가 platform:revenue 를 credit(회수)하지 않음 — owner 되갚기 방향 역전')
  }
} catch { violations.push('   - [R4] ledger.ts 읽기 실패(owner 되갚기 검증)') }

if (violations.length) {
  console.error('❌ [INV-CB] 커미션 예산 아비터 우회 감지 (docs/design/commission-funding-restructure.md):')
  for (const v of violations) console.error(v)
  console.error('\n   고치는 법: 적립 호출을 order-commissions.ts creditOrderCommissions 로 통합.')
  console.error('   정말 예외가 필요하면 대표 승인 후 이 스크립트의 베이스라인 갱신 + commit 사유 명시.')
  process.exit(1)
}
console.log('✅ [INV-CB] 커미션 예산 아비터 — 우회 호출/신규 INSERT 경로 없음')
