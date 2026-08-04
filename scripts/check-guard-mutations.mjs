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
 * 🔍 `--only <부분문자열>` — 한 건만 돌린다(이름 부분일치).
 * 전수는 45회 vitest 라 ~1.5분이고, 주입 하나를 손보는 동안 그걸 매번 기다리면 결국 **확인을
 * 건너뛰게 된다** — 이 레포가 반복해서 당한 자리다. CI 는 인자 없이 전수로 돈다.
 */
const ONLY = (() => {
  const i = process.argv.indexOf('--only')
  return i !== -1 ? process.argv[i + 1] : null
})()

/**
 * 🧹 `--verify-clean` — **아무것도 주입하지 않고**, 작업트리에 주입 잔재가 남아 있는지만 본다(수초).
 *
 * 왜 별도 모드인가: 이 스크립트는 끝에서 복원을 확인하지만 그건 **끝까지 갔을 때** 얘기다.
 * 전수는 100건 넘는 vitest 라 오래 걸려서 중간에 끊기기 쉽고(타임아웃·Ctrl-C·`kill -9`),
 * 그러면 마지막에 주입된 파일이 **그대로 남는다**. 2026-08-03 실측: 끊긴 harness 가
 * `lane-aimd.ts`·`lane-cadence.ts`·`influencer-auto-collect.ts` 3개를 바꿔 놓은 채였고,
 * 그중 하나는 **같은 날 다른 세션이 고친 커서 버그를 되살리는** 내용이었다 — `git add -A` 로
 * 하마터면 그대로 커밋될 뻔했다.
 *
 * ⇒ **harness 를 중간에 끊었으면 커밋 전에 이걸 돌려라.** `git diff` 로 눈으로 보는 것보다 확실하다
 *   (주입 한 줄은 정상 코드와 구분이 안 간다).
 */
const VERIFY_CLEAN = process.argv.includes('--verify-clean')

/**
 * @typedef {{name:string, file:string, find:string, replace:string, test:string, why:string}} Mutation
 * `find` 는 소스에 **정확히 한 번** 나타나는 문자열이어야 한다(여러 번이면 첫 번째만 바뀌어
 * 의도한 결함이 아닐 수 있다 — 그래서 개수도 검사한다).
 */
