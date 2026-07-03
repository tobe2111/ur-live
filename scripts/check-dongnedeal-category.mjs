#!/usr/bin/env node
/**
 * 🛡️ 2026-07-02: "동네딜(매장 이용권) 도구에 일반 쇼핑(general) 등 비-이용권 카테고리 유입" 방어.
 *
 * 배경 (실제 사고 — 대표 신고 `/admin/dongnedeal-import`): 동네딜 어드민의 통계/목록 쿼리
 *   `category IN (…, 'general')`, 카테고리 별칭 `'온라인'/'일반 상품' → 'general'`, 데모 시드
 *   `cat: 'general'`(드립백/한라봉) 이 섞여 **일반 온라인 쇼핑 상품이 동네딜에 노출·생성**됐다.
 *   동네딜 = 매장 이용권 4종(VOUCHER_CATEGORIES: meal/beauty/stay/etc_voucher) 전용이고,
 *   소비자 동네딜 피드(group-buy-public)도 general 을 제외한다 → 서비스 분리(쇼핑 ↔ 동네딜) 위반.
 *
 * 룰 (동네딜 카테고리 문맥엔 voucher 4종만):
 *   R1  배열 리터럴에 voucher 카테고리와 'general'(또는 타 비-voucher)이 함께 → 동네딜 cats/list 배열.
 *   R2  객체 값 위치 `: 'general'` → 별칭 매핑 값 / 데모 `cat: 'general'`.
 *   R3  클라 `<option value="general">` (동네딜 카테고리 선택).
 *   ⇒ 세 패턴 모두 동네딜 도구에 비-이용권 카테고리를 끌어들이는 사이트.
 *
 * 정당한 용도는 통과: `general: '...'`(라벨 맵의 '키' — 값 아님), 주석 속 general(스트립됨),
 *   voucher 4종만 든 배열.
 *
 * 대상 파일: 동네딜 어드민 라우트 + import 페이지.
 * 동작: 기본 warn-only. 차단: `-s` 또는 STRICT_DONGNEDEAL=1 (exit 1). verify.yml CI 는 -s.
 * 예외: 해당 줄/근처에 `dongnedeal-category-ok` 주석.
 */
import fs from 'fs'
import path from 'path'

const STRICT = process.argv.includes('-s') || process.env.STRICT_DONGNEDEAL === '1'
const ROOT = process.cwd()

const VOUCHER = ['meal_voucher', 'beauty_voucher', 'stay_voucher', 'etc_voucher']
const VOUCHER_SET = new Set(VOUCHER)

// 동네딜 카테고리를 다루는 파일들.
const TARGETS = [
  'src/features/admin/api/admin-products.routes.ts',
  'src/pages/AdminDongnedealImportPage.tsx',
]

/** 주석 내용만 공백 치환(문자열 리터럴은 보존 — 카테고리 값 검사 필요). 줄 번호 보존. */
function stripComments(code) {
  const out = code.split('')
  const n = code.length
  const blank = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' ' }
  let i = 0
  while (i < n) {
    const ch = code[i], nx = code[i + 1]
    if (ch === '/' && nx === '/') { let j = i; while (j < n && code[j] !== '\n') j++; blank(i, j); i = j; continue }
    if (ch === '/' && nx === '*') { let j = i + 2; while (j < n && !(code[j] === '*' && code[j + 1] === '/')) j++; j = Math.min(n, j + 2); blank(i, j); i = j; continue }
    // 문자열은 스킵(내용 보존)
    if (ch === '"' || ch === "'" || ch === '`') { const q = ch; let j = i + 1; while (j < n) { if (code[j] === '\\') { j += 2; continue } if (code[j] === q) break; j++ } i = j + 1; continue }
    i++
  }
  return out.join('')
}

const CAT_LITERAL = /['"]([a-z_]+)['"]/g

const violations = []

for (const rel of TARGETS) {
  const abs = path.join(ROOT, rel)
  if (!fs.existsSync(abs)) continue
  const raw = fs.readFileSync(abs, 'utf8')
  const code = stripComments(raw)
  const lines = code.split('\n')
  const rawLines = raw.split('\n')

  lines.forEach((line, idx) => {
    const ln = idx + 1
    const near = (rawLines[idx] || '') + (rawLines[idx - 1] || '') + (rawLines[idx + 1] || '')
    if (near.includes('dongnedeal-category-ok')) return

    // 이 줄이 voucher 카테고리를 포함하는가(=동네딜 카테고리 문맥일 개연성)
    const cats = [...line.matchAll(CAT_LITERAL)].map(m => m[1])
    const hasVoucher = cats.some(c => VOUCHER_SET.has(c))

    // R1: voucher 와 함께 등장하는 비-voucher 카테고리(배열)
    if (hasVoucher) {
      const bad = cats.filter(c => !VOUCHER_SET.has(c) && (c === 'general' || c.endsWith('_voucher')))
      // 'general' 명시 + 정의 밖 *_voucher 오타 모두 차단
      const badExtra = cats.filter(c => c === 'general')
      const all = [...new Set([...bad, ...badExtra])].filter(c => !VOUCHER_SET.has(c))
      if (all.length) violations.push({ rel, ln, rule: 'R1(배열)', found: all.join(','), text: rawLines[idx].trim().slice(0, 100) })
    }

    // R2: 객체 값 위치의 general — `: 'general'` (별칭 매핑 값 / 데모 cat)
    if (/[:=]\s*['"]general['"]/.test(line)) {
      violations.push({ rel, ln, rule: "R2(값 'general')", found: 'general', text: rawLines[idx].trim().slice(0, 100) })
    }

    // R3: 클라 <option value="general"> — 동네딜 카테고리 선택지
    if (/value=['"]general['"]/.test(line)) {
      violations.push({ rel, ln, rule: 'R3(option general)', found: 'general', text: rawLines[idx].trim().slice(0, 100) })
    }
  })
}

if (violations.length === 0) {
  console.log('✅ 동네딜 카테고리 검사 — 이용권 4종 외 카테고리(general 등) 유입 없음.')
  process.exit(0)
}

console.log(`${STRICT ? '❌' : '⚠️'} 동네딜(매장 이용권) 도구에 비-이용권 카테고리 유입 감지 — 서비스 분리 위반:`)
for (const v of violations) {
  console.log(`   ${v.rel}:${v.ln} [${v.rule}] "${v.found}" — ${v.text}`)
}
console.log('')
console.log('   동네딜 = 이용권 4종(meal/beauty/stay/etc_voucher) 전용. general(일반 쇼핑)은 동네딜 아님.')
console.log('   → 카테고리 배열/별칭/데모/옵션에서 제거. 의도적이면 근처에 `dongnedeal-category-ok` 주석.')

process.exit(STRICT ? 1 : 0)
