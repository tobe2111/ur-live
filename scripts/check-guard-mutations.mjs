#!/usr/bin/env node
/**
 * 🧬 **가드가 실제로 실패할 수 있는지 기계가 확인한다** (되돌려-검증 자동화).
 *
 * ## 왜 (2026-08-01~02 하루에 **세 번** 났다)
 * 이 레포의 반복 사고는 "검사가 실패한다"가 아니라 **"검사가 실패할 수 없다"** 이다.
 * 배포는 초록불이고 아무도 모른다. 같은 날 내가 만든 가드 세 개가 전부 그랬다:
 *
 * 1. `배열을 reverse 해도 같은가` — 15개 배열의 reverse 는 인덱스 i→14−i 라 **홀짝이 보존**돼
 *    2조 분할에 영향이 0 이었다. 정렬을 통째로 지워도 초록불.
 * 2. `phase 이름이 바뀌면 조가 흔들린다` — `maintenance?…` 의 이웃이 `?` 앞에서 이미 갈려
 *    실제로는 안 일어나는 일이었다. 쿼리 제거를 무력화해도 초록불.
 * 3. `한 회차가 예산을 넘지 않는다` — 픽스처에 **일 1회 레인이 하나도 없어** `always` 가 늘
 *    빈 배열이었다. 라이브에선 예산 8 에 12개가 떠서 3개가 잘리고 있었는데도 초록불.
 *
 * 셋 다 **손으로 주입해 보고서야** 알았다. 손으로 하면 다음 세션은 안 한다.
 *
 * ## 무엇을 하는가
 * 아래 `MUTATIONS` 의 각 항목에 대해: 소스에 알려진 결함을 심고 → 지정 테스트를 돌리고 →
 * **빨간불이 안 뜨면 실패**시킨다. 그리고 원본을 복원한다.
 *
 * 두 가지를 동시에 잡는다:
 *   ① **헛도는 가드** — 결함을 심었는데 테스트가 통과 = 그 가드는 아무것도 안 지키고 있다.
 *   ② **낡은 지도** — `find` 문자열이 소스에 없음 = 코드가 옮겨갔는데 이 검증만 남았다.
 *      (이 레포가 잠금표에서 겪은 바로 그 클래스. 조용히 통과시키지 않고 **실패**로 다룬다.)
 *
 * ## ⚠️ 안전
 * 소스를 **실제로 수정**하므로 반드시 복원한다: try/finally + 프로세스 시그널 훅 + 종료 시 재확인.
 * 원본은 메모리에 담고, 어떤 경로로 끝나도 되돌린다. (그래도 중단됐다면 `git diff` 로 확인할 것.)
 *
 * ## 새 가드를 만들면 여기에 한 줄 추가하라
 * 이게 이 레포의 "깨뜨려서 확인" 규율의 **기계 버전**이다. 항목이 없는 가드는 다음 세션에
 * 조용히 헛돌 수 있다.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const STRICT = process.argv.includes('-s') || process.argv.includes('--strict')

/**
 * @typedef {{name:string, file:string, find:string, replace:string, test:string, why:string}} Mutation
 * `find` 는 소스에 **정확히 한 번** 나타나는 문자열이어야 한다(여러 번이면 첫 번째만 바뀌어
 * 의도한 결함이 아닐 수 있다 — 그래서 개수도 검사한다).
 */