/** @type {Mutation[]} */
const MUTATIONS = [
  {
    name: '나라장터 계약 — 마스킹된 전화를 진짜 연락처로 센다',
    file: 'src/features/marketing/api/nara-contract-collect.ts',
    find: "  return raw.includes('*') ? '' : raw",
    replace: '  return raw',
    test: 'src/tests/unit/nara-contract-collect.test.ts',
    why:
      '이 원부는 수주사 전화를 `***********` 로 가려서 준다(실측). 그대로 저장하면 **"연락처 있음"** 으로 ' +
      '집계돼 액션풀(active=1)에 들어간다 — 유어애즈의 유일한 지표가 *"제안 보낼 수 있는 리드 수"* 인데 ' +
      '그 숫자가 거짓이 된다. 전화하면 그제서야 안다. 200 도 받고 저장도 되니 **에러가 어디에도 안 뜬다.**',
  },
  {
    name: '나라장터 계약 — 상권 필터가 풀려 26k 계약이 통째로 유입',
    file: 'src/features/marketing/api/nara-contract-collect.ts',
    find: '  if (!DISTRICT_CONTRACT_RE.test(cntrctNm)) return []',
    replace: '  if (!cntrctNm) return []',
    test: 'src/tests/unit/nara-contract-collect.test.ts',
    why:
      '원부 26,445건 중 상권 계약은 소수이고 나머지는 대학·병원 물품 구매다. 필터가 풀리면 ' +
      '**수집이 성공한 것처럼 보이면서**(저장 수가 오히려 폭증한다) 상권 리드가 잡음에 덮인다. ' +
      '수치가 커지는 방향의 고장이라 대시보드로는 절대 못 알아챈다.',
  },
  {
    name: '나라장터 계약 — 굳은 파라미터 판정이 코드 수정을 이긴다',
    file: 'src/features/marketing/api/nara-contract-collect.ts',
    find: '  if (Number(v || 0) !== NARA_PARAM_STATE_VERSION) return null',
    replace: '  void v',
    test: 'src/tests/unit/nara-contract-collect.test.ts',
    why:
      '레인이 측정한 파라미터 모드를 D1 에 굳히는데, 버전 잠금이 빠지면 **코드 기본값을 고쳐 배포해도 ' +
      'DB 의 옛 판정이 이겨 라이브가 안 변한다.** 인허가 레인에서 정확히 이 사고를 겪었고 ' +
      '(`LICENSE_STATE_VERSION` 이 그 수습이다) 원인을 찾는 데 하루가 갔다 — 배포는 초록불이었다.',
  },
  {
    name: '데모 추첨 자가치유가 발화 안 하는 cron 슬롯에 배선됨',
    file: 'src/worker/scheduled.ts',
    find: "    ctx.waitUntil(safeCron('demo-fcfs-renew', () => renewDemoFcfs(env)));",
    replace: "    if (cron === '0 * * * *') { ctx.waitUntil(safeCron('demo-fcfs-renew', () => renewDemoFcfs(env))); }",
    test: 'src/tests/unit/cron-slot-registered.test.ts',
    why:
      '숙박 데모 72개가 **추첨 배지 없이** 89,000원짜리 진짜 숙박권으로 보이고 있어 자가치유 백필을 ' +
      '`demo-fcfs-renew` 에 넣고 배포했는데 라이브가 그대로였다. 그 cron 이 `0 * * * *` 블록 안에 있고 ' +
      '그 표현식은 wrangler.toml crons 에 **없다**(3단계 보류) — 즉 한 번도 발화한 적이 없다(하트비트 ' +
      '실측: 시간당 32건이 전부 ads:* 별도 워커, 메인 워커 0건). **에러가 없어** 배포는 초록불이고 ' +
      '리뷰에도 안 걸린다. 짝인 check-cron-heartbeat 는 "safeCron 으로 감쌌는가"만 보므로 못 잡는다.',
  },
  {
    name: '서비스 지도가 낡아 공구 서비스 일을 유어딜 일로 오인',
    file: 'docs/design/urdeal-platform-model.md',
    find: '| **🏪 공구 서비스** (운영자 SaaS)',
    replace: '| ~~삭제된 행~~',
    test: 'src/tests/unit/service-map-currency.test.ts',
    why:
      '지도가 오래 3-서비스였고 도매몰을 여전히 "B2B 도매"로만 적어, 그 사이 도매몰 코드를 용도 변경해 ' +
      '만들어진 **공구 서비스**(운영자 SaaS)가 지도에 없었다. 2026-08-03 세션이 그 서비스의 오픈 차단 ' +
      '항목(미수령 고지·브랜딩·실결제)을 **"유어딜 일"로 대표에게 보고**했다 — 서로 다른 서비스의 할 일이 ' +
      '한 목록에 섞였고 대표가 바로잡았다. 지도는 세션이 "이건 어느 서비스인가"를 판단하는 유일한 근거다.',
  },
  {
    name: '결제수단을 카테고리로 정해 이용권이 카드 결제에서 빠짐',
    file: 'src/pages/GroupBuyDetailPage.tsx',
    find: 'const { flow } = resolveProductFlow(detail)',
    replace: "const flow = isVoucherCategory(detail.category) ? 'voucher_deal' : 'group_buy_toss'",
    test: 'src/tests/unit/payment-flow-naming.test.ts',
    why:
      '결제수단 SSOT 는 `getProductFlow`(deal_only=1 → 딜 / group_buy_status=active → 카드)이고 ' +
      '**카테고리는 판정 기준이 아니다**. `meal_voucher` 인 김밥천국 할인권은 카드 결제다. ' +
      '2026-08-03 에 세션이 낡은 주석을 믿고 "이용권은 카드로 못 산다"고 대표에게 보고했고, ' +
      '그 결과 존재하는 테스트 상품을 두고 새로 만들라고 안내할 뻔했다. 카테고리로 판정하면 ' +
      '이용권 전체가 카드 결제에서 빠진다.',
  },
  {
    name: '데모 판정이 좁은 접두사로 되돌아가 새 데모 종류가 소비자에게 판매 상품으로 보임',
    file: 'src/features/group-buy/api/group-buy-public.routes.ts',
    find: "const DEMO_LAST = `(CASE WHEN ${demoSlugSql('p')} THEN 1 ELSE 0 END)`",
    replace: `const DEMO_LAST = "(CASE WHEN COALESCE(p.slug,'') LIKE 'demo-deal-%' THEN 1 ELSE 0 END)"`,
    test: 'src/tests/unit/demo-raffle-coverage.test.ts',
    why:
      '2026-08-03 실측: `demo-deal-` 접두사가 6군데에 하드코딩돼 있었고, 나중에 생긴 `demo-stay-*` 72개가 ' +
      '어디에도 안 걸렸다. 추첨 설정이 0이라 배지 렌더 `{fcfs && <FcfsBadge/>}` 가 아무것도 안 그렸고 ' +
      '소비자 눈엔 **89,000원짜리 진짜 숙박권**으로 보였다. 후순위 정렬에도 안 걸려 **피드 첫 50건을 전부 점유** ' +
      '(같은 시점 실상품은 3개뿐). 에러가 없어 몇 주간 아무도 몰랐다 — 대표가 화면을 보고 물어서 드러났다.',
  },
  {
    name: '심평원 수집이 마감선 없이 25초짜리 페이지를 3장 연다(67초, 최다)',
    file: 'src/features/marketing/api/hira-hospital-collect.ts',
    find: "if (Date.now() - startedAt > runDeadlineMs) { stoppedBy = 'deadline'; break }",
    replace: '',
    test: 'src/tests/unit/ads-lane-deadlines-final.test.ts',
    why:
      '페이지 한 장이 `AbortSignal.timeout(25000)` 까지 버티고 무료 maxPages=3 ⇒ 최악 75초(+재시도 8초). ' +
      '실측 67초로 유어애즈 최다였다. 부모 cron 이 그걸 못 버티고 죽으면 매달린 자식이 전부 끌려간다. ' +
      '⚠️ per-fetch 25초는 다른 세션의 재시도 실험 변수라 건드리지 않는다 — 이 마감선은 페이지 수만 묶는다.',
  },
  {
    name: '야간 재스캔의 하위작업이 고정 순서라 마지막(naver)이 영구 미실행',
    file: 'src/features/marketing/api/influencer-maintenance.ts',
    find: 'for (const idx of rotatedOrder(from, jobs.length))',
    replace: 'for (const idx of jobs.map((_, i) => i))',
    test: 'src/tests/unit/ads-lane-deadlines-final.test.ts',
    why:
      '하위작업 셋을 순차 실행하는데 마감선을 넣으면서 순서를 고정하면, 앞의 둘이 시간을 다 쓸 때 ' +
      '`naver` 는 매 회차 잘린다. **하루 1회 레인이라 그건 곧 영구 미실행이다.** ' +
      '`sweep-mx` 블록에서 겪은 것과 같은 구조적 기아 — 마감선과 회전은 짝이다.',
  },
  {
    name: '꼬리가 워커 금지 조합(동적 alias import)으로 되돌아감',
    file: 'src/worker-ads/tail-bound.ts',
    find: "const waited = resolvePlan(env as never) === 'paid' ? TAIL_WAIT_MS_PAID : TAIL_WAIT_MS",
    replace: "const { envPlanValue } = await import('@/features/marketing/api/collect-budget')\n  const waited = envPlanValue(undefined, TAIL_WAIT_MS, TAIL_WAIT_MS_PAID, env as never)",
    test: 'src/tests/unit/ads-tail-bound.test.ts',
    why:
      'CLAUDE.md 가 금지하는 조합이다(워커에서 dynamic import + `@/` alias). 이 꼬리에서 던지면 ' +
      '**기록이 통째로 안 남아** 고치려던 고장과 증상이 같아진다 — 원인 규명이 한 바퀴 더 돈다. ' +
      '같은 폴더 `resolvePlan` 을 정적 상대 import 로 쓴다(`tick-history-write.ts` 와 동일).',
  },
  {
    name: '앞 단계가 던지면 요약·스탬프가 통째로 생략됨',
    file: 'src/worker-ads/tail-bound.ts',
    find: '  try {\n    await writeTickSummary(o.DB as never, o.at, o.hourUTC, judgedLaneNames(o.ranNames, r.settled), o.beats.seenBeats, o.env as never)\n  } catch { /* 스탬프까지는 남긴다 */ }',
    replace: '  await writeTickSummary(o.DB as never, o.at, o.hourUTC, judgedLaneNames(o.ranNames, r.settled), o.beats.seenBeats, o.env as never)',
    test: 'src/tests/unit/ads-tail-bound.test.ts',
    why:
      '이 꼬리의 존재 이유가 **기록이 남는 것**이다. 대기·flush·요약 중 하나가 던져서 뒤가 생략되면 ' +
      '고장 그대로다(실제로 배포 첫 회차에 기록이 또 안 남았고, 원인 후보가 바로 이 취약성이었다).',
  },
  {
    name: '꼬리 상한이 25s 로 되돌아감(부모가 못 버티는 값)',
    file: 'src/worker-ads/tail-bound.ts',
    find: 'export const TAIL_WAIT_MS = 10_000',
    replace: 'export const TAIL_WAIT_MS = 25_000',
    test: 'src/tests/unit/ads-tail-bound.test.ts',
    why:
      '25s 로는 밤사이 10회차 중 3회 꼬리가 안 돌았고 `cap` 이 4→2 로 되물러났다(2026-08-04 실측). ' +
      '상한이 있으면 최대 그만큼만 기다리므로, 그래도 못 남긴다는 건 **부모가 25s 조차 못 버틴다**는 뜻이다. ' +
      '값을 다시 올리려면 라이브 근거(이력 구멍 감소 실측)가 먼저 있어야 한다.',
  },
  {
    name: '회차 꼬리가 다시 무한정 기다림(학습기 갱신 자리가 통째로 사라짐)',
    file: 'src/worker-ads/tail-bound.ts',
    find: 'await Promise.race([Promise.all(tracked), deadline])',
    replace: 'await Promise.all(tracked)',
    test: 'src/tests/unit/ads-tail-bound.test.ts',
    why:
      '`cap` 을 갱신하는 자리는 회차 꼬리 하나뿐인데, 띄운 레인이 전부 끝나기를 기다리면 부모가 못 버틸 때 ' +
      '요약도 학습도 **통째로 실행되지 않는다**. 실측: 이력이 09:00 KST 에서 5시간 정지했는데 디스패치 기록은 ' +
      '매 회차 정상이고 cron_failures 는 0이었다(예외 없이 잘려 실패로도 안 남는다). 그래서 학습기가 바닥 2 에 고착됐다.',
  },
  {
    name: '못 기다린 레인을 판정에 넘김 — 회차가 늘 해로움이 되는 부호 반대 고착',
    file: 'src/worker-ads/tail-bound.ts',
    find: 'judgedLaneNames(o.ranNames, r.settled)',
    replace: 'o.ranNames',
    test: 'src/tests/unit/ads-tail-bound.test.ts',
    why:
      '`tickHarmed` 는 `fail + miss` 로 판정하고 `miss` 는 *띄웠는데 하트비트가 없는* 레인이다. ' +
      '상한을 넣고도 아직 도는 레인을 그대로 넘기면 전부 miss 로 잡혀 **모든 회차가 항상 해로움**이 된다 — ' +
      '고치려던 것과 **부호만 반대인 같은 고착**이다. 끝난 레인만 판정 대상이어야 한다.',
  },
  {
    name: '순환 경보가 다시 "해제될 수 없는" 임계로 회귀',
    file: 'src/features/marketing/api/influencer-keyword-rotation.ts',
    find: 'export const ROTATION_STARVE_CYCLES = 3',
    replace: 'export const ROTATION_STARVE_CYCLES = 2',
    test: 'src/tests/unit/ads-rotation-health.test.ts',
    why:
      '이 경보의 병은 "안 울리는 것"이 아니라 **꺼질 수 없는 것**이었다(임계 2일 < 한 바퀴 6.5일 → 완벽해도 80% 가 걸림). ' +
      '배수를 실측 최악(2.21바퀴)보다 낮추면 정상 상태가 다시 경보가 된다 — 매일 울리는 경보는 곧 안 읽히는 경보다. ' +
      '이 주입은 그 회귀를 재현한다.',
  },
  {
    name: '매시간 레인이 gap 없이 등록돼 침묵 판정에서 통째로 빠짐',
    // 🔁 2026-08-03: 조립이 `lane-cadence.laneCadenceFields` 로 추출되면서 이 줄이 이사했다
    //   (같은 필드가 미루기 판정에도 쓰여 매시간 레인을 통째로 `always` 로 만들던 것을 끊으면서).
    //   불변식은 그대로다 — **기본값 없이 undefined 를 그대로 넘기면** 그 레인이 침묵 판정에서 빠진다.
    file: 'src/worker-ads/lane-cadence.ts',
    find: '  const gapMin = opts?.gap ?? hourlyGapMinutes()',
    replace: '  const gapMin = opts?.gap as number',
    test: 'src/tests/unit/ads-lane-gap-judgeable.test.ts',
    why:
      '자식 하트비트(`writeSelfBeat`)는 설계상 cron 식을 안 싣고 부모가 넘긴 `gap` 만 믿는데, ' +
      '자식 쓰기가 **나중**이라 부모가 실어 둔 `cron` 을 덮는다. 둘 다 없으면 `getCronHealth` 가 ' +
      '그 레인을 `missing` 으로 빼고 stale 검사를 **안 한다** — 게다가 `missing` 은 `ok` 를 안 깬다. ' +
      '⇒ 그 레인은 조용히 멈춰도 dead-man\'s switch 가 초록이다. 실측: `ads:sweep-kakao-chain`(매시간 17초)이 ' +
      '정확히 그 상태였고, "안 도는 것"과 "판정 대상이 아닌 것"이 화면에서 똑같이 생겼다.',
  },
  {
    name: '요금제 유료값을 만들어 놓고 선택부를 안 붙임(파일 경계를 넘는 배선)',
    file: 'src/features/marketing/api/influencer-maintenance.ts',
    find: 'envPlanValue(undefined, RESCAN_DEADLINE_MS, RESCAN_DEADLINE_MS_PAID, env)',
    replace: 'RESCAN_DEADLINE_MS',
    test: 'src/tests/unit/ads-plan-knobs.test.ts',
    why:
      '상수를 만드는 것과 **그 상수가 선택되는 것**은 다른 일이다 — 후자가 빠지면 유료로 바꿔도 ' +
      '그 축은 안 오르고 **에러는 안 난다**. 이 항목은 특히 **선언과 선택이 다른 파일**인 경우를 고정한다: ' +
      '600줄 캡 때문에 회전 정책을 모듈로 뺀 순간 파일-지역 판정이 오탐을 냈고, 그 교정판의 첫 시도는 ' +
      '`import` 줄에 남은 이름 때문에 **주입에도 초록**이 떴다(텍스트 존재는 구조의 증거가 아니다).',
  },
  {
    name: '회전 커서를 읽어 놓고 항상 0번부터 시작(회전이 죽음)',
    file: 'src/features/marketing/api/rescan-rotation.ts',
    find: 'const start = normalizeOrder(String(from), len)',
    replace: 'const start = 0',
    test: 'src/tests/unit/ads-lane-deadlines-final.test.ts',
    why:
      '배선(호출)은 남아 있는데 산술만 죽으면 **텍스트 검사는 통과**한다 — 위 항목이 못 보는 자리다. ' +
      '그래서 회전은 문자열이 아니라 **동작**으로도 검증한다(회차당 1개만 돌아도 3회차에 셋 다 선두를 받는가).',  },
  {
    name: '주간 D1 백업이 인덱스/트리거/뷰를 안 담아 복구본에서 멱등 UNIQUE 가 사라짐',
    file: 'src/worker/cron/d1-backup.ts',
    find: 'if (objects.length > 0) {',
    replace: 'if (false) {',
    test: 'src/tests/unit/d1-backup-restorable.test.ts',
    why:
      '덤프가 `type=\'table\'` 만 뽑던 시절의 동작이다. 프로덕션 실측 인덱스 610(UNIQUE 46) · 트리거 7 · 뷰 1 이 ' +
      '전부 백업에서 빠지고, 복구하면 `INSERT OR IGNORE + partial UNIQUE` 로 지키던 멱등(머니 룰 #3)이 없어져 ' +
      '**같은 ref 로 두 번 적립이 통과**한다(2026-08-03 축소판 복구 리허설에서 재현). 백업은 ok=true 로 성공하고 ' +
      '복구 검증 쿼리도 행 수만 세므로 **어디서도 빨간불이 안 뜬다** — 그래서 테스트로 박았다.',
  },
  {
    name: 'FTS5 그림자 테이블을 덤프에 실어 BLOB 손상 + 매주 무결성 경고',
    file: 'src/worker/cron/d1-backup.ts',
    find: '.filter((n) => !isInternalTable(n) && !isFtsShadowTable(n, virtualTables))',
    replace: '',
    test: 'src/tests/unit/d1-backup-restorable.test.ts',
    why:
      '`products_fts` 는 외부콘텐츠(content=products) FTS 라 그림자 테이블은 색인 내부구조다. ' +
      '`_data`/`_docsize` 는 BLOB 이라 문자열로 뭉개지고, `_idx`/`_config` 와 D1 내부 `_cf_KV` 는 ' +
      'WITHOUT ROWID 라 `SELECT rowid` 가 실패해 dump 실패 테이블로 남는다. 복구 후 `rebuild` 한 번이면 ' +
      '색인은 원본에서 정확히 재생성되므로 깨진 그림자를 실어 나를 이유가 없다.',
  },
  {
    name: "dead-man's switch 의 의도된 503 을 5xx 로 세어 채널을 영구 점유",
    file: 'src/worker/middleware/error-rate-monitor.ts',
    find: "if (status === 503 && new URL(c.req.url).pathname === '/api/_healthcheck/cron') return;",
    replace: '',
    test: 'src/tests/unit/five-xx-observability.test.ts',
    why:
      '경로 계측을 붙이자 24시간 유일한 5xx 가 `/api/_healthcheck/cron` 이었다 — 고장이 아니라 ' +
      '**cron 침묵을 알리는 설계상 503** 이고, 외부 프로브가 10분마다 두드린다. 그걸 세면 5xx 채널이 ' +
      '영구 점유돼 **진짜 5xx 가 와도 구분이 안 된다**(같은 PR 이 고친 거짓 경보와 같은 클래스). ' +
      '침묵 자체는 uptime.yml + 자가진단이 각자 채널로 이미 보고하므로 여기서 빼도 잃는 정보가 없다.',
  },
  {
    name: '5xx 경보가 1건을 "스파이크"라 불러 매일 거짓 ⚠️ 를 냄',
    file: 'src/worker/cron/daily-self-diagnostic.ts',
    find: 'if (Number(row?.worst || 0) >= 10) issues.push',
    replace: 'if (true) issues.push',
    test: 'src/tests/unit/five-xx-observability.test.ts',
    why:
      '실측상 모든 창이 `count=1`(시간당 1건)인데 화면엔 ⚠️ 로 떴다. 스파이크 임계는 10/분이므로 ' +
      '그건 스파이크가 아니다 — 거짓 경보이고, **진짜 스파이크가 왔을 때 구분이 안 된다.** ' +
      '임계 미만은 정보로 남기고 🔴 는 실제로 넘었을 때만 올린다.',
  },
  {
    name: '5xx 경보에 무엇이 실패했는지가 없어 조치 불가',
    file: 'src/worker/middleware/error-rate-monitor.ts',
    find: "VALUES (?, '5xx_path', ?, 1)",
    replace: "VALUES (?, 'x', ?, 1)",
    test: 'src/tests/unit/five-xx-observability.test.ts',
    why:
      '이 표엔 숫자만 있었다(`key=global`). "5xx 가 있었다"는 알아도 **어디서** 났는지 알 수 없어 ' +
      '경보를 받고도 손에 쥔 것이 없었다. `key` 에 경로를 넣어 같은 표·같은 인덱스로 분포를 얻는다 ' +
      '(스파이크 판정은 global 합계 그대로 — 경로가 갈려도 잡힌다).',
  },
  {
    name: '카카오 전화 스윕이 마감선 없이 회차를 늘림(31초, 침묵 1위)',
    file: 'src/features/marketing/api/company-collect.ts',
    find: "if (Date.now() - startedAt > runDeadlineMs) { stoppedBy = 'deadline'; break }",
    replace: '',
    test: 'src/tests/unit/ads-lane-deadlines.test.ts',
    why:
      '예산(`budget.left`)은 **요청 수**만 세고 응답이 얼마나 걸리는지는 안 본다. 예산이 남아 있는 한 ' +
      '느린 카카오 조회가 계속 쌓여 부모 cron 의 CPU 를 태우고, 부모가 죽으면 매달린 자식이 전부 끌려간다.',
  },
  {
    name: 'MX 스윕이 블록 고정 순서라 두 번째 블록이 영구히 굶음',
    file: 'src/features/marketing/api/email-mx-sweep.ts',
    find: 'if (firstIsCompany) { await runCompany(); await runProspects() }',
    replace: 'await runCompany(); await runProspects()',
    test: 'src/tests/unit/ads-lane-deadlines.test.ts',
    why:
      '마감선은 일을 줄이는 게 아니라 **미루는** 것이다. 블록 ①→② 순서가 고정이면 ①에서 마감선에 ' +
      '걸릴 때 ②(매장 후보)는 **매 회차 한 번도 안 돌아** `cursorS` 가 영원히 멈춘다. ' +
      '마감선을 넣으면서 이 회전을 빼면 **없던 기아를 새로 만드는 것**이다.',  },
  {
    name: '공고 스캐너가 마감선 없이 회차를 늘려 부모 CPU 를 태움',
    file: 'src/features/marketing/api/notice-scan.ts',
    find: "if (Date.now() - startedAt > runDeadlineMs) { stoppedBy = 'deadline'; break }",
    replace: '',
    test: 'src/tests/unit/notice-scan-deadline.test.ts',
    why:
      '이 레인은 실측 31초(cpu_risk=danger)였는데 예산 20 에 실제 호출은 6번뿐이라 **예산이 한 번도 안 걸린다**. ' +
      '비용은 요청 수가 아니라 시간인데 시간을 재는 것이 없었다 — 공공 API 하나가 15초까지 버티니 최악 90초다. ' +
      '부모 cron 이 그걸 못 버텨 자식을 끌고 죽는다(`dispatch-budget.ts` 가 기록한 그 구조).',
  },
  {
    name: '마감선만 넣고 회전을 빼 뒤쪽 키워드가 영원히 굶음',
    file: 'src/features/marketing/api/notice-scan.ts',
    find: 'const kw = KEYWORDS[(kwFrom + i) % KEYWORDS.length]',
    replace: 'const kw = KEYWORDS[i]',
    test: 'src/tests/unit/notice-scan-deadline.test.ts',
    why:
      '마감선은 일을 줄이는 게 아니라 **미루는** 것이다. 시작점을 고정하면 매 회차 같은 앞쪽만 돌고 ' +
      '뒤쪽 키워드는 **한 번도** 조회되지 않는다 — 레인 단위에서 이미 겪은 구조적 기아를 키워드 단위에서 ' +
      '반복하는 셈이다. 마감선과 회전 커서는 반드시 같이 간다.',
  },
  {
    name: '주간 백업이 products·sellers 를 조용히 빼먹음(커서 한 칸이 컬럼 한도 초과)',
    file: 'src/worker/cron/d1-backup.ts',
    find: 'SELECT * FROM ${table} WHERE ${pk} > ?',
    replace: 'SELECT rowid, * FROM ${table} WHERE ${pk} > ?',
    test: 'src/tests/unit/d1-backup-wide-tables.test.ts',
    why:
      'D1 결과 컬럼 한도는 100 인데 `products`·`sellers` 는 **이미 정확히 100컬럼**이다. ' +
      '페이징용 `rowid` 한 칸을 더하면 101 이 되어 `too many columns in result set` 으로 ' +
      '**그 두 테이블만** dump 에서 통째로 빠진다. 2026-08-03 첫 회차가 그렇게 나갔다 — ' +
      '파일은 19MB 로 멀쩡해 보였고 알림도 "완료"였다. 그 백업으로 복구하면 상품도 셀러도 없다.',
  },
  {
    name: '백업 실패를 catch 가 삼켜 하트비트에 ok:true 로 남음',
    file: 'src/worker/cron/d1-backup.ts',
    find: 'throw err instanceof Error ? err : new Error(msg);',
    replace: 'return { success: false, error: msg };',
    test: 'src/tests/unit/d1-backup-wide-tables.test.ts',
    why:
      '`safeCron` 은 **예외가 나야** ok:false 를 남기고 cron_failures 에 기록한다. 그냥 반환하면 ' +
      '실패한 백업이 하트비트에서 성공처럼 보인다 — 재해복구에서 이건 가장 나쁜 거짓말이다. ' +
      '같은 파일의 `BACKUP_BUCKET` 미바인딩이 2026-06-12 에 throw 로 바뀐 것과 같은 이유.',
  },
  {
    name: '이용권 정산이 없는 컬럼(products.commission_rate)을 읽어 회차 전체가 죽음',
    file: 'src/worker/cron/auto-settlement.ts',
    find: 'COALESCE(s.commission_rate, ?)',
    replace: 'COALESCE(p.commission_rate, ?)',
    test: 'src/tests/unit/auto-settlement-rail-a.test.ts',
    why:
      '`products` 에 `commission_rate` 는 **존재한 적이 없다**(프로덕션 pragma 0 · baseline 97컬럼에도 없음). ' +
      '그래서 이 SELECT 는 매일 03:00 KST 에 `no such column` 으로 던지고 정산 회차가 통째로 죽었다. ' +
      '셀러별 수수료의 SSOT 는 `sellers.commission_rate` 다. SELECT 절은 `check-sql-column-exists` 의 ' +
      '**명시된 사각지대**(JOIN/alias 복잡도로 skip)라 정적 가드가 못 봤다 — 그래서 테스트로 박았다.',
  },
  {
    name: '정산 cron 이 Rail A 를 스스로 프로비저닝해 이중지급을 깨움',
    file: 'src/worker/cron/auto-settlement.ts',
    find: 'if (!(await railAProvisioned(DB))) {',
    replace: 'if (false) {',
    test: 'src/tests/unit/auto-settlement-rail-a.test.ts',
    why:
      'Rail A(`restaurant_settlements`)는 프로덕션에 **테이블조차 없다** — 한 행도 만든 적이 없다. ' +
      '실제 지급은 Rail B(원장→payouts)가 한다. 여기서 게이트를 없애면 과거 사용분 전체가 Rail A 에 ' +
      '한꺼번에 적재되고, 두 레일은 서로의 멱등 마커를 안 보므로 **같은 매출을 두 번 지급**한다. ' +
      '`settlement-reconciliation.md` §Severe 3 이 머니 경로로 파킹해 둔 자리다.',
  },
  {
    name: '컬럼 가드의 SELECT 패스가 보간 쿼리를 통째로 건너뛰어 헛돎',
    file: 'scripts/check-sql-column-exists.mjs',
    find: "      let prev\n      do { prev = stmt; stmt = stmt.replace(/\\$\\{[^{}]*\\}/g, ' ') } while (stmt !== prev)",
    replace: '      continue',
    test: 'src/tests/unit/auto-settlement-rail-a.test.ts',
    why:
      '첫 구현이 `${}` 보간을 보면 statement 를 건너뛰었는데, **이 사건의 원본 쿼리**' +
      '(`auto-settlement` 의 `${ledgerSkipClause}`)가 정확히 그 형태라 주입 검증에서 초록이 떴다. ' +
      '보간 조각만 지우고 나머지 리터럴은 검사해야 한다 — 안 그러면 SELECT 패스를 붙여 놓고도 ' +
      '정작 그것 때문에 만들어진 결함을 못 본다.',
  },
  {
    name: '일일 진단이 캐리어에 없는 Pages 전용 키로 매일 거짓 🔴 를 냄',
    file: 'src/worker/cron/daily-self-diagnostic.ts',
    find: 'const carrierKeys = [...new Set(',
    replace: "const carrierKeys = ['JWT_SECRET', ...new Set(",
    test: 'src/tests/unit/diagnostic-carrier-scope.test.ts',
    why:
      '`JWT_SECRET`·`REFRESH_TOKEN_SECRET`·`KAKAO_REST_API_KEY` 는 **Pages** 에 있고 cron 캐리어엔 ' +
      '없는 게 정상인데, 진단이 자기 env 에서 찾아 매일 🔴 3건을 냈다(라이브 `/api/version` 은 셋 다 present). ' +
      '거짓 경보 옆에 진짜가 섞이면 구분이 안 된다 — 늑대소년은 알림을 켜는 순간이 아니라 이미 시작돼 있었다.',
  },
  {
    name: '매장 보강이 크롤 불가 URL 에 슬롯을 낭비함',
    file: 'src/features/marketing/api/prospect-enrich.ts',
    find: '${COOL} AND ${platformNot}',
    replace: '${COOL}',
    test: 'src/tests/unit/prospect-enrich-platform-url.test.ts',
    why:
      '이 레인은 회차당 **8건**만 처리하는데(deadline) 실측상 그중 **4건이 차단 호스트**(인스타·블로그·카페)였다. ' +
      '소상공인의 홈페이지가 대부분 그것이라 이메일이 구조적으로 없는데 LIMIT 슬롯과 예산은 똑같이 먹는다 — ' +
      '진짜 사이트가 영영 안 뽑힌다. 파트너 레인이 07-28 에 같은 실측으로 이미 받은 처방이다.',
  },
  {
    name: '무수확 판정이 풀 포화를 고장으로 오인(오경보)',
    file: 'src/features/marketing/api/lane-yield-health.ts',
    find: 'if (totalSaved > 0 && found === 0 && err)',
    replace: 'if (totalSaved > 0 && err)',
    test: 'src/tests/unit/lane-yield-health.test.ts',
    why:
      '발굴은 되는데 저장이 0 인 것은 **정상**이다(풀 포화 = 전부 중복). `found` 조건을 빼면 그 회차가 ' +
      '매번 고장으로 신고돼 경보가 신뢰를 잃는다. ⚠️ 이 항목의 첫 픽스처엔 `diag.error` 가 없어 ' +
      '**주입해도 초록불이었다** — "가드가 막는다는 그 경우"가 픽스처에 실재해야 한다는 것을 직접 증명했다.',
  },
  {
    name: '후보 경로 프로브가 임의 호스트를 허용(SSRF)',
    file: 'src/features/marketing/api/public-data-probe.ts',
    // 2026-08-02: 호스트가 단수 상수 → **열거 목록**이 되어 지도를 갱신했다.
    // 2026-08-03: 표준데이터 게이트웨이(`api.data.go.kr`)를 넓히며 또 갱신 — 두 번 다
    //   ⚠️ **갱신을 알려 준 게 이 검사 자신이다**("낡은 지도" 모드가 실제로 일하고 있다는 증거).
    find: "export const PROBE_ALLOWED_HOSTS = ['apis.data.go.kr', 'www.localdata.go.kr', 'api.data.go.kr'] as const",
    replace: "export const PROBE_ALLOWED_HOSTS = ['apis.data.go.kr', 'www.localdata.go.kr', 'api.data.go.kr', 'evil.example.com'] as const",
    test: 'src/tests/unit/ads-public-data-probe.test.ts',
    why:
      '어드민 인증이 있어도 임의 URL 을 받으면 서버측 요청 위조다 — 내부 메타데이터 주소(169.254.169.254)까지 ' +
      '우리 워커 이름으로 찌를 수 있게 된다. 호스트는 **열거된 정부 도메인으로 고정**한다(리터럴 목록 + `.go.kr` 경계 이중).',
  },
  {
    name: '프로브 URL 이 레인 상수와 갈라짐(거짓말하는 프로브)',
    file: 'src/features/marketing/api/public-data-probe.ts',
    find: 'B551182/hospInfoServicev2/getHospBasisList',
    replace: 'B551182/hospInfoServiceXX/getHospBasisList',
    test: 'src/tests/unit/ads-public-data-probe.test.ts',
    why:
      '프로브가 레인과 **다른 주소**를 찌르면 "프로브는 초록인데 레인은 죽는다"가 되어 진단이 오히려 오도한다. ' +
      '진단 도구의 유일한 가치는 레인과 같은 것을 본다는 것이다.',
  },
  {
    name: '프로브가 레인과 **다른 오퍼레이션**을 찌름(서비스명만 같음)',
    file: 'src/features/marketing/api/public-data-probe.ts',
    find: 'FftcBrandRlsInfo2_Service/getBrandList',
    replace: 'FftcBrandRlsInfo2_Service/getBrandReleaseInfo',
    test: 'src/tests/unit/ads-public-data-probe.test.ts',
    why:
      '2026-08-02 라이브에서 실제로 일어난 일이다. 기존 대조는 **서비스명**(FftcBrandRlsInfo2_Service)만 봐서 ' +
      '오퍼레이션이 다른 것을 통과시켰고, 레인은 HTTP 404 · 프로브는 400 NO_OPENAPI_SERVICE_ERROR 로 **다른 답**을 ' +
      '받았다. 그 400 을 근거로 "서비스가 폐기됐다"고 결론 낼 뻔했다 — 진단 도구가 오진의 재료가 되는 최악의 모양이다.',
  },
  {
    name: '전진 0 가드가 헛돎(신규를 통과시킴)',
    file: 'scripts/check-cursor-after-loop.mjs',
    find: 'if (TIME_BOUND.test(body)) continue               // 시간 상한이 있다 — 통과',
    replace: 'if (true) continue',
    test: 'src/tests/unit/ads-cursor-after-loop-guard.test.ts',
    why:
      '이 가드가 막는 실패는 **에러가 안 보인다** — 하트비트는 "느린가 보다"로 읽히고 저장 0 의 이유가 ' +
      '커서 미전진이라는 건 코드를 열어야 안다. 판정을 무력화하면 신규 레인이 그대로 통과해 ' +
      '**세 번째 전진 0** 이 조용히 생긴다(이미 commerce·quality 두 번 났다).',
  },
  {
    name: '전화 매칭이 대표번호를 통과시킴(남의 매장에 본사 이메일)',
    file: 'src/features/marketing/api/registry-phone-match.ts',
    find: '  if (!d || isSharedLine(d)) return null',
    replace: '  if (!d) return null',
    test: 'src/tests/unit/registry-phone-match.test.ts',
    why:
      '1588·1544·080 같은 대표번호는 **한 번호에 매장이 수백 개**다. 그대로 이으면 전혀 다른 매장에 ' +
      '본사 이메일이 붙고, 잘못 붙은 주소로 보낸 메일은 **반송·스팸신고**가 되어 도메인 평판을 깎는다 — ' +
      '그건 되돌리기 어렵다. 이 필터가 이 기능의 안전장치 절반이다.',
  },
  {
    name: '전화 매칭이 모호한 다중 매칭을 통과시킴',
    file: 'src/features/marketing/api/registry-phone-match.ts',
    find: "  if (emails.length > 1) return { skip: 'ambiguous_phone' }",
    replace: '  // (removed)',
    test: 'src/tests/unit/registry-phone-match.test.ts',
    why:
      '같은 번호에 서로 다른 이메일이 둘 이상이면 **어느 쪽인지 모른다**. 아무거나 고르면 절반은 틀린다 — ' +
      '연락처 품질은 양보다 정확도가 먼저다(틀린 주소 하나가 도메인 전체를 깎는다).',
  },
  {
    name: '두 사업 명단이 보류(연락처 없음)까지 셈',
    file: 'src/features/marketing/api/company-breakdown.ts',
    find: 'WHERE merged_into IS NULL AND active = 1',
    replace: 'WHERE merged_into IS NULL',
    test: 'src/tests/unit/ads-export-filter-parity.test.ts',
    why:
      '화면 맨 위의 두 숫자는 **"지금 제안을 보낼 수 있는 수"** 다. 보류(active=0 = 연락처 없어 제외된 행)를 ' +
      '섞으면 17만 총계와 다를 바 없어지고, 대표가 그 숫자를 믿고 명단을 뽑으면 **보낼 수 없는 행이 섞여 나온다.**',
  },
  {
    name: '페이백 명단을 전화로도 셈(이메일 발송인데)',
    file: 'src/features/marketing/api/company-breakdown.ts',
    find: "SUM(CASE WHEN category = '온라인판매' AND email IS NOT NULL AND email != '' THEN 1 ELSE 0 END) AS payback_ready",
    replace: "SUM(CASE WHEN category = '온라인판매' AND phone IS NOT NULL THEN 1 ELSE 0 END) AS payback_ready",
    test: 'src/tests/unit/ads-export-filter-parity.test.ts',
    why:
      '두 사업은 **도달 채널이 다르다** — 페이백은 이메일 발송이라 전화만 있는 행은 명단이 아니고, ' +
      '대행사는 전화도 채널이다. 이 구분이 무너지면 숫자는 커지는데 실제로 보낼 수 있는 건 줄어든다.',
  },
  {
    name: '루트별 수율이 총계로 뭉개짐(어디에 예산 쓸지 못 봄)',
    file: 'src/features/marketing/api/store-prospects.ts',
    find: "SUM(CASE WHEN (phone IS NOT NULL AND phone != '') OR (email IS NOT NULL AND email != '') THEN 1 ELSE 0 END) AS with_any",
    replace: 'COUNT(*) AS with_any',
    test: 'src/tests/unit/ads-export-filter-parity.test.ts',
    why:
      '총계만 보면 "5만 건 모았다"로 읽힌다. 실측은 `neis_academy` 49,315건에 **이메일 7건**이고 ' +
      '대표 우선업종은 **0건**이라는 전혀 다른 이야기를 한다 — 둘 다 총계로는 안 보인다. ' +
      '⚠️ 이 항목의 첫 시험은 파일 전체에서 컬럼명을 찾아 **주입해도 초록불이었다**(같은 이름이 다른 쿼리에도 있다). ' +
      '"가드가 막는다는 그 자리"로 범위를 좁혀야 실제로 깨진다.',
  },
  {
    name: '내보내기가 화면 필터를 무시(손에 안 잡히는 지표)',
    file: 'src/features/marketing/api/partner-pool.routes.ts',
    find: 'listCompanyLeads(c.env.DB, { ...filter, limit: EXPORT_MAX })',
    replace: 'listCompanyLeads(c.env.DB, { limit: EXPORT_MAX })',
    // 2026-08-03: 파싱이 `pool-export.ts` 로 이동했지만 **넘기는 지점**은 여전히 여기다(지도 유효).
    test: 'src/tests/unit/ads-export-filter-parity.test.ts',
    why:
      '이 DB 의 성공 지표는 총 인원이 아니라 **"제안 보낼 수 있는 리드 수"** 다. 화면은 그 정의로 세는데 ' +
      '내보내기가 안 따르면 지표가 **화면에만 있고 손에는 안 잡힌다** — 실측상 파트너 풀은 이메일 보유가 12%뿐이라 ' +
      '무필터 5,000행에 실제 발송 가능분은 ~600건이고 보류(active=0)까지 섞인다.',
  },
  {
    name: '내보내기 조립이 목록과 두 벌로 갈라짐',
    file: 'src/pages/admin/AdminStoreProspectsPage.tsx',
    find: 'store-prospects/export?${buildQuery().toString()}',
    replace: 'store-prospects/export',
    test: 'src/tests/unit/ads-export-filter-parity.test.ts',
    why:
      '매장 풀은 **95%가 학원**이다(인허가 레인 사망으로 음식점·카페·미용·숙박 0). 화면 필터가 파일까지 ' +
      '안 이어지면 대표 우선업종은 **내보내기로 도달 자체가 불가능**하다 — 서버만 고치고 화면을 안 고치면 ' +
      '정확히 그 상태로 되돌아간다.',
  },
  {
    name: '품질 패스가 시간 상한을 잃음(전진 0 복귀)',
    file: 'src/features/marketing/api/influencer-quality.ts',
    find: "    if (Date.now() - t0 >= deadlineMs) { stoppedBy = 'deadline'; break }",
    replace: '',
    test: 'src/tests/unit/ads-quality-deadline.test.ts',
    why:
      '상한이 **행 수(8,000)뿐**이라 한 인보케이션이 16페이지를 통째로 채점하다 CPU 한도로 죽었다(`ms=3649`). ' +
      '🩸 재분류보다 나쁘다 — **커서 저장이 루프 뒤**라 죽으면 그 줄에 도달하지 못하고 다음 회차가 같은 지점을 ' +
      '또 훑고 또 죽는다 ⇒ **영원히 전진 0**(통신판매에서 확정된 그 실패 모양).',
  },
  {
    name: '품질 패스 마감선 중단이 done=true 로 커서를 리셋',
    file: 'src/features/marketing/api/influencer-quality.ts',
    find: "if (Date.now() - t0 >= deadlineMs) { stoppedBy = 'deadline'; break }",
    replace: 'if (Date.now() - t0 >= deadlineMs) { done = true; break }',
    test: 'src/tests/unit/ads-quality-deadline.test.ts',
    why:
      '`done` 은 "한 바퀴 다 돌았다" 는 뜻이고 커서를 **0 으로 리셋**한다. 시간 때문에 멈춘 것을 완주로 표시하면 ' +
      '매 회차가 처음부터 다시 돌아 **풀 뒷부분은 영영 채점되지 않는다** — 조용히, 에러 없이.',
  },
  {
    name: '재분류 패스 루프가 마감선을 잃음(매시간 CPU 사망 복귀)',
    file: 'src/worker-ads/index.ts',
    find: 'passes < 5 && !last.done && Date.now() - t0 < deadlineMs',
    replace: 'passes < 5 && !last.done',
    test: 'src/tests/unit/ads-reclassify-deadline.test.ts',
    why:
      '이 레인은 **매시간 CPU 한도로 죽고 있었다**(`ok=false ms=3880`). 5패스 × 1,000행 × 행당 정규식 ~20개 = ' +
      '10만 회를 한 인보케이션에서 돈다 — `ads-cpu-work-cap` 이 세운 교리(*"페이지가 아니라 인보케이션당 총량"*)를 ' +
      '**호출부**가 어긴 것이다. 커서가 이어받으므로 일찍 멈춰도 커버리지 손실은 0 이다.',
  },
  {
    name: '미사용 env 신고가 평상시에도 울림(경보 신뢰 상실)',
    file: 'src/worker-ads/env-drift.ts',
    find: "return u.length ? { env_unused: u.join(',') } : {}",
    replace: "return { env_unused: u.join(',') }",
    test: 'src/tests/unit/ads-env-drift.test.ts',
    why:
      '이상 없을 때도 키가 붙으면 하트비트 사유줄이 매 회차 오염되고, 진짜 신호가 그 안에 묻힌다. ' +
      '이 레포가 무수확 레인 판정에서 배운 것과 같다 — **평상시 조용하지 않은 경보는 아무도 안 본다.**',
  },
  {
    name: '미사용 env 목록이 낡음(새 노브를 오신고)',
    file: 'src/worker-ads/env-drift.ts',
    find: "'ADS_HIRA_ROWS',",
    replace: '',
    test: 'src/tests/unit/ads-env-drift.test.ts',
    why:
      '목록은 **코드가 읽는 키의 SSOT** 다. 새 노브를 코드에 넣고 목록에 안 넣으면 런타임이 그 키를 ' +
      '"설정했는데 안 쓰임"으로 **오신고**한다 — 정상 설정을 결함으로 부르는 순간 이 신호는 죽는다. ' +
      '(첫 작성에서 내가 손으로 적다가 실제로 64개를 빠뜨렸고, 이 시험이 즉시 잡았다.)',
  },
  {
    name: '표준데이터 호스트가 키를 못 받음(SERVICE_KEY_IS_NULL)',
    file: 'src/features/marketing/api/public-data-probe.ts',
    find: "export const PORTAL_KEY_HOSTS = ['apis.data.go.kr', 'api.data.go.kr'] as const",
    replace: "export const PORTAL_KEY_HOSTS = ['apis.data.go.kr'] as const",
    test: 'src/tests/unit/ads-public-data-probe.test.ts',
    why:
      '판정이 단일 호스트 비교였을 때 같은 포털의 표준데이터 게이트웨이(`api.data.go.kr`, ‘s’ 없음)가 조건에서 ' +
      '빠져 **키 없이 나갔고** 라이브가 `SERVICE_KEY_IS_NULL`(code 20)로 답했다. 그러면 *"우리 키가 이 데이터셋에 ' +
      '열려 있는가"* 를 영영 판정 못 한다 — **이 프로브의 존재 이유가 바로 그 판정인데 스스로 막고 있었다.** ' +
      '상권/상인회 축의 유일한 연락처 소스가 이 호스트에만 있다.',
  },
  {
    name: '전통시장 레인이 금지 파라미터를 실어 보냄',
    file: 'src/features/marketing/api/market-collect.ts',
    find: '&numOfRows=${rows}&type=json`',
    replace: '&numOfRows=${rows}&pageIndex=${page}&type=json`',
    test: 'src/tests/unit/market-collect.test.ts',
    why:
      '표준데이터 게이트웨이는 모르는 파라미터를 **거부**한다(`INVALID_REQUEST_PARAMETER_ERROR (pageIndex)`). ' +
      '다른 레인을 베끼다 "혹시 몰라" 한 줄 얹으면 **인증까지 통과한 요청이 죽는다** — 그리고 그 실패는 ' +
      '`found:0` 으로만 보여서 주소 문제로 오진하게 된다.',
  },
  {
    name: '전통시장 전화 필드 매핑이 끊김(연락 불가 명단이 된다)',
    file: 'src/features/marketing/api/market-collect.ts',
    find: "g(it, 'phoneNumber') || null",
    replace: "null",
    test: 'src/tests/unit/market-collect.test.ts',
    why:
      '상권 축에서 **전화가 이 소스의 존재 이유**다(나머지 세 소스는 연락처가 아예 없다). 필드명이 어긋나면 ' +
      'HTTP 200 에 행까지 오는데 **연락 불가 명단**만 쌓인다 — 인허가에서 실제로 당한 클래스(200 은 성공이 아니다).',
  },
  {
    name: '표준데이터에 모르는 파라미터를 실어 보냄(INVALID_REQUEST_PARAMETER)',
    file: 'src/features/marketing/api/public-data-probe.ts',
    find: "  return host === 'api.data.go.kr' ? 'std' : 'both'",
    replace: "  return 'both'",
    test: 'src/tests/unit/ads-public-data-probe.test.ts',
    why:
      '게이트웨이마다 **모르는 파라미터를 대하는 태도가 다르다.** 기관별 서비스는 조용히 무시하지만 ' +
      '표준데이터는 거부한다 — 라이브가 `INVALID_REQUEST_PARAMETER_ERROR (pageIndex)` 로 말해 줬다. ' +
      '즉 인증·주소가 다 맞은 요청을 **우리 편의 문법이 죽인다**(진단 도구가 스스로 만든 실패). ' +
      '상권 축의 유일한 연락처 소스가 이 게이트웨이에 있다.',
  },
  {
    name: '인허가 경로에서 오퍼레이션(/info)이 사라짐',
    file: 'src/features/marketing/api/license-url.ts',
    find: "export const LICENSE_OPERATION = 'info'",
    replace: "export const LICENSE_OPERATION = ''",
    test: 'src/tests/unit/license-url-variant.test.ts',
    why:
      '이 한 칸이 없어서 인허가 레인 전체가 며칠간 0건이었다. 게이트웨이는 `NO_OPENAPI_SERVICE_ERROR`(code 12)로 ' +
      '답하는데 그 코드는 **폐기와 경로 오타를 구분하지 못한다** — 실제로 이전 세션이 "서비스 폐기 확정"이라고 ' +
      '오판했다. 대표 우선업종(음식점·카페·미용·숙박)이 통째로 이 경로에 달려 있다.',
  },
  {
    name: '낡은 변종 판정을 그대로 믿음(옛 형태에 영구히 갇힘)',
    file: 'src/features/marketing/api/license-url.ts',
    find: 'return Number(state.v || 0) === LICENSE_STATE_VERSION ? state : null',
    replace: 'return state',
    test: 'src/tests/unit/license-url-variant.test.ts',
    why:
      '라이브 DB 에 **주소가 틀렸던 시절의 판정**(`{"id":"v1"}` + code 12 실패 이력)이 남아 있었다. 저장된 값이 ' +
      '항상 이기므로 기본값을 고쳐도 안 지워지고, 프로브는 *실패했을 때만* 도는데 경로가 고쳐진 뒤로는 v1 도 ' +
      '200 을 받는다(페이징 키가 조용히 무시될 뿐) → 실패가 없다 → 프로브가 안 돈다 → **영원히 v1**. ' +
      '에러 없이 같은 페이지만 긁는 "조용한 전진 0" 이다.',
  },
  {
    name: '인허가 기본 후보가 무시되는 페이징 키로 되돌아감',
    file: 'src/features/marketing/api/license-url.ts',
    find: "{ id: 'v4', pageParam: 'pageNo', sizeParam: 'numOfRows'",
    replace: "{ id: 'v4', pageParam: 'pageIndex', sizeParam: 'pageSize'",
    test: 'src/tests/unit/license-url-variant.test.ts',
    why:
      '라이브 응답 봉투가 `{"numOfRows":…,"pageNo":…}` 를 echo 한다 = 이 둘이 실제로 읽히는 키다. ' +
      '`pageIndex`/`pageSize` 는 같이 보내도 **조용히 무시**되므로 그쪽으로 되돌리면 **200 을 받으면서 ' +
      '영원히 1페이지만** 긁는다 — 에러가 없어 안 보이는 실패(이 레포가 "조용한 전진 0"이라 부르는 것).',
  },
  {
    name: '인허가 대문자 필드 별칭이 사라짐(200 인데 저장 0)',
    file: 'src/features/marketing/api/localdata-collect.ts',
    find: "g(it, 'mgtno', 'mgtNo', 'MNG_NO')",
    replace: "g(it, 'mgtno', 'mgtNo')",
    test: 'src/tests/unit/license-field-aliases.test.ts',
    why:
      '이관된 포털은 대문자 스네이크(`MNG_NO`/`BPLC_NM`/`TELNO`)를 쓴다. 옛 소문자 이름만 읽으면 ' +
      '**HTTP 200 에 실제 행이 와도** 전부 빈 문자열로 파싱돼 복합키가 성립하지 않고 행이 통째로 버려진다. ' +
      '경로만 고치고 이걸 빠뜨리면 증상(0건)이 그대로라 "아직도 안 된다"로 오진하게 된다.',
  },
  {
    name: '사망 지점 흔적이 이전 누적본을 오염시킴(제자리 push)',
    file: 'src/features/marketing/api/enrich-telemetry.ts',
    find: 'r.deaths = [...(r.deaths || []), at].slice(-DEATH_TRAIL_MAX)',
    replace: '{ (r.deaths ||= []).push(at); r.deaths = r.deaths.slice(-DEATH_TRAIL_MAX) }',
    test: 'src/tests/unit/enrich-rollup.test.ts',
    why:
      '`foldRound` 는 이전 누적본을 **얕은 복사**해 배열을 참조로 물고 온다. 제자리 push 면 아직 저장되지 ' +
      '않은 원본까지 함께 늘어나 **멱등 검사가 거짓말을 한다**(같은 라운드를 두 번 센 것처럼 보인다). ' +
      '계측이 틀리면 그 위에 세운 처방이 전부 틀린다 — 이 레코드의 존재 이유가 무너진다.',
  },
  {
    name: '심평원 재시도가 실험이 아니게 됨(같은 크기로 재시도)',
    file: 'src/features/marketing/api/hira-hospital-collect.ts',
    find: 'Math.max(20, Math.floor(numRows / 5))',
    replace: 'numRows',
    test: 'src/tests/unit/hira-retry-experiment.test.ts',
    why:
      '이 재시도의 목적은 회복이 아니라 **원인 판별**이다 — 작은 페이지로 성공하면 "페이지 크기 문제"(무배포 노브로 해결), ' +
      '작은 페이지도 실패하면 "크기 무관"(동시성·외부)이다. 같은 크기로 다시 쏘면 두 경우가 구분되지 않아 ' +
      '60회 무수확의 원인을 **또 모르는 채로** 남는다.',
  },
  {
    name: '심평원 재시도 상한이 사라짐(페이지마다 재시도)',
    file: 'src/features/marketing/api/hira-hospital-collect.ts',
    find: '      retried = true',
    replace: '      retried = false',
    test: 'src/tests/unit/hira-retry-experiment.test.ts',
    why:
      '무료 요금제의 서브리퀘스트 천장은 인보케이션당 ~50 이다. 회차당 1회 상한이 없으면 페이지마다 재시도가 붙어 ' +
      '**같은 회차의 다른 레인 예산까지 잡아먹는다** — 이 레포가 이미 여러 번 당한 자리다.',
  },
  {
    name: 'code 12 힌트가 "폐기 확정"으로 읽히게 약해짐',
    file: 'src/features/marketing/api/public-data-diag.ts',
    // 2026-08-03: 대조군을 하나 더 얻어(미신청=code 30) 문구가 정밀해졌다 — 지도를 갱신했다.
    //   ⚠️ 알려 준 게 이 검사 자신이다("낡은 지도" 모드).
    find: '🔑 단, **활용신청 문제는 아니다** — 미신청은 code 30(403)으로 따로 온다',
    replace: '',
    test: 'src/tests/unit/public-data-diag.test.ts',
    why:
      '2026-08-03 에 **내가 직접 이 오추론을 했다** — code 12 를 보고 "공정위 서비스 폐기 확정"이라고 인계에 적었다. ' +
      '대조군을 찔러 보니 살아있는 `MllBs_2Service`(같은 키로 200·264만건)도 오퍼레이션을 틀리면 **같은 code 12** 였다. ' +
      '두 가능성을 나열만 하는 문구는 읽는 사람이 자기 가설에 맞는 쪽을 고르게 둔다 — 오추론을 **명시적으로 막아야** 한다.',
  },
  {
    name: '레인 일감이 요금제를 모름(예산만 커지고 일은 그대로)',
    file: 'src/features/marketing/api/nps-workplace-enrich.ts',
    find: 'const maxLeads = maxLeadsArg ?? envPlanValue(undefined, 40, 120, env)',
    replace: 'const maxLeads = maxLeadsArg ?? 40',
    test: 'src/tests/unit/ads-cpu-deadline.test.ts',
    why:
      '축이 둘이다 — 예산만 키우고 회차당 처리 건수가 고정이면 **늘어난 예산이 그냥 남는다**. ' +
      '⚠️ 이 축은 예산과 달리 **비율로 유도하면 안 된다**(40×15=600 · NEIS 3×15=45 는 죽는 값이다) — ' +
      '그래서 `envLaneBudget` 이 아니라 명시값 `envPlanValue` 를 쓴다.',
  },
  {
    name: '유료 마감선을 만들어 놓고 분기가 안 씀',
    file: 'src/features/marketing/api/store-kakao-collect.ts',
    find: 'if (Date.now() - startedAt > runDeadlineMs)',
    replace: 'if (Date.now() - startedAt > RUN_DEADLINE_MS)',
    test: 'src/tests/unit/store-kakao-voucher-grid.test.ts',
    why:
      '상수를 추가해도 **분기가 안 보면** 아무 일도 안 일어난다 — 유료 CPU 한도가 커져도 회차는 12초에 끊긴다.',
  },
  {
    name: '노브 등기부 강제 무력화',
    file: 'scripts/check-plan-knob-coverage.mjs',
    find: 'if (bad) process.exit(STRICT ? 1 : 0)',
    replace: 'if (false) process.exit(1)',
    test: 'src/tests/unit/ads-plan-knobs.test.ts',
    why: '등기부 누락·배선 누락을 통과시키면 다음 노브도 조용히 요금제를 못 받는다(하루에 세 번 만난 결함).',
  },
  {
    name: 'DO 알람이 요금제를 다시 모름',
    file: 'src/worker-ads/lane-alarm-policy.ts',
    find: "  if (!Number.isFinite(n) || n <= 0) return paidPlan(env) ? ALARM_INTERVAL_MS_PAID : ALARM_INTERVAL_MS_DEFAULT",
    replace: '  if (!Number.isFinite(n) || n <= 0) return ALARM_INTERVAL_MS_DEFAULT',
    test: 'src/tests/unit/ads-plan-scaling.test.ts',
    why: '지금 실제로 보강을 돌리는 레인이다 — 요금제가 못 닿으면 유료로 바꿔도 처리량이 한 톨도 안 는다.',
  },
  {
    name: '레인 예산이 요금제를 다시 모름',
    file: 'src/features/marketing/api/collect-budget.ts',
    find: '  if (resolvePlan(env) !== \'paid\') return freeDefault',
    replace: '  return freeDefault; if (false)',
    test: 'src/tests/unit/ads-plan-scaling.test.ts',
    why: '실제 예산은 min(envBudget, learnedCap, platformCap) — env 가 80 이면 천장을 900 으로 올려도 80 에서 멈춘다.',
  },
  {
    name: '레인이 raw parseInt 로 예산 기본값 회귀',
    file: 'src/features/marketing/api/enrich-lane.ts',
    find: "envLaneBudget(env.ADS_ENRICH_BUDGET || env.ADS_COMPANY_SUBREQUEST_BUDGET, 300, env)",
    replace: "(parseInt(env.ADS_ENRICH_BUDGET || env.ADS_COMPANY_SUBREQUEST_BUDGET || '', 10) || 300)",
    test: 'src/tests/unit/ads-plan-scaling.test.ts',
    why: '함수가 옳아도 레인이 안 쓰면 요금제가 닿을 길이 없다 — 오늘 같은 자리에서 이미 당했다.',
  },
  {
    name: 'miss 를 이름 대신 뺄셈으로 계산(음수 재발)',
    file: 'src/worker-ads/tick-history.ts',
    find: '    miss: [...ran].filter(nm => !beatNames.has(nm)).length,',
    replace: '    miss: ran.size - lanes.length,',
    test: 'src/tests/unit/ads-tick-history.test.ts',
    why: '예산 밖 레인이 자기 하트비트를 남기면 음수가 된다 — 08-02 19:00 회차에서 실제로 나온 값.',
  },
  {
    name: '회차 요약이 flush 로 비워짐(붕괴 과소보고)',
    file: 'src/worker-ads/beat-batch.ts',
    find: '      seen.push({ name: beat.name, ok: beat.ok, ms: beat.ms })',
    replace: '      if (!pending.length) seen.length = 0; seen.push({ name: beat.name, ok: beat.ok, ms: beat.ms })',
    test: 'src/tests/unit/ads-tick-history.test.ts',
    why: 'seen 이 pending 처럼 비워지면 마지막 flush 시점에 앞쪽 묶음이 사라져 요약이 실제보다 작아진다.',
  },
  {
    name: '회차 이력이 이름 대신 개수를 씀(miss 음수)',
    // 📍 2026-08-03: 꼬리가 `index.ts` 인라인 → `tail-bound.ts` `closeTick` 으로 이사해 앵커를 옮겼다.
    //   (이 이사를 낡은 지도 검사가 그 자리에서 잡았다 — 안 잡혔으면 이 불변식이 조용히 사라졌을 것이다.)
    file: 'src/worker-ads/tail-bound.ts',
    find: 'judgedLaneNames(o.ranNames, r.settled), o.beats.seenBeats',
    replace: 'o.beats.seenBeats.map(b => b.name.slice(4)), o.beats.seenBeats',
    test: 'src/tests/unit/ads-tick-history.test.ts',
    why: '이름 대조를 버리면 miss 가 0 이 되거나(개수 뺄셈이면) 음수가 된다 — 라이브 실측 "띄운7 기록9".',
  },
  {
    name: '같은 회차가 두 줄로 갈림',
    file: 'src/worker-ads/tick-history.ts',
    find: 'const list = readTickHistory(prev).filter(t => t.at !== entry.at)',
    replace: 'const list = readTickHistory(prev)',
    test: 'src/tests/unit/ads-tick-history.test.ts',
    why: 'flush 가 두 번이면 한 회차가 두 줄이 되어 회차 수가 부풀고 "얼마나 자주 도는가"를 오판한다.',
  },
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
    find: 'const cap = budget <= 0 ? 0 : Math.max(1, budget - always.length)',
    replace: 'const cap = budget <= 0 ? 0 : budget',
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why: '미룰 수 없는 레인이 예산 위에 얹히던 08-02 결함. 예산 8 에 12개가 떠 꼬리 3개가 CPU 한도로 잘렸다.',
  },
  {
    name: 'cap 하한 1 제거',
    file: 'src/worker-ads/dispatch-budget.ts',
    find: 'const cap = budget <= 0 ? 0 : Math.max(1, budget - always.length)',
    replace: 'const cap = budget <= 0 ? 0 : Math.max(0, budget - always.length)',
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
    name: '마감 창 가드 제거(확정 실패 + 가짜 도장)',
    file: 'src/features/marketing/api/collect-budget.ts',
    find: 'return deadline - now >= FETCH_TIMEOUT_FLOOR_MS',
    replace: 'return true',
    test: 'src/tests/unit/ads-invocation-lifetime.test.ts',
    why:
      '바닥값(1.5s)을 줄 수 없는데도 항목을 집으면 **확정적으로 마감을 넘겨 실패**하고, 그 리드는 ' +
      '데이터 없이 perf_checked_at 도장을 받아 22,000 깊이 큐 뒤로 밀린다(nb_unmeasured 에서도 빠진다). ' +
      '08-02 실측: tried 9 / failed 3 — 실패 3 = 동시성 3(워커마다 마지막 1건). 전수 시뮬레이션상 ' +
      '가드를 지우면 잔여 1~1,499ms 구간 1,499건이 전부 마감 초과가 된다.',
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
    name: '파트너 커서가 계획한 창 크기로 전진(영구 사각지대)',
    file: 'src/features/marketing/api/company-collect.ts',
    find: 'const nextCursor = total > 0 ? (cursor + consumed) % total : 0',
    replace: 'const nextCursor = total > 0 ? (cursor + batch) % total : 0',
    test: 'src/tests/unit/company-keyword-grid.test.ts',
    why:
      '이 레인은 거의 매 회차 예산이 먼저 마른다(실측 `keywords 11 · limit_hit true`). ' +
      '계획한 12칸을 전진하면 못 돈 1개가 **건너뛰어지고**, 전진폭이 창 크기와 같아 창 경계가 ' +
      '영원히 고정되므로 **매 회전 같은 자리**가 빠진다 — 지연이 아니라 영구 사각지대다. 오류도 안 난다.',
  },
  {
    name: '카카오 매장 회차가 다시 완주를 전제함(중간 정산 제거)',
    file: 'src/features/marketing/api/store-kakao-collect.ts',
    find: 'if (cursorKey && rows.length >= FLUSH_ROWS) await flushAt(cursorKey,',
    replace: 'if (false) await flushAt(cursorKey,',
    test: 'src/tests/unit/store-kakao-voucher-grid.test.ts',
    why:
      '맨 끝에서 한 번만 저장·전진하면 회차가 중간에 죽을 때 **캔 것도 전진도 통째로** 사라지고, ' +
      '다음 회차가 같은 키워드를 또 훑는다 — 또 죽으면 영원히 0 이다(#927 이 그 구조로 며칠 멈췄다). ' +
      '08-02 실측: 부모가 ms≈3.6초에 CPU 한도로 죽는데 이 레인의 완주 시간은 8,097ms 다. 완주가 예외다.',
  },
  {
    name: '수동 트리거가 ur-ads 에 없는 경로를 부름',
    file: 'src/features/marketing/api/store-prospects.routes.ts',
    find: "['/collect-store-kakao', 'collect-store-kakao'],",
    replace: "['/collect-store-kakao', 'collect-store-kakao-x'],",
    test: 'src/tests/unit/store-collect-config.test.ts',
    why:
      '위임 `kick()` 이 fail-soft 라 대상이 틀려도 `{success:true, started:true}` 가 돌아간다 — ' +
      '화면엔 "수집 시작" 토스트가 뜨고 **아무 일도 안 일어난다**. 404 보다 나쁜 건 404 가 성공처럼 보이는 것이고, ' +
      '이 레인은 5회차에 한 번 도는 터라 "곧 되겠지"와 구분조차 안 된다.',
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
    // 2026-08-02: 마감선이 요금제 인지 지역변수(`runDeadlineMs`)로 바뀌어 이 지도를 갱신했다.
    //   ⚠️ 갱신을 알려 준 게 이 검사 자신이다("낡은 지도" 모드) — 그게 이 파일의 존재 이유다.
    find: "if (Date.now() - startedAt > runDeadlineMs) { stoppedBy = 'deadline'; break outer }",
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

  // ── 🎚️ 회차당 레인 수 학습기 (2026-08-02) — 손으로 잰 상수를 대체한 제어 루프
  {
    name: '학습기가 예산 밖 기록(off)을 해로 셈',
    file: 'src/worker-ads/lane-aimd.ts',
    find: '  Math.max(0, t.fail || 0) + Math.max(0, t.miss || 0) >= HARM_MIN_LANES',
    replace: '  Math.max(0, t.fail || 0) + Math.max(0, t.miss || 0) + Math.max(0, t.off || 0) >= HARM_MIN_LANES',
    test: 'src/tests/unit/ads-lane-aimd.test.ts',
    why:
      '`off` 는 DO 알람·우회 레인이 자기 하트비트를 남긴 정상 동작이다(라이브 "띄운7 기록9"). ' +
      '이걸 해로 세면 학습기가 매 회차 물러나 **영원히 바닥에 눌린다** — 처리량을 스스로 반으로 깎고 아무도 모른다.',
  },
  {
    name: '자기신고 1건에도 함대를 깎음',
    file: 'src/worker-ads/lane-aimd.ts',
    find: 'export const HARM_MIN_LANES = 2',
    replace: 'export const HARM_MIN_LANES = 1',
    test: 'src/tests/unit/ads-lane-aimd.test.ts',
    why:
      '`enrich-influencer-fanout` 은 CPU 와 무관하게 스스로 ok=false 를 남긴다(라이브 실재). ' +
      '문턱이 1 이면 그 자기신고 하나가 매 회차 레인 수를 깎는다 — CPU 고갈은 떼로 죽인다(실측 5·2·4).',
  },
  {
    name: '물러남이 반올림으로 제자리가 됨',
    file: 'src/worker-ads/lane-aimd.ts',
    find: 'const backed = Math.min(base - 1, Math.floor(base * BACKOFF_FACTOR))',
    replace: 'const backed = Math.ceil(base * BACKOFF_FACTOR)',
    test: 'src/tests/unit/ads-lane-aimd.test.ts',
    why: '"최소 1 은 반드시 줄인다"가 없으면 작은 값에서 물러남이 사라져 학습이 멈춘다(계속 죽으면서 그 자리를 지킨다).',
  },
  {
    name: '유료 전환이 배운 자리를 버리고 천장에서 시작',
    file: 'src/worker-ads/lane-aimd.ts',
    find: '  const base = clampCap(prev?.cap ?? start, top)',
    replace: '  const base = clampCap(start, top)',
    test: 'src/tests/unit/ads-lane-aimd.test.ts',
    why:
      '이 축의 한도는 요금제가 아니라 인보케이션당 CPU 다(유료 기본값도 30초). 배운 자리를 버리고 ' +
      '`PAID_LANES_PER_TICK`(64)에서 시작하면 **유료로 바꾼 첫 정각에 무너진다** — 대표 요구사항의 정반대.',
  },
  {
    name: '학습값이 디스패처에 안 닿음',
    file: 'src/worker-ads/dispatch-budget.ts',
    find: '  if (Number.isFinite(learned as number) && (learned as number) >= 1) return Math.floor(learned as number)',
    replace: '  if (false) return 0',
    test: 'src/tests/unit/ads-lane-aimd.test.ts',
    why:
      '배우기만 하고 안 쓰면 오늘 세 번 겪은 그 상태(닿지 않는 노브)가 그대로다 — 에러가 없어서 ' +
      '학습이 도는 것처럼 보이는데 회차 수는 상수 그대로다.',
  },
  {
    name: '바닥 고착 탈출이 사라짐',
    file: 'src/worker-ads/lane-aimd.ts',
    find: '  if (pinned >= PROBE_AFTER_PINNED) return { cap: Math.min(top, MIN_LANES_PER_TICK + 1), clean: 0, pinned: 0 }',
    replace: '  if (pinned >= 999999) return { cap: Math.min(top, MIN_LANES_PER_TICK + 1), clean: 0, pinned: 0 }',
    test: 'src/tests/unit/ads-lane-aimd.test.ts',
    why:
      '하트비트를 아예 안 남기는 레인이 하나만 있어도 `miss` 가 영구 1 이라 바닥에 영원히 눌린다. ' +
      '탈출이 없으면 그 상태가 신호 없이 지속된다("실패가 아니라 조용한 부재").',
  },
  {
    name: 'cron 계정 한도 초과(스케줄 PUT 전면 거부)',
    file: 'wrangler.toml',
    find: 'crons = ["*/5 * * * *", "0 18 * * *", "0 19 * * *", "0 20 * * SUN"]',
    replace: 'crons = ["*/5 * * * *", "0 18 * * *", "0 19 * * *", "0 20 * * SUN", "0 21 * * SUN"]',
    test: 'src/tests/unit/cron-schedule.test.ts',
    why:
      '무료 플랜은 **계정당** cron 5개다(code 10072). 이 계정은 지금 정확히 5(ur-live 4 + ads 1) — 6번째를 넣으면 ' +
      '스케줄 PUT 이 통째로 거부되고 **그 뒤 모든 worker-deploy 가 이 단계에서 실패**해 cron 코드 ' +
      '배포가 전면 정지한다. 2026-08-02 13:19Z 에 실제로 그렇게 됐고, 한 파일만 보는 검사로는 못 잡는다.',
  },
  {
    name: 'cron day-of-week 0 재유입(배열 전체 거부)',
    file: 'wrangler.toml',
    // 🔁 2026-08-02: 원래 좌표는 `"0 20 * * SUN"` 이었는데, 무료 한도로 그 항목을 잠깐 뺐을 때
    //   **뺀 이유를 적은 주석에 같은 문자열이 남아** 주입이 주석에 걸렸다. 주석을 고쳐 봐야
    //   동작이 안 바뀌니 테스트가 통과했고 *"가드가 헛돈다"* 로 오진됐다(진실은 "낡은 지도").
    //   ⇒ 좌표를 **항상 살아 있는** 항목으로 옮긴다. 지키려는 것은 특정 cron 이 아니라
    //   **배열 안 어떤 dow 든 0 이면 안 된다** 이므로 어느 항목이든 무방하다.
    find: '"0 18 * * *"',
    replace: '"0 18 * * 0"',
    test: 'src/tests/unit/cron-schedule.test.ts',
    why:
      '표준 crontab 에선 0=일요일이라 맞아 보이지만 Cloudflare 는 1-7/MON-SUN 만 받는다(code 10100). ' +
      '스케줄 PUT 이 원자적 전체 교체라 이 한 줄이 배열 **전체**를 무효화한다 — 주간 D1 백업이 ' +
      '몇 달간 등록조차 안 된 채였고(재해복구 0) 에러는 배포 로그 안에만 있었다. ' +
      '⚠️ 위 계정-한도 항목과 별개다: 하나는 개수, 이것은 문법이며 서로를 대체하지 않는다.',
  },
  {
    name: '바인딩을 주석으로 되돌림(배포가 지운다)',
    file: 'wrangler.toml',
    find: '[[r2_buckets]]\nbinding = "BACKUP_BUCKET"',
    replace: '# [[r2_buckets]]\n# binding = "BACKUP_BUCKET"',
    test: 'src/tests/unit/worker-bindings-declared.test.ts',
    why:
      '`wrangler deploy` 는 이 파일이 선언한 것으로 워커 설정을 **통째로 교체**한다 — 주석은 ' +
      '"추가 안 함"이 아니라 **삭제**다. 2026-08-02~03 에 두 번 당했고(CACHE_KV · BACKUP_BUCKET), ' +
      '두 번째는 **백업 cron 을 켜는 그 배포가 백업이 쓸 버킷을 지웠다**. 에러는 안 나고 ' +
      '주간 회차가 올 때(일주일 뒤) 조용히 실패한다.',
  },

  // ── 🚚 ur-ads 배포가 조용히 안 나감 (2026-08-02 실사고)
  {
    name: 'env 밖 요금제 쌍(_PAID)이 다시 사각지대로',
    file: 'scripts/check-plan-knob-coverage.mjs',
    find: 'if (orphanPaid.size) {',
    replace: 'if (false) {',
    test: 'src/tests/unit/ads-plan-knobs.test.ts',
    why:
      '요금제 축의 절반은 env 가 아니라 파일 안 상수 쌍(RUN_DEADLINE_MS/_PAID 등)이다 — 등기부에도 R2 에도 ' +
      '안 걸린다. `_PAID` 를 만들고 선택부를 안 붙이면 **유료로 바꿔도 그 축은 안 오른다**(에러 없음).',
  },
  {
    name: 'bad 집계 변수 소실(R3 위반 시 ReferenceError)',
    file: 'scripts/check-plan-knob-coverage.mjs',
    find: 'let bad = false',
    replace: 'globalThis.__bad_removed = 1',
    test: 'src/tests/unit/ads-plan-knobs.test.ts',
    why:
      'R3 는 `bad = true` 로 집계한다 — 선언이 사라지면 위반이 났을 때 ReferenceError 로 죽는다. ' +
      '⚠️ 통과할 땐 멀쩡하고 **실패할 때만** 깨지는 모양이라 눈으로는 못 본다(첫 판이 실제로 그 상태였다: ' +
      'R3 를 선언보다 앞에 뒀다). 위치·존재 검사가 없으면 그대로 머지된다.',
  },
  {
    name: 'PR 검증이 다시 건너뛰어짐(미검증 코드 머지)',
    file: '.github/workflows/verify.yml',
    find: '  pull_request:\n    branches: [main]\n  push:',
    replace: "  pull_request:\n    branches: [main]\n    paths-ignore: ['docs/**']\n  push:",
    test: 'src/tests/unit/ci-verify-coverage.test.ts',
    why:
      '문서 커밋을 코드 커밋 뒤에 밀면 concurrency 가 앞 run 을 취소하고 뒤 커밋은 자기 run 을 안 만든다 ' +
      '— PR 에 실패한 체크가 하나도 없는데 코드는 한 번도 검증되지 않은 상태가 된다(2026-08-03 실제 발생).',
  },
  {
    name: '고아 레인 판정이 나이를 다시 안 봄',
    file: 'src/worker-ads/lane-cadence.ts',
    find: '      return (age as number) > staleMinutes       // 🔴 최근에 뛰고 있으면 고아가 아니다',
    replace: '      return true',
    test: 'src/tests/unit/ads-lane-cadence.test.ts',
    why:
      'DO 알람·우회로 도는 레인은 디스패처 목록에 없다 — 나이를 안 보면 **멀쩡히 도는 레인이 전부 고아**로 ' +
      '찍힌다(실측 16건 중 대부분). 고칠 게 없는 경보 16줄이 진짜 하나(sweep-kakao-phone 4일 정지)를 묻는다.',
  },
  {
    name: 'never_fired 가 다시 비대칭 정규화',
    file: 'src/worker-ads/lane-cadence.ts',
    find: '  return known.filter(k => !fired.has(baseLaneName(k))).sort()',
    replace: '  return known.filter(k => !fired.has(k)).sort()',
    test: 'src/tests/unit/ads-lane-cadence.test.ts',
    why:
      '`known` 은 쿼리를 단 채 들어오는데 하트비트 쪽만 쿼리를 떼면, 쿼리 있는 레인은 기록이 멀쩡히 있어도 ' +
      '**영원히 "한 번도 안 돌았다"** 로 찍힌다(실측 2건). 오탐이 경보 전체의 신뢰를 깎는다.',
  },
  {
    name: 'ur-ads 배포 백오프가 초 단위로 회귀',
    file: '.github/workflows/deploy-ads.yml',
    find: 'WAIT=$(( i == 1 ? 60 : (i == 2 ? 150 : 300) ))',
    replace: 'WAIT=$(( i * 10 ))',
    test: 'src/tests/unit/deploy-retry-backoff.test.ts',
    why:
      'Cloudflare 10429 는 초 단위로 안 풀린다 — 실측에서 3회 재시도가 40초 안에 소진돼 배포가 실패했고 ' +
      'ur-ads 가 낡은 코드로 계속 돌았다(머지 2건이 조용히 미배포). 라이브는 멀쩡해 보인다.',
  },
  {
    name: '소비자 Pages 배포 백오프가 초 단위로 회귀',
    file: '.github/workflows/main.yml',
    find: "                SLEEP=$(( i == 1 ? 60 : (i == 2 ? 150 : 300) ))",
    replace: "                SLEEP=$((i * 10))",
    test: 'src/tests/unit/deploy-retry-backoff.test.ts',
    why:
      '소비자 사이트 배포가 같은 10429 로 **연속 4회** 실패했다(22:53·23:37·23:47·23:56 KST). ' +
      '라이브가 4개 머지만큼 뒤처졌는데 화면은 멀쩡해 보인다 — 한 곳만 고치면 다른 곳이 같은 이유로 죽는다.',
  },
  {
    name: '빈 회차를 해로 안 셈(학습기 관측 편향 재발)',
    file: 'src/worker-ads/lane-aimd.ts',
    find: '  if (!tickHarmed(tick) && missed <= 0) {',
    replace: '  if (!tickHarmed(tick)) {',
    test: 'src/tests/unit/ads-lane-aimd.test.ts',
    why:
      '부모가 flush 전에 죽은 회차는 요약이 없다 — 즉 **가장 심하게 무너진 회차일수록 학습기 눈에 안 띈다**. ' +
      '빈자리를 안 세면 학습기가 살아남은 회차만 보고 영영 안 물러난다(실측: 관측된 회차 5중 2).',
  },
  {
    name: '빈 회차를 이력 덧붙인 *뒤* 에 셈(항상 0)',
    file: 'src/worker-ads/tick-history-write.ts',
    find: "    const prevAt = readTickHistory(pick(TICK_HISTORY_KEY)).at(-1)?.at\n    const next = appendTick(pick(TICK_HISTORY_KEY), tick)",
    replace: "    const next = appendTick(pick(TICK_HISTORY_KEY), tick)\n    const prevAt = readTickHistory(next).at(-1)?.at",
    test: 'src/tests/unit/ads-tick-history.test.ts',
    why:
      '덧붙인 뒤 마지막 항목은 **방금 만든 이 회차**라 간격이 항상 0 이 된다 — 검사가 통째로 헛돈다 ' +
      '(이 레포가 반복해 만난 "헛도는 가드" 의 교과서적 형태).',
  },
  {
    name: '배포 워크플로가 자기 자신을 경로에서 잃음',
    file: '.github/workflows/deploy-ads.yml',
    find: "      - '.github/workflows/deploy-ads.yml'",
    replace: '',
    test: 'src/tests/unit/deploy-retry-backoff.test.ts',
    why:
      '자기 자신이 paths 에 없으면 **이 워크플로의 수리가 배포되지 않는다** — 깨진 배포 경로를 고쳐도 ' +
      '무관한 코드 변경을 기다려야 적용된다(수리를 검증할 방법이 없는 자기참조적 사각지대).',
  },
  {
    name: '집중 축 커서를 읽어오지 않음(항상 0 — 앞 4개만 무한 반복)',
    file: 'src/features/marketing/api/influencer-auto-collect.ts',
    find: '[STATS_KEY, FOCUS_CURSOR_KEY,',
    replace: '[STATS_KEY,',
    test: 'src/tests/unit/ads-keyword-focus-split.test.ts',
    why:
      'readSettings 목록에 없는 키는 **에러가 아니라 undefined** 로 온다 → parseInt(\'0\') → 커서 0 고정. ' +
      '라이브 실측: 활성 대행사 키워드 18개 중 앞 4개만 돌고 "체험단 대행"·"인플루언서 섭외" 등 14개는 ' +
      '`found_total = 0 · last_run_at = null`(한 번도 검색된 적 없음). 슬롯 배정(`focus_n: 4`)은 정상이라 ' +
      '통계만 봐선 멀쩡해 보였다.',
  },
  {
    name: '민 커서를 통계 JSON 에만 남기고 저장 안 함',
    file: 'src/features/marketing/api/influencer-auto-collect.ts',
    find: '    [FOCUS_CURSOR_KEY, String(nextFocusCursor)],\n',
    replace: '',
    test: 'src/tests/unit/ads-keyword-focus-split.test.ts',
    why:
      '다음 회차가 읽는 곳은 `platform_settings` 이지 통계 blob 이 아니다. 라이브 실측에서 ' +
      'cursor_pri=158 · cursor=6 은 있는데 cursor_focus 는 **행 자체가 없었다** — 계산은 매 회차 했는데 ' +
      '아무 데도 안 남았다. 커서가 있는 레인이라면 어디서든 같은 형태로 재발한다.',
  },
  {
    name: '집중 축 커서를 계획한 수만큼 밀어 안 돈 키워드를 건너뜀',
    file: 'src/features/marketing/api/influencer-auto-collect.ts',
    find: '(focusCursor + focusDone)',
    replace: '(focusCursor + nFocus)',
    test: 'src/tests/unit/ads-keyword-focus-split.test.ts',
    why:
      '예산은 픽 4개를 다 못 돈다(보통 1~2개). 계획한 수만큼 밀면 처리 못 한 키워드를 지나쳐 ' +
      '**한 바퀴에 한 번도 안 걸리는 자리**가 생긴다 — 우선/일반 커서가 `prefixDone` 을 쓰는 이유와 같은 병(leapfrog).',
  },
  {
    name: "bare '마케터' 가 소개글까지 대행사로(이용권 축에서 훔쳐옴)",
    file: 'src/features/marketing/api/influencer-classify.ts',
    find: '광고\\s*(운영|세팅|집행)/i,\n    nameRe:',
    replace: '광고\\s*(운영|세팅|집행)|마케터/i,\n    nameRe:',
    test: 'src/tests/unit/ads-classify-marketer.test.ts',
    why:
      '라이브 실측: 대행사 273명 중 **45명(16%)이 오직 이 단어 하나로** 들어왔고, 원래 자리는 ' +
      '맛집 10 · 외식창업 8 · IT/재테크 5 · 카페 5 · 숙소 4 · 여행 2 · 패션 1 · 미분류 10 — ' +
      '대부분 이용권 본체 축이다. "15년차 마케터. 75개국 여행" 이 여행 블로거를 대행사로 만든다.',
  },
  {
    name: '이름 전용 신호를 안 봄(진짜 마케터가 사라짐)',
    file: 'src/features/marketing/api/influencer-classify.ts',
    find: 'if (!r.re.test(text) && !(r.nameRe && r.nameRe.test(name))) continue',
    replace: 'if (!r.re.test(text)) continue',
    test: 'src/tests/unit/ads-classify-marketer.test.ts',
    why:
      '좁히기의 짝이다. `nameRe` 를 안 보면 싱어송마케터·지역전문마케터·QR마케터처럼 **이름으로 자기를 ' +
      '선언한 실제 마케터 14명**이 통째로 빠진다 — 오탐을 줄이려다 정탐을 버리는 형태.',
  },
  {
    name: '규칙이 거부하는 옛 카테고리를 안 비움(영구 고착)',
    file: 'src/features/marketing/api/influencer-classify.ts',
    find: "  if (stored === '마케팅대행사') {",
    replace: "  if (false && stored === '마케팅대행사') {",
    test: 'src/tests/unit/ads-classify-marketer.test.ts',
    why:
      '재분류는 `classifyCategory` 가 **null 이면 그대로 둔다.** 규칙을 좁히면 어느 규칙에도 안 걸리는 ' +
      '행이 생기는데(실측 45 중 10건), 안 비우면 옛 값이 영구히 굳는다 — `shouldClearCategory` docblock 이 ' +
      '입주 시공업체 27명 실측으로 이미 경고한 바로 그 형태("측정하면 점진 교정된다"는 낙관은 틀렸다).',
  },
  {
    name: '시트 미러가 사이클 스냅샷을 넘어 그리드 밖을 씀',
    file: 'src/features/marketing/api/sheets-sync.ts',
    find: 'Math.min(PAGE, ROWS_PER_RUN - wrote, room)',
    replace: 'Math.min(PAGE, ROWS_PER_RUN - wrote)',
    test: 'src/tests/unit/ads-sheets-sync.test.ts',
    why:
      '그리드는 사이클 **시작 시점 total** 로만 넓힌다(`ensurePoolSheet(total+2)`, `off===0` 분기 안). ' +
      '읽기 루프에 그 상한이 없으면 사이클 도중 늘어난 행을 그리드 밖에 쓰고 Sheets 400 이 난다. ' +
      '실패는 커서를 그 자리에 저장하고 끝나므로 `off` 가 0 으로 돌아갈 길이 없다 = **영구 고착**' +
      '(2026-08-03 라이브: `{off:44000, total:43597}`, 24시간 7회 실패).',
  },
  {
    name: '지나친 커서를 되돌리지 않아 그리드 확장이 영영 안 불림',
    file: 'src/features/marketing/api/sheets-sync.ts',
    find: 'return cur.total > 0 && cur.off >= cur.total ? { off: 0, total: 0 } : cur',
    replace: 'return cur',
    test: 'src/tests/unit/ads-sheets-sync.test.ts',
    why:
      '위 상한은 *앞으로* 안 넘어가게 할 뿐, **이미 넘어가 있는 라이브 커서는 안 푼다.** 이 되돌림이 ' +
      '없으면 배포해도 같은 행에서 400 이 계속 나고, 2~3칸뿐인 회차 예산에서 한 칸을 계속 태운다. ' +
      '⚠️ `total` 을 0 으로 되돌리는 것까지가 수리다 — 그래야 호출부가 총계를 다시 세고 그리드를 넓힌다.',
  },
  {
    name: '알람이 모는 수집 레인을 부모도 던짐(부모 CPU 이중 소모)',
    file: 'src/worker-ads/index.ts',
    find: "if (!laneAlarmOn && env.ADS_AUTO_COLLECT_ENABLED === 'true')",
    replace: "if (env.ADS_AUTO_COLLECT_ENABLED === 'true')",
    test: 'src/tests/unit/ads-lane-alarm.test.ts',
    why:
      '리스가 이중 *실행* 은 막지만 **던지는 것 자체가 부모 CPU 를 먹는다** — 그게 애초에 이 레인을 죽인 ' +
      '원인이다(2026-08-03 실측: 디스패치 3초 뒤 `ads:collect  Worker exceeded CPU time limit`).',
  },
  {
    name: 'laneAlarmOn 선언이 첫 사용보다 아래로(런타임 TDZ)',
    file: 'src/worker-ads/index.ts',
    find: '  const laneAlarmOn = laneAlarmDrivesEnrich(env)\n',
    replace: '',
    test: 'src/tests/unit/ads-lane-alarm.test.ts',
    why:
      '`const` 는 TDZ 라 선언보다 먼저 쓰면 **런타임에 ReferenceError** 인데 **타입체크는 통과한다**. ' +
      '수집 게이트가 보강 블록보다 위에 있어 작성 중 실제로 밟았다. 이 주입은 선언을 통째로 지워 ' +
      '"순서" 불변식이 위치를 실제로 보는지 확인한다.',
  },
  {
    name: '수집 레인 시간당 상한이 조용히 증설됨',
    file: 'src/worker-ads/lane-alarm-runners.ts',
    find: '  collect: {\n    runsPerHour: 1,\n',
    replace: '  collect: {\n',
    test: 'src/tests/unit/ads-lane-alarm.test.ts',
    why:
      '빼면 정책 기본값(12회/시간)을 받는다 = cron 설계 의도(`0 * * * *`)를 12배 넘는 증설이고, ' +
      '**네이버로 나가는 요청량이 늘어나는 변경**이라 대표 판단 사항이다. 값이 조용히 바뀌는 것을 막는다.',
  },
  {
    name: '미루기 판정이 주기 대신 침묵 임계를 봄(매시간 레인이 통째로 always)',
    file: 'src/worker-ads/dispatch-budget.ts',
    find: '  const period = Number(lane.periodMin)\n  if (Number.isFinite(period) && period > 0) return period <= 60\n',
    replace: '',
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why:
      '`gapMin` 은 `staleGapMinutes` = 주기×2+30 으로 **부풀린** 침묵 판정 임계다. 이 분기를 지우면 ' +
      '매시간 레인의 150 이 `> 60` 으로 읽혀 **전부 `always`** 가 된다(2026-08-03 12:00 KST 실측: ' +
      '네 도메인 전부 `deferred: 0`, 레인 14). 예산·학습기는 미룰 수 있는 레인에만 작용하므로 ' +
      '통제 대상이 0 개가 되고, #1007(예산 0 구속) 수리가 옳고도 무력해진다.',
  },
  {
    name: '게이트 레인에도 periodMin 60 을 실어 일 1회 레인이 미뤄짐',
    file: 'src/worker-ads/lane-cadence.ts',
    find: "  return opts?.gap === undefined ? { gapMin, periodMin: 60 } : { gapMin }",
    replace: '  return { gapMin, periodMin: 60 }',
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why:
      '반대 방향의 사고 — 명시 `gap` 을 받은 게이트 레인(일 1회·N시간·스케줄)까지 매시간으로 표시하면 ' +
      '**미룰 수 있게** 되고, 그 레인의 조 차례가 지정 시각이 아닌 때 걸리는 순간 **영영 안 돈다**. ' +
      '침묵이 아니라 부재라 경보에도 안 잡힌다(`isDeferrable` docblock 이 경고하는 바로 그 형태).',
  },
  {
    name: '은퇴 축 리드를 안 비움(유령 카테고리 영구 잔존)',
    file: 'src/features/marketing/api/influencer-classify.ts',
    find: '  if (retired.has(stored)) return true',
    replace: '  if (false) return true',
    test: 'src/tests/unit/ads-category-retire.test.ts',
    why:
      '축을 접어도 리드의 카테고리 값은 남는다 — 아무 규칙도 안 만드는 유령 값이 영구 잔존한다. ' +
      '재분류는 `classifyCategory` 가 null 이면 그대로 두므로 스스로 낫지 않는다.',
  },
  {
    name: '은퇴 축을 키워드 폴백이 다시 붙임(비우기와 무한 싸움)',
    file: 'src/features/marketing/api/influencer-classify.ts',
    find: '!NON_CATEGORIES.has(kc) && !retired.has(kc)',
    replace: '!NON_CATEGORIES.has(kc)',
    test: 'src/tests/unit/ads-category-retire.test.ts',
    why:
      '비우기(①)만 있고 유입 차단(②)이 없으면 재분류가 지우고 저장이 다시 붙여 **영원히 제자리**다. ' +
      '두 경로는 짝이라 하나만 있으면 무의미하다.',
  },
  {
    name: '은퇴 축 키워드가 수집 슬롯을 계속 먹음',
    file: 'src/features/marketing/api/influencer-auto-collect.ts',
    find: '.filter(k => !k.category || !RETIRED_CATEGORIES.has(k.category))',
    replace: '',
    test: 'src/tests/unit/ads-category-retire.test.ts',
    why:
      '수집은 시간당 1회 · 회차당 16픽뿐이다(실측). 접은 축 키워드가 계속 순번을 받으면 살아있는 축이 ' +
      '그만큼 굶는다 — 대행사 축이 19개 중 17개를 못 돌던 것과 같은 희소성 문제다.',
  },
  {
    name: '예산 0 을 "미설정"으로 읽어 기본값 6 으로 바꿔치기(제어 반전)',
    file: 'src/worker-ads/dispatch-budget.ts',
    find: 'perTick >= 0 ? Math.floor(perTick)',
    replace: 'perTick >= 1 ? Math.floor(perTick)',
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why:
      '`domainBudgets` 는 예산이 도메인 수보다 적으면 **일부러 0 을 주고 회전**시킨다(그 함수 docblock). ' +
      '여기서 0 을 걸러 기본값 6 으로 바꾸면 **조일수록 레인이 늘어나는 제어 반전**이 된다 — ' +
      '실측(2026-08-03 11:00 KST, 학습 cap 2): 예산 0 인 두 도메인이 3개·6개를 띄워 총 11개. ' +
      '그 붕괴가 부모 꼬리의 `writeTickSummary`·`sheets-sync` 를 지워 학습기가 더 조이는 폭주 고리였다.',
  },
  {
    name: '쉬는 회차에도 cap 하한 1 을 깔아 "쉬어라"가 무효화됨',
    file: 'src/worker-ads/dispatch-budget.ts',
    find: 'const cap = budget <= 0 ? 0 : Math.max(1, budget - always.length)',
    replace: 'const cap = Math.max(1, budget - always.length)',
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why:
      '위 수리의 짝이다. 0 을 제대로 읽어도 하한 1 이 남아 있으면 쉬는 조가 매 회차 1개씩 띄운다 — ' +
      '도메인 수만큼 곱해지면 학습기 판단(cap 2)이 다시 안 맞는다. 하한은 *자리를 받은* 조에만 있어야 한다.',
    name: 'YT 건너뛴 행이 스탬프를 못 받아 영구 선두(재선택 churn)',
    // ⚠️ 2026-08-03 600줄 래칫으로 YT 성과가 이 파일로 분리됐다(순수 이동). 앵커가 안 따라오면
    //   이 주입은 "find 문자열이 소스에 없음"으로 낡은 지도 판정을 받는다 — 그게 이 러너의 모드 ②다.
    file: 'src/features/marketing/api/influencer-yt-performance.ts',
    find: "category_source = COALESCE(?, category_source), pub_checked_at = datetime('now') WHERE id = ?",
    replace: 'category_source = COALESCE(?, category_source) WHERE id = ?',
    test: 'src/tests/unit/ads-enrich-throughput.test.ts',
    why:
      '선택 순서가 `(pub_checked_at IS NULL) DESC` 다. 스탬프가 없으면 예산으로 건너뛴 행이 **다음 회차에도 ' +
      '맨 앞**이라 채널콜을 또 태운다. 실측: PT 하루 2,003 units 로 106행만 측정 = **19콜/행**(코드상 2~3콜).',
  },
  {
    name: 'YT 성과 상한이 고정으로 회귀(검색 유휴분을 못 씀)',
    file: 'src/features/marketing/api/influencer-enrich-lane.ts',
    find: 'resolveYtPerfCap(ytSearchCalls * YT_SEARCH_UNIT_COST, env.ADS_YT_PERF_UNITS)',
    replace: 'Math.min(9000, YT_PERF_UNITS_DEFAULT)',
    test: 'src/tests/unit/ads-enrich-throughput.test.ts',
    why:
      '실측: 검색 배정 9,000 중 2,200만 쓰는데 성과는 2,000 상한에 걸려 **그날 남은 시간 측정 0**. ' +
      '멎은 쪽이 수율이 더 높은 축이다(YT 45.2% vs 블로그 28.6%). 총 쿼터의 58%가 놀고 있었다.',
  },
  {
    name: '선두 기록 누락 — 교대가 성립하지 않음',
    file: 'src/features/marketing/api/influencer-enrich-lane.ts',
    find: "    led: naverFirst ? 'naver' : 'front',\n",
    replace: '',
    test: 'src/tests/unit/ads-enrich-throughput.test.ts',
    why:
      'DO 알람에선 `depth` 가 항상 0 이라 `depth % 2 === 1` 교대가 **영원히 거짓**이다. 직전 선두를 ' +
      '기록해야 교대가 성립한다. YT 상한을 푼 뒤에는 이게 없으면 블로거가 굶는다 — 두 수리는 한 몸이다.',
  },
  {
    name: '알람이 cron 시절 7초 창을 그대로 씀',
    file: 'src/worker-ads/lane-alarm-runners.ts',
    find: "runInfluencerEnrich(env, 0, undefined, null, { driver: 'alarm' })",
    replace: 'runInfluencerEnrich(env)',
    test: 'src/tests/unit/ads-enrich-throughput.test.ts',
    why:
      '7초의 근거는 *"부모 인보케이션이 10.5초에 회수되고 자식이 함께 죽는다"* 였다. **알람엔 부모가 없다** — ' +
      '같은 알람의 collect 가 28,643ms 완주가 증거다. 전제가 사라진 값을 그대로 쓰면 창이 근거 없이 좁다.',
  },
  {
    name: '수집 폭 동결이 풀림(측정이 병목인데 백로그가 증가 반전)',
    file: 'src/features/marketing/api/influencer-auto-collect.ts',
    find: '    if (processedIds.size >= roundCap) break',
    replace: '',
    test: 'src/tests/unit/ads-keyword-focus-split.test.ts',
    why:
      '네이버 enrichMax 축소로 키워드당 비용이 ~10.4 → ~6 이 되면 루프가 **자동으로** 회차당 5 → 9개를 돈다. ' +
      '실측: 블로그 유입 3,895/일 vs 측정 4,184/일(여유 +289). 폭을 1.8배로 넓히면 유입 ~7,000 → ' +
      '백로그가 매일 +2,800 으로 **증가 반전**한다. 새 행은 이메일 1.3% 라 행 수만 늘고 발송 가능 리드는 안 는다.',
  },
  {
    name: '네이버 수집 시점 보강이 원래대로(예산 54% 재소모)',
    file: 'src/features/marketing/api/influencer-auto-collect.ts',
    find: 'enrichMax: NAVER_COLLECT_ENRICH_MAX',
    replace: 'enrichMax: 5',
    test: 'src/tests/unit/ads-keyword-focus-split.test.ts',
    why:
      '실측 `spend_by` 에서 네이버가 회차 예산의 54%(28/56)를 쓰는데 그 산출은 미측정 행 이메일 **1.3%** 다. ' +
      '키워드당 발굴 69명 중 5명(7%)만 보강하기 때문 — 보강 레인은 같은 사람들을 100% 커버해 25% 로 만든다. ' +
      '즉 어차피 할 일의 7%를 미리 하면서 예산 절반을 쓰는 중복이다.',
  },
  {
    name: '집중 축이 다시 앞머리 독점(일반 풀 커서 동결 — 커버리지 붕괴)',
    // ⚠️ 600줄 래칫으로 병합 로직이 `influencer-keyword-rotation.ts` 로 추출됐다(순수 이동).
    //   앵커가 안 따라오면 이 주입은 "find 가 소스에 없음"으로 낡은 지도 판정을 받는다.
    file: 'src/features/marketing/api/influencer-keyword-rotation.ts',
    find: '  for (let i = 0; i < Math.max(focus.length, pri.length, gen.length); i++) {',
    replace: '  out.push(...focus)\n  for (let i = 0; i < Math.max(pri.length, gen.length); i++) {',
    test: 'src/tests/unit/ads-keyword-focus-split.test.ts',
    why:
      '회차는 `planned 16 → processed 5`(예산 56/56 소진)다. 집중 축을 앞머리에 두면 4개가 앞자리를 먹고 ' +
      '일반 풀엔 1개만 남는다. `prefixDone` 은 처리된 **앞부분만** 세므로 뒤 풀은 커서도 안 움직여 ' +
      '**같은 키워드를 무한 재실행**한다 — 실측: 활성 399 중 323개가 이틀째 미실행, 24h 실행 54개뿐.',
  },
  {
    name: '티스토리가 블로거 뒤로 밀림(잔여를 다 뺏겨 영원히 0)',
    file: 'src/features/marketing/api/influencer-enrich-lane.ts',
    find: '    try { tistory = await enrichTistoryActivity(DB, budget, TISTORY_ROOM, slice) } catch (err) { note(err) }\n',
    replace: '',
    test: 'src/tests/unit/ads-tistory-enrich.test.ts',
    why:
      '블로거는 `naverRoomFromRemaining` 으로 **잔여 전부**를 가져간다. 티스토리가 뒤에 서면 남는 예산이 없어 ' +
      '측정이 0으로 고착된다 — 에러 없이 조용히. ⚠️ 첫 판정이 `indexOf(\'enrichTistoryActivity\')` 라 맨 위 ' +
      '**import 문**을 먼저 찾아 초록이 떴다(import 는 언제나 첫 번째다) → 호출부로 앵커를 옮겼다.',
  },
  {
    name: '티스토리 몫이 조용히 증설됨(블로거 백로그를 갉음)',
    file: 'src/features/marketing/api/influencer-enrich-lane.ts',
    find: 'export const TISTORY_ROOM = 2',
    replace: 'export const TISTORY_ROOM = 9',
    test: 'src/tests/unit/ads-tistory-enrich.test.ts',
    why:
      '이 값이 곧 블로거에게서 뺏는 양이다(2 = 회차당 최대 4 서브리퀘스트 ≈ 9%). 티스토리 백로그는 495 로 ' +
      '블로거(20,264)의 2.4% 라, 몫을 키우면 20,264행 소진이 그만큼 늦어진다. 늘리려면 실측이 먼저다.',
  },
  {
    name: '네이버 오픈API 계측이 래퍼에서 사라짐(그 레인이 통째로 계측 밖)',
    file: 'src/features/marketing/api/fetch-with-err.ts',
    find: '  noteNaverCall(url) //',
    replace: '  // noteNaverCall(url) //',
    test: 'src/tests/unit/ads-naver-api-usage.test.ts',
    why:
      '유튜브·카카오는 일별 실사용을 세는데 네이버만 카운터가 없어 "한도 안"이 **추정**이었다. 래퍼에서 빠지면 ' +
      '그 레인 호출이 통째로 계측 밖이 되고, 숫자는 그럴듯하게 남아 **더 위험하다**(0이 아니라 과소계상). ' +
      '⚠️ 이 주입은 *주석 처리* 다 — 첫 판정이 문자열만 봐서 초록이 떴고, 그래서 검사가 주석을 지우고 본다.',
  },
  {
    name: '네이버 계측이 회차당 두 번 take(뒤가 0 — 조용한 과소계상)',
    file: 'src/features/marketing/api/influencer-auto-collect.ts',
    find: '+ takeNaverCalls()',
    replace: '+ takeNaverCalls() + takeNaverCalls()',
    test: 'src/tests/unit/ads-naver-api-usage.test.ts',
    why:
      '`takeNaverCalls()` 는 **가져가며 비운다**. 두 번 부르면 두 번째가 항상 0이라 합계가 맞는 것처럼 보이지만, ' +
      '중간에 다른 코드가 끼면 그 사이 누적이 통째로 사라진다. 호출은 회차당 정확히 한 번이어야 한다.',
  },
  {
    name: 'B2B 레인이 네이버 누적을 안 비움(그 인보케이션 몫 유실)',
    file: 'src/features/marketing/api/company-collect.ts',
    find: '  await flushNaverCalls(DB, Date.now())',
    replace: '  // await flushNaverCalls(DB, Date.now())',
    test: 'src/tests/unit/ads-naver-api-usage.test.ts',
    why:
      '네이버 쿼터는 **앱 단위**라 B2B 몫도 같은 통에 들어가야 총계가 의미를 갖는다. 안 비우면 그 인보케이션 ' +
      '누적은 사라진다 — 아이솔레이트가 달라 인플루언서 레인이 걷어가지 못한다.',
  },
  {
    name: 'YT 성과 바닥이 남은 쿼터를 무시(무료 한도 초과)',
    file: 'src/features/marketing/api/influencer-enrich-lane.ts',
    find: 'const floor = Math.min(YT_PERF_UNITS_DEFAULT, Math.max(0, YT_DAILY_QUOTA_UNITS - used))',
    replace: 'const floor = YT_PERF_UNITS_DEFAULT',
    test: 'src/tests/unit/ads-enrich-throughput.test.ts',
    why:
      '바닥 2,000 을 무조건 보장하면 **검색 9,000(배정 90회) + 성과 2,000 = 11,000 > 10,000** 이 성립한다. ' +
      '초과의 대가는 청구서가 아니라 403 quotaExceeded — 그날 측정이 통째로 멎는다. 바닥보다 **총합**이 상위 불변식이다.',
  },
  {
    name: 'YT 영상 통계 루프가 저장 몫을 안 남김(쿼터 태우고 저장 0)',
    file: 'src/features/marketing/api/influencer-yt-performance.ts',
    find: 'allIds.length && budget.left > 1 && !outOfTime(budget)',
    replace: 'allIds.length && budget.left > 0 && !outOfTime(budget)',
    test: 'src/tests/unit/ads-enrich-throughput.test.ts',
    why:
      '루프 뒤 `DB.batch(stmts)` 가 이 회차 측정 전량의 **유일한** 쓰기다. D1 도 서브리퀘스트라 마지막 칸까지 ' +
      '쓰면 batch 가 던지고 `.catch(() => null)` 이 삼킨다 → 채널콜·영상콜 쿼터를 다 태우고 저장 0, 스탬프도 없어 ' +
      '그 행들이 다음 회차에도 맨 앞(이 PR 이 잡으려던 재선택 churn 을 되레 만든다).',
  },
  {
    name: '경보 채널이 비어 있다는 사실이 화면에서 안 보임',
    file: 'src/worker-ads/health.routes.ts',
    find: "      discord: e.DISCORD_WEBHOOK_URL ? '설정됨' : '🔴 미설정 — 아래 경보가 전부 무음',",
    replace: "      discord: '',",
    test: 'src/tests/unit/ads-alert-channel-visible.test.ts',
    why:
      '유어애즈 경보는 전부 `if (env.DISCORD_WEBHOOK_URL && …)` 라 값이 없으면 흔적 없이 건너뛴다 — ' +
      '**경보가 무음이라는 사실 자체가 무음**이다. 2026-08-03 실측: ur-ads 에 미설정이라 시트 미러가 ' +
      '이틀 멈춘 동안 디스코드 알림 0건. 같은 시점 메인(ur-live)엔 설정돼 있어 머니 경보는 정상이었고, ' +
      '**두 워커의 env 가 갈렸다는 걸 밖에서 확인할 방법이 없었다.** 값 설정은 대표 몫이지만 ' +
      '비어 있음이 보이는 것까지는 코드의 몫이다.',
  },
  {
    name: '경보 실발사 확인 라우트가 결과를 삼킴(자기 존재 이유 상실)',
    file: 'src/worker-ads/health.routes.ts',
    find: '    return c.json({ ok: res.ok, status: res.status, ms: Date.now() - t0',
    replace: '    return c.json({ ok: true, ms: Date.now() - t0',
    test: 'src/tests/unit/ads-alert-channel-visible.test.ts',
    why:
      '이 라우트는 "설정됨"과 "실제로 도착함"을 가르려고 만든 것이다. Discord 상태를 안 돌려주고 ' +
      '`ok: true` 만 주면 **오타난 웹훅도 초록**이라 라우트 자체가 같은 병에 걸린다 — 그러면 ' +
      '대표는 채널이 살아 있다고 믿고 다음 장애를 또 놓친다.',
  },
  {
    name: '실발사 확인 응답에 웹훅 URL 을 실음(채널 탈취)',
    file: 'src/worker-ads/health.routes.ts',
    find: "hint: res.ok ? '전송됨 — 채널에 도착했는지 눈으로 확인' : '웹훅 URL/채널 확인 필요'",
    replace: 'webhook: url',
    test: 'src/tests/unit/ads-alert-channel-visible.test.ts',
    why:
      'Discord 웹훅 URL 은 그 자체가 자격증명이다 — 아는 사람은 누구나 그 채널에 글을 쓸 수 있다. ' +
      '진단 응답에 실으면 어드민 화면·로그·스크린샷을 타고 새어 나간다.',
  },
  {
    name: '어드민 위임이 경보 확인 결과를 삼킴(오타난 웹훅이 초록)',
    file: 'src/features/marketing/api/admin-ads-pool-ops.routes.ts',
    find: 'return c.json({ success: !!j?.ok, status: j?.status ?? null',
    replace: 'return c.json({ success: true, status: null',
    test: 'src/tests/unit/ads-alert-channel-visible.test.ts',
    why:
      'ur-ads 가 Discord HTTP 상태를 그대로 돌려주도록 만들어 놨는데, 위임이 그걸 뭉개면 ' +
      '**오타난 웹훅·삭제된 채널도 초록**으로 보인다. 그러면 대표는 채널이 살아 있다고 믿고 ' +
      '다음 장애를 또 놓친다 — 이 경로 전체의 존재 이유가 사라지는 형태.',
  },
]
/**
 * 🔒 **주입이 도는 동안 커밋을 막는 자물쇠** (2026-08-03 — 실제로 한 번 당한 뒤 추가).
 *
 * 이 스크립트는 소스에 **의도적 결함을 심었다 지운다**. 복원은 튼튼하지만(try/finally + 시그널 + exit),
 * 그 사이에 **다른 곳에서 `git add -A` 를 하면 결함이 그대로 스테이징된다.**
 * 실제로 그렇게 `Promise.all(tracked)`(무한 대기 — 그 PR 이 고치려던 바로 그 고장)가 커밋됐고,
 * CI 가 잡을 때까지 아무도 몰랐다. `git status` 의 낯선 변경이 유일한 신호였는데 그건 사람이 놓친다.
 *
 * `.git/` 안에 두므로 커밋 대상이 될 수 없다. pre-commit 훅이 이 파일을 보고 거절한다.
 */
