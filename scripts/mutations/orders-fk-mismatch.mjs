/**
 * 🧨 결제를 통째로 막던 깨진 외래키 — 주입 매니페스트 (2026-09-19).
 * 가드: src/tests/unit/orders-fk-mismatch-2026-09-19.test.ts · scripts/check-foreign-key-sanity.mjs
 *
 * 이 회귀들은 전부 **조용하다** — 화면도 안 깨지고 빌드도 통과하고, 실패는 자동 환불에 삼켜진다.
 * 사람이 알아챌 신호가 0 이라 기계가 대신 깨뜨려 봐야 한다.
 */
const TEST = 'src/tests/unit/orders-fk-mismatch-2026-09-19.test.ts'

export default [
  {
    name: '🧨 수리 모듈이 부모 컬럼을 안 고치고 그대로 둔다(= 결제 전면 차단 복귀)',
    file: 'src/worker/utils/ensure-orders-fk-sane.ts',
    find: "const GOOD_PARENT_REF = 'REFERENCES orders(order_number)'",
    replace: "const GOOD_PARENT_REF = 'REFERENCES orders(order_no)'",
    test: TEST,
    why: '참조를 안 고치면 재빌드는 "성공"하는데 INSERT…RETURNING 은 계속 막힌다 — 수리했다는 착각이 제일 위험하다.',
  },
  {
    name: '🧨 수리 호출이 /join 에서 사라진다',
    file: 'src/features/group-buy/api/group-buy.routes.ts',
    find: '  await ensureOrdersForeignKeysSane(DB).catch(() => {})  // 🧨 2026-09-19 깨진 FK 수리(멱등). 근거: ensure-orders-fk-sane.ts\n  const productIdRaw = c.req.param(\'id\')',
    replace: '  const productIdRaw = c.req.param(\'id\')',
    test: TEST,
    why: '딜 결제 경로가 자가수리를 잃으면 그 경로만 조용히 다시 막힌다(카드 경로는 멀쩡해서 더 안 보인다).',
  },
  {
    name: '🧨 수리가 토스 승인 **뒤**로 밀린다 (이미 청구된 돈을 되돌리는 경로로 떨어진다)',
    file: 'src/features/group-buy/api/group-buy.routes.ts',
    find: "  await ensureOrdersForeignKeysSane(DB).catch(() => {})  // 🧨 깨진 FK 수리 — 반드시 **과금 전**(승인 뒤면 청구된 돈을 되돌리게 된다)\n",
    replace: '',
    test: TEST,
    why: '순서가 이 수정의 핵심이다 — 승인 뒤에 고치면 사용자는 여전히 "결제 실패"를 보고 토스엔 승인이 찍힌다.',
  },
  {
    name: '🧨 인덱스 재생성이 빠져 재빌드가 인덱스를 조용히 날린다',
    file: 'src/worker/utils/ensure-orders-fk-sane.ts',
    find: "          ...(idx.results || []).map((i) => DB.prepare(i.sql.replace(/^CREATE\\s+(UNIQUE\\s+)?INDEX\\s+/i, (m) => `${m}IF NOT EXISTS `))),\n",
    replace: '',
    test: TEST,
    why: '테이블 재빌드는 인덱스를 데려오지 않는다 — 빠지면 느려질 뿐 에러가 없어 발견이 몇 달 늦는다.',
  },
]
