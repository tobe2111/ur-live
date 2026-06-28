/**
 * 빌드 버전 체크 — 서버에 새 버전이 배포됐으면 사용자에게 새로고침 배너 안내
 *
 * 동작:
 * 1. 5분마다 서버 버전 확인
 * 2. 탭 복귀 시 즉시 확인
 * 3. 로컬 버전과 다르면 → 🛡️ 2026-06-01: 강제 리로드 대신 `ur:new-version` 이벤트 dispatch
 *    → NewVersionBanner 가 "새로고침" 버튼 안내 (입력/스크롤 중 강제 리로드 방지).
 *    단, MIME/text-html 깨짐(고착 번들)은 복구 위해 즉시 리로드 유지.
 */

import { Capacitor } from '@capacitor/core'

const CHECK_INTERVAL_MS = 5 * 60 * 1000 // 5분
const VERSION_STORAGE_KEY = 'ur_build_version'
export const NEW_VERSION_EVENT = 'ur:new-version'

let currentVersion: string | null = null
let intervalId: ReturnType<typeof setInterval> | null = null

async function fetchServerVersion(): Promise<string | null> {
  try {
    const res = await fetch('/api/version', { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json() as { success: boolean; version: string | null }
    return data.version || null
  } catch {
    return null
  }
}

function getLocalVersion(): string | null {
  // 현재 로드된 번들의 script src에서 해시 추출 — 가장 확실
  const scripts = document.querySelectorAll('script[src*="/assets/index-"]')
  for (const s of Array.from(scripts)) {
    const src = (s as HTMLScriptElement).src
    const m = src.match(/\/assets\/(index-[A-Za-z0-9_-]+\.js)/)
    if (m) return m[1]
  }
  return localStorage.getItem(VERSION_STORAGE_KEY)
}

/** 사용자가 배너 "새로고침" 클릭 시 호출 — 캐시 비우고 리로드. */
export async function applyVersionUpdate() {
  await forceReload()
}

async function forceReload() {
  try {
    // SW 캐시 전부 비우기
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
    // SW 강제 갱신
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.update()))
    }
  } catch {}
  // 캐시 우회 리로드
  window.location.reload()
}

async function checkVersion() {
  const serverVersion = await fetchServerVersion()
  if (!serverVersion) return

  const local = currentVersion || getLocalVersion()
  if (!currentVersion && local) currentVersion = local

  if (local && serverVersion !== local) {
    // 🛡️ 2026-06-01: 강제 리로드 대신 배너 안내 — 입력/스크롤 중 데이터 유실 방지.
    //   sessionStorage 가드로 같은 버전은 1회만 안내 (반복 토스트 방지).
    const reloadKey = 'version_reload_' + serverVersion
    if (sessionStorage.getItem(reloadKey)) return
    sessionStorage.setItem(reloadKey, '1')
    localStorage.setItem(VERSION_STORAGE_KEY, serverVersion)
    try {
      window.dispatchEvent(new CustomEvent(NEW_VERSION_EVENT, { detail: { version: serverVersion } }))
    } catch { /* CustomEvent 미지원 환경 — 다음 진입 시 새 번들 로드 */ }
  } else if (!local) {
    localStorage.setItem(VERSION_STORAGE_KEY, serverVersion)
    currentVersion = serverVersion
  }
}

export function startVersionCheck() {
  if (import.meta.env.DEV) return
  // 🛡️ 2026-06-27: 네이티브 앱(Capacitor 번들)에선 version-check 비활성.
  //   번들 앱은 웹 새로고침으로 갱신 불가(스토어 업데이트로만) → 서버버전≠번들버전이면
  //   "새로고침" 배너가 반복 노출 + 눌러도 같은 번들 리로드(무의미). 네이티브는 스토어 업데이트.
  //   ⚠️ 향후 server.url 을 라이브로 전환(앱이 라이브 웹 로드)하면 이 가드 제거 검토.
  try { if (Capacitor.isNativePlatform()) return } catch { /* 웹 — 계속 */ }

  // MIME 에러 감지: 스크립트가 text/html로 로드됐으면 즉시 캐시 클리어
  // sw.js MIME 에러는 무시 (배포 시 일시적으로 발생 가능)
  // 🛡️ 2026-04-29: 가드 이중화 — sessionStorage(같은 탭) + localStorage(전체 탭, 1분 윈도우).
  //   기존 sessionStorage-only: 새 탭 진입마다 1회씩 reload → 영구 캐시 문제 시 사용자
  //   체험 폭주. localStorage 타임스탬프 가드로 1분 내 반복 reload 차단.
  window.addEventListener('error', (e) => {
    const msg = e.message || ''
    if ((msg.includes('MIME type') || msg.includes('text/html')) && !msg.includes('sw.js')) {
      if (sessionStorage.getItem('mime_reload')) return
      try {
        const lastTs = parseInt(localStorage.getItem('mime_reload_ts') || '0', 10)
        if (Date.now() - lastTs < 60_000) return // 1분 내 reload 했으면 skip
        localStorage.setItem('mime_reload_ts', String(Date.now()))
      } catch { /* localStorage 차단 환경 — sessionStorage 가드만 사용 */ }
      sessionStorage.setItem('mime_reload', '1')
      forceReload()
    }
  })

  currentVersion = getLocalVersion()
  if (currentVersion) localStorage.setItem(VERSION_STORAGE_KEY, currentVersion)

  // 주기적 체크
  if (intervalId) clearInterval(intervalId)
  intervalId = setInterval(checkVersion, CHECK_INTERVAL_MS)

  // 탭 복귀 시 즉시 체크
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkVersion()
  })

  // 온라인 복구 시 체크
  window.addEventListener('online', checkVersion)
}
