#!/usr/bin/env node
/**
 * 🌐 2026-07-02: 유어딜 플랫폼 모델 SSOT 문서(docs/design/urdeal-platform-model.md) 신선도 가드.
 *
 * 목적: 플랫폼의 "구조"(행위자·상품종류·경제 커미션 종류·서비스 경계·역할)를 바꾸는 파일을
 *   staged 했는데 마스터 문서를 함께 안 고치면 경고 → 문서가 낡는 걸 방지(가이드/블로그 sync 와 동일 철학).
 *   ⚠️ 수치(%·금액)는 어드민 조정값이라 감시 대상 아님 — *구조 변경*만 본다.
 *
 * warn-only(기본). STRICT_PLATFORM_MODEL=1 이면 block. 우회: commit 메시지 [SKIP_PLATFORM_MODEL].
 * 실행: node scripts/check-platform-model-sync.mjs
 */
import { execSync } from 'node:child_process'

// 🌐 SSOT 문서 2종 — 구조 변경 시 함께 갱신 대상. 플랫폼모델(기술)·비즈니스(대외).
const DOC = 'docs/design/urdeal-platform-model.md'
const BIZ_DOC = 'docs/business/urdeal-business-plan.md'
// 구조를 바꾸는 고신호 파일/디렉터리 (수치 SSOT 는 제외 — 값은 어드민 조정)
const STRUCTURAL = [
  /^src\/shared\/seller-roles\.ts$/,            // 역할 정의
  /^src\/shared\/voucher-categories/,           // 상품종류 SSOT
  /^src\/shared\/product-flow\.ts$/,            // 종류판별
  /^src\/worker\/utils\/fee-resolver\.ts$/,     // 정산 구조(1P/3P·에이전시)
  /^src\/worker\/utils\/(affiliate-credit|influencer-store-intro-commission|agency-store-intro-commission|order-commissions)\.ts$/, // 커미션 종류
  /^src\/features\/(curator|agency|supply|community-group-buy|seller-tiers)\//, // 링크샵·에이전시·공구·셀러등급 골격
]

function staged() {
  try {
    return execSync('git diff --cached --name-only', { encoding: 'utf8' }).split('\n').filter(Boolean)
  } catch { return [] }
}
function lastCommitMsg() {
  try { return execSync('git log -1 --pretty=%B', { encoding: 'utf8' }) } catch { return '' }
}

const files = staged()
if (files.length === 0) { console.log('ℹ️  platform-model: staged 없음 (skip).'); process.exit(0) }
if (/\[SKIP_PLATFORM_MODEL\]/.test(lastCommitMsg())) { console.log('platform-model: [SKIP_PLATFORM_MODEL] — skip.'); process.exit(0) }

const structuralHits = files.filter(f => STRUCTURAL.some(re => re.test(f)))
// 구조 변경 시 미갱신된 SSOT 문서 목록 (플랫폼모델=기술 SSOT, 비즈니스=대외 문서 — 둘 다 구조 반영 대상)
const missingDocs = [
  { path: DOC, why: '마스터 플랫폼 모델(§2~5: 행위자/상품종류/커미션종류/역할)' },
  { path: BIZ_DOC, why: '비즈니스 문서(서비스개요·타겟·수익구조·입점혜택)' },
].filter(d => !files.includes(d.path))

if (structuralHits.length > 0 && missingDocs.length > 0) {
  const strict = process.env.STRICT_PLATFORM_MODEL === '1'
  console.log(`${strict ? '❌' : '⚠️ '} 플랫폼 구조 파일 변경인데 SSOT 문서 미갱신:`)
  structuralHits.forEach(f => console.log(`   변경: ${f}`))
  missingDocs.forEach(d => console.log(`   미갱신 문서: ${d.path} — ${d.why}`))
  console.log('   → 행위자/상품종류/커미션종류/서비스경계/역할이 바뀌면 두 SSOT 문서를 같은 커밋에서 갱신.')
  console.log('   (순수 수치 변경만이면 무관 — 어드민 조정값. 의도적이면 commit 메시지에 [SKIP_PLATFORM_MODEL])')
  process.exit(strict ? 1 : 0)
}
console.log('✅ platform-model: 구조 변경 없음 또는 SSOT 문서 동반 갱신됨.')
process.exit(0)
