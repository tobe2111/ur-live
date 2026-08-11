/**
 * 🎛️ **수집 트랙 게이트 + YT 콜 내역 배선** (2026-08-11).
 *
 * ## 이 테스트가 지키는 사고 두 개
 * ① **원클릭 게이트를 만들면서 조용히 켜 버리는 것** — 라이브 env 는 `ADS_COLLECT_CAFE_ENABLED='false'`
 *    (카페 OFF)다. 설정이 비어 있는 동안에는 **반드시 그 env 를 따라야** 한다. 폴백을 잘못 짜면
 *    배포하는 순간 카페가 켜져 회차 예산(현재 캡)을 먹고 키워드 폭이 줄어든다 — 발굴량 직접 감소.
 * ② **계산해 놓고 안 쓰는 계측** — `DiscoverCalls` 는 videos 콜의 성과(email/contact/cat/empty)를
 *    이미 세는데, 집계부가 3개 필드만 옮겨 **스냅샷에 도달하지 못했다**(실측: yt_calls 에 세부 없음).
 *    그래서 예산의 60%를 쓰는 트랙의 낭비율을 아무도 볼 수 없었고, 추측으로만 논할 수 있었다.
 *
 * ## 못 막는 것 (과신 금지)
 * - 실제 D1 쓰기/읽기는 유닛이 못 본다(라우트 존재와 판정 함수만 고정).
 * - `videos_empty` 비율이 "잘라도 되는 몫"인지의 **판단**은 데이터가 쌓인 뒤 사람이 한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { cafeCollectEnabled, CAFE_GATE_KEY } from '@/features/marketing/api/collect-track-gates'

describe('카페 원클릭 게이트 — 설정 > env 폴백', () => {
  const envOff = { ADS_COLLECT_CAFE_ENABLED: 'false' }   // ← 라이브 실제 값
  const envUnset = {}

  it('🔴 설정이 비어 있으면 env 를 그대로 따른다(배포만으로 켜지면 예산을 먹어 폭이 줄어든다)', () => {
    expect(cafeCollectEnabled(null, envOff)).toBe(false)      // 라이브 현재 = OFF 유지
    expect(cafeCollectEnabled(undefined, envOff)).toBe(false)
    expect(cafeCollectEnabled('', envOff)).toBe(false)
    expect(cafeCollectEnabled('   ', envOff)).toBe(false)
    expect(cafeCollectEnabled(null, envUnset)).toBe(true)     // env 미설정 = 종전 기본 ON 규칙 보존
  })

  it('설정이 있으면 설정이 이긴다 — env 를 건드리지 않고 켜고 끄는 것이 이 게이트의 목적', () => {
    expect(cafeCollectEnabled('on', envOff)).toBe(true)       // env=false 인데도 켜진다(원클릭)
    expect(cafeCollectEnabled('off', envUnset)).toBe(false)   // env 기본 ON 인데도 꺼진다
  })

  it('표기 변형을 받는다(true/1, false/0, 대문자·공백) — 손으로 넣은 값에 걸려 넘어지지 않게', () => {
    for (const v of ['ON', ' true ', '1']) expect(cafeCollectEnabled(v, envOff), v).toBe(true)
    for (const v of ['OFF', ' false ', '0']) expect(cafeCollectEnabled(v, envUnset), v).toBe(false)
  })

  it('알 수 없는 값은 폴백으로 — 오타가 정책을 뒤집지 않는다', () => {
    expect(cafeCollectEnabled('yes', envOff)).toBe(false)     // 'yes' 는 미지원 → env(OFF)
    expect(cafeCollectEnabled('나중에', envUnset)).toBe(true)  // → env(기본 ON)
  })
})

describe('배선 — 게이트/계측이 실제로 실행 경로에 붙어 있다', () => {
  const collectSrc = () => readFileSync('src/features/marketing/api/influencer-auto-collect.ts', 'utf8')
  /** 주석 제거 — 주석에만 남은 이름이 배선으로 오인되는 걸 막는다(이 레포가 여러 번 밟은 함정). */
  const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

  it('🔴 카페 분기가 SSOT 판정을 쓴다 — env 를 직접 보면 원클릭이 죽은 손잡이가 된다', () => {
    const c = code(collectSrc())
    expect(c).toMatch(/const cafeEnabled = cafeCollectEnabled\(settings\[CAFE_GATE_KEY\], env\)/)
    expect(c).toMatch(/if \(cafeEnabled\) try/)
    // 옛 인라인 env 판정이 되살아나면 설정이 무시된다.
    expect(c).not.toMatch(/ADS_COLLECT_CAFE_ENABLED[^\n]*!==\s*'false'\)\s*try/)
  })

  it('🔴 게이트 키가 기존 배치 읽기에 있다 — 낱개로 읽으면 발굴 fetch 하나를 잡아먹는다', () => {
    // SETTING_KEYS 에 없는 키를 settings[...] 로 읽으면 **값이 아니라 undefined** 가 온다
    // (집중 축 커서가 정확히 그래서 항상 0 이었다 — 2026-08-03 실사고).
    expect(code(collectSrc())).toMatch(/const SETTING_KEYS = \[[^\]]*CAFE_GATE_KEY[^\]]*\]/)
    expect(CAFE_GATE_KEY).toBe('ads_collect_cafe')
  })

  it('🔬 YT 콜 세부 카운터가 스냅샷까지 옮겨진다 — 3개만 옮기면 낭비율을 영영 못 본다', () => {
    const c = code(collectSrc())
    for (const f of ['videos_email', 'videos_contact', 'videos_cat', 'videos_empty']) {
      expect(c, `${f} 가 집계에서 빠졌다`).toMatch(new RegExp(`ytCalls\\.${f}\\s*=`))
    }
  })

  it('게이트 API 라우트가 마운트돼 있다(파일만 있고 안 붙으면 화면이 404 를 받는다)', () => {
    const src = readFileSync('src/features/marketing/api/admin-ads.routes.ts', 'utf8')
    expect(code(src)).toMatch(/app\.route\('\/',\s*adminAdsCollectGatesRoutes\)/)
  })
})