const LOCK = path.join(ROOT, '.git', 'guard-mutations.lock')
function lockOn() { try { fs.writeFileSync(LOCK, `${process.pid} ${new Date().toISOString()}\n`) } catch { /* 최선 노력 */ } }
function lockOff() { try { fs.rmSync(LOCK, { force: true }) } catch { /* 최선 노력 */ } }

/** 복원해야 할 원본들 — 어떤 경로로 끝나도 되돌린다. */
const pending = new Map()
function restoreAll() {
  for (const [abs, src] of pending) { try { fs.writeFileSync(abs, src) } catch { /* 최선 노력 */ } }
  pending.clear()
  lockOff()   // 복원과 같은 자리에서 푼다 — 둘이 갈리면 자물쇠만 남아 커밋이 영영 막힌다
}
for (const sig of ['SIGINT', 'SIGTERM', 'uncaughtException']) {
  process.on(sig, (e) => { restoreAll(); if (e instanceof Error) console.error(e); process.exit(1) })
}
process.on('exit', restoreAll)
lockOn()   // 여기서부터 소스에 손을 댄다 — pre-commit 이 이 자물쇠를 보고 커밋을 거절한다

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

/**
 * 💬 주석을 공백으로 덮은 사본을 만든다 — **길이와 인덱스는 원본과 같게.**
 *
 * 2026-08-02 실측: `"0 20 * * SUN"` 주입이 `wrangler.toml` 의 **주석**에 걸렸다. 무료 한도로
 * 그 cron 을 배열에서 뺐는데, 뺀 이유를 적은 주석 안에 같은 문자열이 남아 있었기 때문이다.
 * 결과는 조용한 오진이었다 — 주석을 고쳐 봐야 동작이 안 바뀌니 테스트는 통과했고, 이 도구는
 * 그걸 *"가드가 헛돈다"* 로 보고했다. **진실은 "지도가 낡았다"** 였고, 둘은 조치가 정반대다
 * (전자는 테스트 픽스처를 고치고, 후자는 주입 좌표를 옮긴다).
 *
 * CLAUDE.md 가 `check-lock-table-symbols` 에 대해 적어 둔 함정 *"주석에만 남아도 통과"* 와
 * 같은 클래스다. 이 도구 자체가 그 함정에 빠졌으니 여기서 막는다.
 *
 * ⚠️ **못 하는 것**: 문자열 리터럴 안의 `#`·`/*` 를 주석으로 오인할 수 있다. 그래도 안전한 쪽으로
 *    틀린다 — 과잉 마스킹의 결과는 "낡은 지도"라는 **시끄러운 실패**지 조용한 통과가 아니다.
 */
