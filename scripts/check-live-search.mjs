#!/usr/bin/env node
/**
 * 🔎 2026-11-02 — 배포된 **실제 사이트**에서 검색이 살아 있는지 잰다.
 *
 * ## 왜 (대표 — *"매번 검색 로직 관련해서 작업을 했는데 문제가 생기는거지? 안망가지게 할 수 없어?"*)
 *
 * 검색은 고칠 때마다 **조용히** 망가졌다 — 에러 화면이 아니라 "결과가 적다" 로만 드러나서
 * 대표가 손으로 검색해 보고서야 알았다:
 *   · 2026-09-03~09-30  랭킹 검색이 없는 컬럼 하나로 **매번 죽고** 옛 검색으로 조용히 내려감(4주)
 *   · 2026-09-30        바인드 순서가 어긋나 **에러 없이 틀린 결과**
 *   · 2026-11-02        주소를 안 봐서 `부산` 이용권 7개 중 1개 · 분류 이름(`숙소`) 0건
 * 단위 시험은 **가짜 표**로 돈다 — 라이브 표와 다르면 시험은 초록이고 사이트만 틀린다.
 * ⇒ 배포 직후 사이트에 직접 물어본다. 결과 **수**와 **종류**와 **엔진 상태**를 셋 다 본다.
 *
 * ## 판정 (검색어마다)
 *   1. 200 + success
 *   2. 이용권이 하한 이상 — 하한은 라이브 실측(2026-11-02)의 **절반 이하**로 잡아 상품이 조금 줄어도 안 운다
 *   3. 결과가 전부 이용권이다 (scope=voucher 가 서버에서 먹는가)
 *   4. `search_mode === 'ranked'` (랭킹 검색이 죽고 옛 검색으로 내려가지 않았는가)
 *
 *   node scripts/check-live-search.mjs                       # https://urdeal.kr
 *   BASE_URL=https://live.ur-team.com node scripts/check-live-search.mjs
 *
 * ⚠️ 못 보는 것: 결과의 **순서**가 좋은가 · 검색 화면(앱)이 이 응답을 제대로 그리는가.
 * ⚠️ 상품이 실제로 크게 줄면(예: 서울 이용권이 20개 미만) 이 검사가 운다 — 그땐 하한을 내리는 게 맞다.
 */
const BASE = (process.env.BASE_URL || 'https://urdeal.kr').replace(/\/$/, '')
const UA = 'Mozilla/5.0 (compatible; ur-live-search-check/1.0; +https://urdeal.kr)'

// [검색어, 이용권 하한, 이 검색어가 지키는 것] — 하한 = 2026-11-02 라이브 실측의 절반 이하
const CASES = [
  ['서울', 20, '지역(주소) 검색 — 실측 87'],
  ['부산', 3, '지역(주소) 검색 — 실측 7'],
  ['숙소', 8, '분류 이름 → 카테고리 — 실측 20'],
  ['맛집', 20, '분류 이름 → 카테고리 — 실측 72'],
]
const VOUCHER = /_voucher$/
// 측정 0 = 실패 — 검사 대상이 비면 통과가 아니라 검사가 사라진 것이다.
if (CASES.length === 0) {
  console.error('❌ 검사 대상이 0개다 — 통과 아님.')
  process.exit(1)
}

async function get(q) {
  const url = `${BASE}/api/search?q=${encodeURIComponent(q)}&scope=voucher&limit=50&page=1&_=${Date.now()}`
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) })
      const body = await res.json().catch(() => null)
      if (res.ok && body) return { status: res.status, body }
      if (attempt === 1) return { status: res.status, body }
    } catch (e) {
      if (attempt === 1) return { status: 0, error: String(e) }
    }
    await new Promise((r) => setTimeout(r, 3000))
  }
}

const fails = []
for (const [q, min, why] of CASES) {
  const r = await get(q)
  const rows = Array.isArray(r.body?.data) ? r.body.data : []
  const vouchers = rows.filter((p) => !Number(p.deal_only) && VOUCHER.test(String(p.category || '')))
  const problems = []
  if (r.status !== 200 || !r.body?.success) problems.push(`응답 ${r.status}${r.error ? ' ' + r.error : ''}`)
  if (vouchers.length < min) problems.push(`이용권 ${vouchers.length}개 < 하한 ${min}`)
  if (rows.length !== vouchers.length) problems.push(`이용권 아닌 결과 ${rows.length - vouchers.length}개 섞임(scope 가 안 먹는다)`)
  if (r.body?.search_mode !== 'ranked') problems.push(`search_mode=${r.body?.search_mode ?? '없음'} (랭킹 검색이 죽고 옛 검색으로 내려갔거나 필드가 사라졌다)`)
  const line = `${q.padEnd(4)} 이용권 ${String(vouchers.length).padStart(2)}개 · ${why}`
  if (problems.length) { fails.push(q); console.error(`❌ ${line}\n     ${problems.join('\n     ')}`) }
  else console.log(`✅ ${line}`)
}

if (fails.length) {
  console.error(`\n🚨 라이브 검색 이상 ${fails.length}건 (${BASE}) — 검색이 조용히 망가지는 클래스다.`)
  console.error('   단위 시험은 초록이어도 라이브 표와 코드가 다르면 여기서만 드러난다. 먼저 라이브 컬럼을 확인할 것:')
  console.error('   node scripts/snapshot-live-schema.mjs && node scripts/check-sql-column-exists.mjs -s')
  process.exit(1)
}
console.log(`\n✅ 라이브 검색 정상 (${BASE})`)
