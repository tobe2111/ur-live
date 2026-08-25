/**
 * 🪦 은퇴 하트비트 분류 — `classifyBeat` / `freshBaseNames` / `pickSilentLanes` (2026-08-04)
 *
 * ⚠️ **이 테스트가 지키는 것**: 게이트가 *꺼질 수 있어야* 한다는 것. 첫 케이스가 라이브 실측 19건을
 *   그대로 넣고, 개명·인수된 이름이 판정에서 빠지는지 본다. 그게 안 되면
 *   `/api/_healthcheck/cron` 은 다시 영구 503 이 되고 사이트 다운 감지를 가린다(실측 6일).
 *
 * ⚠️ **못 막는 것**: `listCronHeartbeats` 가 age/gap 을 옳게 계산하는지는 여기서 못 본다(D1 밖).
 *   또 "은퇴처럼 보이지만 실은 6일째 진짜 고장"은 원리적으로 구분 불가다 — 그래서 지우지 않고
 *   `retired` 로 **보여 준다**(그 선택 자체가 이 설계의 타협점이다).
 */
import { describe, it, expect } from 'vitest'
import {
  classifyBeat, freshBaseNames, beatBaseName,
  RETIRED_GAP_MULTIPLE, RETIRED_MIN_AGE_MIN, BEAT_RENAMED_TO,
} from '@/worker/utils/cron-beat-retirement'
import { pickSilentLanes } from '@/worker-ads/silence-digest'

/** 2026-08-04 라이브 `/api/_healthcheck/cron` 의 stale 19건 + 그 시각 신선했던 3개 알람 레인. */
const LIVE = [
  // 신선(이 셋이 위 phase 변종들을 대체한다)
  { name: 'ads:collect', age_minutes: 3, max_gap_min: 150 },
  { name: 'ads:enrich-influencer', age_minutes: 1, max_gap_min: 40 },
  { name: 'ads:maintenance', age_minutes: 2, max_gap_min: 40 },
  // 개명/인수 — 판정에서 빠져야 한다
  { name: 'ads:sweep-kakao-phone', age_minutes: 8594, max_gap_min: 150 },
  { name: 'ads:maintenance?phase=merge', age_minutes: 3855, max_gap_min: 1470 },
  { name: 'ads:maintenance?phase=handle', age_minutes: 2894, max_gap_min: 1470 },
  { name: 'ads:maintenance?phase=selflink', age_minutes: 2837, max_gap_min: 1470 },
  { name: 'ads:maintenance?phase=quality', age_minutes: 2650, max_gap_min: 1470 },
  { name: 'ads:maintenance?phase=reextract', age_minutes: 2534, max_gap_min: 1470 },
  { name: 'ads:maintenance?phase=reclassify', age_minutes: 2290, max_gap_min: 1470 },
  { name: 'ads:enrich-influencer-fanout', age_minutes: 2592, max_gap_min: 150 },
  { name: 'ads:enrich-influencer-driver', age_minutes: 2592, max_gap_min: 150 },
  { name: 'ads:lane-alarm-boot', age_minutes: 2290, max_gap_min: 150 },
  // 진짜 침묵 — 남아야 한다
  { name: 'ads:scan-notices', age_minutes: 3314, max_gap_min: 2910 },
  { name: 'ads:collect-store-kakao', age_minutes: 922, max_gap_min: 150 },
  { name: 'ads:sweep-kakao-chain', age_minutes: 792, max_gap_min: 150 },
  { name: 'ads:collect-neis', age_minutes: 562, max_gap_min: 150 },
  { name: 'ads:match-registry', age_minutes: 317, max_gap_min: 150 },
  { name: 'ads:social-maintenance', age_minutes: 259, max_gap_min: 150 },
  { name: 'ads:collect-hira', age_minutes: 202, max_gap_min: 150 },
]