function maskComments(src, file) {
  const ext = path.extname(file)
  const js = ['.ts', '.tsx', '.js', '.mjs', '.cjs'].includes(ext)
  const hash = ['.toml', '.yml', '.yaml', '.sh', '.conf'].includes(ext)
  if (!js && !hash) return src

  // ⚠️ **정규식으로는 이 클래스를 못 가른다**(2026-08-02 실측). 첫 구현은
  //   `/\/\*[\s\S]*?\*\//` 로 블록 주석을 지웠는데, 어느 `//` 주석이 본문에 `` `/*` `` 라는
  //   **글자**를 담고 있어서 거기서부터 9줄을 통째로 삼켰다 — 그 안의 살아 있는 코드가
  //   "주석"이 되어 정상 주입이 "낡은 지도"로 오진됐다. 문자열 안의 `#`·`/*` 도 같은 문제다.
  //   ⇒ 왼쪽부터 상태를 들고 훑는다. 여는 기호는 **그때 상태가 code 일 때만** 의미가 있다.
  const out = src.split('')
  let i = 0
  const n = src.length
  let state = 'code' // code | line | block | sq | dq | tpl
  const blank = (k) => { if (out[k] !== '\n') out[k] = ' ' }
  while (i < n) {
    const c = src[i], d = src[i + 1]
    if (state === 'code') {
      if (js && c === '/' && d === '/') { state = 'line'; blank(i); blank(i + 1); i += 2; continue }
      if (js && c === '/' && d === '*') { state = 'block'; blank(i); blank(i + 1); i += 2; continue }
      if (hash && c === '#') { state = 'line'; blank(i); i += 1; continue }
      if (c === "'") state = 'sq'
      else if (c === '"') state = 'dq'
      else if (js && c === '`') state = 'tpl'
      i += 1; continue
    }
    if (state === 'line') { if (c === '\n') state = 'code'; else blank(i); i += 1; continue }
    if (state === 'block') {
      if (c === '*' && d === '/') { blank(i); blank(i + 1); state = 'code'; i += 2; continue }
      blank(i); i += 1; continue
    }
    // 문자열 — 내용은 그대로 두고(주입 대상이 문자열인 경우가 많다) 이스케이프만 건너뛴다.
    if (c === '\\') { i += 2; continue }
    if ((state === 'sq' && c === "'") || (state === 'dq' && c === '"') || (state === 'tpl' && c === '`')) state = 'code'
    else if (state !== 'tpl' && c === '\n') state = 'code' // 닫히지 않은 따옴표로 파일 전체가 문자열이 되는 것 방지
    i += 1
  }
  return out.join('')
}

