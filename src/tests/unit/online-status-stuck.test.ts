/**
 * 🌐 오프라인 배너 고착 방지 불변식 (2026-08-26 대표 신고 — "와이파이 연결했는데도 문구가 안 없어져")
 *
 * 배경: `navigator.onLine` / `online` 이벤트는 신뢰할 수 없다. 인터페이스 전환(모바일↔와이파이)이나
 * 카카오 인앱·WebView 에서 **offline 만 오고 online 이 끝내 안 오는** 경우가 있어, 플래그가 false 로
 * 고착되면 배너가 새로고침 전까지 영영 안 사라진다.
 *
 * 지키는 것:
 *   O1 SSR-safe — 초기값은 `navigator.onLine === false` 일 때만 오프라인(2026-07-07 프리렌더 사고).
 *   O2 offline 이벤트를 그대로 믿지 않는다 — 실제 요청(probe)으로 확인한 뒤에만 배너.
 *   O3 오프라인 동안 워치독이 재확인 — online 이벤트가 없어도 스스로 복구된다(고착 불가).
 *   O4 평상시(온라인)엔 probe 를 돌리지 않는다 — 배경 트래픽 0.
 *   O5 probe 는 타임아웃이 있다 — 응답 없는 네트워크에서 영원히 매달리지 않는다.
 *
 * 이 테스트가 못 막는 것: 실제 브라우저의 이벤트 타이밍(수동 확인 필요).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const SRC = readFileSync('src/hooks/useOnlineStatus.ts', 'utf-8')

describe('오프라인 배너 — 고착 불가', () => {
  it('O1 초기값은 명시적 offline 일 때만 (프리렌더에 배너가 구워지지 않게)', () => {
    expect(SRC).toMatch(/navigator\.onLine\s*===\s*false/)
    // 옛 버그: onLine(undefined) 을 그대로 초기값으로
    expect(SRC).not.toMatch(/useState<boolean>\(\s*typeof navigator[^)]*\?\s*navigator\.onLine\s*:/)
  })

  it('O2 offline 이벤트는 probe 로 확인한 뒤에만 배너를 띄운다', () => {
    // handleOffline 이 setIsOnline(false) 를 직접 호출하면 안 된다 — 확인 없이 배너가 뜬다.
    expect(SRC).toMatch(/const handleOffline = \(\) => \{ void verify\(\); \}/)
    expect(SRC, 'verify 는 실제 요청으로 판정해야 한다').toMatch(/const ok = await probeConnectivity\(\)/)
  })

  it('O3 오프라인 동안 워치독이 재확인한다 — online 이벤트 없이도 복구', () => {
    expect(SRC, '워치독이 없으면 online 이벤트가 안 올 때 영영 고착된다').toMatch(/setInterval\(/)
    expect(SRC).toMatch(/RECHECK_MS/)
    // 워치독은 isOnline 에 반응해야 한다(false 로 바뀔 때 돌기 시작).
    expect(SRC).toMatch(/\}, \[isOnline\]\)/)
  })

  it('O4 온라인일 때는 probe 를 돌리지 않는다 (배경 트래픽 0)', () => {
    const watchdog = SRC.slice(SRC.indexOf('// ② 워치독'))
    expect(watchdog, '이 early-return 이 빠지면 모든 사용자가 5초마다 요청한다').toMatch(/if \(isOnline\) return/)
  })

  it('O5 probe 에 타임아웃이 있다', () => {
    expect(SRC).toMatch(/AbortController/)
    expect(SRC).toMatch(/setTimeout\(\(\) => controller\.abort\(\), timeoutMs\)/)
  })

  it('probe 실패만 오프라인으로 — fetch 부재(SSR 등)는 온라인 취급', () => {
    expect(SRC).toMatch(/if \(typeof fetch === 'undefined'\) return true/)
  })
})
