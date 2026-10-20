/**
 * 🔎 2026-08-01 (대표: "/admin/errors 진단 가능하게 해줘")
 *
 * `/admin/errors` 는 에러를 **모아 보여 주기만** 하고 원인 판별에 필요한 것을 안 보여 줬다:
 *   ① `user_agent` 는 저장돼 있는데 조회 API 가 안 돌려줬다(= 어떤 브라우저/인앱웹뷰인지 알 수 없음).
 *   ② `[boot-stuck]` 메시지는 진단 필드를 **한 줄 문자열에 욱여넣어** 눈으로 읽어야 했다.
 *   ③ 시간이 9시간 어긋나 있었다 — `created_at` 은 D1 의 UTC-naive 문자열인데 `new Date()` 로 파싱했다
 *      (레포에 같은 클래스의 사고 이력과 가드가 있다: `check-utc-date-parse`).
 *
 * 이 모듈은 그 세 가지를 순수함수로 분리한다(테스트 가능하게).
 *
 * ⚠️ 못 하는 것: 원인을 **판정**해 주지는 않는다. 판별에 필요한 축(브라우저·부팅단계·진입방식)을
 *    화면에 드러낼 뿐이다. 실제 판정은 그 축의 분포를 보고 사람이 한다.
 */

/** UA 문자열 → 짧은 라벨. 정확한 파싱이 아니라 **묶어 보기 위한** 분류다. */
export function shortUA(ua: string | null | undefined): string {
  const s = String(ua || '').trim()
  if (!s) return '알 수 없음'

  // 인앱 웹뷰가 먼저다 — 부팅 실패의 상당수가 여기서 난다(카톡/네이버/인스타 인앱).
  if (/KAKAOTALK/i.test(s)) return '카카오톡 인앱'
  if (/NAVER\(inapp/i.test(s) || /NAVER /i.test(s)) return '네이버 인앱'
  if (/Instagram/i.test(s)) return '인스타 인앱'
  if (/FBAN|FBAV/i.test(s)) return '페이스북 인앱'
  if (/Line\//i.test(s)) return '라인 인앱'
  if (/DaumApps/i.test(s)) return '다음 인앱'

  // 봇/크롤러 — 사람 트래픽과 섞이면 통계가 왜곡된다.
  if (/bot|crawler|spider|slurp|Yeti|Googlebot|bingbot|HeadlessChrome/i.test(s)) return '봇/크롤러'

  const os = /iPhone|iPad|iPod/i.test(s) ? 'iOS'
    : /Android/i.test(s) ? 'Android'
    : /Macintosh|Mac OS X/i.test(s) ? 'Mac'
    : /Windows/i.test(s) ? 'Windows'
    : /Linux/i.test(s) ? 'Linux' : ''

  // 순서 주의: Edge/Samsung/Opera 는 UA 에 Chrome 도 함께 담는다.
  const br = /Edg\//i.test(s) ? 'Edge'
    : /SamsungBrowser/i.test(s) ? '삼성인터넷'
    : /OPR\/|Opera/i.test(s) ? 'Opera'
    : /Whale/i.test(s) ? '웨일'
    : /FxiOS|Firefox/i.test(s) ? 'Firefox'
    : /CriOS|Chrome/i.test(s) ? 'Chrome'
    : /Safari/i.test(s) ? 'Safari' : '기타'

  return os ? `${br} · ${os}` : br
}

export interface BootStuckFields {
  reason?: string
  chunkSeen?: string
  entryRan?: string
  /** performance.now() — 문서마다 0부터라 12초 워치독인데 값이 작으면 같은 문서가 아니다 */
  t?: number
  ready?: string
  /** navigation type (+prerendering/+bfcache) — 작은 t 의 설명이 여기 있다 */
  nav?: string
  vis?: string
  lastErr?: string
}

/** `[boot-stuck] reason=… chunkSeen=… t=123ms …` 한 줄을 필드로 쪼갠다. boot-stuck 이 아니면 null. */
export function parseBootStuck(message: string): BootStuckFields | null {
  if (!message || message.indexOf('[boot-stuck]') !== 0) return null
  const out: BootStuckFields = {}
  const grab = (k: string) => {
    // lastErr 은 값에 공백이 있을 수 있어 줄 끝까지 가져온다.
    const re = k === 'lastErr' ? /lastErr=(.*)$/ : new RegExp(`\\b${k}=([^\\s]+)`)
    const m = re.exec(message)
    return m ? m[1] : undefined
  }
  out.reason = grab('reason')
  out.chunkSeen = grab('chunkSeen')
  out.entryRan = grab('entryRan')
  out.ready = grab('ready')
  out.nav = grab('nav')
  out.vis = grab('vis')
  out.lastErr = grab('lastErr')
  const t = grab('t')
  if (t) {
    const n = parseInt(t, 10)
    if (Number.isFinite(n)) out.t = n
  }
  return out
}

/**
 * boot-stuck 한 건에 대한 **읽을 수 있는 소견**. 판정이 아니라 "무엇이 이상한지" 표시다.
 *
 * 핵심: 워치독은 12초 뒤에만 도는데 `t` 가 그보다 훨씬 작으면 **같은 문서가 아니다**.
 * 그 경우 진입 방식(nav)이 설명해 주는지, 아니면 아직 설명이 없는지를 구분해 준다.
 */
export function bootStuckNote(f: BootStuckFields): string | null {
  if (!f) return null
  const nav = f.nav || ''
  if (nav.includes('prerendering')) return 'prerender 중 — 사용자가 보던 화면이 아님(무시 가능)'
  if (nav.includes('bfcache')) return 'bfcache 복원 문서 — 타이머가 뒤늦게 발화'
  if (typeof f.t === 'number' && f.t < 10000) {
    if (!f.nav) return `t=${f.t}ms 인데 워치독은 12초 — 진입 방식(nav) 기록 이전의 옛 데이터`
    return `t=${f.t}ms 인데 워치독은 12초 — nav=${f.nav} 로도 설명 안 됨(원인 미상)`
  }
  if (f.entryRan === 'n' && f.chunkSeen === 'false') return '엔트리 미실행 + 청크 에러 증거 없음 — 네트워크/차단 의심'
  if (f.entryRan === 'y') return '엔트리는 돌았고 마운트가 안 끝남 — 렌더 지연/에러 의심'
  if (f.chunkSeen === 'true') return '청크 404/MIME 확증 — 배포 전파 중 stale 문서'
  return null
}

/** 이 에러가 사람이 만든 것으로 보이는가 — 봇/크롤러/자동화는 통계에서 분리해 봐야 한다. */
export function looksAutomated(ua: string | null | undefined): boolean {
  return shortUA(ua) === '봇/크롤러'
}