const problems = []

// 🧹 잔재 확인 전용 모드 — 주입은 건드리지 않고 "지금 트리에 남아 있나"만 본다(위 VERIFY_CLEAN 주석).
if (VERIFY_CLEAN) {
  const dirty = []
  for (const m of MUTATIONS) {
    const abs = path.join(ROOT, m.file)
    if (!fs.existsSync(abs)) continue // 파일 이동은 전수 모드가 "낡은 지도"로 따로 보고한다
    const s = fs.readFileSync(abs, 'utf8')
    // `find` 가 사라졌는데 `replace` 가 있으면 주입된 상태다. `find` 만 사라졌으면 코드가 옮겨간 것.
    if (!s.includes(m.find) && m.replace && s.includes(m.replace)) dirty.push(`${m.file} — ${m.name}`)
  }
  if (dirty.length) {
    console.error(`\n❌ 주입 잔재 ${dirty.length}건 — **커밋하지 말 것**\n`)
    for (const d of dirty) console.error(`   • ${d}`)
    console.error(`\n   복원: git checkout -- <위 파일들>\n`)
    process.exit(1)
  }
  console.log(`✅ 주입 잔재 0 — 작업트리 깨끗함 (${MUTATIONS.length}건 확인)`)
  process.exit(0)
}

console.log(`🧬 guard-mutations: ${MUTATIONS.length}개 주입 검증 (각각 소스를 잠깐 고쳤다가 되돌린다)\n`)

