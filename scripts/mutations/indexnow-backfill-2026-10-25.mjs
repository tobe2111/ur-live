/**
 * 🧬 2026-10-25 — IndexNow 일회성 전수 제출의 주입. 근거는 시험 머리말.
 */
const TEST = 'src/tests/unit/indexnow-backfill-2026-10-25.test.ts'
const CRON = 'src/worker/cron/indexnow-submit.ts'
const LIB = 'src/shared/seo/indexnow.ts'

export default [
  {
    name: '🧺 전수 제출이 lastmod 있는 것만 보낸다',
    file: LIB,
    find: "  for (const m of String(xml).matchAll(/<url>[\\s\\S]*?<loc>([\\s\\S]*?)<\\/loc>[\\s\\S]*?<\\/url>/g)) {",
    replace: "  for (const m of String(xml).matchAll(/<url>[\\s\\S]*?<loc>([\\s\\S]*?)<\\/loc>[\\s\\S]*?<lastmod>[\\s\\S]*?<\\/url>/g)) {",
    test: TEST,
    why: '전수의 요점이 *한 번도 제출 안 된 URL* 인데, lastmod 없는 90건(지역·홈)이 또 빠진다.',
  },
  {
    name: '🧺 전수 제출 표식을 무시해 매일 전수를 보낸다',
    file: LIB,
    find: "  return (marker || '').trim() !== INDEXNOW_BACKFILL_VERSION",
    replace: '  return true',
    test: TEST,
    why: '매일 476건을 다시 밀면 받는 쪽엔 스팸이고, 변경분 신호가 묻힌다.',
  },
  {
    name: '🧺 전수 제출이 실패해도 표식을 세운다',
    file: CRON,
    find: "    if (!ok.ok) {",
    replace: '    if (false) {',
    test: TEST,
    why: '실패한 날 "보냈다" 로 기록되면 전수가 영영 안 간다(에러 0).',
  },
  {
    name: '🧺 0건이어도 표식을 세운다',
    file: CRON,
    find: "    if (!locs.length) {",
    replace: '    if (false) {',
    test: TEST,
    why: 'sitemap 이 깨진 날 빈 제출이 "성공" 으로 기록돼 전수가 영영 안 간다.',
  },
  {
    name: '🧺 전수가 실패하면 변경분 제출까지 멈춘다',
    file: CRON,
    find: "      return `indexnow: 전수 제출 실패 (${ok.status}) · ${locs.length}건, 표식 유지 · ${await submitChanges(DB, key, entries)}`",
    replace: "      return `indexnow: 전수 제출 실패 (${ok.status}) · ${locs.length}건, 표식 유지`",
    test: TEST,
    why: '2026-10-25 첫 회차가 429 를 받았다. 전수가 거절되는 동안 새로 바뀐 상품까지 제출이 멎는다(에러 0).',
  },
]
