/**
 * 📷 **계산대 카메라 설정 · 디코딩 폴백** (2026-10-07 — 대표 *"QR 코드는 정말 중요해"*)
 *
 * 대표 신고: *"휴대폰 카메라는 되는데 우리 유어딜 페이지에서 매장 계산대로 카메라를 켰을 때 QR
 * 인식을 잘 못하는데?"* → *"아이폰 아니라 안드로이드였는데도"* → *"노트북에 있는 QR코드를
 * 휴대폰으로 했었어"*.
 *
 * 🔑 **증거가 가리키는 곳은 카메라다** (대표가 바로잡아 준 것): **같은 QR** 을 네이티브 카메라는
 *   읽었다. 그러니 QR 그림 자체가 못 읽을 물건은 아니고, 차이는 **파이프라인**에 있다 —
 *   네이티브 카메라는 센서 전체 해상도 + 연속 초점 + 다중 프레임 합성으로 본다.
 *   우리는 `{ facingMode }` 하나만 요청해 **640×480 · 초점 제약 없음 · 초당 3회**로 봤다.
 *
 * 이 모듈은 그 격차를 좁히는 것만 담는다. 화면 밝기(웹에서 못 올린다)와 유리 반사는 못 고치므로
 * **사진으로 읽기**(`scanImageFile`)를 마지막 통로로 둔다 — 네이티브 카메라로 찍은 사진이나
 * 노트북 스크린샷이면 그 좋은 파이프라인의 결과물을 그대로 쓰는 셈이다.
 */

/** 프레임 검사 간격(ms) — 초당 약 8회. detect() 완료 후에 다음 tick 을 잡으므로 상한일 뿐이다. */
export const SCAN_TICK_MS = 120

/**
 * ⏱️ 네이티브 디코더에 주는 유예(ms). 이 안에 **한 번도** 못 읽으면 wasm 으로 넘긴다.
 * 6초는 "사장님이 QR 을 비췄는데 반응이 없다" 를 느끼기 시작하는 지점이자, 아직 안 비춘
 * 사람에게는 전환이 일어나도 해가 없는 길이다(전환해도 기능은 같다 — 조금 더 무거울 뿐).
 */
export const DETECTOR_GRACE_MS = 6000

/** 이만큼 아무것도 못 읽으면 **화면이 말한다**(종전엔 영원히 조용했다 — 그게 대표가 겪은 증상이다). */
export const SCAN_HELP_AFTER_MS = 7000

/**
 * 📷 **카메라에 해상도를 요구한다.**
 *
 * 🩸 종전엔 `{ facingMode: 'environment' }` **하나만** 넘겼다. 그러면 브라우저가 기본 해상도를
 *   고르는데 보통 **640×480** 이다. 노트북 화면의 QR 은 멀어서 작고 반사·모아레까지 겹치므로
 *   그 해상도에서는 모듈 하나가 몇 픽셀밖에 안 된다.
 *
 * `ideal` 이라 지원 못 하는 기기에서도 **실패하지 않고** 가능한 해상도로 떨어진다(`exact` 금지 —
 * 그러면 구형 업소용 기기에서 카메라가 **아예 안 열린다**).
 */
export const SCAN_VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: 'environment',
  width: { ideal: 1920 },
  height: { ideal: 1080 },
}

/**
 * 🎯 **화면에 보이는 만큼 전부 판독한다** (wasm 디코더 전용).
 *
 * 🩸 qr-scanner 의 기본 `calculateScanRegion` 은 **중앙 정사각형(짧은 변의 2/3)** 만 보고, 우리는
 *   `highlightScanRegion: false` 라 **그 영역이 화면에 안 보인다**(소스 실측:
 *   `Math.round(2/3 * Math.min(videoWidth, videoHeight))`, `downScaled 400`).
 *   ⇒ 사장님은 화면 전체를 보고 조준하는데 판독은 보이지 않는 가운데 일부에서만 일어난다.
 *   가장자리에 걸치면 **아무 일도 안 난다 — 에러도 안 뜬다.**
 *
 * ⚠️ 해상도를 올렸으니 **다운스케일도 같이 올려야 한다** — 기본 400 으로 줄이면 1080p 로 받은
 *   디테일을 도로 버린다(둘은 짝이다. 한쪽만 고치면 효과가 상쇄된다).
 *   긴 변 960 상한은 wasm 디코딩 비용과의 타협이다(초당 8회 × 960 은 폰에서 여유).
 */
