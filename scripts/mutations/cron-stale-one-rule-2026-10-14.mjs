// 💓 2026-10-14 — cron 침묵 판정이 한 규칙인지 (`cron-stale-one-rule-2026-10-14.test.ts`)
// 라이브 실측: 같은 질문에 답이 세 벌이었고 어드민 API 의 `data.stale` 만 고정 24h 를 따로 재
// 주간 작업 6개를 영구 거짓 침묵으로 냈다. 그 목록은 자동화·세션이 ground truth 로 읽는다.
export default [
  {
    name: '💓침묵규칙 고정 24h 임계로 되돌림 (주간 작업이 상시 거짓 경보)',
    file: 'src/features/admin/api/admin-system-monitoring.routes.ts',
    find: "const stale = items.filter(i => i.stale === true && (i.verdict ?? 'judge') === 'judge')",
    replace: "const stale = items.filter(i => (i.age_minutes ?? 0) > 60 * 24 && (i.verdict ?? 'judge') === 'judge')",
    why: '2026-10-14 이전 상태. 허용 간격이 7일인 주간 작업이 7일 중 6일 침묵으로 찍혀 진짜 침묵을 묻는다.',
    test: 'src/tests/unit/cron-stale-one-rule-2026-10-14.test.ts',
  },
  {
    // ⚠️ '유령 제외를 통째로 삭제' 하는 주입은 **이미 있다**(`check-guard-mutations.mjs` 의
    //    '어드민 침묵 목록이 유령까지 센다' — `cron-heartbeat-verdict.test.ts` 담당).
    //    같은 결함을 두 번 심으면 어느 가드가 잡았는지 출력으로 못 가른다(중복 잠금) ⇒
    //    여기서는 **반대로 뒤집어** 유령만 보고하게 만든다 — 그건 ⑤가 잡는다.
    name: '💓침묵규칙 유령 판정을 뒤집어 유령만 경보로',
    file: 'src/features/admin/api/admin-system-monitoring.routes.ts',
    find: "i.stale === true && (i.verdict ?? 'judge') === 'judge'",
    replace: "i.stale === true && (i.verdict ?? 'judge') !== 'judge'",
    why: '승계·은퇴한 옛 이름만 경보로 올리면 진짜 침묵은 영원히 안 뜬다(경보가 정반대를 가리킨다).',
    test: 'src/tests/unit/cron-stale-one-rule-2026-10-14.test.ts',
  },
  {
    name: '💓침묵규칙 행의 stale 계산을 허용 간격과 무관하게',
    file: 'src/worker/utils/cron-heartbeat.ts',
    find: 'stale: (limit != null && age != null) ? age > limit : null,',
    replace: 'stale: (age != null) ? age > 1440 : null,',
    why: '행의 판정도 고정 하루로 바꾸면 게이트·카드·어드민이 **전부** 주간 작업을 오판한다.',
    test: 'src/tests/unit/cron-stale-one-rule-2026-10-14.test.ts',
  },
  {
    name: '💓침묵규칙 허용 간격이 작업 신고값을 무시하고 cron 식만 보게',
    file: 'src/worker/utils/cron-heartbeat.ts',
    find: 'const limit = gap ?? expectedMaxAgeMinutes(cron)',
    replace: 'const limit = expectedMaxAgeMinutes(cron)',
    why: '`*/5` 디스패처 안에서 도는 주간 작업은 cron 식이 `*/5` 라 신고 주기를 버리면 상시 침묵이 된다.',
    test: 'src/tests/unit/cron-stale-one-rule-2026-10-14.test.ts',
  },
  {
    name: '💓침묵규칙 게이트가 max_gap_min 을 안 보게',
    file: 'src/worker/utils/cron-heartbeat.ts',
    find: 'const limit = b.max_gap_min ?? expectedMaxAgeMinutes(b.cron)',
    replace: 'const limit = expectedMaxAgeMinutes(b.cron)',
    why: '헬스 게이트가 작업별 허용 간격을 버리면 어드민과 다시 갈라진다(이 결함의 반대 방향).',
    test: 'src/tests/unit/cron-stale-one-rule-2026-10-14.test.ts',
  },
  {
    name: '💓침묵규칙 로그 화면이 자기 침묵 판정을 만듦',
    file: 'src/pages/admin/influencer-pool/AutoRunLog.tsx',
    find: 'const isStale = stale.includes(b.name)',
    replace: 'const isStale = (b.age_minutes ?? 0) > 60 * 24',
    why: '화면이 자기 임계값을 재면 서버를 고쳐도 그 화면만 틀린다 — 규칙이 또 갈라진다.',
    test: 'src/tests/unit/cron-stale-one-rule-2026-10-14.test.ts',
  },
]
