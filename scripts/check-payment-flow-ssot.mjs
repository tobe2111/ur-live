#!/usr/bin/env node
/**
 * 💳 "결제수단을 카테고리로 정한다" 버그 클래스 방어 (2026-08-03 신설)
 *
 * ## 실제로 있었던 일
 *
 * 대표에게 **"이용권·교환권은 딜로만 살 수 있다"** 고 보고했다. 틀렸다.
 * SSOT(`src/shared/product-flow.ts` `getProductFlow`)는 이렇게 정한다:
 *
 * ```
 * 1. deal_only === 1              → voucher_deal    (딜)     ← 교환권
 * 2. group_buy_status === 'active' → group_buy_toss  (카드)   ← 이용권 포함
 * 3. 그 외                         → standard_checkout (카드)
 * ```
 *
 * **카테고리는 판정 기준이 아니다.** SSOT 주석이 정확히 그렇게 경고한다 —
 * *"voucher category 만으로는 voucher 아님 — 같은 category(meal_voucher 등)가 공구 상품의
 * 할인권 형태로 쓰일 수 있음 (예: 김밥천국 할인권 = 공구, Toss 결제)"*.
 *
 * 내가 그렇게 오해한 직접 원인은 **소비자 화면의 낡은 주석**이었다:
 * *"교환권 (voucher 카테고리) 은 딜 결제"* — 명칭 SSOT 상 `meal_voucher` 는 **이용권**이고
 * 교환권은 `deal_only=1` 인데, 주석이 둘을 같은 말로 쓰고 있었다.
 *
 * ## 룰
 *
 * - **R1**: 결제수단(`payment_method: 'deal'|'toss'`)을 정하는 분기가 **카테고리 술어**
 *   (`isVoucherCategory` · `VOUCHER_CATEGORIES` · `category === '*_voucher'`)에 걸려 있으면 위반.
 *   판정은 `getProductFlow`/`resolveProductFlow` 를 거쳐야 한다.
 * - **R2**: 소비자 결제 표면에서 "교환권" 을 **카테고리와 동일시하는 주석**은 위반.
 *   (주석이 다음 세션을 오도한다 — 이 사고가 그렇게 났다.)
 *
 * ## 이 가드가 못 막는 것
 *
 * 서버측 카테고리 검증(`/join` 이 재고·카테고리·마감을 확인하는 것)은 결제수단 판정이 아니라
 * **유효성 검사**라 대상이 아니다. 그건 정당하다.
 *
 * 동작: 기본 warn-only. 차단: `-s` 또는 `STRICT_PAYMENT_FLOW=1`. 예외: 같은 줄/윗줄 `payment-flow-ok`.
 */
import fs from 'node:fs'
import path from 'node:path'

const STRICT = process.argv.includes('-s') || process.env.STRICT_PAYMENT_FLOW === '1'
const ROOT = process.cwd()

/** 소비자 결제수단을 실제로 고르는 표면들. 여기가 아니면 관심 없다. */
const SURFACES = [
  'src/pages/GroupBuyDetailPage.tsx',
  'src/pages/VoucherDetailPage.tsx',
  'src/pages/ProductDetailPage.tsx',
  'src/pages/CheckoutPage.tsx',
  'src/pages/checkout/PaymentSection.tsx',
]