export function fullFrameScanRegion(v: { videoWidth: number; videoHeight: number }) {
  const w = v.videoWidth || 640
  const h = v.videoHeight || 480
  const k = Math.min(1, 960 / Math.max(w, h))
  return {
    x: 0,
    y: 0,
    width: w,
    height: h,
    downScaledWidth: Math.round(w * k),
    downScaledHeight: Math.round(h * k),
  }
}

/**
 * 🔧 **열린 스트림에 "잘 보이는" 설정을 다시 요구한다.**
 *
 * - **해상도**: `getUserMedia` 때 못 받았거나(wasm 디코더는 스스로 `{ facingMode }` 만 요청한다 —
 *   소스 실측) 트랙이 더 줄 수 있는 경우를 위해 한 번 더.
 * - **연속 초점**: 계산대 QR 은 20~40cm 근거리다. 초점이 안 맞으면 해상도가 아무리 높아도
 *   **절대 안 읽힌다.** `advanced` 는 지원 못 하는 기기에서 **조용히 무시**되므로 안전하다.
 * - **확대**: 노트북 화면처럼 멀리 있는 QR 을 위해. 기기가 보고한 범위 안에서만 올린다.
 *
 * 전부 **fail-soft** — 거부돼도 종전 그대로 쓴다. 여기서 던지면 카메라가 통째로 안 열린다.
 */
export async function applyBestCameraSettings(
  track: MediaStreamTrack | undefined | null,
  opts?: { zoom?: number },
): Promise<void> {
  if (!track?.applyConstraints) return
  try { await track.applyConstraints({ width: { ideal: 1920 }, height: { ideal: 1080 } }) } catch { /* 기기 한계 */ }
  try {
    // TS 의 `MediaTrackConstraintSet` 에는 `focusMode`/`zoom` 이 없다(표준 밖 확장) — unknown 경유.
    await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] } as unknown as MediaTrackConstraints)
  } catch { /* 초점 제약 미지원 — 자동 초점에 맡긴다 */ }
  if (!opts?.zoom) return
  try {
    const caps = track.getCapabilities?.() as { zoom?: { min: number; max: number } } | undefined
    const z = caps?.zoom
    if (!z || !(z.max > z.min)) return  // 확대를 못 하는 기기 — 손으로 가까이 가야 한다
    const want = Math.min(z.max, Math.max(z.min, opts.zoom))
    await track.applyConstraints({ advanced: [{ zoom: want }] } as unknown as MediaTrackConstraints)
  } catch { /* 무시 */ }
}

/**
 * 🖼️ **사진 한 장에서 QR 을 읽는다** — 카메라가 어떤 이유로든 안 될 때의 마지막 통로.
 *
 * 대표의 관찰이 이 폴백의 근거다 — **네이티브 카메라는 읽었다.** 그러니 그 카메라로 찍은 사진을
 * 받으면 우리도 읽을 수 있다(노트북이면 스크린샷도 된다). 코드를 손으로 받아 치는 것보다
 * 훨씬 빠르고, 대소문자·오타 사고도 없다.
 *
 * 못 읽으면 `null` — 호출부가 안내한다. 여기서 던지지 않는다.
 */
export async function scanImageFile(file: Blob): Promise<string | null> {
  try {
    const QrScanner = (await import('qr-scanner')).default
    const res = await QrScanner.scanImage(file, { returnDetailedScanResult: true })
    return (res as { data?: string })?.data || null
  } catch {
    return null
  }
}
