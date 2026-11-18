/**
 * 🧬 주입 — adsLeadsDb: env 하나에 핸들 하나 (2026-11-18)
 *    가드: src/tests/unit/ads-leads-db.test.ts (R5) · influencer-stats-counters-2026-11-18.test.ts
 */
export default [
  { name: '라우터 — 요청마다 새 핸들을 만든다', file: 'src/shared/ads/leads-db.ts',
    find: '  _routerByEnv.set(env as object, router)\n', replace: '', test: 'src/tests/unit/ads-leads-db.test.ts',
    why: 'WeakSet 스키마 기억이 안 맞아 isolate 당 1회여야 할 DDL 이 요청마다 돈다(통계 요청당 왕복 9번 ≈ 2초 실측).' },
  { name: '라우터 — 바인딩이 바뀌어도 옛 핸들을 준다', file: 'src/shared/ads/leads-db.ts',
    find: "    && (hit as { __ads?: unknown }).__ads === ads && (hit as { __company?: unknown }).__company === env.ADS_COMPANY_DB) return hit as E['DB']", replace: "    || true) return hit as E['DB']", test: 'src/tests/unit/ads-leads-db.test.ts',
    why: '다른 DB 를 가리키는 env 가 엉뚱한 DB 로 쿼리를 보낸다.' },
  { name: '증분 — 설치 실패를 영영 기억한다', file: 'src/features/marketing/api/influencer-stats-counters.ts',
    find: '  if (f != null && nowMs - f >= 0 && nowMs - f < ENSURE_RETRY_MS) return false', replace: '  if (f != null) return false', test: 'src/tests/unit/influencer-stats-counters-2026-11-18.test.ts',
    why: '과부하 한 번에 그 isolate 가 수명 내내 옛 경로(전수 세기)로 돈다.' },
]