const CATEGORY_PREDICATE = /isVoucherCategory|VOUCHER_CATEGORY_SET|VOUCHER_CATEGORIES|category\s*===\s*['"`]\w*_?voucher|['"`]meal_voucher['"`]\s*[,)]/
const FLOW_SSOT = /getProductFlow|resolveProductFlow/
/**
 * ⚠️ 리터럴만 보면 안 된다 — 첫 구현은 `payment_method\s*:\s*'deal'` 만 찾아서,
 *    정작 잡아야 할 `payment_method: isVoucherCategory(c) ? 'deal' : 'toss'` 를 **통과시켰다**
 *    (주입 검증에서 초록이 떠서 알았다). 결제수단을 **정하는 자리**를 폭넓게 잡는다.
 */
const PAYMENT_DECISION = /payment_method\s*[:=]/
/** 무엇이 이 결제수단을 정했나 — 위로 훑어 **먼저 만나는** 근거가 답이다. */
const LOOKBACK = 40

const problems = []
let scanned = 0

for (const rel of SURFACES) {
  const abs = path.join(ROOT, rel)
  if (!fs.existsSync(abs)) {
    // 경로가 낡으면 **통과가 아니라 실패** — 조용히 사라지는 가드를 만들지 않는다.
    problems.push({ file: rel, line: 0, kind: 'missing', text: '검사 대상 파일이 없다 (경로가 낡았다)' })
    continue
  }
  const lines = fs.readFileSync(abs, 'utf8').split('\n')
  scanned++

  lines.forEach((line, i) => {
    const near = (lines[i - 1] || '') + line + (lines[i + 1] || '')
    if (/payment-flow-ok/.test(near)) return

    const isComment = /^\s*(\/\/|\*|\/\*)/.test(line)

    // R2 — 주석이 교환권을 **카테고리로 정의**하는 경우만.
    //   ⚠️ 넓게 잡으면 정상 주석까지 빨간불이 된다(첫 구현이 실제로 2건 오탐했다 —
    //      `deal_only=1(기프티콘 교환권) OR isVoucherCategory(동네딜 공구)` 는 **맞는** 설명이다).
    //   그래서 "교환권" 바로 뒤에 오는 동격 괄호가 카테고리를 말하는 형태만 잡는다.
    if (isComment && /교환권\s*[(（][^)）]*(카테고리|category)/.test(line)) {
      problems.push({
        file: rel, line: i + 1, kind: 'R2',
        text: '주석이 교환권을 카테고리와 등치 — 교환권은 deal_only=1 이고 이용권(meal_voucher 등)은 카드다',
      })
      return
    }
    if (isComment) return

    // R1 — 이 결제수단을 정한 근거가 SSOT 인가 카테고리인가.
    //   같은 줄부터 위로 훑어 **먼저 만나는 쪽**이 실제 근거다(둘 다 있으면 가까운 쪽).
    if (PAYMENT_DECISION.test(line)) {
      for (let j = i; j >= Math.max(0, i - LOOKBACK); j--) {
        const l = lines[j]
        if (/^\s*(\/\/|\*)/.test(l)) continue          // 주석은 근거가 아니다
        if (FLOW_SSOT.test(l)) break                     // SSOT 경유 — 정상
        if (CATEGORY_PREDICATE.test(l)) {
          problems.push({
            file: rel, line: i + 1, kind: 'R1',
            text: `결제수단을 카테고리로 결정(${j + 1}줄) — getProductFlow(SSOT)를 거칠 것`,
          })
          break
        }
      }
    }
  })
}

// 🔍 측정 0 = 통과가 아니라 실패. 표면 경로가 낡으면 이 가드는 아무것도 안 보면서 초록이 된다.
if (scanned === 0) {
  console.error('❌ payment-flow-ssot: 검사 대상이 0개다 — SURFACES 경로가 낡았다(통과 아님).')
  process.exit(1)
}

if (problems.length === 0) {
  console.log(`✅ payment-flow-ssot: 결제수단 판정이 SSOT 를 거친다 (표면 ${SURFACES.length}개).`)
  process.exit(0)
}

console.error(STRICT ? '❌ 결제수단 판정 SSOT 위반' : '⚠️  결제수단 판정 SSOT 위반 (warn)')
for (const p of problems) {
  console.error(`   - ${p.file}:${p.line} [${p.kind}] ${p.text}`)
}
console.error('')
console.error('   판정 SSOT: src/shared/product-flow.ts getProductFlow()')
console.error('     deal_only=1 → 딜(교환권) · group_buy_status=active → 카드(이용권/공구) · 그 외 → 카드')
console.error('   의도적이면 해당 줄 근처에 `payment-flow-ok` 주석.')
process.exit(STRICT ? 1 : 0)
