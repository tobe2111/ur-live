/**
 * 🔇 **돌긴 도는데 못 하는 일** — cron 이 필요로 하는 env 가 그 런타임에 없을 때 (2026-08-01 신설)
 *
 * ## 왜 필요했나 (실측)
 *
 * `ur-live` 라는 이름의 런타임이 **둘**이다. Pages(HTTP 요청 전부, 시크릿 전부)와
 * Workers(cron 전부, **시크릿 0개**). 그런데 `/api/health/env-readiness` 는 HTTP 엔드포인트라
 * **Pages 를 잰다** — 거기 뜬 초록불이 cron 이 그 키를 쓸 수 있다는 뜻이 아니다.
 *
 * 2026-08-01 배포 로그가 cron 캐리어의 바인딩을 확정했다: **DO 2 + D1 1 + 평문 var 2. 그게 전부.**
 * KV 도 R2 도 시크릿도 없다. 그리고 지금 **돌고 있는** 세 블록 안에 이런 것들이 있다:
 *
 * | cron | 작업 | 키가 없으면 |
 * |---|---|---|
 * | `*\/5` | `scheduled-cleanup` | 만료 선물 **자동 환불이 통째로 스킵**(`if (tossSecretKey)`) — 5분마다 조용히 |
 * | `0 19` | `reconciliation` | 막힌 주문이 `stillStuck++; continue` — **영원히 stuck** |
 * | `0 18` | `auto-settlement` | 만료 바우처 **환불 취소 호출 실패** |
 *
 * 셋 다 **머니 경로**이고, 셋 다 **하트비트에는 `ok: true`** 로 남는다. 예외가 안 나기 때문이다.
 * 하트비트는 *"돌았다"* 를 증명하지 *"했다"* 를 증명하지 않는다 — 이 모듈이 그 간극을 메운다.
 *
 * ## 설계
 *
 * 판정을 **런타임에서** 한다. 레포도 배포 로그도 답을 못 준다:
 *   - 레포: `wrangler.toml` 에 시크릿이 없는 게 정상이다(있으면 그게 사고다).
 *   - 배포 로그: 바인딩은 찍지만 **대시보드에서 넣은 시크릿은 안 찍는다.**
 *   ⇒ *그 키가 실제로 있는지*는 그 코드가 도는 자리에서만 알 수 있다.
 *
 * ⚠️ **이 모듈이 못 보는 것**: 키가 *있는데 틀린* 경우(폐기된 토스 키 등). 존재만 본다.
 *   값의 유효성은 그 키를 쓰는 호출의 실패로만 드러난다.
 */

/** 한 cron 블록이 요구하는 env 하나. */
export interface CronEnvRequirement {
  /** env 키 이름. */
  key: string
  /** 이 키를 읽는 cron 작업 파일(확장자 제외) — 테스트가 실제 참조를 검증한다. */
  jobs: string[]
  /** 키가 없을 때 **에러 없이** 벌어지는 일. 이 문장이 이 모듈의 존재 이유다. */
  silently: string
}

/**
 * cron 식 → 그 블록이 요구하는 env.
 *
 * ⚠️ **지금 등록된 블록만** 담는다(`*\/5`·`0 18`·`0 19`). 미등록 블록의 키를 넣으면
 *   "안 도는 것"과 "돌지만 못 하는 것"이 한 목록에 섞여 판정이 흐려진다.
 *   블록을 점화할 때 그 블록의 요구사항을 **같은 PR 에서** 여기 추가할 것.
 */
export const CRON_REQUIRED_ENV: Readonly<Record<string, readonly CronEnvRequirement[]>> = {
  '*/5 * * * *': [
    {
      key: 'TOSS_SECRET_KEY',
      jobs: ['scheduled-cleanup'],
      silently: '만료 선물 자동 환불이 통째로 스킵된다(5분마다).',
    },
    // 📌 2026-08-02: **셋을 다 적는다.** 원래 `ALIGO_API_KEY` 하나만 있었는데, 발송 가드는
    //   `!!(API_KEY && USER_ID && SENDER_KEY)` 라 **하나만 빠져도 통째로 skip** 된다.
    //   실제로 물렸다 — 대표가 셋을 다 등록했는데 Workers 쪽 이름이 `' ALIGO_USER_ID'`(앞 공백)로
    //   들어가 런타임에선 undefined 였다. 그런데 이 명부엔 API_KEY 만 있어서 판정이
    //   **`ok — 요구 키 전부 존재`** 로 나왔다. 알림톡은 여전히 0건인데 계기는 초록이었다.
    //   ⇒ **가드가 보는 조건과 코드가 보는 조건이 같아야 한다.** 하나만 보면 나머지가 사각지대다.
    {
      key: 'ALIGO_API_KEY',
      jobs: ['scheduled-cleanup', 'retry-alimtalk'],
      silently: '알림톡 발송·재시도가 전부 skip — 발송 0건이 정상처럼 보인다.',
    },
    {
      key: 'ALIGO_USER_ID',
      jobs: ['scheduled-cleanup', 'retry-alimtalk'],
      silently: '같은 가드(3종 AND)에 걸려 알림톡이 통째로 skip — API_KEY 만 있으면 소용없다.',
    },
    {
      key: 'ALIGO_SENDER_KEY',
      jobs: ['scheduled-cleanup', 'retry-alimtalk'],
      silently: '같은 가드(3종 AND)에 걸려 알림톡이 통째로 skip.',
    },
    {
      key: 'CACHE_KV',
      jobs: ['cache-prewarm'],
      silently: 'SSR 페이로드 전역 워밍이 한 번도 안 돈다(콜드 콜로 TTFB 그대로).',
    },
  ],
  '0 18 * * *': [
    {
      key: 'TOSS_SECRET_KEY',
      jobs: ['auto-settlement'],
      silently: '만료 바우처 환불의 결제취소 호출이 실패한다 — 고객 돈이 안 돌아간다.',
    },
    {
      key: 'DISCORD_WEBHOOK_URL',
      jobs: ['daily-self-diagnostic', 'auto-settlement', 'ledger-integrity-check'],
      silently: '일일 진단·원장 불일치 경보가 갈 곳이 없다(어드민 벨·DB 에만 남음).',
    },
  ],
  '0 19 * * *': [
    {
      key: 'TOSS_SECRET_KEY',
      jobs: ['reconciliation'],
      silently: '결제 상태가 막힌 주문을 Toss 에 물어보지 못해 영원히 stuck 으로 남는다.',
    },
  ],
}

