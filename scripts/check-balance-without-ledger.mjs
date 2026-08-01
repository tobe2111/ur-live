#!/usr/bin/env node
/**
 * 💸 잔액은 늘리고 원장 기록은 삼키는 코드 차단.
 *
 * ## 왜 생겼나 (2026-08-01 실측)
 * 라이브 원장 정합 검사가 몇 주째 `user_points_balance_mismatch: 4` 를 남겼다. 조회 API 를 만들어
 * 열어 보니 4명 중 3명이 같은 모양이었다 — **잔액만 있고 거래 기록이 0**.
 *
 * 원인은 코드 패턴이었다. 딜 적립 함수들이 이렇게 생겼다:
 *   ① `user_points ... balance = balance + ?`   ← 잔액은 확실히 증가
 *   ② `INSERT INTO point_transactions ...`      ← 실패해도 `catch {}` / `.catch(() => null)`
 * ②가 실패하면 **잔액만 늘고 원장 행이 없는 유저**가 남는다. 에러가 없으니 아무도 모른다.
 * (②가 실패한 이유: 확장 컬럼 `points_amount`·`balance_after`·`order_id`·`free_delta` 가
 *  base CREATE 에 없고 repair-schema 에도 `free_delta` 만 등록돼 있었다.)
 *
 * ⚠️ 이 가드를 만든 진짜 이유: **내가 같은 결함을 두 번 놓쳤다.** `creditFreePoints` 를 고치고
 *    "근본원인 수리"라고 했는데, 정작 3,000딜을 적립하는 `grantSignupBonus` 는 별도 함수였고
 *    똑같이 삼키고 있었다. 사람이 함수 목록을 외워서 막을 일이 아니다.
 *
 * ## 규칙
 * `user_points` 의 balance 를 증가시키는 파일에서, `point_transactions` INSERT 가
 * **삼키는 catch**(빈 블록 / `.catch(() => null)` / `.catch(() => {})`)로 끝나면 위반.
 * 실패 시 최소 컬럼으로 재시도하는 **폴백**이 있으면 통과.
 *
 * ⚠️ 못 잡는 것: 잔액 증가와 원장 기록이 **서로 다른 파일**로 나뉘어 있으면 못 본다(파일 단위 검사).
 *    그리고 폴백이 있는지만 보지, 폴백이 정말 도는지는 유닛 테스트가 봐야 한다.
 *
 * 예외: 해당 줄이나 윗줄에 `balance-ledger-ok` 주석.
 * 기본 warn, 차단: `STRICT_BALANCE_LEDGER=1`.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const STRICT = process.env.STRICT_BALANCE_LEDGER === '1'

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.ts$/.test(e.name) && !p.includes(`${path.sep}tests${path.sep}`)) out.push(p)
  }
  return out
}

/**
 * 잔액을 **움직이는** SQL 이 있는가 — 적립(+)과 차감(−) 둘 다.
 * ⚠️ 처음엔 `+` 만 봤다. 그래서 2026-08-01 전수조사에서 나온 **차감 케이스를 못 잡았다**:
 *    `order.routes.ts` 의 추천 커미션 회수가 잔액만 줄이고 원장에 아무것도 안 남겨,
 *    `잔액 < 거래합` 인 유저(라이브 user 3, 차이 −22,480)를 만들고 있었다.
 */
const MUTATES_BALANCE = /user_points[\s\S]{0,400}?balance\s*=\s*(?:MAX\([^)]*|COALESCE\([^)]*\)|balance)?\s*[\s\S]{0,20}?balance\s*[+-]\s*\?/i
/** 원장 INSERT 뒤에 곧바로 오는 '삼키는' 마무리. */
const SWALLOW = [
  /INSERT INTO point_transactions[\s\S]{0,900}?\)\s*\.run\(\)\s*\.catch\(\s*\(\)\s*=>\s*(?:null|\{\s*\})\s*\)/,
  /INSERT INTO point_transactions[\s\S]{0,900}?\.run\(\)\s*\n?\s*\}\s*catch\s*\{\s*(?:\/\*[^*]*\*\/)?\s*\}/,
]
/**
 * 최소 컬럼 폴백(있으면 안전). 인라인 INSERT 또는 SSOT 헬퍼(`recordPointTxMinimal`) 위임 둘 다 인정한다.
 * ⚠️ 헬퍼 이름을 바꾸면 여기도 바꿔야 한다 — 안 바꾸면 정상 코드가 빨간불이 된다.
 */
const HAS_FALLBACK = /INSERT INTO point_transactions \(user_id, type, amount, description\)|recordPointTxMinimal\s*\(/
/** 원장 기록을 SSOT 헬퍼에 위임하는 형태(직접 INSERT 를 안 써도 안전). */
const VIA_SSOT = /adjustUserPoints\s*\(|recordPointTransaction\s*\(|creditFreePoints\s*\(|recordPointTxMinimal\s*\(/

const files = walk(path.join(ROOT, 'src'))
if (files.length < 200) {
  console.error(`❌ balance-ledger: 스캔 대상이 ${files.length}개뿐 — 검사가 헛돌고 있다(경로 확인).`)
  process.exit(1)
}

const violations = []
let scannedCredit = 0
for (const abs of files) {
  const rel = path.relative(ROOT, abs).split(path.sep).join('/')
  const src = fs.readFileSync(abs, 'utf8')
  if (!MUTATES_BALANCE.test(src)) continue
  scannedCredit++
  if (src.includes('balance-ledger-ok')) continue

  // 규칙 ①: 잔액을 움직이면서 **원장을 아예 언급조차 안 한다**(SSOT 위임도 없음).
  //   2026-08-01 전수조사에서 이 모양이 실제로 1건 나왔다(추천 커미션 회수).
  const recordsSomehow = src.includes('point_transactions') || VIA_SSOT.test(src)
  if (!recordsSomehow) {
    const m = MUTATES_BALANCE.exec(src)
    violations.push({ rel, lineNo: src.slice(0, m.index).split('\n').length, kind: '원장 기록 자체가 없다' })
    continue
  }

  // 규칙 ②: 원장 INSERT 는 하는데 실패를 삼킨다(폴백 없음).
  if (HAS_FALLBACK.test(src)) continue
  for (const re of SWALLOW) {
    const m = re.exec(src)
    if (m) {
      const lineNo = src.slice(0, m.index).split('\n').length
      violations.push({ rel, lineNo, kind: 'INSERT 실패를 삼킨다' })
      break
    }
  }
}

// 측정 대상이 0 이면 통과가 아니라 실패 — 이 레포가 반복해 겪은 '가드가 헛도는' 실패 모드.
if (scannedCredit === 0) {
  console.error('❌ balance-ledger: 잔액 변동 파일을 한 개도 못 찾았다 — 패턴이 낡았다.')
  process.exit(1)
}

if (violations.length === 0) {
  console.log(`✅ balance-ledger: 잔액 변동 ${scannedCredit}개 파일 — 원장 기록 누락/삼킴 없음`)
  process.exit(0)
}

console.log('⚠️  잔액은 움직이는데 원장 기록이 남지 않을 수 있는 코드:')
for (const v of violations) {
  console.log(`   - ${v.rel}:${v.lineNo} — ${v.kind}`)
}
console.log('\n   고치는 법: 실패 시 base CREATE 가 보장하는 최소 컬럼으로 다시 INSERT.')
console.log("     INSERT INTO point_transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)")
console.log('   의도적이면 `balance-ledger-ok` 주석.')
if (STRICT) {
  console.error('\n❌ STRICT_BALANCE_LEDGER — 차단.')
  process.exit(1)
}
