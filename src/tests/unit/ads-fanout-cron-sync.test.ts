/**
 * 🪂 **cron 팬아웃도 자식을 기다린다** — "띄웠다"로는 아무것도 안 남는다 (2026-08-02).
 *
 * ## 라이브가 두 번 반증한 전제
 * `enrich.routes.ts` 는 스스로 규칙을 적어 뒀다:
 * > *"서비스 바인딩 피호출자는 호출자보다 오래 살 수 없다."*
 *
 * 그런데 cron 경로만 예외로 뒀다 — *"거긴 waitUntil 이 맞다(부모가 살아 있다)"*.
 * 라이브 실측이 그 전제를 깼다:
 * ```
 *   ads:enrich-influencer-driver   ok=true  641ms      ← 즉시 반환
 *   enrich_lane.last_run           04:44:30 에서 정지
 *   enrich_fanout.prev_landed      false (05:00 · 07:00 연속 두 회차)
 *   total_measured                 10,719 고정 (3시간 20분)
 * ```
 * 그 사이 실제로 일한 것은 `sync=1` 을 쓰는 **수동 경로 한 번**뿐이었다.
 * 드라이버가 0.6초에 반환하면 부모의 `waitUntil` 이 그때 풀리고, 부모는 더 붙들 이유가 없다
 * → 손자(조각 K개)가 통째로 취소된다.
 *
 * ## 왜 되돌릴 이유가 없나 — **위험이 한 방향이다**
 * 기다리다 부모가 먼저 죽으면 결과는 *지금과 같다*(아무것도 안 남는다).
 * 기다려서 성공하면 K라운드가 남는다. **최악 = 현상 유지, 최선 = 회복.**
 * 그리고 대기는 I/O 라 **CPU 를 안 쓴다** — 이 회차들을 죽인 CPU 고갈을 악화시키지 않는다.
 *
 * ⚠️ **이 테스트가 못 보는 것**: 실제로 자식이 살아 돌아오는지. 그건 라이브에서
 *   `total_measured` 가 움직이는지로만 판정된다(배포 후 다음 정각).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

const INDEX = 'src/worker-ads/index.ts'
const ROUTES = 'src/worker-ads/enrich.routes.ts'

/** 주석을 걷어낸 소스 — 설명 문장 속 코드 조각이 판정을 뒤집는 사고를 오늘 이미 겪었다. */
function code(path: string): string {
  const raw = fs.readFileSync(path, 'utf8')
  expect(raw.length, `${path} 가 비었다 — 경로가 낡았다(통과가 아니라 실패)`).toBeGreaterThan(500)
  return raw.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')
}

describe('cron 팬아웃 — 자식을 기다린다', () => {
  /**
   * 🔑 배선이 이 수정의 전부다. 라우트가 `sync` 를 지원해도 **cron 이 안 넘기면** 아무 일도 안 일어난다
   *   — 그게 정확히 방금 전까지의 상태였다(라우트엔 sync 가 있었고 수동 경로만 썼다).
   */
  it('스케줄러가 드라이버를 sync=1 로 띄운다', () => {
    const src = code(INDEX)
    expect(src, 'cron 이 sync 없이 띄우면 자식이 취소된다(실측: prev_landed false 2회 연속)')
      .toMatch(/kick\('\/__ads\/enrich-influencer-driver\?sync=1'/)
  })

  /**
   * 쿼리를 붙였으니 하트비트 이름이 갈린다 — `beat` 를 고정 안 하면 `enrich-influencer-driver?sync=1`
   * 이라는 **새 이름**이 생기고, 기존 stale-watch 는 옛 이름이 멈춘 것으로 본다(관측이 통째로 어긋난다).
   */
  it('하트비트 이름을 고정한다 — 쿼리가 이름을 가르지 않게', () => {
    const src = code(INDEX)
    const at = src.indexOf("kick('/__ads/enrich-influencer-driver?sync=1'")
    expect(at).toBeGreaterThan(-1)
    const block = src.slice(at, at + 500)
    expect(block, "beat: 'enrich-influencer-driver' 를 안 주면 하트비트 이름이 갈린다").toMatch(/beat:\s*'enrich-influencer-driver'/)
  })
})

describe('cron 팬아웃 — 착지 신고를 잃지 않는다', () => {
  /**
   * 🔴 `sync` 분기는 원래 `reportFanout` 을 **안 불렀다**. cron 을 sync 로 바꾸면서 그대로 뒀다면
   *   *"자식이 전멸해도 화면은 초록"* 이 sync 경로로 되살아난다 — 오늘 고친 바로 그 결함이다.
   */
  it('sync 경로에서도 팬아웃을 신고한다', () => {
    const src = code(ROUTES)
    const reportAt = src.indexOf('await reportFanout(')
    const syncAt = src.indexOf('if (syncFanout) {')
    expect(reportAt, 'reportFanout 호출을 못 찾았다 — 코드가 옮겨갔다').toBeGreaterThan(-1)
    expect(syncAt).toBeGreaterThan(-1)
    expect(reportAt, 'sync 분기 뒤에만 신고하면 sync 경로가 관측 밖으로 나간다').toBeLessThan(syncAt)
  })

  /**
   * 🔑 **신고는 띄우기 *전***이어야 한다. `reportFanout` 은 지금 레인 스냅샷을 `lane_before` 로 저장해
   *   다음 회차가 비교한다. 기다린 *뒤*에 찍으면 이번 라운드의 전진이 이미 반영돼
   *   **다음 회차가 영원히 "전진 없음"으로 오판**한다 — 경보가 상시 빨강이 되어 곧 무시된다.
   */
  it('신고가 자식을 띄우기 전에 온다', () => {
    const src = code(ROUTES)
    const reportAt = src.indexOf('await reportFanout(')
    const kidsAt = src.indexOf('const kids = Array.from(')
    expect(kidsAt).toBeGreaterThan(-1)
    expect(reportAt, '띄운 뒤에 신고하면 lane_before 가 사후값이 되어 다음 회차 비교가 깨진다').toBeLessThan(kidsAt)
  })

  /**
   * 한 조각도 안 돌아왔으면 **이 레인은 실패다.** `ok:true` 로 반환하면 부모 하트비트가 초록이 되고
   * "띄웠다 = 성공" 오해가 sync 경로로 되살아난다.
   */
  it('한 조각도 착지 못하면 실패로 반환한다', () => {
    const src = code(ROUTES)
    expect(src, 'landed 판정이 없다 — sync 경로가 항상 초록이 된다').toMatch(/const landed = slices\.filter\(Boolean\)\.length/)
    expect(src, 'ok 를 landed 로 안 묶으면 전멸해도 초록이다').toMatch(/ok: landed > 0/)
    expect(src, '전멸을 5xx 로 알려야 부모의 runLane 이 실패로 기록한다').toMatch(/landed > 0 \? 200 : 500/)
  })

  /** 신고가 두 번 나가면 `lane_before` 가 덮어써져 비교 기준이 흔들린다 — 정확히 1회여야 한다. */
  it('신고는 정확히 한 번만 호출된다', () => {
    const src = code(ROUTES)
    expect((src.match(/await reportFanout\(/g) || []).length).toBe(1)
  })
})
