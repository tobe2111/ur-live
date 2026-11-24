import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

import { interpretTossLookupCode } from '../../worker/utils/toss-access-probe'
import { getTossErrorInfo } from '../../worker/utils/toss-error-messages'
import { interpretTossKeyProbe, TOSS_ACCESS_DENIED_CODE, TOSS_KEY_PROBE_ID } from '../../worker/cron/daily-self-diagnostic'

/**
 * 🔑 "키가 있다" ≠ "키가 맞다" — 토스 키 유효성 프로브 〔2026-08-02 신설〕
 *
 * ## 왜
 * cron 캐리어(Workers)에 `TOSS_SECRET_KEY` 를 새로 넣었는데, **그게 맞는 값인지 확인할 방법이
 * 없었다.** 그 키를 실제로 쓰는 작업은 전부 *대상이 생겨야* 돈다:
 *   - `auto-settlement` → 만료 바우처가 있어야 (다음 대상 8/22)
 *   - `reconciliation` → 1시간 넘게 PENDING 인 주문이 있어야 (실측 0건)
 *   - `scheduled-cleanup` → 만료 선물이 있어야
 * ⇒ 최악의 경우 **첫 실전 환불에서야** 키가 틀렸다는 걸 알게 된다. 고객 돈이 걸린 자리다.
 *
 * 그래서 없는 결제키로 조회 1회를 보내 **인증만** 검증한다. 상태코드가 갈라준다:
 *   401 = 인증 거부(키 불량) / 404 = 인증 통과(데이터만 없음).
 *
 * ## ⚠️ 이 프로브가 증명하지 **않는** 것 (과신 금지)
 * - **그 키로 환불이 성공하는지.** 결제를 취소하려면 그 결제를 만든 키와 같아야 하는데,
 *   Pages 와 Workers 에 서로 다른 키가 들어가 있어도 둘 다 401 은 아니다. 그 불일치는
 *   **실제 취소 시도에서만** 드러난다.
 * - 권한 범위(테스트/라이브 구분). 인증 성공까지다.
 */

describe('interpretTossKeyProbe — 인증 실패와 데이터 없음을 가른다', () => {
  it('401 은 키 불량 — 이슈로 올린다', () => {
    const r = interpretTossKeyProbe(401)
    expect(r.verdict).toBe('invalid')
    expect(r.message).toContain('401')
  })

  it('404 는 키 정상 — 인증은 통과했고 대상만 없다', () => {
    // 이 구분이 이 프로브의 전부다. 404 를 실패로 읽으면 정상 키를 매일 🔴 로 신고하게 된다.
    expect(interpretTossKeyProbe(404).verdict).toBe('valid')
  })

  it('그 외 상태는 판정 불가 — 키 문제로 단정하지 않는다', () => {
    // 토스 5xx·429 를 '키 불량'으로 읽으면, 토스가 잠깐 아픈 날 우리가 키를 갈아엎게 된다.
    for (const s of [200, 429, 500, 502, 503]) {
      expect(interpretTossKeyProbe(s).verdict, `status=${s}`).toBe('unknown')
    }
  })

  it('API_KEY_ACCESS_DENIED 는 IP 차단 — 이슈로 올리고 막힌 IP 를 남긴다', () => {
    // 2026-11-24: 토스가 등록된 IP·국가 밖 호출을 막기 시작했다. 종전엔 403 이 '판정 불가' 로
    //   조용히 넘어가서, 결제 승인이 전부 막혀도 알림이 안 왔다.
    const r = interpretTossKeyProbe(403, {
      code: TOSS_ACCESS_DENIED_CODE,
      message: 'API 키 접근 정책에 의해 허용되지 않은 요청입니다. 요청 IP: 123.45.0.1',
    })
    expect(r.verdict).toBe('blocked')
    expect(r.message).toContain('123.45.0.1')
  })

  it('코드 없는 403 은 IP 차단으로 단정하지 않는다', () => {
    // 403 은 다른 뜻(FORBIDDEN_REQUEST 등)도 있다 — 상태코드가 아니라 응답 코드로 가른다.
    expect(interpretTossKeyProbe(403).verdict).toBe('unknown')
    expect(interpretTossKeyProbe(403, { code: 'FORBIDDEN_REQUEST' }).verdict).toBe('unknown')
    expect(interpretTossKeyProbe(403, null).verdict).toBe('unknown')
  })

  it('판정 불가 메시지에 상태코드가 남는다 (다음 조사를 위해)', () => {
    expect(interpretTossKeyProbe(503).message).toContain('503')
  })
})

describe('프로브 대상은 실제로 없는 결제여야 한다', () => {
  it('센티널이 명백히 조회용이고 URL 안전하다', () => {
    // 실재하는 결제키를 쓰면 조회가 200 을 반환해 '판정 불가'로 빠진다(그리고 남의 결제를 들여다본다).
    expect(TOSS_KEY_PROBE_ID).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(TOSS_KEY_PROBE_ID).toContain('probe')
  })
})

