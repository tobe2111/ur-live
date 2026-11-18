/** 🧬 주입 — 쿼리 플래너 통계 갱신 (2026-11-18) · 가드: src/tests/unit/planner-stats-refresh-2026-11-18.test.ts */
export default [
  { name: 'plannerstats: 인자 없는 optimize(새 연결에선 무동작)', file: 'src/worker/cron/scheduled-cleanup-daily.ts',
    find: "await DB.prepare('PRAGMA optimize=0x10002').run();", replace: "await DB.prepare('PRAGMA optimize').run();",
    test: 'src/tests/unit/planner-stats-refresh-2026-11-18.test.ts',
    why: '워커의 새 연결은 표를 안 읽었으니 optimize 가 아무것도 안 재고 통계가 10행에 멈춘다.' },
]
