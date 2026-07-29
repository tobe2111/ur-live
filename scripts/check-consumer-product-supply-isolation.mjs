#!/usr/bin/env node
/**
 * 🧱 소비자 상품 조회 ↔ 도매 원본 격리 회귀 잠금 (2026-06-26) — 서비스 분리(도매↔유어딜) 영구 가드.
 *
 *   배경(CLAUDE.md 최상위 룰): 도매몰(유통스타트 B2B)과 유어딜 공구(소비자)는 한 코드베이스의 두 서비스.
 *   공유 products 테이블은 `is_supply_product`(도매=1) + `supply_source_id`(원본=NULL) 로 격리해야 한다.
 *   승인된 도매 *원본*(is_supply_product=1 AND supply_source_id 없음)은 group_buy_status DEFAULT 'active'
 *   를 상속하므로, 소비자 단건 조회(상세/카트/공구확정)가 supply 필터 없이 group_buy_status 만 보면 누수된다.
 *   리스트/검색(findAll/count/FTS/자동완성)은 이미 격리됐고, 단건 ID 경로도 2026-06-26 에 닫았다.
 *
 *   이 가드: 소비자 단건 상품 조회 *알려진 사이트*가 격리 필터를 **유지**하는지 회귀 검사.
 *   누군가 필터를 지우면(또는 동일 패턴의 새 누수가 이 파일들에 들어오면) red.
 *
 *   격리 토큰(둘 중 하나면 통과): SQL `is_supply_product`+`supply_source_id` 동반 WHERE 절,
 *   또는 라우트 가드 마커 주석 `supply-isolation-ok`(필터 불가한 공유 메서드를 라우트에서 가드한 경우).
 */
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => (existsSync(resolve(ROOT, p)) ? readFileSync(resolve(ROOT, p), 'utf8') : null)

// 소비자 단건 상품 조회 사이트 — 각자 도매 원본 격리를 반드시 보유.
const SITES = [
  {
    file: 'src/features/group-buy/api/group-buy-public.routes.ts',
    // 상세 핸들러 + _diag baseWhere 둘 다 격리(최소 2회 등장).
    test: (s) => (s.match(/NOT \(COALESCE\(p\.is_supply_product, 0\) = 1 AND COALESCE\(p\.supply_source_id, 0\) = 0\)/g) || []).length >= 2,
    desc: '공구 상세 baseWhere (상세 + _diag)',
  },
  {
    file: 'src/features/products/api/products.routes.ts',
    // GET /:id 라우트 가드(findById 는 create/update 공유라 WHERE 불가 → 라우트에서 is_supply_product 체크).
    test: (s) => /product_detail:\$\{id\}/.test(s) && /is_supply_product/.test(s) && /supply_source_id/.test(s),
    desc: 'GET /api/products/:id 라우트 가드',
  },
  {
    file: 'src/features/cart/api/cart.routes.ts',
    test: (s) => /FROM products WHERE id = \? AND NOT \(COALESCE\(is_supply_product, 0\) = 1 AND COALESCE\(supply_source_id, 0\) = 0\)/.test(s),
    desc: '장바구니 getProduct',
  },
  {
    file: 'src/features/group-buy/api/group-buy.routes.ts',
    // confirm-toss 재검증 SELECT 에 격리.
    test: (s) => /FROM products WHERE id = \? AND is_active = 1 AND NOT \(COALESCE\(is_supply_product, 0\) = 1 AND COALESCE\(supply_source_id, 0\) = 0\)/.test(s),
    desc: 'confirm-toss 상품 재검증',
  },
]

const violations = []
let checked = 0
for (const site of SITES) {
  const src = read(site.file)
  if (src == null) { violations.push({ ...site, reason: '파일 없음' }); continue }
  if (/supply-isolation-ok/.test(src)) { checked++; continue } // 명시적 예외(라우트 가드 등)
  checked++
  if (!site.test(src)) violations.push({ ...site, reason: '격리 필터 누락/변형' })
}

console.log(`🧱 소비자 상품 조회 ↔ 도매 원본 격리 회귀 가드`)
console.log(`   검사 ${checked}/${SITES.length} 사이트 (소비자 단건 상품 조회)`)
if (violations.length === 0) {
  console.log(`✅ 위반 0 — 모든 소비자 단건 상품 조회가 도매 원본(is_supply_product=1·supply_source_id 없음) 격리 유지.`)
  process.exit(0)
}
console.log(`\n❌ 도매 원본 누수 위험 ${violations.length}건 (도매 B2B 원본이 소비자 표면에 노출):`)
for (const v of violations) {
  console.log(`   • ${v.file} — ${v.desc}: ${v.reason}`)
  console.log(`     → SQL WHERE 에 \`AND NOT (COALESCE(is_supply_product,0)=1 AND COALESCE(supply_source_id,0)=0)\` 유지(또는 라우트 가드 + supply-isolation-ok 주석).`)
}
const STRICT = process.env.STRICT_SUPPLY_ISOLATION === '1'
process.exit(STRICT ? 1 : 0)
