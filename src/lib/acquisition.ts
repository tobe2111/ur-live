/**
 * 📡 2026-07-05 유입 소스 어트리뷰션 — 클라이언트 first-touch 캡처/귀속.
 *
 * URL 규격 (시설물 QR 인쇄 SSOT): /local/{지역코드}?src={소스}
 *   소스 네이밍: 소문자·숫자·하이픈 (photozone, banner-01, flag-1234, insta, danggn …).
 *   src 가 없으면 utm_source 를 같은 체계로 흡수 (광고/SNS 유입 통합).
 *
 * 동작:
 *  1. captureAcquisitionSource(): 어떤 랜딩이든 URL 의 ?src=(또는 utm_source) 를 검증해
 *     localStorage 에 30일 first-touch 로 고정(이미 유효한 첫 소스가 있으면 덮어쓰지 않음).
 *     새로 캡처된 순간에만 POST /api/acquisition/landing 1회 발사(퍼널 분모, 페이지뷰마다 아님).
 *  2. claimAcquisitionIfLoggedIn(): 로그인 상태면 저장된 first-touch 를
 *     POST /api/acquisition/claim 으로 유저에 귀속(서버 UNIQUE(user_id) — 첫 소스 고정).
 *     성공 시 claimed 마킹 — 재발사 없음.
 *
 * 어트리뷰션 사슬: 랜딩(landing) → 가입/로그인(claim) → 첫 구매(서버 markAcquisitionFirstPurchase).
 */
const LS_KEY = 'ur_acq_src_v1'
const TTL_MS = 30 * 24 * 3600 * 1000 // 30일 first-touch 고정

interface StoredAcq {
  src: string
  code: string | null
  at: string // ISO landed_at
  landed_sent?: boolean
  claimed?: boolean
}

function readStored(): StoredAcq | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as StoredAcq
    if (!v?.src || !v?.at) return null
    if (Date.now() - new Date(v.at).getTime() > TTL_MS) { localStorage.removeItem(LS_KEY); return null }
    return v
  } catch { return null }
}

function writeStored(v: StoredAcq) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(v)) } catch { /* quota 등 무시 */ }
}

function validSrc(raw: string | null): string | null {
  const s = (raw || '').trim().toLowerCase()
  return /^[a-z0-9][a-z0-9-]{0,39}$/.test(s) ? s : null
}

/** /local/{code} 경로면 지역코드 추출 (그 외 표면은 null — 소스만 귀속). */
function regionCodeFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/local\/(\d{5,12})(?:\/|$)/)
  return m ? m[1] : null
}

/** 랜딩 시 1회 호출 — first-touch 캡처 + landing 이벤트 발사. */
export function captureAcquisitionSource(): void {
  try {
    const params = new URLSearchParams(window.location.search)
    const src = validSrc(params.get('src')) || validSrc(params.get('utm_source'))
    if (!src) return
    const existing = readStored()
    if (existing) return // first-touch 고정 — 30일 내 새 소스는 무시
    const stored: StoredAcq = { src, code: regionCodeFromPath(window.location.pathname), at: new Date().toISOString() }
    writeStored(stored)
    // 새 first-touch 캡처 시점에만 랜딩 이벤트 1회 (fail-soft)
    import('@/lib/api').then(({ default: api }) =>
      api.post('/api/acquisition/landing', { src: stored.src, code: stored.code }).then(() => {
        writeStored({ ...stored, landed_sent: true })
      }).catch(() => { /* 다음 세션 재시도 없음 — 분모 1건 손실 허용 */ }),
    ).catch(() => {})
  } catch { /* SSR/프라이빗 모드 등 */ }
}

/** 로그인 확인 후 호출 — first-touch 를 유저에 귀속 (멱등). */
export function claimAcquisitionIfLoggedIn(isLoggedIn: boolean): void {
  try {
    if (!isLoggedIn) return
    const stored = readStored()
    if (!stored || stored.claimed) return
    import('@/lib/api').then(({ default: api }) =>
      api.post('/api/acquisition/claim', { src: stored.src, code: stored.code, landed_at: stored.at }).then((r) => {
        if (r?.data?.success) writeStored({ ...stored, claimed: true })
      }).catch(() => { /* 다음 로그인/방문에서 재시도 (멱등) */ }),
    ).catch(() => {})
  } catch { /* ignore */ }
}
