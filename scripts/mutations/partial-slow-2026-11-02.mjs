/**
 * 🐢 2026-11-02 대표 *"부분적으로 느린 경우들이 많아서 유저들이 헷갈려해"* — 생활 표 확인 왕복 1회 · 유어샵 주인 보기 물결 3.
 * 시험: home-service-schema-probe-2026-11-02 · ushop-owner-waves-2026-11-02.
 */
export default [
  {
    name: '🐢 생활 표 확인이 다시 매번 DDL 34문장 직렬(왕복 1회 확인을 건너뜀)',
    file: 'src/features/home-service/api/home-service-db.ts',
    find: '  if (await schemaComplete(DB)) return // 왕복 1회로 끝',
    replace: '  if (false) return // 왕복 1회로 끝',
    test: 'src/tests/unit/home-service-schema-probe-2026-11-02.test.ts',
    why: '2026-11-02 실측: /api/home-service/config 서버 시간 1,424ms — 서버 기동마다 DDL 34문장을 하나씩 보냈다.',
  },
  {
    name: '🐢 생활 표 확인이 색인 개수를 안 보고 통과(머니 멱등 UNIQUE 색인이 빠져도 건너뜀)',
    file: 'src/features/home-service/api/home-service-db.ts',
    find: '    return n === HS_PROBE[0].expect',
    replace: '    return true',
    test: 'src/tests/unit/home-service-schema-probe-2026-11-02.test.ts',
    why: '2026-11-02: idx_hs_credit_tx_kind_ref 는 참여권 원장의 멱등 키다 — 있다고 가정하고 건너뛰면 안 된다.',
  },
  {
    name: '🐢 유어샵 주인 보기 물결이 다시 쪼개짐(직렬 대기 3 → 4+)',
    file: 'src/worker/routes/curator.routes.ts',
    find: '    const headline = head?.linkshop_headline ?? null',
    replace: '    await Promise.resolve()\n    const headline = head?.linkshop_headline ?? null',
    test: 'src/tests/unit/ushop-owner-waves-2026-11-02.test.ts',
    why: '2026-11-02: 주인 보기는 no-store·미국 원본 DB 라 직렬 대기 하나가 한국에서 ~0.17초씩 쌓인다.',
  },
]
