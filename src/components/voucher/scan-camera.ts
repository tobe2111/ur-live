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

/**
 * 🔭 **어느 렌즈로 보는가** (2026-10-07 — 대표 *"이제 다 된거야? 가장 이상적이야?"* 에 답하다 찾은 것)
 *
 * 🩸 **이것이 대표가 겪은 증상의 원인일 수 있다 — 첫 수리에서 놓쳤다.**
 *   후면 렌즈가 여럿인 폰(갤럭시 S·울트라, 아이폰 프로)에서 `facingMode: 'environment'` 는
 *   **어느 렌즈를 줄지 보장하지 않는다.** 안드로이드 크롬은 기종에 따라 **초광각(0.5x)** 을 주는데,
 *   초광각은 ① 피사체가 작게 잡히고 ② **근거리 자동초점이 없거나 약하다.** 20~30cm 의 QR 은
 *   흐릿하게 맺혀 **해상도·초점 제약을 아무리 걸어도 못 읽는다** — 그 렌즈엔 걸 초점이 없다.
 *   **네이티브 카메라 앱은 메인 렌즈로 자동 전환한다.** 그래서 "폰 카메라는 되는데 우리 건 안 된다"
 *   는 증상과 정확히 맞는다(웹 QR 스캐너 라이브러리들이 반복해서 받는 신고가 이것이다).
 *
 * ⚠️ **라벨만으로는 못 가른다** — 아이폰은 `Back Ultra Wide Camera` 처럼 알려 주지만 삼성은
 *   `camera2 0, facing back` · `camera2 2, facing back` 이라 어느 게 초광각인지 이름에 없다.
 *   그래서 **각 렌즈를 잠깐 열어 연속 초점을 지원하는지** 본다(초광각은 대개 `fixed` 뿐이다).
 *   한 번 고르면 기억해 두므로 다음부터는 바로 그 렌즈로 연다.
 *
 * 이 판정은 **권한을 받은 뒤에만** 의미가 있다 — 그 전엔 `enumerateDevices()` 가 라벨을 비워 준다.
 */
export const SCAN_CAMERA_KEY = 'scan_camera_device_id'

/** 이름으로 앞면·초광각·망원을 걸러낸다. 이름이 비어 있으면(삼성) 아무것도 안 거른다. */
export function isFrontLabel(label: string): boolean {
  return /front|user|facetime|전면|셀카/i.test(label)
}
export function isAuxLensLabel(label: string): boolean {
  return /ultra\s*wide|ultrawide|0\.5|telephoto|망원|초광각/i.test(label)
}

type MediaDevicesLike = Pick<MediaDevices, 'enumerateDevices' | 'getUserMedia'>

function readCachedCamera(): string | null {
  try { return localStorage.getItem(SCAN_CAMERA_KEY) } catch { return null }
}
export function rememberCamera(deviceId: string): void {
  try { localStorage.setItem(SCAN_CAMERA_KEY, deviceId) } catch { /* 사생활 보호 모드 */ }
}

/** 후면 카메라 목록(앞면 제외). 권한 전이면 라벨이 비어 있어 전부 남는다. */
export async function listBackCameras(md: MediaDevicesLike | undefined = navigator?.mediaDevices): Promise<MediaDeviceInfo[]> {
  if (!md?.enumerateDevices) return []
  try {
    const all = (await md.enumerateDevices()).filter((d) => d.kind === 'videoinput')
    const back = all.filter((d) => !isFrontLabel(d.label))
    return back.length ? back : all
  } catch {
    return []
  }
}

/**
 * 🎯 **QR 을 읽기 가장 좋은 후면 렌즈를 고른다.** 기억해 둔 것이 아직 있으면 그것.
 * 없으면: 이름으로 걸러지는 보조 렌즈를 빼고 → 남은 렌즈를 하나씩 잠깐 열어 **연속 초점**을
 * 지원하는 첫 렌즈를 고른다 → 그런 렌즈가 없으면 남은 것 중 첫째.
 *
 * 실패해도 던지지 않는다(`null` = "기본 facingMode 로 가라"). 여기서 던지면 카메라가 안 열린다.
 */
export async function pickBestBackCamera(md: MediaDevicesLike | undefined = navigator?.mediaDevices): Promise<string | null> {
  const back = await listBackCameras(md)
  if (back.length === 0) return null
  const cached = readCachedCamera()
  if (cached && back.some((d) => d.deviceId === cached)) return cached
  if (back.length === 1) return back[0].deviceId || null

  const main = back.filter((d) => !isAuxLensLabel(d.label))
  const candidates = main.length ? main : back
  for (const d of candidates) {
    if (!d.deviceId) continue
    let stream: MediaStream | null = null
    try {
      stream = await md!.getUserMedia({ video: { deviceId: { exact: d.deviceId } } })
      const caps = stream.getVideoTracks()[0]?.getCapabilities?.() as { focusMode?: string[] } | undefined
      if (caps?.focusMode?.includes('continuous')) {
        rememberCamera(d.deviceId)
        return d.deviceId
      }
    } catch {
      /* 그 렌즈는 못 연다 — 다음 */
    } finally {
      stream?.getTracks().forEach((t) => t.stop())
    }
  }
  return candidates[0]?.deviceId || null
}

/** 다음 후면 렌즈(사장님이 직접 넘길 때). 고른 것은 기억한다 — 기기마다 맞는 렌즈가 다르다. */
export function nextCamera(list: MediaDeviceInfo[], currentId: string | null): string | null {
  if (list.length === 0) return null
  const i = list.findIndex((d) => d.deviceId === currentId)
  const next = list[(i + 1) % list.length]?.deviceId || null
  if (next) rememberCamera(next)
  return next
}