/**
 * 이 cron 이 요구하는 것 중 **런타임에 실제로 없는** 키.
 *
 * 빈 문자열도 부재로 본다 — 대시보드에서 빈 값으로 저장한 경우가 미설정과 같은 결과를 낸다.
 */
export function missingEnvFor(cron: string, env: Record<string, unknown>): CronEnvRequirement[] {
  const reqs = CRON_REQUIRED_ENV[cron]
  if (!reqs) return []
  return reqs.filter((r) => {
    const v = env?.[r.key]
    if (v == null) return true
    return typeof v === 'string' && v.trim() === ''
  })
}

/**
 * 🫥 **이름에 공백이 낀 채로 등록된 키**를 찾아낸다 — 대시보드에 붙여넣을 때 생긴다.
 *
 * 2026-08-02 실측: Workers `ur-live` 에 `' ALIGO_USER_ID'`(앞 공백)·`'DATA_ENCRYPTION_KEY '`
 * (뒤 공백)로 들어가 있었다. 화면에는 **정상으로 보이고**(공백은 눈에 안 보인다) 대시보드도
 * 아무 경고를 안 준다. 그런데 런타임에선 `env.ALIGO_USER_ID` 가 undefined 라 알림톡 발송
 * 가드(3종 AND)가 조용히 거짓이 되어 **발송 0건이 정상처럼** 보였다.
 *
 * 이 함수는 "없다"를 **"없다 + 비슷한 이름이 있다"** 로 바꿔 준다. 그 차이가 곧 조치의 차이다
 * (등록하라 ↔ 이름의 공백을 지워라). 눈으로 찾으려 하면 다음에도 못 찾는다.
 */
export function whitespaceVariantOf(key: string, env: Record<string, unknown>): string | null {
  for (const k of Object.keys(env ?? {})) {
    if (k !== key && k.trim() === key) return k
  }
  return null
}

/** 하트비트 `result` 에 넣을 한 줄 요약. `env` 를 주면 공백 낀 이름까지 지목한다. */
export function formatMissingEnv(
  missing: readonly CronEnvRequirement[],
  env?: Record<string, unknown>,
): string {
  return missing
    .map((m) => {
      const variant = env ? whitespaceVariantOf(m.key, env) : null
      // 공백은 눈에 안 보이므로 **따옴표로 감싸** 어디에 붙었는지 보이게 한다.
      return variant
        ? `${m.key}(⚠️이름공백 '${variant}' — 지우고 재등록)`
        : `${m.key}(${m.jobs.join(',')})`
    })
    .join(' ')
}

/**
 * 빠진 키가 없을 때 남기는 값.
 *
 * ⚠️ **왜 '아무것도 안 쓰기'가 아닌가** — 처음엔 그렇게 만들었고, 그게 거짓말을 만들었다.
 * 키가 채워져도 옛 행이 그대로 남아 화면에는 여전히 "없음"으로 보였다(2026-08-02 실측:
 * 22:50 행이 23:00 회차 뒤에도 남아 해결된 키를 미해결로 읽을 뻔했다).
 * **상태 지시등은 침묵으로 '정상'을 말할 수 없다** — 침묵은 '정상'과 '관측 자체가 멈춤'을
 * 구분하지 못하기 때문이다. 매 회차 덮어써야 행의 시각이 곧 판정 시각이 된다.
 */
export const ENV_ALL_PRESENT = 'ok — 요구 키 전부 존재'

/**
 * 한 회차에 남길 env 판정 한 줄 — 요구사항이 없는 cron 이면 `null`(호출부가 건너뛴다).
 *
 * 📦 2026-08-02: `scheduled.ts` 에서 옮겨왔다. 그 파일은 68개 작업의 **디스패치 표**라 줄이
 * 늘기만 하고(파일크기 래칫에 세 번 걸렸다), 판정 자체는 이 명부의 일이다. 무엇보다
 * **분기가 여기 있어야 규칙을 소스 정규식이 아니라 행동으로 검사**할 수 있다 —
 * `if (missing.length > 0)` 로 되돌아가는 회귀는 "정상일 때 null 을 돌려준다"로 잡힌다.
 */
export function envBeatFor(cron: string, env: Record<string, unknown>): string | null {
  if (!CRON_REQUIRED_ENV[cron]?.length) return null
  const missing = missingEnvFor(cron, env)
  // ⚠️ 여기서 '빠진 게 없으면 null' 로 바꾸지 말 것 — 그러면 옛 행이 남아 거짓말을 시작한다
  //    (위 ENV_ALL_PRESENT 주석의 실측 사고). 요구사항이 있는 cron 은 **매 회차** 덮어쓴다.
  return missing.length > 0 ? formatMissingEnv(missing, env) : ENV_ALL_PRESENT
}
