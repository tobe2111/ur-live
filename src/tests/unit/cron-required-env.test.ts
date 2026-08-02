import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

import {
  CRON_REQUIRED_ENV,
  missingEnvFor,
  formatMissingEnv,
  envBeatFor,
  whitespaceVariantOf,
  ENV_ALL_PRESENT,
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

/**
 * 🔁 2026-08-02 — **상태 지시등은 침묵으로 '정상'을 말할 수 없다.**
 *
 * 처음엔 빠진 키가 있을 때만 기록했다. 그랬더니 키가 채워져도 **옛 행이 그대로 남아** 화면에는
 * 여전히 "없음"으로 보였다(실측: 22:50 행이 23:00 회차 뒤에도 남음 — 이미 해결된 키를 미해결로
 * 읽을 뻔했고, 발화 시각과 행 시각을 대조해서야 알았다).
 *
 * 침묵은 **'정상'과 '관측 자체가 멈춤'을 구분하지 못한다.** 이 세션이 하루 종일 쫓은 바로 그
 * 실패 양식을, 그걸 잡으려고 만든 도구가 스스로 저질렀다.
 */
describe('빠진 키가 없을 때도 판정을 남긴다', () => {
  const SRC = readFileSync(resolve(__dirname, '../../worker/scheduled.ts'), 'utf-8')
  // `*/5` 가 요구하는 키 전부 — 하나라도 빠지면 아래 '정상' 케이스가 정상이 아니게 된다.
  const ALL_PRESENT_ENV = Object.fromEntries(
    (CRON_REQUIRED_ENV['*/5 * * * *'] ?? []).map((r) => [r.key, 'x']),
  )

  /**
   * 🔁 2026-08-02 — 원래 이 두 검사는 `scheduled.ts` **소스를 정규식으로** 훑었다.
   * 분기를 `envBeatFor` 로 옮기면서 **행동 검사로 바꿨다** — 소스 정규식은 코드가 한 줄만
   * 움직여도 조용히 헛돌고(이 레포가 반복해 당한 클래스), 지키려는 건 문장 모양이 아니라
   * "정상일 때도 한 줄을 남기는가"라는 **동작**이기 때문이다.
   */
  it('요구사항이 있는 cron 은 빠진 키가 0이어도 값을 돌려준다 (침묵 금지)', () => {
    // `if (missing.length > 0)` 로 되돌아가면 여기서 null 이 나오고 옛 행이 다시 거짓말을 시작한다.
    expect(ALL_PRESENT_ENV.TOSS_SECRET_KEY, '픽스처가 비었다 — 통과가 아니라 실패').toBeDefined()
    expect(envBeatFor('*/5 * * * *', ALL_PRESENT_ENV)).toBe(ENV_ALL_PRESENT)
  })

  it('빠진 키가 있으면 그 이름을 돌려준다', () => {
    expect(envBeatFor('*/5 * * * *', { ...ALL_PRESENT_ENV, TOSS_SECRET_KEY: '' })).toContain(
      'TOSS_SECRET_KEY',
    )
  })

  it('요구사항이 없는 cron 은 null (정상 시 write 0)', () => {
    expect(envBeatFor('0 3 * * *', {})).toBeNull()
  })

  it('정상일 때 남기는 값이 비어 있지 않다', () => {
    // 빈 문자열이면 summarizeResult 가 null 로 만들어 결국 행이 안 남는다(같은 사고 재발).
    expect(ENV_ALL_PRESENT.trim().length).toBeGreaterThan(3)
  })

  it('scheduled.ts 가 그 판정을 실제로 배선한다 (헬퍼만 있고 호출부가 없으면 무의미)', () => {
    expect(SRC).toContain('envBeatFor')
    expect(SRC).toMatch(/safeCron\(\s*['"]cron-env-missing['"]/)
  })
})

/**
 * 🫥 2026-08-02 — **공백 낀 바인딩 이름**. 이 클래스는 화면으로 못 찾는다.
 *
 * 실측: Workers 에 `' ALIGO_USER_ID'` 로 등록돼 런타임에선 undefined 였고, 3종 AND 가드가
 * 조용히 거짓이 되어 **알림톡 0건이 정상처럼** 보였다. "없다"와 "이름이 틀렸다"는 조치가
 * 다르다(등록하라 ↔ 공백을 지워라). 판정이 그 차이를 말해 줘야 한다.
 */
describe('공백 낀 이름 지목', () => {
  it('비슷한 이름이 있으면 그것을 지목한다', () => {
    const env = { TOSS_SECRET_KEY: 'x', ' ALIGO_USER_ID': 'x', ALIGO_API_KEY: 'x', ALIGO_SENDER_KEY: 'x', CACHE_KV: {} }
    const out = envBeatFor('*/5 * * * *', env)
    expect(out).toContain('ALIGO_USER_ID')
    expect(out, '공백 낀 실제 이름을 따옴표로 보여야 한다').toContain("' ALIGO_USER_ID'")
    expect(out).toContain('재등록')
  })

  it('그냥 없을 때는 평소 형식(작업 목록)을 쓴다', () => {
    const env = { TOSS_SECRET_KEY: 'x', ALIGO_API_KEY: 'x', ALIGO_SENDER_KEY: 'x', CACHE_KV: {} }
    const out = envBeatFor('*/5 * * * *', env) || ''
    expect(out).toContain('ALIGO_USER_ID')
    expect(out).toContain('retry-alimtalk')
    expect(out).not.toContain('이름공백')
  })

  it('whitespaceVariantOf 는 정확히 트림 일치만 본다', () => {
    expect(whitespaceVariantOf('A', { ' A': 1 })).toBe(' A')
    expect(whitespaceVariantOf('A', { 'A ': 1 })).toBe('A ')
    expect(whitespaceVariantOf('A', { A: 1 })).toBeNull()   // 정상 등록은 변종이 아니다
    expect(whitespaceVariantOf('A', { AB: 1 })).toBeNull()
  })
})
