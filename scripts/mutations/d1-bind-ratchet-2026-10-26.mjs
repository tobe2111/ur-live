/**
 * 🧬 주입 — D1 바인딩 한도 **표면 래칫** (2026-10-26, 같은 날 두 번째 사고의 후속)
 *    가드: src/tests/unit/d1-bind-ratchet-2026-10-26.test.ts
 *
 * 왜 래칫까지 필요했나: 도장 한 자리를 고치고 보니 손으로 `IN (?,?,…)` 을 조립하는 자리가
 * **171곳** 이었고, 그중 `/api/fcfs/active` 는 **이미 터져 있었다**(활성 395개를 한 IN 에 넣어
 * 두 쿼리가 모두 실패 → `.catch` 가 빈 배열로 삼켜 `success:true, data:[]`, HTTP 200 — 라이브 실측).
 * 171곳을 하나씩 쫓는 것보다 **표면을 동결**하는 쪽이 영구적이다.
 *
 * 아래 주입은 ① 스캐너가 실제로 세는가 ② 래칫이 늘어난 것을 잡는가 ③ 고친 세 자리가 되돌아오는지
 * ④ 가드 자신이 헛돌 수 없는가 — 그리고 **반대 방향**(고치려다 더 나쁘게 만드는 쪽)을 함께 본다.
 */
