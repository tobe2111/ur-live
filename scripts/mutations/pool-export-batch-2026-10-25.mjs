/**
 * 🧬 주입 — 내보낸 리드에 도장("받은 건 다시 안 준다", 2026-10-25 대표 지시)
 *    가드: src/tests/unit/pool-export-batch-2026-10-25.test.ts
 */
const T = 'src/tests/unit/pool-export-batch-2026-10-25.test.ts'
const S = 'src/features/marketing/api/pool-export-batch.ts'
const INF = 'src/features/marketing/api/influencer-pool-export.ts'
const INFR = 'src/features/marketing/api/admin-ads-influencers.routes.ts'
const PARTNER = 'src/features/marketing/api/partner-pool.routes.ts'
const COMPANY = 'src/features/marketing/api/company-discovery.ts'
const WORKER = 'src/worker/index.ts'
export default [
  {
    name: '도장 — 아무것도 안 찍는다(질문 자체가 미해결로 돌아간다)',
    file: S,
    find: '  const clean = [...new Set(ids.map(Number).filter(n => Number.isInteger(n) && n > 0))]\n  if (!clean.length) return 0',
    replace: '  const clean = []\n  if (!clean.length) return 0',
    test: T,
    why: '도장이 안 찍히면 다음 다운로드가 같은 상위 N행을 또 준다 — 대표 질문이 그대로 남는다.',
  },
  {
    name: '도장 — 이미 찍힌 행을 덮어쓴다(첫 배치의 소유권 상실)',
    file: S,
    find: '`UPDATE ${t} SET exported_at = ? WHERE id IN (${ph}) AND ${NOT_EXPORTED_SQL}`',
    replace: '`UPDATE ${t} SET exported_at = ? WHERE id IN (${ph})`',
    test: T,
    why: '전체 덤프와 묶음이 섞여 돌면 첫 배치의 도장 시각이 덮여 그 배치를 되돌릴 수 없게 된다.',
  },
  {
    name: '도장 — 전체 덤프에도 찍는다(사본 한 번이 전 리드를 소진)',
    file: S,
    find: '  if (!args.newOnly || !rows.length) return { rows, cap, notes: [] }',
    replace: '  if (!rows.length) return { rows, cap, notes: [] }',
    test: T,
    why: '풀 사본을 한 번 받으면 연락 대상 전원이 소진된다 — 되돌리기 전까지 목록이 통째로 빈다.',
  },
  {
    name: '도장 — 0건에도 묶음을 소진시킨다',
    file: S,
    find: '  if (!args.newOnly || !rows.length) return { rows, cap, notes: [] }',
    replace: '  if (!args.newOnly) return { rows, cap, notes: [] }',
    test: T,
    why: '필터가 0건을 내는데 안내가 붙으면 "받았다"로 읽힌다(남은 건수 쿼리도 헛돈다).',
  },
  {
    name: '남은 건수를 도장 **전에** 센다(파일이 이 묶음을 두 번 센다)',
    file: S,
    find: '  const stamped = await stampExported(args.DB, args.pool, rows.map(r => r.id), stamp)\n  const remaining = await args.count(true)',
    replace: '  const remaining = await args.count(true)\n  const stamped = await stampExported(args.DB, args.pool, rows.map(r => r.id), stamp)',
    test: T,
    why: '파일에 적는 "남은 건수"가 다음 회차 분량과 어긋난다 — 대표가 끝났다고 믿는 시점이 틀어진다.',
  },
  {
    name: '취소 — 도장 형식 검사를 없앤다(전 행 초기화)',
    file: S,
    find: "  if (!/^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$/.test(s)) return 0",
    replace: '  if (!s) return 0',
    test: T,
    why: '임의 문자열이 통과하면 도장 전체를 날릴 수 있다 — 되돌리기가 "전부 되돌리기"가 된다.',
  },
  {
    name: '풀 화이트리스트를 열어 둔다(표 이름이 SQL 에 문자열로 들어간다)',
    file: S,
    find: "  return raw && Object.prototype.hasOwnProperty.call(EXPORT_POOLS, raw) ? (raw as ExportPoolKey) : null",
    replace: '  return (raw || null) as ExportPoolKey | null',
    test: T,
    why: '표 이름이 보간되는 자리라 임의 값이 들어오면 인젝션 + `adsLeadsDb` 라우터가 엉뚱한 DB 를 고른다.',
  },
  {
    name: '🩸 업체 전체 덤프 상한을 5,000 으로 되돌린다(무음 캡 재발)',
    file: PARTNER,
    find: 'const EXPORT_MAX = 2000',
    replace: 'const EXPORT_MAX = 5000',
    test: T,
    why: '행은 2,000 에서 잘리는데 고지 조건이 `>= 5000` 이라 **절단 고지가 한 번도 안 뜬다** — 파일이 전부처럼 보인다.',
  },
  {
    name: '인플루언서 — 전체 덤프 상한을 묶음으로(반대 방향: 사본이 500행이 된다)',
    file: INF,
    find: "const PAGE = 5000, CAP = opts?.newOnly ? EXPORT_BATCH_ROWS : 60000",
    replace: 'const PAGE = 5000, CAP = EXPORT_BATCH_ROWS',
    test: T,
    why: '풀 사본이 500행으로 잘리면 백업·대조 용도가 사라진다. 묶음은 작업 목록에만 걸려야 한다.',
  },
  {
    name: '인플루언서 — 중복제거로 빠진 행에는 도장을 안 찍는다(같은 사람에게 두 번 보낸다)',
    file: INF,
    find: "stampExported(DB, 'influencer', rows.map(r => r.id), batchStamp)",
    replace: "stampExported(DB, 'influencer', outRows.map(r => r.id), batchStamp)",
    test: T,
    why: '그 주소는 형제 행으로 이미 파일에 실려 나갔다 — 다음 묶음에 다시 올라오면 중복 발송이 된다.',
  },
  {
    name: '인플루언서 라우트 — 전체 덤프도 기본 묶음으로',
    file: INFR,
    find: "newOnly: c.req.query('newOnly') ? c.req.query('newOnly') === '1' : c.req.query('contactable') === '1'",
    replace: "newOnly: c.req.query('newOnly') !== '0'",
    test: T,
    why: '"엑셀 다운로드 (전체)" 가 500행 + 도장이 되어 풀 사본 버튼이 리드를 소진시킨다.',
  },
  {
    name: '업체 WHERE — 미다운로드 조건 사본을 손으로 적는다',
    file: COMPANY,
    find: '  if (filter.notExported) where.push(NOT_EXPORTED_SQL)',
    replace: "  if (filter.notExported) where.push('exported_at IS NULL')",
    test: T,
    why: 'SSOT 를 벗어난 사본은 조건이 바뀌는 날 한쪽만 고쳐져 풀마다 기준이 갈린다(에러 0).',
  },
  {
    name: '되돌리기 라우트 마운트를 뺀다(끊긴 다운로드 한 번이 영구 손실)',
    file: WORKER,
    find: "app.route('/api/admin/pool-export-batches', poolExportBatchRoutes);",
    replace: '',
    test: T,
    why: '도장은 찍히는데 되돌릴 문이 없다 — 전송이 끊기면 그 500명이 목록에서 영구히 사라진다.',
  },
  {
    name: '되돌리기 라우트를 어드민 전용이 아니게',
    file: 'src/features/marketing/api/pool-export-batches.routes.ts',
    find: "app.use('*', requireAdmin())",
    replace: '',
    test: T,
    why: '누구나 전 풀의 도장을 지울 수 있는 문이 된다(목록 전체를 다시 쏟아내게 만들 수 있다).',
  },
]
