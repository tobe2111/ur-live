/**
 * 📅 **인허가 수집: 날짜를 언제 '완료'로 볼 것인가** — 불변식 (2026-07-29 실측 근본수리).
 *
 *   무엇이 잘못돼 있었나: 페이지 결과가 `count === 0` 이면 그 업종을 완료로 보고 **날짜 커서를 전진**했다.
 *   그런데 `count === 0` 에는 두 가지가 섞여 있다 —
 *     ① 그날 그 업종에 **정말 변동이 없었다**(정상)
 *     ② **API 가 에러를 냈다**(현재 라이브: HTTP 500)
 *   ②를 ①로 처리하면 고장난 API 에 백필 창이 통째로 소모된다. 라이브가 정확히 그 상태였다:
 *   `backfill_days:180 · pending_days:0 · **total_saved:0**` — 180일을 걸어가며 한 건도 저장하지 못했다.
 *
 *   ⚠️ 이 클래스가 특히 위험한 이유: **고쳐도 지나간 날짜는 돌아오지 않는다.** 커서는 한 방향으로만 간다.
 *   (이 레포에 이미 있는 규칙 — "도장은 성공을 확인하고 찍는다". 보강 레인은 한도 실패 시 도장을 안 찍는다.)
 *
 *   ⚠️ 이 검사가 못 막는 것: 형태만 본다. 실제 커서 이동은 라이브 `diag`(`pending_days`·`saved`)로 확인한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = readFileSync(resolve(process.cwd(), 'src/features/marketing/api/localdata-collect.ts'), 'utf8')

describe('에러와 "그날 변동 없음"을 구분한다', () => {
  it('🔒 두 레인(일일·백필) 모두 에러를 미완으로 처리한다', () => {
    const guards = SRC.match(/if \(msg && !count\) \{ stoppedAt = ei; break \}/g) || []
    expect(guards.length, '일일 레인과 백필 레인 각 1개씩 있어야 한다').toBe(2)
  })

  it('🔒 순서가 중요하다 — 에러 판정이 `!count` 조기 종료보다 **먼저** 와야 한다', () => {
    // `if (!count) break` 가 먼저면 에러 분기에 영영 도달하지 못한다(조용히 원래 버그로 복귀).
    for (const m of SRC.matchAll(/if \(msg && !count\) \{ stoppedAt = ei; break \}\n\s*(?:\/\/[^\n]*\n\s*)*if \(!count\) break/g)) {
      expect(m[0]).toContain('msg && !count')
    }
    const pairs = [...SRC.matchAll(/if \(msg && !count\)[\s\S]{0,200}?if \(!count\) break/g)]
    expect(pairs.length, '두 레인 모두 [에러 판정 → !count] 순서여야 한다').toBe(2)
  })

  it('🔒 정상적으로 빈 날(에러 메시지 없음)은 여전히 완료 처리된다 — 안 그러면 커서가 영영 안 나간다', () => {
    // `msg` 조건 없이 무조건 미완으로 만들면 변동 없는 날에서 백필이 멈춘다.
    expect(SRC).not.toMatch(/if \(!count\) \{ stoppedAt = ei; break \}/)
    expect((SRC.match(/if \(!count\) break/g) || []).length).toBeGreaterThanOrEqual(2)
  })

  it('검사 대상이 실제로 존재한다 — 0건 통과를 성공으로 오인하지 않게', () => {
    expect(SRC).toContain('runLocalDataBackfill')
    expect(SRC).toContain('BF_CURSOR_KEY')
  })
})
