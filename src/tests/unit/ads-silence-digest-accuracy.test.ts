/**
 * 🔔 **디스코드 침묵 알람이 부정확했다** — 대표 신고 2026-08-11 *"디스코드 알람이 부정확한가봐"*.
 *
 * 라이브에서 온 문장은 이랬다:
 * ```
 *   ⚠️ 유어애즈 레인 2개가 임계를 넘겨 침묵 중입니다.
 *   • ads:collect-maker  — 3.0시간째 침묵 (임계 3시간)
 *   • ads:enrich-company — 3.0시간째 침묵 (임계 3시간)
 * ```
 * 실측으로 **두 가지가 틀렸다**:
 *
 * ### ① 임계를 반올림해서 자기모순이 됐다
 * 실제 임계는 **150분(2.5시간)** 인데 `Math.round(150/60)` = **3** 으로 찍혔다. 그래서 메시지가
 * *"3.0시간째 침묵 (임계 3시간)"* — **넘지도 않은 것처럼** 읽힌다. 경보가 자기 근거를 틀리게
 * 말하면 다음부터 안 읽힌다(이 레포가 반복해 만난 "꺼질 수 없는/믿을 수 없는 경보" 클래스).
 *
 * ### ② 자기와 같은 회차를 못 봤다
 * 이 요약은 `gates.dailyAt(23)` 로 **레인들과 같은 정각 회차**에 돈다(워커의 유일한 트리거가 매시
 * 정각이다). 그런데 하트비트는 **묶어서 나중에 쓴다**(`beat-batch.ts` — 대기 3초 + 레인 실행시간,
 * 실측 최장 26초). 그래서 스냅샷 시점엔 그 회차 실행분이 아직 기록에 없다:
 * ```
 *   23:00:26Z  요약   ads:collect-maker "3.0시간째 침묵"
 *   00:26Z    조회   ads:collect-maker age 87분  → 마지막 실행 23:00Z (= 요약과 같은 회차)
 * ```
 * **레인은 멈춘 적이 없다.** ⇒ 순간값 한 번으로 지속 상태를 단정하지 않는다.
 *
 * ⚠️ **이 테스트가 못 막는 것**: 임계값 자체가 그 레인의 *실제* 주기와 안 맞는 문제
 * (`collect-maker` 는 매시간이라 선언했지만 디스패치 예산에 밀려 실제로는 2~3시간마다 돈다 —
 * `dispatch-budget.ts` 가 그 둘을 이름으로 적어 뒀다). 그건 표시/판정이 아니라 **처리량** 문제라
 * 여기서 고치지 않는다. 다만 ①②를 고치면 그 사실이 메시지에 **정직하게** 드러난다.
 */
import { describe, it, expect } from 'vitest'
import { fmtDur, line, confirmSilent, pickSilentLanes, type SilentLane } from '@/worker-ads/silence-digest'

describe('① 임계 표시 — 반올림이 판정을 뒤집으면 안 된다', () => {
  it('🔒 150분 임계를 "3시간"이라고 하지 않는다 (실제 사고 문구)', () => {
    expect(fmtDur(150)).toBe('2.5시간')
    expect(fmtDur(150)).not.toBe('3시간')
  })

  /**
   * 경과 > 임계 인데 **문자열로도** 그렇게 보여야 한다. 종전 문구는 `3.0시간 vs 3시간` 이라
   * 사람 눈에 "안 넘었다"로 읽혔다 — 숫자가 맞아도 메시지가 틀리면 틀린 경보다.
   */
  it('🔒 경과가 임계보다 크면 문구에서도 커 보인다', () => {
    const l: SilentLane = { name: 'ads:collect-maker', age_min: 180, gap_min: 150, at: null }
    const s = line(l)
    expect(s).toContain('3.0시간째 침묵')
    expect(s).toContain('임계 2.5시간')
    expect(s).not.toContain('임계 3시간')
  })

  it('60분 미만은 분으로 — 소수 시간은 사람이 못 읽는다', () => {
    expect(fmtDur(45)).toBe('45분')
    expect(fmtDur(90)).toBe('1.5시간')
    expect(fmtDur(60 * 36)).toBe('1.5일')
  })

  /**
   * 마지막 실행 시각이 있어야 "정말 멈춘 건가"를 **메시지만 보고** 판단한다. 없으면 대표가
   * 어드민을 열어야 하고, 그 왕복이 이 경보를 만든 이유를 무효로 만든다. 표기는 KST(CLAUDE.md).
   */
  it('🔒 마지막 실행 시각을 KST 로 함께 적는다', () => {
    const s = line({ name: 'ads:x', age_min: 180, gap_min: 150, at: '2026-08-10T23:00:26.000Z' })
    expect(s).toContain('마지막 실행')
    expect(s).toContain('08/11 08:00')   // 23:00Z = KST 익일 08:00
  })

  it('시각 기록이 없으면 그 조각만 빠진다 (문구가 깨지지 않는다)', () => {
    expect(line({ name: 'ads:x', age_min: 180, gap_min: 150, at: null })).not.toContain('마지막 실행')
  })
})