/** @type {Mutation[]} */
const MUTATIONS = [
  {
    name: 'cron 팬아웃이 다시 안 기다림(자식 취소)',
    file: 'src/worker-ads/index.ts',
    find: "kick('/__ads/enrich-influencer-driver?sync=1'",
    replace: "kick('/__ads/enrich-influencer-driver'",
    test: 'src/tests/unit/ads-fanout-cron-sync.test.ts',
    why: '드라이버가 0.6초에 반환하면 부모 waitUntil 이 풀려 손자가 취소된다 — 실측 prev_landed:false 2회 연속.',
  },
  {
    name: '팬아웃 신고가 띄운 뒤로 이동(비교 기준 사후값)',
    file: 'src/worker-ads/enrich.routes.ts',
    find: '    await reportFanout(c.env as never, K, rounds)\n    const kids = Array.from(',
    replace: '    const kids = Array.from(',
    test: 'src/tests/unit/ads-fanout-cron-sync.test.ts',
    why: 'lane_before 가 이번 라운드 전진 후 값이 되면 다음 회차가 영원히 "전진 없음"으로 오판한다.',
  },
  {
    name: 'sync 전멸을 초록으로 반환',
    file: 'src/worker-ads/enrich.routes.ts',
    find: 'ok: landed > 0, fanout: K, sync: true, landed, slices }, landed > 0 ? 200 : 500',
    replace: 'ok: true, fanout: K, sync: true, landed, slices }, 200',
    test: 'src/tests/unit/ads-fanout-cron-sync.test.ts',
    why: '"띄웠다 = 성공" 오해가 sync 경로로 되살아난다 — 자식이 전멸해도 화면이 초록.',
  },
  {
    name: '스냅샷이 조건부로 회귀(붕괴 판정의 분모 소실)',
    file: 'src/worker-ads/lane-runner.ts',
    find: "  const writes = [\n    env.DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind('ads_dispatch_last', snap),\n  ]\n  if (sel.deferred.length) {",
    replace: "  const writes = []\n  if (sel.deferred.length) {\n    writes.push(env.DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind('ads_dispatch_last', snap))",
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why: '미룬 게 없는 회차에 띄운 레인 수가 안 남는다 — 06:00Z 에서 실제로 "4개를 띄웠나 8개가 죽었나"를 못 갈랐다.',
  },
  {
    name: '도메인 격리 제거(예산이 다시 섞임)',
    file: 'src/worker-ads/dispatch-budget.ts',
    find: '    const sel = selectLanesForTick(group, budgets[d], cursors[d] ?? 0, share)',
    replace: '    const sel = selectLanesForTick(group, perTick, cursors[d] ?? 0, share)',
    test: 'src/tests/unit/ads-lane-domains.test.ts',
    why: '도메인마다 전체 예산을 주면 격리가 없어진다 — B2B 레인이 늘면 인플루언서가 깎이던 그 상태.',
  },
  {
    name: '작은 도메인 최소 1자리 보장 제거',
    file: 'src/worker-ads/lane-domains.ts',
    find: 'for (const e of exact) { out[e.d] = Math.max(1, Math.floor(e.v)); used += out[e.d] }',
    replace: 'for (const e of exact) { out[e.d] = Math.floor(e.v); used += out[e.d] }',
    test: 'src/tests/unit/ads-lane-domains.test.ts',
    why: '몫이 작은 도메인(매장후보·도매)이 반올림에서 0 이 되어 영원히 안 돈다 — 부재 사고의 교과서적 형태.',
  },
  {
    name: '레인 도메인 표 누락(남의 예산을 씀)',
    file: 'src/worker-ads/lane-domains.ts',
    find: "  'enrich-influencer-driver': 'influencer',",
    replace: '',
    test: 'src/tests/unit/ads-lane-domains.test.ts',
    why: '표에서 빠진 레인은 FALLBACK 으로 흘러가 돌기는 도는데 남의 조 예산을 쓴다(에러 없음).',
  },
  {
    name: '유료 천장이 무료와 같아짐(요금제 반쪽)',
    file: 'src/features/marketing/api/collect-budget.ts',
    find: 'export const SUBREQ_PLATFORM_CAP_PAID = 900',
    replace: 'export const SUBREQ_PLATFORM_CAP_PAID = 60',
    test: 'src/tests/unit/ads-plan-scaling.test.ts',
    why: '유료로 바꿔도 레인당 처리가 60 에 묶이던 08-02 이전 상태. "레인 수만 늘고 일은 그대로".',
  },
  {
    name: '레인이 요금제를 우회(raw env 직접 전달)',
    file: 'src/features/marketing/api/enrich-lane.ts',
    find: 'envSubreqCap(env)',
    replace: 'platformSubreqCap(env.ADS_SUBREQ_PLATFORM_CAP)',
    test: 'src/tests/unit/ads-plan-scaling.test.ts',
    why: '13개 파일이 전부 이 형태였다 — 함수가 옳아도 레인이 안 쓰면 요금제가 닿을 길이 없다.',
  },
  {
    name: '무료 보폭이 바뀜(라이브 회귀)',
    file: 'src/features/marketing/api/collect-budget.ts',
    find: 'return Math.max(RECOVER_STEP, Math.round(scaleBase(ceiling, learnedCap) / 30))',
    replace: 'return Math.max(RECOVER_STEP, Math.round(scaleBase(ceiling, learnedCap) / 10))',
    test: 'src/tests/unit/ads-plan-scaling.test.ts',
    why: '유료 축을 넣다가 무료 학습 곡선을 흔드는 것 — 에러 없이 수확만 줄어드는 종류의 회귀.',
  },
  {
    name: 'AIMD 불변식 위반(하향 ≤ 회복)',
    file: 'src/features/marketing/api/collect-budget.ts',
    find: 'return Math.max(ABANDON_STEP, Math.round(scaleBase(ceiling, learnedCap) / 15))',
    replace: 'return Math.max(ABANDON_STEP, Math.round(scaleBase(ceiling, learnedCap) / 60))',
    test: 'src/tests/unit/ads-plan-scaling.test.ts',
    why: '하향이 회복보다 작으면 회차가 계속 죽는 동안에도 상한이 순증해 영영 못 내려온다.',
  },
  {
    name: '보폭이 생활점 대신 천장 기준으로 회귀',
    file: 'src/features/marketing/api/collect-budget.ts',
    find: 'const live = learnedCap && learnedCap > 0 ? Math.min(learnedCap, ceiling) : ceiling',
    replace: 'const live = ceiling',
    test: 'src/tests/unit/collect-budget-cap.test.ts',
    why: '첫 판이 그랬다 — 천장이 크고 실제 한도가 작은 배치(ADS_PLAN=paid 인데 계정은 무료)에서 낭비가 늘었다.',
  },
  {
    name: '예산 차감 제거(라이브 결함 재현)',
    file: 'src/worker-ads/dispatch-budget.ts',
    find: 'const cap = Math.max(1, budget - always.length)',
    replace: 'const cap = budget',
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why: '미룰 수 없는 레인이 예산 위에 얹히던 08-02 결함. 예산 8 에 12개가 떠 꼬리 3개가 CPU 한도로 잘렸다.',
  },
  {
    name: 'cap 하한 1 제거',
    file: 'src/worker-ads/dispatch-budget.ts',
    find: 'const cap = Math.max(1, budget - always.length)',
    replace: 'const cap = Math.max(0, budget - always.length)',
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why: '0 이면 그 시간대가 반복될 때 커서가 영원히 안 움직인다(= 부재).',
  },
  {
    // 2026-08-02: 커서가 역할별로 갈리며 전진 지점이 `pickFrom` 안으로 옮겨졌다(이전 대상
    //   `nextCursor: (c + cap) % n` 은 소멸). 지도를 안 고치면 이 주입이 조용히 안 돈다.
    name: '커서 전진 제거',
    file: 'src/worker-ads/dispatch-budget.ts',
    find: 'next: (c + take) % n',
    replace: 'next: c',
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why: '커서가 안 움직이면 매 회차 같은 레인만 돌고 나머지는 영원히 굶는다.',
  },
  {
    name: '커서 저장 제거(배선)',
    file: 'src/worker-ads/lane-runner.ts',
    // 역할별 커서라 숫자 하나로는 못 남긴다 — 저장이 JSON 으로 바뀌었다(2026-08-02).
    find: 'bind(DISPATCH_CURSOR_KEY, JSON.stringify(sel.nextCursors))',
    replace: 'bind(DISPATCH_CURSOR_KEY, "0")',
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why: '순수 로직이 맞아도 저장을 안 하면 라운드로빈이 매번 0에서 다시 시작한다.',
  },
  {
    name: '역할 몫 무력화(측정 기아 재발)',
    file: 'src/worker-ads/dispatch-budget.ts',
    find: "return assignKey(lane.beat).startsWith('enrich') ? 'measure' : 'other'",
    replace: "return 'other'",
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why: '역할 판정이 죽으면 몫이 다시 **레인 개수**로 정해진다 — 수집 소스를 붙일 때마다 측정의 몫이 깎이는 한 방향 드리프트가 재발한다(08-02 라이브: 수집 13 : 측정 1, nb_unmeasured 상승).',
  },
  {
    name: '진단 노출 제거',
    file: 'src/features/marketing/api/ads-pool-diag.ts',
    find: "    dispatch: parseJson(find('ads_dispatch_last')),",
    replace: '',
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why: '스냅샷을 쓰기만 하고 노출을 안 해 #919 첫 판정에서 ran/deferred 를 못 봤다.',
  },
  {
    name: '일 1회 레인 보호 제거',
    file: 'src/worker-ads/dispatch-budget.ts',
    find: '  return gap <= 60',
    replace: '  return true',
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why: '일 1회 레인을 미루면 그 시간이 지나 영영 안 돈다 — 침묵이 아니라 부재라 경보에도 안 잡힌다.',
  },
  {
    name: '유료 확대 무력화',
    file: 'src/worker-ads/dispatch-budget.ts',
    find: 'export const PAID_LANES_PER_TICK = 64',
    replace: 'export const PAID_LANES_PER_TICK = 8',
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why: '대표 지시 "유료 전환 시 자연히 늘어나게" 의 실체 — 이게 죽으면 유료로 올려도 그대로다.',
  },
  {
    name: '예산 우회 래칫 무력화',
    file: 'scripts/check-ads-dispatch-bypass.mjs',
    find: "const added = found.filter(k => !baseline.includes(k))",
    replace: 'const added = []',
    test: 'src/tests/unit/ads-dispatch-bypass.test.ts',
    why: '래칫이 신규 우회를 안 잡으면 예산 밖 레인이 조용히 늘어난다(부모 CPU 직격).',
  },
  {
    name: '수집 타임라인 KST 보정 제거',
    file: 'src/features/marketing/api/pool-timeline.ts',
    find: "DATE(${tsColumn}, '+9 hours') AS d",
    replace: 'DATE(${tsColumn}) AS d',
    test: 'src/tests/unit/ads-pool-timeline.test.ts',
    why: 'D1 값은 Z 없는 UTC 라 보정 없이 DATE() 하면 한국 사용자에게 하루 밀린 날짜를 보여준다(실사고 4건 클래스).',
  },
  {
    name: '수집 타임라인 풀 컬럼 혼동',
    file: 'src/features/marketing/api/pool-timeline.ts',
    find: "company: { table: 'ad_company_leads', tsColumn: 'collected_at' },",
    replace: "company: { table: 'ad_company_leads', tsColumn: 'created_at' },",
    test: 'src/tests/unit/ads-pool-timeline.test.ts',
    why: '2026-08-02 라이브 실사고 재현: created_at 으로 적어 배포했더니 no such column 을 catch 가 삼켜 **에러 없이 allTime 0**(17만 건 풀이 빈 것처럼). 둘 다 collected_at 이다.',
  },
  {
    name: '팬아웃 자기신고 무력화(띄웠다=성공)',
    file: 'src/features/marketing/api/enrich-fanout-health.ts',
    find: '    ok: verdict.landed !== false,',
    replace: '    ok: true,',
    test: 'src/tests/unit/ads-enrich-fanout-health.test.ts',
    why: '필드만 추가하고 ok 를 안 뒤집으면 화면은 여전히 초록이다 — 자식이 전멸해도 6시간을 모른다(08-02 실측).',
  },
  {
    name: '풀 스캔 작업 상한 제거',
    file: 'src/features/marketing/api/pool-scan-budget.ts',
    find: 'if (n >= POOL_SCAN_MAX_ROWS) return true',
    replace: 'if (false) return true',
    test: 'src/tests/unit/ads-cpu-work-cap.test.ts',
    why: '상한이 없으면 한 인보케이션이 4만 행을 훑어 CPU 한도를 넘긴다(#908).',
  },
  {
    name: '스키마 매니페스트에 로직 유입',
    file: 'src/worker/routes/repair-schema/column-repairs.ts',
    find: 'export const COLUMN_REPAIRS: ColumnRepair[] = [',
    replace: 'const mk = (t) => ({ desc: t, sql: `ALTER TABLE ${t} ADD x TEXT` })\nexport const COLUMN_REPAIRS: ColumnRepair[] = [\n    mk("zz"),',
    test: 'src/tests/unit/repair-schema-manifest.test.ts',
    why:
      '이 파일은 "순수 데이터"라는 이유로 600줄 캡을 면제받았다. 로직이 들어오면 그 근거가 사라져 ' +
      '단지 "린트를 끈 1,000줄짜리 파일"이 된다. 이 주입은 처음엔 **초록이 떴다** — 검사가 배열 ' +
      '본문만 봐서 선언 위에 심은 헬퍼를 못 봤다. 파일 전체를 보게 고친 뒤 빨강.',
  },
  {
    name: '추천 보너스 원장 폴백 제거',
    file: 'src/features/group-buy/api/referral-bonus.ts',
    find: "await recordPointTxMinimal(DB, uid, 'referral_bonus', bonus, desc)",
    replace: '/* removed */',
    test: 'src/tests/unit/point-credit-ledger-row.test.ts',
    why:
      '이 원장 행은 잔액 기록이자 **중복 방지 키**다(`alreadyRewarded` 가 description LIKE 로 읽는다). ' +
      '행이 없으면 같은 추천 조합이 매번 다시 보상받는다 — 불일치를 넘어 반복 지급.',
  },
  {
    name: '회차 조건 clamp 를 순진한 Number 로',
    file: 'src/features/marketing/api/store-trades.ts',
    find: "  const ok = (typeof v === 'number' && Number.isFinite(v))",
    replace: '  const ok = Number.isFinite(Number(v))',
    test: 'src/tests/unit/store-collect-config.test.ts',
    why:
      '`Number(null)` · `Number([])` · `Number("")` 은 전부 **0** 이라 "값 없음"이 기본값이 아니라 ' +
      '**하한**으로 조용히 바뀐다. 이 레포는 같은 함정으로 `{amount: []}` 가 0원 환불로 통과한 적이 있다(#941). ' +
      '이 항목은 시험이 실제로 잡아낸 결함이다.',
  },
  {
    name: '지역 권역 매칭 0 → 전국 폴백 제거',
    file: 'src/features/marketing/api/store-kakao-collect.ts',
    find: '  return picked.length ? picked : S2_REGIONS // 아무것도 안 잡히면 전국(설정 오타로 수집이 0 이 되면 안 된다)',
    replace: '  return picked',
    test: 'src/tests/unit/store-collect-config.test.ts',
    why: '설정 오타 하나로 그리드가 0 이 되면 레인이 **에러 없이** 아무것도 안 캔다 — 침묵하는 0 보다 넓게 도는 편이 낫다.',
  },
  {
    name: '매장 업태 — 빈 배열도 상수로 폴백(끈 게 되살아남)',
    file: 'src/features/marketing/api/store-kakao-collect.ts',
    find: 'const voucherTrades = dbTrades ? (dbTrades.voucher || []) : VOUCHER_TRADES',
    replace: 'const voucherTrades = (dbTrades?.voucher?.length ? dbTrades.voucher : VOUCHER_TRADES)',
    test: 'src/tests/unit/store-trades-config.test.ts',
    why:
      '"조회 실패" 와 "의도적으로 다 끔" 은 둘 다 비어 있지만 뜻이 정반대다. 후자에 폴백하면 ' +
      '화면은 OFF 인데 수집은 계속 돈다 — 설정이 무력화되는 가장 나쁜 실패이고, 에러도 안 난다.',
  },
  {
    name: '매장 업태 시드가 설정을 덮어씀',
    file: 'src/features/marketing/api/store-trades.ts',
    find: 'INSERT OR IGNORE INTO ad_store_trades (block, kw, category) VALUES',
    replace: 'INSERT OR REPLACE INTO ad_store_trades (block, kw, category) VALUES',
    test: 'src/tests/unit/store-trades-config.test.ts',
    why: 'REPLACE 면 대표가 끈 업태가 **매 배포마다** 되살아난다 — 설정이 배포에 지워진다.',
  },
  {
    name: '수집 업종 토글이 집계와 다른 식을 씀',
    file: 'src/features/marketing/api/company-trades.ts',
    find: 'UPDATE ad_company_keywords SET active = ? WHERE ${TRADE_EXPR} = ?',
    replace: 'UPDATE ad_company_keywords SET active = ? WHERE subcategory = ?',
    test: 'src/tests/unit/company-trades-toggle.test.ts',
    why:
      '집계(화면)와 토글(실행)이 다른 식을 쓰면 대표가 끈 줄 아는 업종이 계속 캐진다. ' +
      '서브카테고리가 빈 업종은 아예 안 꺼진다 — 에러 없이.',
  },
  {
    name: '마지막 활성 업종 가드 제거',
    file: 'src/features/marketing/api/company-trades.ts',
    find: "if ((Number(self?.n) || 0) > 0 && activeTrades <= 1) return { ok: false, error: 'LAST_ACTIVE_TRADE' }",
    replace: '',
    test: 'src/tests/unit/company-trades-toggle.test.ts',
    why:
      '전부 끄면 회전 쿼리가 0행을 받아 수집이 **에러 없이** 멈추고 하트비트는 초록으로 남는다 ' +
      '(레인은 정상 실행되고 할 일이 없을 뿐이다). 클릭 한 번으로 그 상태가 될 수 있다.',
  },
  {
    name: '우선업종 category 오타(조용한 0 순위)',
    file: 'src/features/marketing/api/store-kakao-collect.ts',
    find: "{ kw: '한식', category: '일반음식점' }",
    replace: "{ kw: '한식', category: '음식점' }",
    test: 'src/tests/unit/store-kakao-voucher-grid.test.ts',
    why:
      'category 는 `PRIORITY_UPJONG`(인허가 한글 업종명)과 글자까지 같아야 우선순위 SQL 에 걸린다. ' +
      '한 글자만 달라도 에러 없이 **0 순위**가 되고 어드민 업종 필터에서도 별개 항목으로 갈린다 ' +
      '— store-prospects.ts 주석이 이미 경고한 함정이다.',
  },
  {
    name: '카카오 매장 수집 마감선 제거',
    file: 'src/features/marketing/api/store-kakao-collect.ts',
    find: "if (Date.now() - startedAt > RUN_DEADLINE_MS) { stoppedBy = 'deadline'; break outer }",
    replace: '',
    test: 'src/tests/unit/store-kakao-voucher-grid.test.ts',
    why:
      '커서 저장이 루프 뒤에 있다. CPU 한도로 죽으면 커서가 안 올라가 다음 회차가 같은 키워드를 ' +
      '또 훑는다 ⇒ **영원히 전진 0**. 통신판매 레인이 정확히 그렇게 며칠간 멈춰 있었다(#927).',
  },
  {
    name: '무인 블록 최소 몫 보장 제거',
    file: 'src/features/marketing/api/store-kakao-collect.ts',
    find: 'const unmanned = Math.max(1, Math.round(total * (1 - voucherShare)))',
    replace: 'const unmanned = Math.floor(total * (1 - voucherShare))',
    test: 'src/tests/unit/store-kakao-voucher-grid.test.ts',
    why:
      '몫이 0 이면 그 레인은 **에러 없이** 멈춘다 — 커서도 안 움직여서 아무도 모른다. ' +
      '대표가 07-28 에 요청한 무인 레인을 조용히 죽이는 경로다.',
  },
  {
    name: '카카오 매장 블록이 커서를 공유',
    file: 'src/features/marketing/api/store-kakao-collect.ts',
    find: "const CURSOR_KEY_VOUCHER = 'ads_store_kakao_cursor_v'",
    replace: "const CURSOR_KEY_VOUCHER = 'ads_store_kakao_cursor'",
    test: 'src/tests/unit/store-kakao-voucher-grid.test.ts',
    why:
      '두 블록(우선업종·무인)이 한 커서를 쓰면 서로의 진행을 덮어써 어느 쪽도 한 바퀴를 못 돈다 ' +
      '— 레인별 학습 상한을 공유해 같은 사고가 났던 `ads_subreq_cap` 과 똑같은 구조다(2026-07-28).',
  },
]