for (const m of MUTATIONS) {
  if (ONLY && !m.name.includes(ONLY)) continue
  const abs = path.join(ROOT, m.file)
  if (!fs.existsSync(abs)) { problems.push(`${m.name}: 파일 없음 — ${m.file} (코드가 옮겨갔다)`); continue }
  const src = fs.readFileSync(abs, 'utf8')
  // 🔑 세는 것도 고치는 것도 **주석 밖에서만** 한다. 주석을 고쳐 봐야 동작은 안 바뀌므로,
  //   주석에 걸린 주입은 "가드가 헛돈다"가 아니라 "지도가 낡았다"로 보고해야 맞다.
  const masked = maskComments(src, m.file)
  // 판정은 **매치가 코드에서 시작하는가**로 한다. 문자열 전체를 마스킹된 사본에서 찾으면,
  // 뒤쪽 주석을 앵커로 포함한 주입(`… : S2_REGIONS // 아무…`)을 거짓으로 "주석뿐"이라 부른다
  // — 실제로 그렇게 두 건을 오탐했다. 시작 위치만 보면 둘 다 정확히 갈린다.
  const inComment = (i) => masked[i] === ' ' && src[i] !== ' '
  const hits = []
  for (let i = src.indexOf(m.find); i !== -1; i = src.indexOf(m.find, i + 1)) hits.push(i)
  const live = hits.filter((i) => !inComment(i))
  const rawCount = hits.length
  const count = live.length
  if (count === 0) {
    problems.push(
      rawCount > 0
        ? `${m.name}: 주입 대상이 **주석에만** 있다 — ${m.file} 의 \`${m.find.slice(0, 50)}…\` (낡은 지도: 코드에서 사라졌고 설명만 남았다)`
        : `${m.name}: 주입 대상을 못 찾음 — ${m.file} 의 \`${m.find.slice(0, 50)}…\` (낡은 지도)`,
    )
    continue
  }
  if (count > 1) { problems.push(`${m.name}: 주입 대상이 ${count}곳 — 유일해야 한다(엉뚱한 곳을 고칠 수 있다)`); continue }
  // 주석에도 같은 문자열이 있을 수 있으므로 **코드 쪽 인덱스로** 바꾼다
  // (`String.replace` 는 첫 등장을 바꾸는데, 그게 주석일 수 있다).
  const at = live[0]

  pending.set(abs, src)
  let stillGreen
  try {
    fs.writeFileSync(abs, src.slice(0, at) + m.replace + src.slice(at + m.find.length))
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