const T = 'src/tests/unit/d1-bind-ratchet-2026-10-26.test.ts'
const SCAN = 'scripts/d1-bind-scan.mjs'
const GUARD = 'scripts/check-d1-bind-limit.mjs'
const F = 'src/features/group-buy/api/fcfs.routes.ts'
const BK = 'src/worker/cron/d1-backup.ts'
export default [
  {
    name: '래칫 — 스캐너가 `d1-bind-ok` 예외를 무시한다(예외가 안 먹는다)',
    file: SCAN,
    find: '      if (OK_RE.test(ln)) return',
    replace: '      if (false) return',
    test: T,
    why: '예외 주석이 안 먹으면 의도한 자리까지 세어 래칫이 요동치고, 결국 사람이 가드를 꺼 버린다. '
      + '래칫의 값은 "늘어난 것만 잡는다" 는 신뢰이고 그 신뢰가 깨지면 가드가 아니라 소음이다.',
  },
  {
    name: '래칫 — 스캐너가 `chunkForBinds` 경유 자리까지 센다',
    file: SCAN,
    find: '      if (SSOT_RE.test(ctx)) return',
    replace: '      if (false) return',
    test: T,
    why: 'SSOT 로 옮긴 자리를 계속 세면 **고칠 때마다 카운트가 안 줄어** 재기준이 무의미해진다. '
      + '"옮기면 줄어든다" 가 이 래칫이 사람을 SSOT 로 미는 유일한 힘이다.',
  },
  {
    name: '래칫 — SSOT 를 찾아보는 범위를 0 으로(옮긴 자리를 못 알아본다)',
    file: SCAN,
    find: 'export const CTX_LINES = 25',
    replace: 'export const CTX_LINES = 0',
    test: T,
    why: '`for (const ch of chunkForBinds(...))` 와 그 안의 `ch.map(() => \'?\')` 는 보통 한두 줄 '
      + '떨어져 있다. 범위가 0 이면 **옮긴 자리를 전부 다시 세어** 위 주입과 같은 결과가 된다.',
  },
  {
    name: '래칫 — 검사 대상이 비어도 통과한다(경로가 낡으면 조용히 0건)',
    file: GUARD,
    find: 'if (files.length < 500) {',
    replace: 'if (false) {',
    test: T,
    why: '이 레포가 반복해 당한 **헛도는 가드**다 — glob 이 낡아 0개를 검사하면서 초록을 찍는다. '
      + '`check-local-ci-parity` 가 그 클래스를 잡으려고 만들어졌고, 같은 하한이 여기도 필요하다.',
  },
  {
    name: '래칫 — 플레이스홀더 0건이어도 통과한다(정규식이 낡음)',
    file: GUARD,
    find: 'if (total === 0) {',
    replace: 'if (false) {',
    test: T,
    why: '패턴이 낡으면 전 레포가 0건이 되고 래칫은 **영원히 초록**이다. 0건은 "깨끗하다" 가 아니라 '
      + '"못 보고 있다" 이고, 이 레포엔 분명히 그 모양이 있다.',
  },
  {
    name: '래칫 — 판정 로직을 가드 안으로 되돌린다(시험이 스크립트를 실행하게 됨)',
    file: GUARD,
    find: "import { countBindSites, totalOf, diffAgainst } from './d1-bind-scan.mjs'",
    replace: "const countBindSites = () => ({}), totalOf = () => 1, diffAgainst = () => ({ grew: [], shrank: [] })",
    test: T,
    why: '부작용 있는 스크립트를 시험이 import 하면 시험이 레포를 건드린다 — 2026-10-06 에 그 클래스로 '
      + '`CURRENT_WORK.md` 를 5,957 → 470줄로 날렸다. 순수 모듈 분리가 그 재발 방지다.',
  },
  {
    name: '선착순 — `/api/fcfs/active` 가 다시 활성 id 를 IN 목록으로 넣는다(라이브 사고 재현)',
    file: F,
    find: "        WHERE p.is_active=1 ${regionWhere}",
    replace: "        WHERE p.id IN (${enabledIds.map(() => '?').join(',')}) AND p.is_active=1 ${regionWhere}",
    test: T,
    why: '라이브 `fcfs_enabled=\'1\'` 상품이 **395개**다 → 바인딩 395 > 100 → 쿼리가 터지고 '
      + '`.catch` 가 빈 배열로 삼켜 **`success:true, data:[]`**. 지도 선착순 배지와 상권관 체험단 '
      + '목록이 통째로 비는데 **HTTP 200 이라 아무도 모른다**(2026-10-26 실측).',
  },
  {
    name: '선착순 — 승계 판정을 다시 NOT IN 목록으로',
    file: F,
    find: 'const winnerSet = new Set(winnerIds.map(String))',
    replace: 'const winnerSet = new Set<string>()',
    test: T,
    why: '당첨자 집합이 비면 `isReplacement` 가 **언제나 참**이 되어 첫 선정에도 "승계" 문안이 간다. '
      + '그리고 NOT IN 으로 되돌리면 당첨자 100명 초과에서 터져 그 반대(언제나 거짓)가 된다.',
  },
  {
    name: '선착순 — JOIN 필터를 지우고 정렬을 JS 로 베낀다(반대 방향 — 두 벌 드리프트)',
    file: F,
    find: "ORDER BY is_demo, p.created_at DESC`",
    replace: "ORDER BY p.id`",
    test: T,
    why: '쪼개서 JS 로 다시 정렬하면 **ORDER BY 가 두 벌**이 된다 — 데모-후순위(2026-07-04 대표 지시)가 '
      + '한쪽에서만 지켜지고 갈려도 에러가 안 난다. 그래서 필터를 SQL 로 옮긴 것이고, 정렬은 '
      + '한 글자도 안 바꾼다는 것이 그 처방의 전제다.',
  },
  {
    name: '백업 — 은퇴한 경로가 다시 500개를 한 IN 에 넣는다',
    file: BK,
    find: 'for (const idChunk of chunkForBinds(ids)) {',
    replace: 'for (const idChunk of [ids]) {',
    test: T,
    why: '`dumpDatabase` 는 지금 시험만 부르지만(라이브 백업은 `d1-backup-chunked` 의 범위 페이징) '
      + '누가 cron 에 다시 꽂으면 **PK 없는 테이블 54개**(`platform_settings`·`user_points` 포함, '
      + 'main DB 실측)가 조용히 빈 백업이 된다. 지뢰는 쓰이지 않을 때 치운다.',
  },
  {
    name: '등록 — 래칫을 verify.yml 에서 뺀다(가드가 있는데 안 돎)',
    file: '.github/workflows/verify.yml',
    find: '        run: node scripts/check-d1-bind-limit.mjs',
    replace: '        run: echo skip',
    test: T,
    why: '이 레포의 반복 사고는 "검사가 실패한다" 가 아니라 **"검사가 아예 안 돈다"** 다. '
      + '파일이 존재하니 보호받는 것처럼 보이는데 어디에서도 실행되지 않는다.',
  },
]
