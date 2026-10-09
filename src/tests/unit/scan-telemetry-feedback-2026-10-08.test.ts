/**
 * 📏🔔 2026-10-08 (대표 "1,2 모두 진행해줘") — 계산대 스캔 ① 기록 ② 아이폰 결과 신호.
 *
 * ① 10-07 에 카메라를 세 번 고쳤는데 근거가 전부 신고와 추측이었다(못 읽는 것은 에러가 아니라 로그가 없다).
 *    ⇒ 스캔 화면을 한 번 열 때마다 **정확히 한 줄**: 켜지기까지 · 첫 코드까지 · 결과(못 읽고 닫음 포함).
 * ② 결과 신호가 `navigator.vibrate` 하나였는데 아이폰 사파리엔 그 함수가 없다.
 *    ⇒ 화면 전체 깜빡임(늘 됨) + 소리(탭으로 깨워 둔 뒤) + 진동(안드로이드).
 *
 * ⚠️ **이 테스트가 못 막는 것**: 실제 폰에서 소리가 나는지(무음 스위치·자동재생 정책) · 깜빡임이 눈에 띄는지 ·
 *    keepalive 요청이 페이지가 닫히는 순간 정말 도착하는지 · 라이브 D1 에 줄이 쌓이는지(배포 후 D1 조회로 판정).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { sign } from 'hono/jwt'
import { stripComments } from '../helpers/source-text'
import { createScanSession, scanPlatform, sendScanReport, type ScanSessionReport } from '@/components/voucher/scan-telemetry'
import { SCAN_TONES, scanSignal } from '@/components/voucher/scan-feedback'
import { parseScanSession } from '@/features/seller/api/scan-session-store'
import { sellerScanDevicesRoutes } from '@/features/seller/api/seller-scan-devices.routes'

const SCANNER = stripComments(readFileSync('src/components/voucher/VoucherScanner.tsx', 'utf-8'))
const ROUTES = stripComments(readFileSync('src/features/seller/api/seller-scan-devices.routes.ts', 'utf-8'))

function clock() {
  let t = 1000
  return { now: () => t, advance: (ms: number) => { t += ms } }
}

describe('📏 한 세션 = 정확히 한 줄', () => {
  it('첫 코드에서 **즉시** 보낸다 — 걸린 시간과 결과가 실린다', () => {
    const c = clock()
    const sent: ScanSessionReport[] = []
    const s = createScanSession((r) => sent.push(r), 'android', c.now)
    c.advance(800)
    s.cameraOpened('detector', 3, { cached: true, repicked: false })
    c.advance(1200)
    s.firstCode('read')
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ outcome: 'read', camera_ms: 800, first_read_ms: 2000, engine: 'detector', cam_count: 3, lens_cached: 1, lens_repicked: 0, platform: 'android' })
  })

  it('보낸 뒤엔 두 번째 코드도, 화면 닫힘도 다시 보내지 않는다', () => {
    const sent: ScanSessionReport[] = []
    const s = createScanSession((r) => sent.push(r), 'ios')
    s.firstCode('read')
    s.firstCode('manual')
    s.end()
    expect(sent).toHaveLength(1)
    expect(sent[0].outcome).toBe('read')
  })

  it('**못 읽고 닫으면** 그것이 기록된다 — 가장 값진 줄(실패는 닫힐 때만 알 수 있다)', () => {
    const sent: ScanSessionReport[] = []
    const s = createScanSession((r) => sent.push(r), 'android')
    s.cameraOpened('wasm', 1, { cached: false, repicked: false })
    s.helpShown()
    s.end()
    s.end()
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ outcome: 'none', first_read_ms: null, help_shown: 1 })
  })

  it('카메라를 못 열었으면 camera_error — 그러나 뒤에 열리면 실패가 지워진다', () => {
    const a: ScanSessionReport[] = []
    const s1 = createScanSession((r) => a.push(r), 'ios')
    s1.cameraFailed()
    s1.end()
    expect(a[0].outcome).toBe('camera_error')
    const b: ScanSessionReport[] = []
    const s2 = createScanSession((r) => b.push(r), 'ios')
    s2.cameraFailed()
    s2.cameraOpened('wasm', 1, { cached: false, repicked: false })
    s2.end()
    expect(b[0].outcome).toBe('none')
  })

  it('네이티브가 못 읽어 넘기면 — 실제로 읽은 디코더(wasm)가 남고, 켜진 시각은 처음 것이다', () => {
    const c = clock()
    const sent: ScanSessionReport[] = []
    const s = createScanSession((r) => sent.push(r), 'android', c.now)
    c.advance(500)
    s.cameraOpened('detector', 2, { cached: false, repicked: true })
    s.handedOver()
    c.advance(4000)
    s.cameraOpened('wasm', 2, { cached: false, repicked: false })
    s.firstCode('read')
    expect(sent[0]).toMatchObject({ engine: 'wasm', handed_over: 1, camera_ms: 500, lens_repicked: 1 })
  })

  it('전송이 던져도 스캔은 계속된다(fail-soft)', () => {
    const s = createScanSession(() => { throw new Error('offline') }, 'ios')
    expect(() => s.firstCode('read')).not.toThrow()
  })
})

describe('📏 플랫폼은 세 갈래로만 — 기종 문자열을 통째로 남기지 않는다', () => {
  it('아이폰·아이패드(데스크톱 UA 포함)·안드로이드·기타', () => {
    expect(scanPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('ios')
    expect(scanPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('ios')
    expect(scanPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe('other')
    expect(scanPlatform('Mozilla/5.0 (Linux; Android 14; SM-S918N)')).toBe('android')
  })
})

describe('📏 보내는 쪽 — 스캔과 같은 신원, 없으면 안 보낸다', () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks() })
  const report = createScanSession(() => {}, 'ios').snapshot()

  it('신원이 없으면 요청 자체를 안 만든다', () => {
    const f = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })))
    vi.stubGlobal('fetch', f)
    sendScanReport(report)
    expect(f).not.toHaveBeenCalled()
  })

  it('사장님 토큰이면 Bearer + keepalive(닫히는 순간에도 도착)', () => {
    localStorage.setItem('seller_token', 'tok')
    const f = vi.fn((_u: string, _i: RequestInit) => Promise.resolve(new Response(null, { status: 204 })))
    vi.stubGlobal('fetch', f)
    sendScanReport(report)
    const init = f.mock.calls[0][1]
    expect(init.keepalive).toBe(true)
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
  })

  it('직원 폰은 스캔 기기 키로', () => {
    localStorage.setItem('scan_device_key', 'k'.repeat(40))
    const f = vi.fn((_u: string, _i: RequestInit) => Promise.resolve(new Response(null, { status: 204 })))
    vi.stubGlobal('fetch', f)
    sendScanReport(report)
    expect((f.mock.calls[0][1].headers as Record<string, string>)['X-Scan-Device-Key']).toBe('k'.repeat(40))
  })
})

describe('📏 서버 — 받을 수 없는 몸은 버리고, 값은 클램프한다', () => {
  it('결과·플랫폼이 화이트리스트 밖이면 null', () => {
    expect(parseScanSession({ outcome: 'hacked', platform: 'ios' })).toBeNull()
    expect(parseScanSession({ outcome: 'read', platform: 'windows' })).toBeNull()
    expect(parseScanSession(null)).toBeNull()
    expect(parseScanSession('x')).toBeNull()
  })
  it('숫자는 정수·범위로, 플래그는 0/1 로, 모르는 디코더는 null', () => {
    const r = parseScanSession({ outcome: 'read', platform: 'ios', engine: 'evil', camera_ms: -5, first_read_ms: 1e12, cam_count: 99, handed_over: 'yes', lens_cached: 1 })!
    expect(r).toMatchObject({ engine: null, camera_ms: null, first_read_ms: 6 * 60 * 60 * 1000, cam_count: 16, handed_over: 0, lens_cached: 1 })
  })
})

/** 라우트를 실제로 태운다 — rateLimit 과 INSERT 가 가짜 DB 에 남긴 SQL 을 센다. */
function fakeDb() {
  const sql: string[] = []
  const stmt = (q: string) => {
    const s = {
      bind: () => s,
      run: async () => { sql.push(q); return { meta: { changes: 1 } } },
      first: async () => { sql.push(q); return { count: 1 } },
      all: async () => { sql.push(q); return { results: [] } },
    }
    return s
  }
  return { sql, DB: { prepare: (q: string) => stmt(q) } as unknown as D1Database }
}
const BODY = JSON.stringify({ outcome: 'read', platform: 'android', engine: 'detector', camera_ms: 700, first_read_ms: 1500 })

