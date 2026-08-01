import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

import { HANDLED_CRONS } from '../../worker/scheduled'

/**
 * 🔇 cron 선언과 실제 분기의 불일치 — "등록했는데 아무 일도 안 일어난다" (2026-07-29 실행 증거 감사)
 *
 * 실제 사고 두 가지가 같은 뿌리였다:
 *
 *   1) `wrangler.toml` 에 9개를 선언해 두고 CF 에는 **3개만** 등록돼 있었다. 스케줄 PUT 이
 *      `0 20 * * 0`(CF 의 day-of-week 는 1-7/MON-SUN — 0 은 범위 밖) 때문에 **원자적으로 전부 거부**됐는데
 *      worker-deploy 가 그 실패를 삼키고 성공으로 보고했다. 배포는 몇 달간 초록불이었다.
 *
 *   2) 그 표기를 `0 20 * * SUN` 으로 고쳐 등록하면 이번엔 디스패처의 `cron === '0 20 * * 0'` 이
 *      매칭 실패한다 — CF 는 **등록된 문자열 그대로** event.cron 에 넣기 때문이다. 등록도 됐고 발화도
 *      하는데 아무 핸들러도 안 도는, 실패보다 더 안 보이는 상태.
 *
 * 이 레포가 반복해 만난 클래스는 "검사가 실패한다"가 아니라 **"검사가 아예 안 돈다"** 이고,
 * cron 은 그 중에서도 제일 조용하다 — 아무도 안 아프기 때문에 제일 오래 안 들킨다.
 *
 * ⚠️ 이 검사가 **못 잡는 것**(과신 금지):
 *   - **CF 에 실제로 등록된 목록.** 그건 레포 밖(대시보드/API)이라 여기서 볼 수 없다. 이 테스트는
 *     `wrangler.toml`(선언) ↔ `scheduled.ts`(분기) 사이의 정합만 본다. 선언과 현실의 차이는
 *     런타임의 `cron-unmatched` 하트비트와 worker-deploy 의 스케줄 PUT 결과가 판정한다.
 *   - 분기 안에서 핸들러가 게이트 OFF 로 조기 return 하는 경우. 그건 하트비트 `result` 가 본다.
 *   - `wrangler-ads.toml`(별도 ur-ads 워커)의 트리거. 다른 스크립트다.
 */

const SCHEDULED = resolve(__dirname, '../../worker/scheduled.ts')
const WRANGLER = resolve(__dirname, '../../../wrangler.toml')

/** 소스에서 `cron === '...'` 리터럴을 전부 뽑는다. 주석은 먼저 제거한다(설명문 안의 예시가 섞이면 오탐). */
function branchCrons(): string[] {
  const src = readFileSync(SCHEDULED, 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
  const out = new Set<string>()
  for (const m of src.matchAll(/cron\s*===\s*'([^']+)'/g)) out.add(m[1])
  return [...out]
}

/** wrangler.toml 의 `crons = [...]` 를 파싱한다(주석 줄은 TOML 이 무시하므로 자연히 제외된다). */
function declaredCrons(): string[] {
  const toml = readFileSync(WRANGLER, 'utf-8')
  const line = toml.split('\n').find((l) => /^\s*crons\s*=/.test(l))
  if (!line) return []
  return [...line.matchAll(/'([^']+)'|"([^"]+)"/g)].map((m) => m[1] ?? m[2])
}

describe('cron 디스패처 정합', () => {
  // 측정 대상이 0이면 "통과"가 아니라 "실패"다 — 정규식이 소스 변화에 밀려 아무것도 못 읽고
  // 조용히 초록불이 되는 것이 이 레포에서 실제로 났던 가드 고장 방식이다.
  it('측정 대상이 0이 아니다 (가드가 헛돌지 않는지)', () => {
    expect(branchCrons().length).toBeGreaterThan(5)
    expect(declaredCrons().length).toBeGreaterThan(0)
  })

  it('HANDLED_CRONS 가 소스의 분기 목록과 정확히 일치한다', () => {
    // 넓히기만 하면 침묵을 다시 못 보고, 좁히면 정상 발화가 unmatched 로 오탐된다. 양방향으로 고정.
    expect([...HANDLED_CRONS].sort()).toEqual(branchCrons().sort())
  })

  it('선언한 트리거는 전부 처리하는 분기가 있다', () => {
    // 이걸 어기면 CF 는 정상 발화시키는데 우리 쪽에서 아무 일도 안 일어난다(사고 2번).
    const orphan = declaredCrons().filter((c) => !HANDLED_CRONS.has(c))
    expect(orphan, `선언했지만 핸들러가 없는 트리거: ${orphan.join(', ')}`).toEqual([])
  })

  it('CF 가 거부하는 day-of-week 표기를 선언하지 않는다', () => {
    // CF cron 의 day-of-week 는 1-7 또는 MON-SUN. `0`(일요일 의미로 흔히 쓰는 표기)은 범위 밖이라
    // **배열 전체**가 거부된다 — 한 줄이 나머지 전부를 막는 것이 사고 1번의 메커니즘이다.
    const bad = declaredCrons().filter((c) => {
      const dow = c.trim().split(/\s+/)[4]
      return dow !== undefined && /^0$/.test(dow)
    })
    expect(bad, `day-of-week 에 0 을 쓴 트리거(CF 거부 → 스케줄 전체 미반영): ${bad.join(', ')}`).toEqual([])
  })
})
