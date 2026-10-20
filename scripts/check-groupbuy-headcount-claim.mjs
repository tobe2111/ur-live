#!/usr/bin/env node
/**
 * 🎟️🏪 **"모이면 싸진다"고 말하지 않는다** — 공구 표면의 정직성 가드 (2026-08-14)
 *
 * 배경(실측): 이 레포에서 "공동구매"는 네 가지를 가리키는데, **라이브의 둘은 인원과 무관하다.**
 *   - 🎟️ 유어딜 이용권 공구 — 즉시 단일가(2026-05-30 A2: `current_discount_pct=maxTierDiscount` 고정,
 *     `next_tier=null`). 그 전엔 "N명 더 모이면 할인 시작!" 을 띄웠고, 2026-06-16 에 걷어냈다.
 *   - 🏪 공구 서비스 픽업 공구 — 기간 한정 특가. `resolveGbPricing` 은 `target` 을 **읽지 않는다**
 *     (세션의 `target` 은 주석 그대로 "표시용").
 *
 * 그런데 그 정직화에는 **가드가 없었다.** 문구는 한 줄이면 되돌아가고, 되돌아가도 에러가 안 난다
 * — 이 레포가 반복해 만난 "실패가 아니라 조용한 부재" 클래스다. 게다가 이건 표시광고 문제라
 * 조용히 틀리면 비용이 크다.
 *
 * ⚠️ **이 가드가 못 막는 것**(과신 금지)
 *   - i18n 번역 파일(`public/locales/**`)의 문구. 키만 코드에 있고 값은 밖에 있으면 못 본다.
 *   - "지금 20명이 함께 구매 중" 같은 **사실 진술**은 막지 않는다(막아서도 안 된다). 이 가드가 잡는 것은
 *     **조건부 약속**("모이면/달성하면 할인")뿐이다.
 *   - 인원 조건이 **코드로** 생기는 경우(가격이 실제로 인원에 반응). 그건 `gb-session` 유닛 테스트가
 *     `resolveGbPricing` 이 `target` 을 안 읽는다는 쪽으로 고정한다.
 *
 * 예외: 그 줄에 `headcount-claim-ok` 주석.
 * 우회: 커밋 메시지 `[SKIP_HEADCOUNT_CLAIM]`
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

const ROOT = process.cwd()
const STRICT = process.argv.includes('--strict') || process.env.STRICT_HEADCOUNT_CLAIM === '1'

/**
 * 검사 대상 = **인원 무관 경제를 "공동구매"라 부르는 표면**만.
 * 🔴 커뮤니티 공구(`community-group-buy`)와 친구추천(`ReferralPage`)은 **제외** — 그쪽은 목표/인원이
 *   실제 메커니즘이라 "N명 모이면" 이 거짓이 아니다. 여기에 넣으면 정상 문구를 빨갛게 만든다.
 */
const TARGET_FILES = [
  'src/pages/GroupBuyDetailPage.tsx',
  'src/pages/GroupBuyListPage.tsx',
  'src/pages/VoucherDetailPage.tsx',
  'src/pages/VouchersPage.tsx',
]
const TARGET_DIRS = [
  'src/pages/group-buy',
  'src/pages/group-buy-list',
  'src/pages/mall',
  'src/components/mall',
  'src/pages/vouchers',
]

/** 조건부 할인 약속 — "모이면/채우면/달성하면 (더) 싸진다". */
const CLAIMS = [
  { re: /\d+\s*명\s*(?:더\s*)?(?:모이면|모으면|채우면)/, why: '인원을 채우면 할인된다는 약속' },
  { re: /명이?\s*모이면/, why: '인원을 채우면 할인된다는 약속' },
  { re: /모일수록\s*(?:더\s*)?(?:싸|저렴|할인)/, why: '모일수록 싸진다는 약속' },
  { re: /(?:목표\s*)?달성\s*(?:시|하면)[^\n]{0,20}(?:할인|특가|인하)/, why: '목표 달성 시 할인 약속' },
  { re: /인원\s*(?:이|가)?\s*(?:늘|많)[^\n]{0,12}(?:할인|저렴|싸)/, why: '인원에 따라 가격이 내려간다는 약속' },
  { re: /다음\s*단계\s*할인|다음\s*티어/, why: '다음 티어 안내(동적 인하 모델 잔재)' },
]

function walk(dir) {
  const abs = resolve(ROOT, dir)
  if (!existsSync(abs) || !statSync(abs).isDirectory()) return []
  return readdirSync(abs, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : (/\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []),
  )
}

const files = [...new Set([...TARGET_FILES.filter((f) => existsSync(resolve(ROOT, f))), ...TARGET_DIRS.flatMap(walk)])]

// 🔴 이 레포의 규칙: **측정 대상이 0 이면 통과가 아니라 실패**다.
//   경로가 낡아 스캔이 비면 가드가 조용히 사라진다(가드 레지스트리가 경고한 바로 그 모드).
if (files.length < 5) {
  console.error(`❌ check-groupbuy-headcount-claim: 검사 대상이 ${files.length}개뿐 — 경로가 낡았다(스캔이 헛돈다).`)
  process.exit(1)
}

const violations = []
for (const f of files) {
  const src = readFileSync(resolve(ROOT, f), 'utf8')
  src.split('\n').forEach((line, i) => {
    if (line.includes('headcount-claim-ok')) return
    // 주석 줄은 제외 — 이 파일들의 주석은 대부분 "그 문구를 **없앴다**"는 기록이라 오탐이 된다.
    const t = line.trim()
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return
    for (const c of CLAIMS) {
      if (c.re.test(line)) violations.push({ f, line: i + 1, why: c.why, text: t.slice(0, 120) })
    }
  })
}

if (violations.length === 0) {
  console.log(`✅ check-groupbuy-headcount-claim: 공구 표면이 인원 조건부 할인을 약속하지 않음 (${files.length}개 파일 검사).`)
  console.log('   라이브 두 공구는 모두 인원 무관 — 유어딜=즉시 단일가 · 공구 서비스=기간 특가.')
  process.exit(0)
}

console.error(`${STRICT ? '❌' : '⚠️'} 인원 조건부 할인 약속 ${violations.length}건 — 라이브 공구는 인원과 무관하다(거짓 표시).`)
for (const v of violations) console.error(`   ${v.f}:${v.line}  [${v.why}]\n      ${v.text}`)
console.error('   사실 진술("N명 함께 구매 중")은 괜찮다. 조건부 약속("모이면 할인")만 금지.')
console.error('   의도적이면 그 줄에 `headcount-claim-ok` 주석.')
process.exit(STRICT ? 1 : 0)