describe('📏 POST /scan-telemetry — 익명 쓰기 구멍이 없다', () => {
  const SECRET = 'test-secret'
  it('신원이 없으면 204 이고 **아무것도 적지 않는다**', async () => {
    const { sql, DB } = fakeDb()
    const res = await sellerScanDevicesRoutes.request('/scan-telemetry', { method: 'POST', body: BODY, headers: { 'Content-Type': 'application/json' } }, { DB, JWT_SECRET: SECRET })
    expect(res.status).toBe(204)
    expect(sql.some((q) => /INSERT INTO voucher_scan_sessions/.test(q))).toBe(false)
  })
  it('사장님 토큰이면 한 줄 적는다', async () => {
    const { sql, DB } = fakeDb()
    const tok = await sign({ type: 'seller', seller_id: 7, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
    const res = await sellerScanDevicesRoutes.request('/scan-telemetry', { method: 'POST', body: BODY, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` } }, { DB, JWT_SECRET: SECRET })
    expect(res.status).toBe(204)
    expect(sql.filter((q) => /INSERT INTO voucher_scan_sessions/.test(q))).toHaveLength(1)
  })
  it('소비자 토큰(type≠seller)은 사장님이 아니다 — 적지 않는다', async () => {
    const { sql, DB } = fakeDb()
    const tok = await sign({ type: 'user', seller_id: 7, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
    await sellerScanDevicesRoutes.request('/scan-telemetry', { method: 'POST', body: BODY, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` } }, { DB, JWT_SECRET: SECRET })
    expect(sql.some((q) => /INSERT INTO voucher_scan_sessions/.test(q))).toBe(false)
  })
  it('기기 키 인증 미들웨어(scanOrSellerAuth)를 이 라우트에 배선하지 않는다 — use-by-seller 전용 · scope 확장 금지', () => {
    const route = ROUTES.slice(ROUTES.indexOf("post('/scan-telemetry'"))
    expect(route.length).toBeGreaterThan(50)
    expect(route.slice(0, route.indexOf('async (c)'))).not.toMatch(/scanOrSellerAuth/)
  })
})

describe('🔔 결과 신호 — 아이폰에서도 알 수 있다', () => {
  it('결과 신호는 scanSignal 하나로 — 스캐너가 navigator.vibrate 를 직접 부르지 않는다(아이폰엔 없다)', () => {
    expect(SCANNER).not.toMatch(/navigator\.vibrate/)
    expect((SCANNER.match(/signal\((?:false|!!d\.success)\)/g) || []).length).toBeGreaterThanOrEqual(3)
  })
  it('화면을 누를 때마다 소리를 깨워 둔다 — [사용 처리] 탭이 결과보다 먼저 온다', () => {
    expect(SCANNER).toMatch(/onPointerDown=\{primeScanSound\}/)
  })
  it('깜빡임은 화면 전체 · 클릭을 막지 않고 · 바탕이 투명이다(애니메이션이 꺼져도 화면을 덮은 채 남지 않는다)', () => {
    const el = SCANNER.slice(SCANNER.indexOf('{flash &&'), SCANNER.indexOf('{flash &&') + 400)
    expect(el).toMatch(/fixed inset-0/)
    expect(el).toMatch(/pointer-events-none/)
    expect(el).toMatch(/opacity-0 animate-\[ur-scan-flash/)
    expect(el).toMatch(/onAnimationEnd=/)
    const css = readFileSync('src/index.css', 'utf-8')
    expect(css).toMatch(/@keyframes ur-scan-flash/)
  })
  it('성공 음이 실패 음보다 높다(밝게/낮게) · 둘 다 0.3초 안', () => {
    const top = (k: 'ok' | 'bad') => Math.max(...SCAN_TONES[k].map((x) => x.hz))
    expect(top('ok')).toBeGreaterThan(top('bad'))
    for (const k of ['ok', 'bad'] as const) {
      const end = Math.max(...SCAN_TONES[k].map((x) => x.at + x.dur))
      expect(end).toBeLessThanOrEqual(0.3)
    }
  })
  it('진동은 그대로 — 안드로이드는 종전 패턴', () => {
    const v = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { value: v, configurable: true })
    scanSignal(true)
    scanSignal(false)
    expect(v).toHaveBeenNthCalledWith(1, 80)
    expect(v).toHaveBeenNthCalledWith(2, [60, 60, 60])
  })
})

describe('📏 배선 — 기록이 실제로 불린다', () => {
  it('사진·손 입력은 결과 종류를 구분해 넘긴다(카메라가 못 읽었다는 신호다)', () => {
    expect(SCANNER).toMatch(/requestUse\(code, 'photo'\)/)
    expect(SCANNER).toMatch(/requestUse\(code, 'manual'\)/)
    expect(SCANNER).toMatch(/sessionRef\.current\?\.firstCode\(source\)/)
  })
  it('두 디코더 모두 켜짐을 기록하고, 둘 다 실패를 기록한다', () => {
    expect(SCANNER).toMatch(/cameraOpened\('detector'/)
    expect(SCANNER).toMatch(/cameraOpened\('wasm'/)
    expect((SCANNER.match(/sess\(\)\.cameraFailed\(\)/g) || []).length).toBe(2)
    expect(SCANNER).toMatch(/sess\(\)\.handedOver\(\)/)
  })
  it('화면이 닫힐 때(pagehide · 언마운트) 끝을 기록한다 — 실패는 이때만 알 수 있다', () => {
    expect(SCANNER).toMatch(/addEventListener\('pagehide', end\)/)
    expect(SCANNER).toMatch(/removeEventListener\('pagehide', end\); end\(\)/)
  })
  it('도움말이 뜬 사실(7초 동안 못 읽음)도 남는다', () => {
    expect(SCANNER).toMatch(/if \(helpOpen\) sessionRef\.current\?\.helpShown\(\)/)
  })
})
