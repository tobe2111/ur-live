/**
 * 🪦 화면의 '침묵'과 경보의 '침묵'이 갈라져 있던 것 — 2026-08-08.
 *
 *   `stale` 만으로는 **멈춘 레인**과 **개명돼 아무도 안 부르는 옛 이름**이 구분되지 않는다.
 *   게이트(`getCronHealth`)·경보(`cron-stale-watch`)는 이미 `classifyBeat` 로 걸러 조용했는데
 *   **사람이 보는 목록만 안 걸렀다** → 화면 12건 vs 실제 알림 2건.
 *
 *   그 격차는 소음이 아니라 **오진을 만들었다**: 같은 날 두 세션이 이 목록을 읽고
 *   *"유어애즈 레인 4개가 침묵 중"* 이라고 보고했지만, 실제로 멈춘 것은 `collect-nara-vendor`
 *   하나였다. 나머지는 `ads:maintenance?phase=*` 처럼 `ads:maintenance` 가 승계한 옛 이름이었다.
 *   ⚠️ 유령을 **지우면 안 된다** — 지우면 "왜 안 보이지"가 되고, 진짜 은퇴 시점도 못 본다.
 *   보여 주되 판정만 분리한다.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { classifyBeat, freshBaseNames } from '@/worker/utils/cron-beat-retirement'

/**
 * 라이브에서 실제로 나온 값 그대로(2026-08-08 `/api/admin/cron-heartbeats` 실측).
 *
 *   ⚠️ **주기(gap)를 지어내면 안 된다** — 처음 이 픽스처를 90 으로 통일해서 썼더니
 *   `collect-nara-vendor` 가 `retired`(=유령)로 떨어져, 진짜 침묵 하나까지 숨기는 결과가 나왔다.
 *   실제 gap 은 2910 이라 은퇴 임계(8배)에 한참 못 미쳐 정상적으로 `judge` 다. 판정이 임계 비율에
 *   달려 있으므로 **실측값이 아니면 이 테스트는 다른 계를 검사하는 셈**이 된다.
 */
const BEATS = [
  { name: 'ads:maintenance', age_minutes: 3, max_gap_min: 40 },                    // 승계자 — 살아 있다
  { name: 'ads:maintenance?phase=merge', age_minutes: 10394, max_gap_min: 1470 },  // 유령(승계)
  { name: 'ads:sweep-kakao-phone', age_minutes: 15133, max_gap_min: 150 },         // 유령(개명·은퇴)
  { name: 'ads:collect-nara-vendor', age_minutes: 6855, max_gap_min: 2910 },       // 🔴 진짜 침묵
  { name: 'ads:collect-company', age_minutes: 14, max_gap_min: 150 },              // 정상
]