describe('② 두 번 표본 — 같은 회차를 못 보는 경주', () => {
  const maker: SilentLane = { name: 'ads:collect-maker', age_min: 180, gap_min: 150, at: null }
  const dead: SilentLane = { name: 'ads:really-dead', age_min: 4000, gap_min: 150, at: null }

  /**
   * 🩸 실사고 재현: 1차 표본엔 있었지만(회차 실행분이 아직 안 쓰였다) 2차엔 사라진다.
   *   그건 침묵이 아니라 **그 순간 돌고 있던 것**이다.
   */
  it('🔒 두 번째 표본에서 사라진 레인은 신고하지 않는다', () => {
    expect(confirmSilent([maker, dead], [dead]).map(l => l.name)).toEqual(['ads:really-dead'])
  })

  it('🔒 둘 다에 있으면 신고한다 (진짜 침묵을 숨기지 않는다)', () => {
    expect(confirmSilent([maker, dead], [maker, dead]).map(l => l.name).sort())
      .toEqual(['ads:collect-maker', 'ads:really-dead'])
  })

  /**
   * 합집합이면 재표본이 무의미해진다 — "한 번이라도 걸리면 신고"는 고치기 전과 같다.
   * 그리고 2차에만 새로 나타난 레인은 아직 한 번밖에 못 본 것이라 다음 회차로 미룬다.
   */
  it('🔒 교집합이지 합집합이 아니다', () => {
    expect(confirmSilent([maker], [dead])).toEqual([])
  })

  it('🔒 보고 값은 더 최신인 2차 표본의 것 (옛 나이를 말하면 그것도 부정확이다)', () => {
    const older = { ...dead, age_min: 4000 }
    const newer = { ...dead, age_min: 4060 }
    expect(confirmSilent([older], [newer])[0].age_min).toBe(4060)
  })

  it('1차가 비면 신고할 것도 없다', () => {
    expect(confirmSilent([], [dead])).toEqual([])
  })
})

describe('배선 — 계산해 놓고 안 쓰면 화면(메시지)은 그대로다', () => {
  it('🔒 pickSilentLanes 가 마지막 실행 시각을 실어 나른다', () => {
    const got = pickSilentLanes([{ name: 'ads:x', age_minutes: 200, max_gap_min: 150, at: '2026-08-10T23:00:26.000Z' }])
    expect(got[0]?.at).toBe('2026-08-10T23:00:26.000Z')
  })

  it('🔒 요약이 실제로 두 번 뜨고 교집합만 신고한다', async () => {
    const src = (await import('node:fs')).readFileSync('src/worker-ads/silence-digest.ts', 'utf8')
    // 1차 → 대기 → 2차 → 교집합. 한 단계라도 빠지면 경주가 되살아난다.
    expect(src).toMatch(/const first = pickSilentLanes\(await listCronHeartbeats\(DB\)\)/)
    expect(src).toMatch(/await sleep\(RECHECK_DELAY_MS\)/)
    expect(src).toMatch(/confirmSilent\(first, pickSilentLanes\(await listCronHeartbeats\(DB\)\)\)/)
  })
})
