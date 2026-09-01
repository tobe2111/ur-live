#!/usr/bin/env node
/**
 * 📦 배송비 판정은 한 곳에서만 (2026-09-01 신설)
 *
 * ■ 왜 생겼나 — 두 화면의 총액이 실제로 달랐다
 *   대표: *"이용권은 배송비도 없는데?"* 그 말을 확인하려고 프리뷰 하네스에 비배송 장바구니를
 *   넣고 렌더해 보니 그대로였다:
 *     · `/cart`      상품 64,900 + **배송비 6,000** = 70,900
 *     · `/checkout`  같은 장바구니 = **64,900** (합계는 맞는데 목록엔 3,000원 두 줄)
 *   원인은 같은 판정이 두 파일에 **따로** 적혀 있었던 것. CheckoutPage 는 2026-06-22 에
 *   "이용권 카테고리도 비배송" 으로 넓혔는데 CartPage 는 `deal_only===1` 에 머물렀다.
 *   합계가 결제 직전에 줄어드는 화면은, 깎아 준 것도 아니고 틀린 것도 아닌 **못 믿을 화면**이다.
 *
 * ■ 두 가지를 고정한다
 *   R1  비배송 판정은 SSOT `isNoShippingProduct`(shared/product-flow) 경유.
 *       구매 흐름 파일에서 `deal_only === 1` 을 손으로 다시 쓰면 위반(그게 갈라진 방식이다).
 *   R2  `shipping_fee || <숫자>` 금지. `||` 는 셀러가 명시한 **0(비배송·무료)** 를
 *       기본값 3,000 으로 되돌린다 — 실제로 이 한 글자가 6,000원을 만들었다. `??` 를 쓸 것.
 *
 * ■ 못 잡는 것 (사람이 봐야 한다)
 *   · 서버 견적(`/api/orders/shipping-quote`)이 배송비를 잘못 주는 경우 — 여긴 클라만 본다
 *   · 화면에 배송비 **줄이 보이는지** — 렌더해서 눈으로 볼 것(하네스 `--cart`)
 *
 * 예외: 그 줄에 `no-shipping-ssot-ok` 주석.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
/** 구매 흐름 파일 — 배송비를 실제로 계산·표시하는 자리. */
const SCOPE = [
  'src/pages/CartPage.tsx',
  'src/pages/CheckoutPage.tsx',
  'src/pages/checkout/OrderItemsList.tsx',
  'src/pages/checkout/OrderSummary.tsx',
  'src/components/cart/CartSummary.tsx',
]
const R1 = /\bdeal_only\s*\)?\s*===?\s*1/
const R2 = /\bshipping_fee\s*\|\|\s*\d/

export function scan(files) {
  const hits = []
  for (const f of files) {
    if (!fs.existsSync(f)) { hits.push(`${path.relative(ROOT, f)}:0 파일이 없다 — 검사 대상이 이동/삭제됐다`); continue }
    const rel = path.relative(ROOT, f)
    fs.readFileSync(f, 'utf-8').split('\n').forEach((ln, i) => {
      const t = ln.trim()
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('{/*') || t.startsWith('/*')) return
      if (ln.includes('no-shipping-ssot-ok')) return
      if (R1.test(ln)) hits.push(`${rel}:${i + 1} deal_only 를 직접 비교 — isNoShippingProduct 를 쓸 것`)
      if (R2.test(ln)) hits.push(`${rel}:${i + 1} shipping_fee || N — 명시한 0 을 삼킨다. ?? 를 쓸 것`)
    })
  }
  return hits
}

/* 🧪 합성 대조 — 0 을 기대하는 검사는 정규식이 죽어도 0 이라 초록불이다. */
function selfTest() {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'noship-'))
  try {
    const w = (n, c) => { const p = path.join(dir, n); fs.writeFileSync(p, c); return p }
    const fail = []
    const bad1 = w('Bad1.tsx', 'const a = items.every(i => Number(i.deal_only) === 1)\n')
    const bad2 = w('Bad2.tsx', 'const fee = item.shipping_fee || 3000\n')
    const ok = w('Ok.tsx', 'const a = items.every(isNoShippingProduct)\nconst fee = item.shipping_fee ?? 3000\n')
    if (!scan([bad1]).length) fail.push('deal_only 직접 비교를 못 잡는다')
    if (!scan([bad2]).length) fail.push('shipping_fee || N 을 못 잡는다')
    if (scan([ok]).length) fail.push('정상 코드를 오탐한다')
    if (!scan([path.join(dir, 'Missing.tsx')]).length) fail.push('사라진 대상 파일을 통과시킨다')
    return fail
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}

const selfFail = selfTest()
if (selfFail.length) {
  console.error('❌ no-shipping-ssot: **가드 자신이 고장났다** — ' + selfFail.join(' · '))
  process.exit(1)
}

/* 🔬 측정 0 = 실패 — 목록이 줄면 위반도 0 이라 초록이 뜨는데 그 초록은 아무것도 보장하지 않는다. */
if (SCOPE.length < 5) {
  console.error(`❌ no-shipping-ssot: 검사 대상이 ${SCOPE.length}개다 — 목록이 낡았거나 줄었다(통과 아님).`)
  process.exit(1)
}

const hits = scan(SCOPE.map((f) => path.join(ROOT, f)))
if (hits.length) {
  console.error(`❌ no-shipping-ssot: 배송비 판정이 갈라진다 (${hits.length}건)`)
  hits.forEach((h) => console.error('   ' + h))
  console.error('\n   SSOT: src/shared/product-flow.ts `isNoShippingProduct`')
  process.exit(1)
}
console.log(`✅ no-shipping-ssot: 구매 흐름 ${SCOPE.length}개 파일이 한 기준을 쓴다`)