describe('하트비트 유령 판정', () => {
  it('🔒 승계된 옛 이름은 침묵으로 안 센다 — 진짜 하나만 남는다', () => {
    const fresh = freshBaseNames(BEATS)
    const judged = BEATS.filter(b => classifyBeat(b, fresh) === 'judge' && b.age_minutes > 60 * 24)
    expect(judged.map(b => b.name)).toEqual(['ads:collect-nara-vendor'])
  })

  it('🔒 유령을 목록에서 지우지는 않는다 (판정만 분리)', () => {
    const fresh = freshBaseNames(BEATS)
    // 전부 판정을 받는다 = 아무도 목록에서 빠지지 않는다.
    expect(BEATS.every(b => ['judge', 'retired', 'superseded'].includes(classifyBeat(b, fresh)))).toBe(true)
    expect(classifyBeat(BEATS[1], fresh)).toBe('superseded') // 승계
    expect(classifyBeat(BEATS[2], fresh)).toBe('retired')     // 개명·은퇴
  })

  /**
   * 배선 가드 — 순수함수가 맞게 판정해도 **목록이 그걸 안 쓰면** 화면은 그대로 12건이다.
   * 이 레포가 반복해 만난 "가드는 있는데 그 자리에 안 붙어 있다" 클래스라 배선 자체를 고정한다.
   */
  it('🔒 목록이 verdict 를 실어 준다 (계산해 놓고 안 쓰면 화면은 그대로다)', () => {
    const src = fs.readFileSync('src/worker/utils/cron-heartbeat.ts', 'utf8')
    expect(src).toMatch(/r\.verdict = classifyBeat\(/)
  })

  /**
   * 🩸 **여기까지 안 오면 고친 게 아니다.** 서버가 판정을 실어 주고 집계에서 빼도, 화면이 행마다
   * `h.stale` 을 빨갛게 칠하면 사람이 보는 것은 그대로 12건이다 — 실제로 이 세션이 서버만 고쳐 놓고
   * "끝났다"고 할 뻔했다(대표가 "이제 영구적이냐"고 물어 다시 확인하다 발견).
   */
  it('🔒 화면이 유령을 빨갛게 칠하지 않는다 (서버만 고치면 화면은 그대로다)', () => {
    const src = fs.readFileSync('src/pages/AdminSystemMonitoringPage.tsx', 'utf8')
    // 유령 판정을 실제로 계산해서 쓰는가
    expect(src).toMatch(/const ghost = [^\n]*verdict === 'superseded'/)
    // '멈춤 의심' 배지와 빨간 점이 raw `stale` 이 아니라 realStale 에 묶여 있는가
    expect(src).toMatch(/\{realStale && [^\n]*멈춤 의심/)
    expect(src).not.toMatch(/\{h\.stale && [^\n]*멈춤 의심/)
  })

  it('🔒 어드민 stale 목록이 judge 만 센다', () => {
    const src = fs.readFileSync('src/features/admin/api/admin-system-monitoring.routes.ts', 'utf8')
    const line = src.split('\n').find(l => l.includes('const stale = items.filter')) || ''
    expect(line).toContain("=== 'judge'")
  })
})

/**
 * 🪦 **코드에서 삭제된 레인** — 나이만 보면 16일 동안 "진짜 침묵"으로 보인다.
 *
 *   2026-08-10 실사고: `collect-nara-vendor` 는 `collect-nara-contract` 로 대체되며 **코드에서 사라진**
 *   레인인데, 은퇴 임계가 자기 주기의 8배(48h 주기 → 384h)라 "114시간째 멈춤"으로 판정됐다.
 *   그 보고를 근거로 **대표에게 필요 없는 API 화면 캡처를 요청**했다.
 *   ⇒ 나이는 은퇴를 늦게 말해 주지만 **"디스패처가 안 부른다"는 사실은 즉시 알 수 있다.**
 */
describe('삭제된 레인(디스패처 목록에 없음)', () => {
  // ⚠️ `beatBaseName` 형태(접두·쿼리 제거)로 담는다 — 프로덕션이 만드는 것과 같은 모양이어야 한다.
  //   처음엔 'ads:' 를 붙여 넣었다가 **살아 있는 레인이 은퇴로 찍혔다**(양쪽 형태 불일치).
  const KNOWN = new Set(['collect-nara-contract', 'collect-company'])
  const dead = { name: 'ads:collect-nara-vendor', age_minutes: 6855, max_gap_min: 2910 }

  it('🔒 목록을 주면 즉시 은퇴로 판정한다 (나이 8배를 안 기다린다)', () => {
    expect(classifyBeat(dead, new Set(), KNOWN)).toBe('retired')
  })

  it('목록이 없으면 종전대로 — 판정을 넓히지 않는다', () => {
    expect(classifyBeat(dead, new Set())).toBe('judge')
  })

  it('🔒 목록이 비어 있으면 판정하지 않는다 (전 레인 은퇴 = 사각지대 자가생성)', () => {
    expect(classifyBeat(dead, new Set(), new Set())).toBe('judge')
  })

  it('🔒 살아 있는 레인은 목록이 있어도 그대로 판정 대상', () => {
    const alive = { name: 'ads:collect-nara-contract', age_minutes: 6855, max_gap_min: 2910 }
    expect(classifyBeat(alive, new Set(), KNOWN)).toBe('judge')
  })

  it('목록을 실제로 읽어 넘긴다 (계산해 놓고 안 쓰면 화면은 그대로다)', () => {
    const src = fs.readFileSync('src/worker/utils/cron-heartbeat.ts', 'utf8')
    expect(src).toMatch(/ads_known_lanes/)
    expect(src).toMatch(/freshBases, knownBases\)/)
  })
})
