/**
 * 🐺 일일 진단이 **자기 캐리어가 안 쓰는 키**로 거짓 경보를 내지 않는다 (2026-08-02)
 *
 * ## 사건
 *
 * 매일 03:00 KST 다이제스트가 이렇게 나가고 있었다:
 *
 * ```
 * 🔴 누락된 Secret: JWT_SECRET, REFRESH_TOKEN_SECRET, KAKAO_REST_API_KEY
 * ```
 *
 * 그런데 라이브 `/api/version` 은 셋 다 **present** 로 답한다. 모순이 아니라 **캐리어가 다르다**:
 *
 * | 런타임 | 담당 | 시크릿 |
 * |---|---|---|
 * | Pages `ur-live`   | HTTP 요청 전부 | 전부 있음 ← 이 셋이 사는 곳 |
 * | Workers `ur-live` | **cron 전부** | 극소수 ← 이 진단이 도는 곳 |
 *
 * 로그인도 카카오도 Pages 에서만 일어난다. cron 캐리어에 그 키가 없는 건 **정상**이다.
 * 그런데 진단이 자기 `env` 에서 그 키를 찾으니 매일 🔴 가 떴다. 진짜 장애가 그 옆에 섞여도
 * 구분이 안 된다 — 늑대소년은 알림을 켜는 순간이 아니라 **이미** 시작돼 있었다.
 *
 * ## 규칙
 *
 * 진단이 검사하는 키는 **`CRON_REQUIRED_ENV` 에 등록된 것뿐**이어야 한다. 그 SSOT 는 스스로
 * "지금 CF 에 등록된 블록만 담는다"고 선언한다 ⇒ *"이 캐리어가 실제로 쓰는 키"* 와 같은 집합이다.
 *
 * ## 이 테스트가 **못 막는 것**
 *
 * - Pages 쪽 키가 진짜로 사라지는 것. 그건 `/api/health/env-readiness`(어드민) 담당이고,
 *   **거기가 잴 수 있는 유일한 자리다.** 여기서 재면 언제나 "없음"이 나온다.
 * - 키가 *있는데 틀린* 경우. 존재만 본다(토스 키만 별도 프로브로 유효성까지 본다).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { CRON_REQUIRED_ENV } from '@/worker/utils/cron-required-env'

const SRC = path.join(process.cwd(), 'src/worker/cron/daily-self-diagnostic.ts')
const CODE = fs.readFileSync(SRC, 'utf8')
const EXEC = CODE
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((l) => !/^\s*(\/\/|\*)/.test(l))
  .join('\n')

/** Pages 에서만 쓰이는 키 — cron 캐리어에 없는 게 정상이라 진단이 물으면 안 된다. */
const PAGES_ONLY = ['JWT_SECRET', 'REFRESH_TOKEN_SECRET', 'KAKAO_REST_API_KEY']

describe('daily-self-diagnostic — 캐리어 스코프', () => {
  it('진단 소스가 존재한다 (경로가 낡으면 통과가 아니라 실패)', () => {
    expect(fs.existsSync(SRC)).toBe(true)
    expect(EXEC.length).toBeGreaterThan(500)
  })

  it('Pages 전용 키를 이 캐리어에서 찾지 않는다', () => {
    for (const key of PAGES_ONLY) {
      expect(EXEC, `${key} 는 Pages 전용 — cron 캐리어엔 없는 게 정상이라 매일 거짓 🔴 가 된다`)
        .not.toMatch(new RegExp(`\\b${key}\\b`))
    }
  })

  it('검사 목록을 하드코딩하지 않고 CRON_REQUIRED_ENV 에서 파생한다', () => {
    // 하드코딩으로 되돌아가면 SSOT 와 드리프트가 다시 시작된다 — 그게 이 사건의 원인이었다.
    expect(EXEC).toMatch(/CRON_REQUIRED_ENV/)
  })

  it('빈 문자열도 부재로 센다', () => {
    // 대시보드에서 빈 값으로 저장한 경우가 미설정과 같은 결과를 낸다(cron-required-env 와 동일 규약).
    expect(EXEC).toMatch(/trim\(\)\s*===\s*''/)
  })
})

describe('CRON_REQUIRED_ENV — 파생 집합의 건전성', () => {
  const keys = [...new Set(Object.values(CRON_REQUIRED_ENV).flatMap((r) => r.map((x) => x.key)))]

  it('빈 집합이 아니다 (0건이면 통과가 아니라 검사가 사라진 것)', () => {
    expect(keys.length).toBeGreaterThan(0)
  })

  it('Pages 전용 키가 섞여 들어오지 않았다', () => {
    for (const k of PAGES_ONLY) expect(keys).not.toContain(k)
  })

  it('머니 경로 키(TOSS_SECRET_KEY)는 반드시 포함된다', () => {
    // 없으면 만료 선물 환불·주문 정합이 조용히 skip 된다 — 하트비트는 ok 로 남는다.
    expect(keys).toContain('TOSS_SECRET_KEY')
  })
})
