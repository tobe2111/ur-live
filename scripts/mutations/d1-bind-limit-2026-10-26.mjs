/**
 * 🧬 주입 — D1 바인딩 한도(100) · 내보낸 리드 도장이 라이브에서 0건이던 사고 (2026-10-26)
 *    가드: src/tests/unit/d1-bind-limit-2026-10-26.test.ts
 *
 * 🩸 이 사고는 **진짜 SQLite 로 동작 판정하는 시험을 통과했다** — `node:sqlite` 한도는 32,766 이라
 *    101개가 멀쩡히 돈다. 그래서 가드가 **D1 한도를 흉내 낸 가짜 DB** 로 같은 함수를 돌린다.
 *    아래 주입은 그 가짜 DB 가 실제로 막는지, 그리고 침묵이 되살아나지 않는지를 함께 본다.
 */
const T = 'src/tests/unit/d1-bind-limit-2026-10-26.test.ts'
const B = 'src/shared/db/d1-binds.ts'
const P = 'src/features/marketing/api/pool-export-batch.ts'
const S = 'src/worker/cron/seller-daily-report.ts'
export default [
  {
    name: '도장 — extraBinds 를 안 세서 바인딩 101개(라이브 사고 재현)',
    file: P,
    find: 'for (const chunk of chunkForBinds(clean, 1)) {',
    replace: 'for (const chunk of chunkForBinds(clean, 0)) {',
    test: T,
    why: '`SET exported_at = ?` 가 바인딩 하나를 쓰므로 id 는 99개까지다. 100개면 101개가 되어 전 청크가 '
      + '`too many SQL variables` 로 실패하고 도장이 한 건도 안 찍힌다(2026-10-26 라이브 실측).',
  },
  {
    name: '도장 — 실패를 다시 조용히 삼킨다',
    file: P,
    find: '    ).bind(stamp, ...chunk).run().catch((e: unknown) => {',
    replace: '    ).bind(stamp, ...chunk).run().catch(() => null) as never; void ((e: unknown) => {',
    test: T,
    why: '이 사고가 하루 동안 안 보인 진짜 이유다 — 로그가 없으면 "도장 0건" 이 고장인지 정상인지 '
      + '아무도 구분할 수 없다(파일 안내문은 정상처럼 읽혔다).',
  },
  {
    name: '도장 — 통째로 실패해도 파일엔 정상 안내를 적는다',
    file: P,
    find: 'const notes = stamped ? [exportBatchNote(stamped, stamp, remaining)] : [exportStampFailedNote(rows.length)]',
    replace: 'const notes = [exportBatchNote(stamped, stamp, remaining)]',
    test: T,
    why: '`이 묶음 0건에 …` 은 사실이지만 받는 사람에겐 정상으로 읽힌다 — 같은 500행을 계속 다시 받는다.',
  },
  {
    name: '취소 — 실패를 조용히 삼켜 "이미 취소된 묶음" 이라 거짓말한다',
    file: P,
    find: '    .bind(s).run().catch((e: unknown) => {',
    replace: '    .bind(s).run().catch(() => null) as never; void ((e: unknown) => {',
    test: T,
    why: '되돌리기는 끊긴 다운로드의 **유일한 복구 경로**다. 조용히 0 을 돌려주면 화면이 '
      + '"이미 취소된 묶음입니다" 를 띄워 그 거짓이 영구 손실로 굳는다.',
  },
  {
    name: '셀러 일일 리포트 — 손으로 100개씩 자른다(바인딩 102개)',
    file: S,
    find: 'for (const chunk of chunkForBinds(ids, 2)) {',
    replace: 'for (let i = 0; i < ids.length; i += 100) {\n    const chunk = ids.slice(i, i + 100)',
    test: T,
    why: '그 네 쿼리는 기간 두 개를 더 쓴다 → 102개. 셀러가 100곳을 넘는 날 전 쿼리가 실패하고 '
      + '`.catch` 가 빈 배열로 삼켜 리포트가 "어제 0건" 이라고 말한다(라이브 13곳이라 아직 안 터졌다).',
  },
  {
    name: '한도 상수를 101 로 올린다',
    file: B,
    find: 'export const D1_MAX_BINDS = 100',
    replace: 'export const D1_MAX_BINDS = 101',
    test: T,
    why: '라이브 실측은 100 OK · 101 ERR 이다. 올리면 모든 묶음이 다시 조용히 실패한다.',
  },
  {
    name: '쪼갤 수 없는 요청을 조용히 1개씩 보낸다',
    file: B,
    find: "  if (size < 1) throw new Error(`[d1-binds] extraBinds=${extraBinds} 면 IN 목록에 넣을 자리가 없다`)",
    replace: '  if (size < 1) return items.map(x => [x])',
    test: T,
    why: '100행에 100왕복이 되는데 아무도 모른다 — 못 하는 일은 던져서 알려야 한다.',
  },
  {
    name: '가짜 D1 이 한도를 안 막는다(가드가 헛돈다)',
    file: T,
    find: 'if (binds.length > limit) { rejected++; throw new Error(`too many SQL variables: ${binds.length}`) }',
    replace: 'if (false) { rejected++ }',
    test: T,
    why: '이 줄이 없으면 가짜 DB 가 라이브 D1 과 다른 것을 재고, ④가 101개짜리 버그에도 초록이 된다.',
  },
]
