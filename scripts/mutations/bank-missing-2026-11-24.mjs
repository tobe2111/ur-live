/** 🧬 주입 — 정산 계좌 없는 매장 알림 (2026-11-24) · 가드: src/tests/unit/bank-missing-nudge-2026-11-24.test.ts */
const T = 'src/tests/unit/bank-missing-nudge-2026-11-24.test.ts'
const F = 'src/worker/utils/bank-missing.ts'
export default [
  { name: 'bankmissing: 매일 알림이 쌓인다', file: F,
    find: '    if (recent) { skipped++; continue }', replace: '', test: T,
    why: '같은 알림이 매일 쌓여 사장님이 알림 전체를 안 보게 된다.' },
  { name: 'bankmissing: 계좌번호만 비어도 등록된 것으로 본다', file: F,
    find: "        AND (TRIM(COALESCE(s.bank_name, '')) = '' OR TRIM(COALESCE(s.bank_account, '')) = '')", replace: "        AND (TRIM(COALESCE(s.bank_name, '')) = '' AND TRIM(COALESCE(s.bank_account, '')) = '')", test: T,
    why: '은행만 적고 번호가 없는 매장이 빠진다 — 그 매장엔 여전히 송금할 수 없다.' },
  { name: 'bankmissing: 승인 전 매장에도 알린다', file: F,
    find: "      WHERE s.status IN (${statuses}) AND s.seller_type = 'store_owner'", replace: "      WHERE s.seller_type = 'store_owner'", test: T,
    why: '정산 대상이 아닌 매장에 정산 계좌 알림이 간다.' },
  { name: 'bankmissing: 이미 보낸 정산을 받을 돈으로 센다', file: F,
    find: "p.payee_id = CAST(s.id AS TEXT) AND p.status = 'pending') AS waiting,", replace: "p.payee_id = CAST(s.id AS TEXT)) AS waiting,", test: T,
    why: '사장님에게 틀린 금액을 알린다.' },
  { name: 'bankmissing: 멈춘 매장에도 알린다', file: F,
    find: '  return r.waiting > 0 || r.liveProducts > 0', replace: '  return true', test: T,
    why: '팔지도 않는 매장에 매주 알림이 간다.' },
  { name: 'bankmissing: 아침 요약 배선이 빠진다', file: 'src/worker/cron/ops-daily-digest.ts',
    find: '      lines.push(...bankMissingDigestLines(await loadBankMissingStores(DB)))', replace: '', test: T,
    why: '대표가 계좌 없는 매장을 모른 채 정산일을 맞는다.' },
  { name: 'bankmissing: 매장 정산 행(store_owner)을 못 본다', file: F,
    find: "WHERE p.payee_type IN ('seller', 'store_owner') AND", replace: "WHERE p.payee_type = 'seller' AND", test: T,
    why: '라이브의 매장 정산은 store_owner 로 찍힌다 — 받을 돈이 0 으로 읽혀 금액 안내가 빠진다(첫 판의 실제 결함).' },
  { name: 'bankmissing: 다른 사람(에이전시)의 정산을 매장 돈으로 센다', file: F,
    find: "WHERE p.payee_type IN ('seller', 'store_owner') AND", replace: 'WHERE', test: T,
    why: '번호만 같은 에이전시 정산이 매장의 받을 돈으로 안내된다.' },
]
