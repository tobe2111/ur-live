/**
 * 📏 2026-10-08 (대표 "1,2 모두 진행해줘" — ① 실제로 잘 읽히는지 기록): **계산대 스캔 한 번 열 때마다 한 줄.**
 *
 * 🩸 왜 필요한가: 10-07 하루에 카메라를 세 번 고쳤다(파이프라인 · 렌즈 선택 · 첫 로딩). 세 번 다
 *   근거는 **대표의 신고와 추측**이었다 — 안 읽혔다는 사실은 사장님이 말해 줄 때만 알 수 있었고,
 *   고친 뒤 정말 나아졌는지는 **아무도 잴 수 없었다.** 못 읽는 것은 에러가 아니라서 로그가 안 남는다.
 *
 * 무엇을 남기나 (개인정보 없음 — 코드·상품·손님 정보는 보내지 않는다):
 *   · 카메라가 켜지기까지 · 첫 코드를 읽기까지 걸린 시간(ms)
 *   · 어느 디코더(네이티브/wasm)·네이티브가 못 읽어 넘겼는지 · 후면 렌즈 수 · 기억한 렌즈를 썼는지 · 렌즈를 다시 골랐는지
 *   · 결과 — 카메라로 읽음 / 사진으로 읽음 / 손으로 입력 / **못 읽고 닫음** / 카메라 실패
 *   · 도움말이 떴는지(7초 동안 못 읽었다는 뜻)
 *
 * 🔑 **"못 읽고 닫음"이 가장 값진 줄이다** — 실패는 화면이 닫힐 때(언마운트·pagehide)만 알 수 있다.
 *   그래서 성공은 첫 코드에서 **즉시** 보내고, 실패는 닫힐 때 보낸다. 한 세션 = 정확히 한 줄(`sent` 가드).
 * ⚠️ 첫 코드만 잰다 — 계산대는 하루 종일 열려 있어 두 번째 손님까지의 시간은 "읽는 시간"이 아니다.
 * ⚠️ 전송은 fail-soft — 기록 실패가 스캔을 막으면 안 된다(fetch keepalive, 응답 무시).
 */

export type ScanOutcome = 'read' | 'photo' | 'manual' | 'none' | 'camera_error'
export type ScanEngine = 'detector' | 'wasm'
export type ScanPlatform = 'ios' | 'android' | 'other'

export interface ScanSessionReport {
  platform: ScanPlatform
  engine: ScanEngine | null
  handed_over: 0 | 1
  cam_count: number | null
  lens_cached: 0 | 1
  lens_repicked: 0 | 1
  camera_ms: number | null
  first_read_ms: number | null
  outcome: ScanOutcome
  help_shown: 0 | 1
}

export const SCAN_TELEMETRY_URL = '/api/seller/scan-telemetry'

/** UA 는 세 갈래로만 접는다 — 기종 문자열을 통째로 남기지 않는다(지문 수집이 아니다). */
export function scanPlatform(ua: string, maxTouchPoints = 0): ScanPlatform {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  // iPadOS 13+ 는 데스크톱 사파리로 자기를 소개한다 — 터치 포인트로 가른다.
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'other'
}

type Clock = () => number
type Sender = (report: ScanSessionReport) => void

export interface ScanSession {
  cameraOpened(engine: ScanEngine, camCount: number, lens: { cached: boolean; repicked: boolean }): void
  handedOver(): void
  cameraFailed(): void
  helpShown(): void
  /** 첫 코드에서만 기록하고 즉시 보낸다. 이후 호출은 무시. */
  firstCode(source: 'read' | 'photo' | 'manual'): void
  /** 화면이 닫힐 때. 아직 아무것도 못 읽었으면 그것이 결과다. */
  end(): void
  /** 테스트·디버그용 — 지금까지 모인 값. */
  snapshot(): ScanSessionReport
}

export function createScanSession(send: Sender, platform: ScanPlatform, now: Clock = () => performance.now()): ScanSession {
  const t0 = now()
  const ms = () => Math.max(0, Math.round(now() - t0))
  const r: ScanSessionReport = {
    platform, engine: null, handed_over: 0, cam_count: null, lens_cached: 0, lens_repicked: 0,
    camera_ms: null, first_read_ms: null, outcome: 'none', help_shown: 0,
  }
  let failed = false
  let sent = false
  /** 호출자(firstCode·end)가 `sent` 를 먼저 본다 — 가드는 그 둘에 있다. */
  const flush = () => {
    sent = true
    try { send({ ...r }) } catch { /* fail-soft */ }
  }
  return {
    cameraOpened(engine, camCount, lens) {
      r.engine = engine  // 넘겨받은 뒤엔 wasm 으로 덮인다 — 실제로 읽은 디코더가 남는다
      r.cam_count = camCount
      if (lens.cached) r.lens_cached = 1
      if (lens.repicked) r.lens_repicked = 1
      if (r.camera_ms == null) r.camera_ms = ms()  // 처음 켜진 순간 = 사장님이 화면을 본 순간
      failed = false
    },
    handedOver() { r.handed_over = 1 },
    cameraFailed() { failed = true },
    helpShown() { r.help_shown = 1 },
    firstCode(source) {
      if (sent) return
      r.outcome = source
      r.first_read_ms = ms()
      flush()
    },
    end() {
      if (sent) return
      r.outcome = failed ? 'camera_error' : 'none'
      flush()
    },
    snapshot: () => ({ ...r }),
  }
}

/** 스캔과 **같은 신원**으로 보낸다(사장님 토큰, 없으면 스캔 전용 기기 키). 둘 다 없으면 서버가 버린다. */
export function sendScanReport(report: ScanSessionReport): void {
  try {
    const token = localStorage.getItem('seller_token')
    const deviceKey = !token ? localStorage.getItem('scan_device_key') : null
    if (!token && !deviceKey) return
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    else if (deviceKey) headers['X-Scan-Device-Key'] = deviceKey
    // keepalive — 페이지가 닫히는 순간(pagehide)에도 요청이 끝까지 간다.
    void fetch(SCAN_TELEMETRY_URL, { method: 'POST', keepalive: true, headers, body: JSON.stringify(report) }).catch(() => {})
  } catch { /* fail-soft */ }
}
