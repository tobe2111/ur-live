#!/usr/bin/env node
/**
 * 🛡️ 동네딜 ↔ 쇼핑(배송형 general) 완전 분리 가드 — 2026-07-02 대표 확정.
 *
 * 배경: 06-17 동네딜 리스트에 general 카테고리 서버 지원이 추가되자 06-30 데모 확장이
 * 배송형 샘플(원두 드립백/한라봉)을 시드 → 소비자 UI 엔 '일반' 칩이 없어 유령 상품이 되고
 * 상세는 쇼핑 UI 로 열려 "동네딜=우리 동네 매장" 멘탈모델을 흐림 (대표 신고 2건).
 * 결정: **동네딜(홈 피드·리스트·어드민 동네딜 도구)에 배송형(general)을 절대 섞지 않는다.**
 * 배송형은 쇼핑(/browse·셀러 상품 도구) 전용.
 *
 * 불변식 (위반 = exit 1):
 *  R1. 동네딜 공개 리스트(group-buy-public.routes.ts)가 category 'general' 을 조회 대상으로
 *      매핑하는 분기 금지.
 *  R2. 동네딜 어드민 도구(admin-products.routes.ts)의 DEAL_DEMO 시드에 cat 'general' 금지.
 *  R3. 동네딜 카테고리 alias(DEAL_CATEGORY_ALIAS)가 general 로 매핑 금지
 *      (수기 등록·CSV 대량등록의 원천 차단).
 *  R4. 동네딜 수기 등록 폼(ManualDealForm.tsx)의 카테고리 옵션에 general 금지.
 *
 * 의도적 예외(정말 필요하면): 해당 라인에 `dongnedeal-general-ok` 주석 — 단 대표 승인 필수.
 */
import { readFileSync } from 'node:fs'

const violations = []

function check(file, regex, rule, desc) {
  let src
  try { src = readFileSync(file, 'utf8') } catch { return }
  const lines = src.split('\n')
  lines.forEach((line, i) => {
    if (regex.test(line) && !line.includes('dongnedeal-general-ok') && !line.trimStart().startsWith('//') && !line.trimStart().startsWith('*')) {
      violations.push(`   - [${rule}] ${file}:${i + 1} — ${desc}\n       ${line.trim().slice(0, 120)}`)
    }
  })
}

// R1: 동네딜 공개 리스트의 general 조회 분기
check(
  'src/features/group-buy/api/group-buy-public.routes.ts',
  /['"]general['"]\s*\]|===\s*['"]general['"]/,
  'R1', "동네딜 리스트가 general 을 조회 — 완전 분리 위반"
)

// R2: DEAL_DEMO 시드에 general
check(
  'src/features/admin/api/admin-products.routes.ts',
  /cat:\s*['"]general['"]/,
  'R2', "동네딜 데모 시드에 배송형(general) 상품"
)

// R3: alias 가 general 로 매핑
check(
  'src/features/admin/api/admin-products.routes.ts',
  /:\s*['"]general['"]/,
  'R3', "동네딜 카테고리 alias 가 general 로 매핑 (수기/CSV 등록 유입로)"
)

// R4: 수기 등록 폼 옵션
check(
  'src/pages/admin-dongnedeal/ManualDealForm.tsx',
  /v:\s*['"]general['"]/,
  'R4', "동네딜 수기 등록 폼에 '일반' 카테고리 옵션"
)

if (violations.length > 0) {
  console.error('❌ 동네딜↔쇼핑 분리 위반 (2026-07-02 대표 확정 — 동네딜에 배송형 금지):')
  console.error(violations.join('\n'))
  console.error('\n   동네딜=로컬 이용권 전용, 배송형(general)은 쇼핑 전용입니다.')
  console.error("   의도적 예외는 해당 라인에 `dongnedeal-general-ok` 주석 (대표 승인 필수).")
  process.exit(1)
}
console.log('✅ 동네딜↔쇼핑 분리 — 동네딜 표면/도구에 배송형(general) 유입 없음.')
