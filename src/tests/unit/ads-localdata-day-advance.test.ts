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
    // 🔁 2026-10-24 재조준: 종전 앵커는 `{ stoppedAt = ei; break }`(= **그 날 전체** 중단)였다.
    //   중단 범위를 '그 날' → '그 업종'(`epErr`)으로 좁혔으므로 앵커를 옮긴다. **지키려는 불변식은
    //   그대로다** — 에러를 "그날 변동 없음"으로 보지 않는다. 범위만 좁아졌다(그 날은 여전히 미완).
    const guards = SRC.match(/if \(msg && !count\) \{ epErr = true; break \}/g) || []
    expect(guards.length, '일일 레인과 백필 레인 각 1개씩 있어야 한다').toBe(2)
    // 그리고 에러로 끝난 업종은 **그 날을 미완으로** 만든다(= 커서가 그 날을 넘어가지 않는다).
    expect((SRC.match(/if \(firstFail == null\) firstFail = ei/g) || []).length, '두 레인 모두').toBe(2)
  })

  it('🔒 순서가 중요하다 — 에러 판정이 `!count` 조기 종료보다 **먼저** 와야 한다', () => {
    // `if (!count) break` 가 먼저면 에러 분기에 영영 도달하지 못한다(조용히 원래 버그로 복귀).
    const pairs = [...SRC.matchAll(/if \(msg && !count\)[\s\S]{0,200}?if \(!count\) break/g)]
    expect(pairs.length, '두 레인 모두 [에러 판정 → !count] 순서여야 한다').toBe(2)
    for (const m of pairs) expect(m[0]).toContain('epErr = true')
  })

  it('🔒 한 업종의 실패가 그 날의 나머지 업종을 끊지 않는다 — 날 중단은 **예산/전역장애**만', () => {
    // 🩸 2026-10-24 라이브: `pending` 14일이 전부 `idx: 0` 이었다(첫 업종을 한 번도 못 넘겼다).
    //   `msg && !count` 에서 바로 `stoppedAt` 을 세우면 그 자리로 되돌아간다.
    expect(SRC).not.toMatch(/if \(msg && !count\) \{ stoppedAt = ei/)
    // 전역 장애 안전판 — 연속 실패가 상한에 닿을 때만 그 날을 끊고, 커서는 **첫 실패 업종**에 둔다
    //   (`ei` 에 두면 그 앞의 실패분이 그 날 영영 건너뛰어진다 — 날짜 커서는 한 방향이다).
    const cut = SRC.match(/\+\+consecFail >= MAX_CONSEC_UPJONG_FAILS\) \{ stoppedAt = firstFail; break \}/g) || []
    expect(cut.length, '두 레인 모두 전역장애 상한을 갖는다').toBe(2)
  })

  it('🔒 못 끝낸 날은 큐 꼬리로 돌린다 — 한 날이 모든 회차를 독식하지 않게', () => {
    // 손도 못 댄 날(`leftover`)과 손댔는데 못 끝낸 날(`retried`)을 구분해 저장 순서를 만든다.
    expect(SRC).toContain('const retried: PendingDay[] = []')
    expect(SRC).toMatch(/retried\.push\(\{ day: item\.day, idx: stoppedAt \}\)/)
    expect(SRC).toMatch(/retried\.push\(\{ day: item\.day, idx: firstFail \}\)/)
    // 상한 자르기는 순수 모듈이 담당(순서 = 회전 상태) — 여기서 `slice(-N)` 으로 되돌리면 안 된다.
    expect(SRC).toContain('rotatePending(leftover, retried)')
    expect(SRC, '회전을 되돌리는 옛 자르기 복귀 금지').not.toMatch(/leftover\.slice\(-MAX_PENDING_DAYS\)/)
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
