/**
 * 🧬 주입 — 이용권 코드 6자리 숫자 (2026-10-12 대표 "6자리로 줄이고 숫자로만.")
 */
const T = 'src/tests/unit/voucher-code-6digit-2026-10-12.test.ts'
export default [
  {
    name: '코드6자리 — DB 에 있는 번호를 거르지 않는다',
    file: 'src/features/group-buy/api/helpers.ts',
    find: 'for (const c of list) if (!taken.has(c)) out.add(c)',
    replace: 'for (const c of list) out.add(c)',
    test: T,
    why: '100만 칸에서 이미 있는 번호를 다시 내면 결제 확정 뒤 이용권 저장이 UNIQUE 로 실패한다(돈은 받았다).',
  },
  {
    name: '코드6자리 — 카드 확정 경로가 묶음 함수 대신 옛 방식으로',
    file: 'src/features/group-buy/api/group-buy.routes.ts',
    find: '    const codes = await generateUniqueVoucherCodes(DB, qty)\n    const orderItemStmt',
    replace: '    const codes = Array.from({ length: qty }, () => String(Math.random()).slice(2, 8))\n    const orderItemStmt',
    test: T,
    why: '겹침 검사 없이 발급 — 결제 확정 뒤 저장 실패.',
  },
  {
    name: '코드6자리 — 조회 잠금 확인을 뺀다',
    file: 'src/features/group-buy/api/group-buy-public.routes.ts',
    find: "    if (await lookupLocked(c, DB)) return c.json({ success: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, 429)\n",
    replace: '',
    test: T,
    why: '없는 번호를 무한히 물어 유효한 번호를 찾아낼 수 있다(100만 칸).',
  },
  {
    name: '코드6자리 — 다른 매장 번호를 맞힌 시도를 안 센다',
    file: 'src/features/group-buy/api/group-buy-voucher.routes.ts',
    find: "        await codeGuard.recordUseFail(DB, pin, guardSalt) // 다른 매장의 번호를 맞힌 것도 '틀린 시도' 다\n",
    replace: '',
    test: T,
    why: '확인코드 하나로 다른 매장 번호를 무한히 대 볼 수 있다.',
  },
  {
    name: '코드6자리 — 확인코드를 원문으로 저장한다',
    file: 'src/worker/utils/voucher-code-guard.ts',
    find: 'const key = `secret:${await hashSecret(secret, salt)}`',
    replace: 'const key = `secret:${secret}`',
    test: T,
    why: '표를 본 사람이 매장 확인코드를 그대로 읽는다.',
  },
]
