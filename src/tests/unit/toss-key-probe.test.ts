import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

import { interpretTossKeyProbe, TOSS_KEY_PROBE_ID } from '../../worker/cron/daily-self-diagnostic'

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

  it('폐기된 FIREBASE_PRIVATE_KEY 를 요구하지 않는다', () => {
    // 2026-07-28 에 Firebase 인증 수용을 제거했다. 목록에 남아 있으면 매일 거짓 🔴 가 나가고,
    // 알림 채널을 켜는 순간 늑대소년이 된다.
    const required = SRC.match(/const requiredSecrets = \[([^\]]*)\]/s)?.[1] ?? ''
    expect(required.length).toBeGreaterThan(10)          // 측정 대상 0이면 통과가 아니라 실패
    expect(required).not.toContain('FIREBASE_PRIVATE_KEY')
  })

  it('키 값을 로그로 흘리지 않는다', () => {
    // 진단이 키를 찍으면 그 자체가 유출 경로다.
    expect(SRC).not.toMatch(/console\.(log|warn|error)\([^)]*tossKey/)
  })
})
