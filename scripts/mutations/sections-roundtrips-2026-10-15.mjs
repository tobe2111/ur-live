/**
 * 🧬 주입 — 홈 섹션 응답이 질의를 차례로 기다리지 않는다
 * (2026-10-15 대표 *"첫 접속 시 2~3배 느려 · 이런 이용권은 어떠세요? 도 너무 늦게 떠"*).
 * 시간으로 재는 시험이라, 직렬화를 되살리면 왕복 수가 늘어 빨간불이 난다.
 */
const T = 'src/tests/unit/sections-roundtrips-2026-10-15.test.ts'
const R = 'src/features/sections/api/sections.routes.ts'
export default [
  {
    name: '⚡ 홈 섹션 — DDL 을 정상 경로에서 매번 돌린다',
    file: R,
    find: "        await maybeSeedHomeSections(readEnv);\n        const weightsP",
    replace: "        await ensureTables(DB);\n        await maybeSeedHomeSections(readEnv);\n        const weightsP",
    test: T,
    why: '새 isolate 마다 CREATE·ALTER 6왕복을 HTML 앞에 붙인다(한국 콜로 ~1초).',
  },
  {
    name: '⚡ 홈 섹션 — 규칙 섹션을 하나씩 기다린다',
    file: R,
    find: "          pending.set(s.id as number, resolveSectionProducts(",
    replace: "          await new Promise((r) => setTimeout(r, 60)); pending.set(s.id as number, resolveSectionProducts(",
    test: T,
    why: '섹션 수만큼 왕복이 직렬로 쌓여 SSR 타임아웃(2000ms)을 넘기면 시드가 빠진다.',
  },
  {
    name: '⚡ 홈 섹션 — 동시에 묻되 위 줄 몫을 더 받지 않는다',
    file: R,
    find: "            overfetch: ahead,\n",
    replace: "            overfetch: 0,\n",
    test: T,
    why: '위 섹션이 가져간 만큼 아래 줄이 짧아진다 — 빨라졌는데 목록이 틀린다.',
  },
  {
    name: '⚡ 홈 섹션 — overfetch 를 SQL 에 반영하지 않는다',
    file: 'src/features/sections/api/section-rules.ts',
    find: '      LIMIT ${limit + overfetch}\n',
    replace: '      LIMIT ${limit}\n',
    test: T,
    why: '라우트가 더 달라고 해도 리졸버가 limit 만 줘서 아래 줄이 짧아진다.',
  },
  {
    name: '⚡ 홈 섹션 — 시드 버전을 매 요청 다시 묻는다',
    file: 'src/features/sections/api/section-seed.ts',
    find: '  if (_seedConfirmed.has(dbKey(DB))) return\n',
    replace: '',
    test: T,
    why: '캐시가 빌 때마다 platform_settings 한 왕복이 HTML 앞에 붙는다.',
  },
  {
    name: '🌏 읽기 복제 — 홈 섹션이 세션 없이 원본으로 묻는다',
    file: R,
    find: '  const DB = publicReadDb((c.env as Env).DB);\n',
    replace: '  const DB = (c.env as Env).DB;\n',
    test: T,
    why: '대표가 복제를 켜도 한국 손님 질의가 계속 미국 원본으로 간다(효과 0, 에러 0).',
  },
  {
    name: '🌏 읽기 복제 — 시드 메모가 세션을 키로 쓴다',
    file: 'src/features/sections/api/section-seed.ts',
    find: '  if (_seedConfirmed.has(dbKey(DB))) return\n',
    replace: '  if (_seedConfirmed.has(DB)) return\n',
    test: T,
    why: '요청마다 새 세션이라 메모가 매번 빗나가 시드 버전 왕복을 다시 낸다.',
  },
  {
    name: '🌏 읽기 복제 — 몰 컬럼 메모가 세션을 키로 쓴다',
    file: 'src/worker/utils/consumer-scope.ts',
    find: '  let byTable = mallColumnCache.get(dbKey(DB))\n',
    replace: '  let byTable = mallColumnCache.get(DB)\n',
    test: T,
    why: '요청마다 PRAGMA 한 왕복이 다시 붙는다.',
  },
  {
    name: '🌏 읽기 복제 — 세션이 원본 표식을 안 단다',
    file: 'src/worker/utils/d1-read-replica.ts',
    find: '    s[PRIMARY] = (db as D1Database & { [PRIMARY]?: D1Database })[PRIMARY] ?? db\n',
    replace: '',
    test: T,
    why: 'dbKey 가 세션 자신을 돌려줘 모든 isolate 메모가 요청마다 빗나간다.',
  },
]