describe('진단이 조용히 사라지지 않는다', () => {
  const SRC = readFileSync(
    resolve(__dirname, '../../worker/cron/daily-self-diagnostic.ts'),
    'utf-8',
  )

  it('결과를 반환한다 — webhook 이 없어도 하트비트에 남게', () => {
    // 예전엔 DISCORD_WEBHOOK_URL 이 없으면 `return;` 으로 끝나 진단 결과가 통째로 사라졌다.
    // console.warn 은 Observability 가 꺼져 있어 아무도 못 본다.
    expect(SRC).toContain('return summary')
    expect(SRC).not.toMatch(/not configured[^]*?\n\s*return;/)
  })

  it('거짓 🔴 를 낼 키를 요구하지 않는다 (하드코딩 목록 폐지)', () => {
    // 2026-07-28 에 Firebase 인증 수용을 제거했다. 목록에 남아 있으면 매일 거짓 🔴 가 나가고,
    // 알림 채널을 켜는 순간 늑대소년이 된다.
    //
    // 🔄 2026-08-02: **하드코딩 목록(`requiredSecrets`) 자체를 없앴다.** 남아 있던 세 키
    //   (`JWT_SECRET`·`REFRESH_TOKEN_SECRET`·`KAKAO_REST_API_KEY`)가 **같은 병**이었기 때문이다 —
    //   전부 Pages 에만 있고 cron 캐리어엔 없는 게 정상인데 매일 🔴 로 나가고 있었다.
    //   이제 `CRON_REQUIRED_ENV`(등록된 cron 블록만 담는 SSOT)에서 파생한다 ⇒ 드리프트가 구조적으로 0.
    //
    //   ⚠️ 이 테스트가 **바로 그 변경을 잡아냈다**(아래 "0이면 실패" 조항 덕분). 규율이 실제로
    //      동작한 사례라 조항을 지우지 말고 **새 메커니즘으로 옮겨서** 유지한다.
    expect(SRC).not.toMatch(/const requiredSecrets = \[/)   // 하드코딩으로 되돌아가지 말 것
    expect(SRC).toContain('CRON_REQUIRED_ENV')
    const derived = SRC.match(/const carrierKeys = \[([\s\S]{0,300}?)\]/)?.[1] ?? ''
    expect(derived.length).toBeGreaterThan(10)              // 측정 대상 0이면 통과가 아니라 실패

    // ⚠️ **주석을 걷어내고 본다.** 위 설명문이 바로 그 키 이름들을 인용하고 있어서, 원문을 그대로
    //    검사하면 *사고를 설명한 문장 때문에* 빨간불이 뜬다(2026-08-02 에 실제로 그랬다 —
    //    같은 날 `check-sql-column-exists` 도 똑같이 물려 `blankComments()` 를 넣었다).
    const EXEC = SRC.replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n')
    for (const dead of ['FIREBASE_PRIVATE_KEY', 'JWT_SECRET', 'REFRESH_TOKEN_SECRET']) {
      expect(EXEC, `${dead} 는 이 캐리어에 없는 게 정상 — 매일 거짓 🔴 가 된다`)
        .not.toMatch(new RegExp(`\\b${dead}\\b`))
    }
  })

  it('키 값을 로그로 흘리지 않는다', () => {
    // 진단이 키를 찍으면 그 자체가 유출 경로다.
    expect(SRC).not.toMatch(/console\.(log|warn|error)\([^)]*tossKey/)
  })
})

describe('API_KEY_ACCESS_DENIED — 손님에게 나가는 안내', () => {
  it('에러 안내표에 있고 가맹점 설정 문제로 분류된다', () => {
    // 표에 없으면 손님에게 토스 원문("…요청 IP: x.x.x.x")이나 일반 오류가 나간다.
    const info = getTossErrorInfo('API_KEY_ACCESS_DENIED')
    expect(info?.category).toBe('merchant_config')
    expect(info?.message).not.toMatch(/IP/)
  })
})

describe('토스 접근 점검(어드민) — 거점별 실측', () => {
  it('없는 결제 = 통과 · 접근 정책 거부 = 차단 · 그 외는 단정하지 않는다', () => {
    expect(interpretTossLookupCode('NOT_FOUND_PAYMENT')).toBe('valid')
    expect(interpretTossLookupCode('API_KEY_ACCESS_DENIED')).toBe('blocked')
    expect(interpretTossLookupCode('UNAUTHORIZED_KEY')).toBe('invalid')
    for (const c of ['NETWORK', 'HTTP_503', 'FORBIDDEN_REQUEST', undefined]) {
      expect(interpretTossLookupCode(c), String(c)).toBe('unknown')
    }
  })

  it('라우트가 SSOT 헬퍼로 조회하고 거점 이름을 함께 돌려준다', () => {
    // 거점 이름이 없으면 "어디서 통과했는지" 를 모르는 판정이 된다 — 이 점검의 전부가 그것이다.
    const src = readFileSync('src/features/admin/api/admin-system-monitoring.routes.ts', 'utf8')
    const body = src.slice(src.indexOf("get('/toss-access-probe'"), src.indexOf("get('/ops-status'"))
    expect(body).toContain('getTossPayment(')
    expect(body).toContain('colo: cf?.colo')
    expect(body).not.toContain('api.tosspayments.com')
  })
})
