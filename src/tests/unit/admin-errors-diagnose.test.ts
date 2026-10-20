/**
 * 🔎 2026-08-01 (대표: "/admin/errors 진단 가능하게 해줘")
 *
 * 진단 화면의 값어치는 **분류가 맞는지**에 달려 있다. 틀린 분류는 없느니만 못하다
 * (예: 카카오 인앱웹뷰를 그냥 "Safari" 로 묶으면 인앱 전용 부팅 실패를 영영 못 본다).
 * 그래서 순수함수로 분리하고 실제 UA 문자열로 고정한다.
 *
 * ⚠️ 못 막는 것: 새 인앱 브라우저가 등장하면 '기타'로 떨어진다 — 그건 데이터를 보고 추가해야 한다.
 */
import { describe, it, expect } from 'vitest'
import { shortUA, parseBootStuck, bootStuckNote, looksAutomated } from '@/pages/admin-errors/diagnose'

describe('shortUA — 부팅 실패를 분류하려면 인앱웹뷰가 먼저 갈려야 한다', () => {
  it('인앱 웹뷰를 브라우저로 오분류하지 않는다', () => {
    // 카카오 인앱은 UA 에 Safari 도 함께 담는다 — 순서가 틀리면 Safari 로 샌다.
    expect(shortUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.4.5')).toBe('카카오톡 인앱')
    expect(shortUA('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 NAVER(inapp; search; 1000; 12.0)')).toBe('네이버 인앱')
    expect(shortUA('Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Instagram 300.0.0.29.110')).toBe('인스타 인앱')
  })

  it('Edge/삼성인터넷/웨일이 Chrome 으로 뭉뚱그려지지 않는다 (셋 다 UA 에 Chrome 을 담는다)', () => {
    expect(shortUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36 Edg/126')).toBe('Edge · Windows')
    expect(shortUA('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 SamsungBrowser/23.0 Chrome/115 Mobile Safari/537.36')).toBe('삼성인터넷 · Android')
    expect(shortUA('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/126 Whale/3.0 Safari/537.36')).toBe('웨일 · Windows')
  })

  it('일반 브라우저 + OS', () => {
    expect(shortUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1')).toBe('Safari · iOS')
    expect(shortUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36')).toBe('Chrome · Windows')
  })

  it('봇을 사람 트래픽과 섞지 않는다', () => {
    expect(shortUA('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe('봇/크롤러')
    expect(shortUA('Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd)')).toBe('봇/크롤러')
    expect(looksAutomated('Mozilla/5.0 HeadlessChrome/126')).toBe(true)
    expect(looksAutomated('Mozilla/5.0 (Windows NT 10.0) Chrome/126 Safari/537.36')).toBe(false)
  })

  it('빈 UA 도 죽지 않는다 (조회 API 가 안 돌려주던 시절 데이터가 섞여 있다)', () => {
    expect(shortUA(null)).toBe('알 수 없음')
    expect(shortUA('')).toBe('알 수 없음')
    expect(shortUA(undefined)).toBe('알 수 없음')
  })
})

describe('parseBootStuck — 한 줄 문자열을 필드로', () => {
  const LIVE = '[boot-stuck] reason=entry-stalled chunkSeen=false entryRan=n t=13010ms ready=interactive nav=navigate vis=visible lastErr=(none)'

  it('라이브에서 실제로 관측된 형식을 쪼갠다', () => {
    const f = parseBootStuck(LIVE)!
    expect(f.reason).toBe('entry-stalled')
    expect(f.chunkSeen).toBe('false')
    expect(f.entryRan).toBe('n')
    expect(f.t).toBe(13010)
    expect(f.ready).toBe('interactive')
    expect(f.nav).toBe('navigate')
    expect(f.vis).toBe('visible')
  })

  it('nav/vis 가 없던 옛 기록도 파싱된다 (필드 추가 이전 데이터)', () => {
    const f = parseBootStuck('[boot-stuck] reason=entry-stalled chunkSeen=false entryRan=n t=384ms ready=loading lastErr=(none)')!
    expect(f.t).toBe(384)
    expect(f.nav).toBeUndefined()
  })

  it('lastErr 은 공백을 포함할 수 있어 줄 끝까지 가져온다', () => {
    const f = parseBootStuck('[boot-stuck] reason=chunk chunkSeen=true entryRan=n t=900ms ready=loading lastErr=asset https://urdeal.kr/assets/index-a1b2.js')!
    expect(f.lastErr).toBe('asset https://urdeal.kr/assets/index-a1b2.js')
  })

  it('boot-stuck 이 아닌 메시지는 건드리지 않는다', () => {
    expect(parseBootStuck('Script error.')).toBeNull()
    expect(parseBootStuck('Ledger mismatch (4): user_points_balance_mismatch: 4')).toBeNull()
    expect(parseBootStuck('사용자가 [boot-stuck] 을 언급함')).toBeNull()  // 접두사여야 한다
  })
})

describe('bootStuckNote — 수수께끼를 데이터로 좁힌다', () => {
  // 이게 이번 작업의 이유다: 12초 워치독인데 t 가 훨씬 작은 기록이 다수였고 설명이 없었다.
  it('prerender/bfcache 면 그것으로 설명된다', () => {
    expect(bootStuckNote({ t: 300, nav: 'navigate+prerendering' })).toContain('prerender')
    expect(bootStuckNote({ t: 300, nav: 'back_forward+bfcache' })).toContain('bfcache')
  })

  it('nav 기록이 없던 옛 데이터는 "옛 데이터" 로 표시한다 (원인 미상과 구분)', () => {
    expect(bootStuckNote({ t: 384 })).toContain('옛 데이터')
  })

  it('nav 가 있는데도 설명이 안 되면 "원인 미상" 이라고 말한다 (아는 척하지 않는다)', () => {
    const n = bootStuckNote({ t: 384, nav: 'navigate' })!
    expect(n).toContain('원인 미상')
    expect(n).toContain('navigate')
  })

  it('정상 범위(12초 이상)면 부팅 단계로 소견을 낸다', () => {
    expect(bootStuckNote({ t: 13010, nav: 'navigate', entryRan: 'n', chunkSeen: 'false' })).toContain('엔트리 미실행')
    expect(bootStuckNote({ t: 14000, nav: 'navigate', entryRan: 'y' })).toContain('마운트')
    expect(bootStuckNote({ t: 14000, nav: 'navigate', entryRan: 'n', chunkSeen: 'true' })).toContain('청크')
  })
})

describe('beacon 이 판별 신호를 실제로 싣는가 (index.html 배선)', () => {
  it('nav/vis 를 메시지에 포함하고, prerender 중에는 워치독을 돌리지 않는다', async () => {
    const { readFileSync } = await import('node:fs')
    const html = readFileSync('index.html', 'utf8')
    expect(html, 'beacon 에 nav= 가 없다 — 파서가 읽을 값이 안 실린다').toContain("' nav=' + navKind()")
    expect(html).toContain("' vis=' + vis")
    expect(html, 'prerender 중 워치독 억제가 없다 — 아무도 안 본 화면이 통계를 채운다').toContain('document.prerendering')
  })
})