/** 복원해야 할 원본들 — 어떤 경로로 끝나도 되돌린다. */
const pending = new Map()
function restoreAll() {
  for (const [abs, src] of pending) { try { fs.writeFileSync(abs, src) } catch { /* 최선 노력 */ } }
  pending.clear()
}
for (const sig of ['SIGINT', 'SIGTERM', 'uncaughtException']) {
  process.on(sig, (e) => { restoreAll(); if (e instanceof Error) console.error(e); process.exit(1) })
}
process.on('exit', restoreAll)

function runTest(testPath) {
  try {
    execFileSync('npx', ['vitest', 'run', testPath], { cwd: ROOT, stdio: 'pipe', timeout: 180_000 })
    return true   // 통과
  } catch { return false }  // 실패(= 우리가 원하는 것)
}

if (MUTATIONS.length === 0) {
  console.error('❌ guard-mutations: 등록된 주입이 0건 — 통과가 아니라 실패다.')
  process.exit(1)
}

const problems = []
console.log(`🧬 guard-mutations: ${MUTATIONS.length}개 주입 검증 (각각 소스를 잠깐 고쳤다가 되돌린다)\n`)

for (const m of MUTATIONS) {
  const abs = path.join(ROOT, m.file)
  if (!fs.existsSync(abs)) { problems.push(`${m.name}: 파일 없음 — ${m.file} (코드가 옮겨갔다)`); continue }
  const src = fs.readFileSync(abs, 'utf8')
  const count = src.split(m.find).length - 1
  if (count === 0) { problems.push(`${m.name}: 주입 대상을 못 찾음 — ${m.file} 의 \`${m.find.slice(0, 50)}…\` (낡은 지도)`); continue }
  if (count > 1) { problems.push(`${m.name}: 주입 대상이 ${count}곳 — 유일해야 한다(엉뚱한 곳을 고칠 수 있다)`); continue }

  pending.set(abs, src)
  let stillGreen
  try {
    fs.writeFileSync(abs, src.replace(m.find, m.replace))
    stillGreen = runTest(m.test)
  } finally {
    fs.writeFileSync(abs, src)
    pending.delete(abs)
  }
  if (stillGreen) problems.push(`${m.name}: 결함을 심었는데 \`${m.test}\` 가 **통과** — 이 가드는 아무것도 안 지킨다.\n      (${m.why})`)
  console.log(`   ${stillGreen ? '❌' : '✅'} ${m.name}`)
}

// 🔒 마지막 안전 확인 — 어떤 경로로든 소스가 바뀐 채 남지 않았는지.
for (const m of MUTATIONS) {
  const abs = path.join(ROOT, m.file)
  if (fs.existsSync(abs) && fs.readFileSync(abs, 'utf8').includes(m.replace) && m.replace && !fs.readFileSync(abs, 'utf8').includes(m.find)) {
    problems.push(`⚠️ 복원 실패 의심: ${m.file} — \`git diff\` 로 확인할 것`)
  }
}

if (problems.length) {
  console.error(`\n❌ guard-mutations: ${problems.length}건\n`)
  for (const p of problems) console.error(`   • ${p}`)
  console.error(`
   이 검사가 실패한다는 것은 **가드가 지키는 척만 하고 있다**는 뜻이다.
   조치: 그 테스트의 픽스처가 정말 그 경우를 담고 있는지 보라(오늘 세 번 다 픽스처 문제였다).
`)
  process.exit(STRICT ? 1 : 0)
}
console.log(`\n✅ guard-mutations: ${MUTATIONS.length}개 주입 전부 빨간불 확인 — 가드가 실제로 실패할 수 있다.`)