describe('classifyBeat — 라이브 실측', () => {
  const fresh = freshBaseNames(LIVE)

  it('개명/인수된 이름은 판정에서 빠진다', () => {
    const gone = LIVE.filter(b => classifyBeat(b, fresh) !== 'judge').map(b => b.name)
    // phase 변종 6 + driver/fanout 2 + sweep-kakao-phone + lane-alarm-boot = 10
    expect(gone).toContain('ads:sweep-kakao-phone')            // 57배 → retired
    expect(gone).toContain('ads:maintenance?phase=quality')    // base 가 신선 → superseded
    expect(gone).toContain('ads:enrich-influencer-driver')     // 17배 → retired
    expect(gone.length).toBe(10)
  })

  it('진짜 침묵은 그대로 남아 게이트를 문다 — 조용히 지우지 않는다', () => {
    const judged = LIVE.filter(b => classifyBeat(b, fresh) === 'judge' && b.age_minutes > b.max_gap_min)
    const names = judged.map(b => b.name)
    expect(names).toContain('ads:scan-notices')        // 일 1회인데 2.3일 — 진짜 밀림
    expect(names).toContain('ads:collect-hira')        // 1.4배 — 예산에 밀리는 중
    expect(names).not.toContain('ads:sweep-kakao-phone')
    expect(judged.length).toBe(7)
  })

  it('superseded 는 쿼리 변종에만 — base 자신은 자기를 대체 못 한다', () => {
    // 같은 이름이 낡았는데 fresh 집합에 자기가 들어가는 자기참조가 생기면 안 된다.
    const only = [{ name: 'ads:maintenance', age_minutes: 9999, max_gap_min: 40 }]
    expect(classifyBeat(only[0], freshBaseNames(only))).toBe('retired')
  })

  it('낡은 기록끼리 서로를 살려 주지 않는다 — 사각지대 자가생성 금지', () => {
    // 레인이 통째로 죽으면 base 도 낡는다. 그때 변종이 superseded 로 숨으면 전멸이 안 보인다.
    const dead = [
      { name: 'ads:maintenance', age_minutes: 5000, max_gap_min: 40 },
      { name: 'ads:maintenance?phase=quality', age_minutes: 100, max_gap_min: 40 },
    ]
    expect(freshBaseNames(dead).has('maintenance')).toBe(false)
    expect(classifyBeat(dead[1], freshBaseNames(dead))).toBe('judge')  // 숨지 않는다
  })

  it('임계 경계 — 배수와 하루를 **둘 다** 넘어야 은퇴', () => {
    const gap = 150
    // 배수는 넘었는데 하루 미만 → 아직 침묵(짧은 임계 레인이 몇 시간 밀린 것)
    expect(classifyBeat({ name: 'ads:x', age_minutes: gap * 9, max_gap_min: gap }, new Set())).toBe('judge')
    expect(gap * 9).toBeLessThan(RETIRED_MIN_AGE_MIN)
    // 둘 다 넘김
    const both = RETIRED_MIN_AGE_MIN + gap * RETIRED_GAP_MULTIPLE
    expect(classifyBeat({ name: 'ads:x', age_minutes: both, max_gap_min: gap }, new Set())).toBe('retired')
  })

  it('모르면 판정한다(보수적) — 조용히 빼면 그게 사각지대', () => {
    expect(classifyBeat({ name: 'ads:x', age_minutes: null, max_gap_min: 150 }, new Set())).toBe('judge')
    expect(classifyBeat({ name: 'ads:x', age_minutes: 999, max_gap_min: null }, new Set())).toBe('judge')
  })

  it('beatBaseName — ads: 접두와 쿼리를 뗀다', () => {
    expect(beatBaseName('ads:maintenance?phase=quality')).toBe('maintenance')
    expect(beatBaseName('payouts-generate')).toBe('payouts-generate')
  })
})

describe('pickSilentLanes — 디스코드 요약 입력', () => {
  it('ads 레인만, 은퇴 제외, 오래된 순', () => {
    const got = pickSilentLanes([...LIVE, { name: 'payouts-generate', age_minutes: 9999, max_gap_min: 60 }])
    expect(got.map(l => l.name)).not.toContain('payouts-generate')   // 유어딜 본체는 이 채널 관심사 아님
    expect(got.map(l => l.name)).not.toContain('ads:sweep-kakao-phone')
    expect(got[0].name).toBe('ads:scan-notices')                     // 가장 오래된 진짜 침묵
    expect(got.length).toBe(7)
  })

  it('전부 신선하면 빈 목록 — 조용하면 아무것도 안 보낸다', () => {
    expect(pickSilentLanes([{ name: 'ads:collect', age_minutes: 3, max_gap_min: 150 }])).toEqual([])
  })
})

/**
 * 🔀 **개명** — 옛 이름이 후임에게 자리를 넘겼는데 하트비트 행만 남은 경우.
 *
 * 라이브 실측(2026-08-25): `d1-backup` 은 `age 32,545 / gap 10,440 = 3.1×` 라 나이 규칙(8배)에
 * 아직 안 걸린다 → **58일째까지 빨간불**이다. 그 5주 동안 상시 빨강은 진짜 다운을 가린다.
 *
 * ⚠️ 이 시험이 못 막는 것: 지도에 **안 적힌** 개명. 지도는 손으로 채우는 사본이라
 *   개명할 때 한 줄 추가하는 것을 대체하지 못한다.
 */
describe('🔀 개명한 이름은 후임이 살아 있을 때만 대체로 친다', () => {
  const OLD = { name: 'd1-backup', age_minutes: 32545, max_gap_min: 10440 }

  it('지도에 d1-backup → d1-backup-chunked 가 있다', () => {
    expect(BEAT_RENAMED_TO['d1-backup']).toBe('d1-backup-chunked')
  })

  it('🔴 나이 규칙만으론 아직 안 걷힌다 — 그래서 지도가 필요하다', () => {
    expect(OLD.age_minutes / OLD.max_gap_min).toBeLessThan(RETIRED_GAP_MULTIPLE)
    expect(classifyBeat(OLD, new Set())).toBe('judge')
  })

  it('🔴 후임이 자기 임계 안에서 뛰고 있으면 superseded', () => {
    const fresh = freshBaseNames([{ name: 'd1-backup-chunked', age_minutes: 4, max_gap_min: 60 }])
    expect(classifyBeat(OLD, fresh)).toBe('superseded')
  })

  it('🔴 후임도 죽었으면 숨기지 않는다 — 옛 이름이 후임 고장을 가리면 안 된다', () => {
    const stale = freshBaseNames([{ name: 'd1-backup-chunked', age_minutes: 5000, max_gap_min: 60 }])
    expect(classifyBeat(OLD, stale)).toBe('judge')
  })

  it('지도에 없는 이름은 종전대로', () => {
    expect(classifyBeat({ name: 'payouts-generate', age_minutes: 200, max_gap_min: 10080 },
      freshBaseNames([{ name: 'd1-backup-chunked', age_minutes: 4, max_gap_min: 60 }]))).toBe('judge')
  })
})
