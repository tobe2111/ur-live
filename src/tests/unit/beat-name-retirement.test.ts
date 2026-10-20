/**
 * 🪦 **하트비트 이름을 조용히 없애면 영원한 빨간불이 된다** — 커밋 시점에 잡는다 (2026-08-25 신설)
 *
 * ## 왜 (하루에 두 번 났다)
 *
 * 하트비트 행(`cron_hb:{name}`)은 **코드보다 오래 산다.** 코드가 어떤 이름을 그만 쓰면 그 행은
 * 아무도 갱신하지 않고 영원히 `stale` 이다. 그리고 이 레포에서는 **영원한 빨간불 하나가
 * 경보 채널 전체를 침묵시킨다** — `uptime.yml` 이 `down && open` 이면 아무것도 안 했기 때문이다:
 *
 * ```
 *   d1-backup  08-02 사망 → 이름만 남음 → 헬스체크 21일째 503
 *              → 이슈 #1056 이 08-04 부터 무갱신
 *              → 그 사이 08-24 일간 16개(정산 성숙·원장 정합) 누락이 **신호 0**
 *   __tick     #1210 이 전역 틱을 트리거별로 쪼갬 → 배포 40분 뒤 새 빨간불
 *              (…`d1-backup` 을 걷어내는 바로 그 작업이 같은 함정을 다시 팠다)
 * ```
 *
 * 둘 다 **배포 후에** 사람이 라이브를 봐서 알았다. 커밋 시점에 알 수 있는 사실인데도.
 *
 * ## ⚠️ 이 시험이 못 막는 것
 *
 * - 스크립트 본체는 `origin/main` 이 있어야 돌아서 여기서 통째로는 못 돌린다. **판정 본체(순수)**
 *   와 이름 추출만 검사한다. 배선(가드가 실제로 등록돼 도는가)은 `check-guard-registry` 몫이다.
 * - **리터럴 이름만** 본다. `` `__tick:${cron}` `` 같은 템플릿이 만드는 이름은 열거할 수 없다.
 */
import { describe, it, expect } from 'vitest'
// @ts-expect-error — 가드 스크립트(.mjs)에는 타입 선언이 없다. 판정 본체만 가져온다.
import { beatNames, findOrphans } from '../../../scripts/check-beat-name-retirement.mjs'

describe('🪦 사라진 하트비트 이름 판정', () => {
  it('🔴 지도에 없는 이름은 고아로 잡는다', () => {
    expect(findOrphans(['d1-backup'], new Set(), '')).toEqual(['d1-backup'])
  })

  it('🔴 개명 지도에 있으면 통과 — 후임이 이어받은 것이다', () => {
    expect(findOrphans(['d1-backup'], new Set(['d1-backup']), '')).toEqual([])
  })

  it('🔴 명시 예외 주석(beat-retire-ok)도 통과 — 정말 후임이 없는 경우', () => {
    expect(findOrphans(['gone-forever'], new Set(), '// beat-retire-ok gone-forever')).toEqual([])
    // 이름이 다르면 면제되지 않는다 — 주석 하나로 전부 열리면 안 된다.
    expect(findOrphans(['gone-forever'], new Set(), '// beat-retire-ok other-name')).toEqual(['gone-forever'])
  })

  it('🔴 오늘의 실제 사례 — __tick 이 쪼개지며 사라진 것을 잡는다', () => {
    const before = `recordCronBeat(env, '__tick', true, 0, cron)`
    const after = 'recordCronBeat(env, `__tick:${cron}`, true, 0, cron)'
    const removed = [...beatNames(before)].filter((n: string) => !beatNames(after).has(n))
    expect(removed).toEqual(['__tick'])
    expect(findOrphans(removed, new Set(), ''), '지도가 비면 고아여야 한다').toEqual(['__tick'])
  })

  it('이름 추출이 네 가지 기록 경로를 모두 본다 (0개면 통과가 아니라 실패)', () => {
    const src = [
      `recordCronBeat(env, 'probe', true, 0, cron)`,
      `safeCron('auto-settlement', () => x())`,
      `slotCron('10 18 * * *')('ledger-reconcile', () => y())`,
      `run('demo-fcfs-renew', () => z())`,
    ].join('\n')
    const got = beatNames(src)
    expect([...got].sort()).toEqual(['auto-settlement', 'demo-fcfs-renew', 'ledger-reconcile', 'probe'])
  })
})
