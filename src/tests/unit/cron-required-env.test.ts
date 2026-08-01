import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

import {
  CRON_REQUIRED_ENV,
  missingEnvFor,
  formatMissingEnv,
} from '../../worker/utils/cron-required-env'
import { EXPECTED_CRON_EXPRESSIONS } from '../../worker/utils/cron-expected'

/**
 * 🔑 "돌긴 도는데 못 하는 일" 명부가 낡지 않게 한다 〔2026-08-01〕
 *
 * 이 명부는 **사람이 손으로 적은 매핑**이라 코드가 움직이면 조용히 거짓이 된다. 그리고 거짓이 된
 * 명부는 없는 것보다 나쁘다 — `cron-env-missing` 이 안 뜨는 것을 "괜찮다"로 읽게 만들기 때문이다.
 * 그래서 두 방향을 다 고정한다: **키가 실제로 그 파일에서 읽히는가**, **cron 식이 실재하는가**.
 *
 * ⚠️ 이 테스트가 **못** 잡는 것:
 *   - 키를 읽는 새 cron 작업이 생겼는데 명부에 안 넣은 경우. 파일 전수 스캔으로는 "읽는다"와
 *     "없으면 조용히 스킵한다"를 구분할 수 없어(로그를 남기고 죽는 코드도 있다) **자동 확장은 안 한다.**
 *     블록을 점화하거나 작업을 추가할 때 사람이 넣는다.
 *   - 키가 *있는데 값이 틀린* 경우. 존재만 본다.
 */

const CRON_DIR = resolve(__dirname, '../../worker/cron')

describe('cron 요구 env 명부', () => {
  it('명부가 비어 있지 않다 (가드가 헛돌지 않는지)', () => {
    // 측정 대상 0은 통과가 아니라 실패다 — 명부가 통째로 사라져도 초록불이면 아무 의미가 없다.
    const total = Object.values(CRON_REQUIRED_ENV).flat().length
    expect(total).toBeGreaterThan(3)
  })

  it('명부의 cron 식은 전부 실재한다', () => {
    // 유령 식이 있으면 그 요구사항은 영원히 평가되지 않는다(조용한 사각지대).
    const ghosts = Object.keys(CRON_REQUIRED_ENV).filter(
      (c) => !EXPECTED_CRON_EXPRESSIONS.includes(c),
    )
    expect(ghosts, `기대 목록에 없는 cron 식: ${ghosts.join(', ')}`).toEqual([])
  })

  it('명부가 지목한 작업 파일이 실제로 그 키를 읽는다', () => {
    const wrong: string[] = []
    for (const [cron, reqs] of Object.entries(CRON_REQUIRED_ENV)) {
      for (const r of reqs) {
        for (const job of r.jobs) {
          const path = resolve(CRON_DIR, `${job}.ts`)
          if (!existsSync(path)) {
            wrong.push(`${cron} → ${job}.ts 없음`)
            continue
          }
          // 캐스팅(`(env as { X?: string }).X`)·구조분해 등 읽는 형태가 여러 가지라
          // 키 이름 자체의 등장으로 본다. 좁게 잡으면 실제 참조를 놓친다.
          if (!readFileSync(path, 'utf-8').includes(r.key)) {
            wrong.push(`${cron} → ${job}.ts 가 ${r.key} 를 안 읽는다`)
          }
        }
      }
    }
    expect(wrong, wrong.join(' / ')).toEqual([])
  })

  it('"없으면 무슨 일이 벌어지나"가 비어 있지 않다', () => {
    // 이 문장이 없으면 명부는 키 목록일 뿐이고, 읽는 사람이 심각도를 판단할 수 없다.
    for (const reqs of Object.values(CRON_REQUIRED_ENV)) {
      for (const r of reqs) expect(r.silently.length).toBeGreaterThan(10)
    }
  })
})

describe('missingEnvFor', () => {
  it('없는 키와 빈 문자열을 둘 다 부재로 본다', () => {
    // 대시보드에서 빈 값으로 저장한 경우가 미설정과 똑같은 결과를 낸다 — 같게 취급해야 한다.
    const missing = missingEnvFor('0 19 * * *', { TOSS_SECRET_KEY: '   ' })
    expect(missing.map((m) => m.key)).toEqual(['TOSS_SECRET_KEY'])
    expect(missingEnvFor('0 19 * * *', {}).map((m) => m.key)).toEqual(['TOSS_SECRET_KEY'])
  })

  it('키가 있으면 아무것도 보고하지 않는다 (정상 시 write 0)', () => {
    expect(missingEnvFor('0 19 * * *', { TOSS_SECRET_KEY: 'live_sk_x' })).toEqual([])
  })

  it('명부에 없는 cron 은 조용히 통과한다', () => {
    expect(missingEnvFor('0 3 * * *', {})).toEqual([])
  })

  it('요약이 키와 작업을 같이 남긴다', () => {
    const s = formatMissingEnv(missingEnvFor('0 19 * * *', {}))
    expect(s).toContain('TOSS_SECRET_KEY')
    expect(s).toContain('reconciliation')
  })
})
