/**
 * 📷 **계산대 카메라가 QR 을 읽는다** (2026-10-07 대표 신고)
 *
 * 대표: *"휴대폰 카메라는 되는데 우리 유어딜 페이지에서 매장 계산대로 카메라를 켰을 때 QR 인식을
 * 잘 못하는데?"* → *"아이폰 아니라 안드로이드였는데도 안되네?"* → *"노트북에 있는 QR코드를
 * 휴대폰으로 했었어 안드로이드 카메라로"*.
 *
 * ## 세 가지가 겹쳐 있었다 (안드로이드 경로)
 * 1. **`'BarcodeDetector' in window` 하나만 보고 그 경로로 들어가 영영 머물렀다.** 안드로이드
 *    크롬의 그 API 는 Google Play 서비스 바코드 모듈 위에 얹혀 있어, 모듈이 안 깔린 기기에서는
 *    **객체는 존재하는데 `detect()` 가 늘 빈 배열**을 돌려준다. 빈 배열은 *"QR 이 화면에 없다"* 와
 *    **구분이 안 된다** — 에러도 로그도 없다. 사장님 눈엔 "켜졌는데 아무 반응이 없다" 로만 보인다.
 * 2. **해상도를 요청하지 않았다** (`{ facingMode: 'environment' }` 뿐) → 브라우저 기본 640×480.
 *    노트북 화면의 QR 은 작고 반사·모아레가 겹쳐 해상도가 특히 크게 작용한다.
 * 3. **350ms 마다 한 번**(초당 3회)만 검사했다.
 *
 * 아이폰(폴백) 쪽엔 하나 더 있었다 — qr-scanner 기본 `calculateScanRegion` 이 **중앙 정사각형
 * (짧은 변의 2/3)** 만 보는데 `highlightScanRegion: false` 라 그 영역이 **화면에 안 보인다**.
 *
 * ## ⚠️ 이 시험이 **못** 보는 것
 * jsdom 엔 카메라도 `BarcodeDetector` 도 wasm 디코더도 없다 — **실제 인식률은 여기서 못 잰다.**
 * 그 판정은 기기에서 QR 을 찍어 봐야 한다(E4). 여기서는 **규약**만 고정한다: 해상도를 요구하는가 ·
 * 지원 포맷을 묻는가 · 실패를 관측하면 넘기는가 · 스캔영역이 전체 프레임인가 · 네이티브 경로를
 * 지우지 않았는가(dual-mode 유지 룰).
 */
import { describe, it, expect } from 'vitest'
import {
  SCAN_VIDEO_CONSTRAINTS,
  SCAN_TICK_MS,
  DETECTOR_GRACE_MS,
  SCAN_HELP_AFTER_MS,
  fullFrameScanRegion,
  applyBestCameraSettings,
} from '@/components/voucher/scan-camera'
import { readCode } from '../helpers/source-text'

const SRC = readCode('src/components/voucher/VoucherScanner.tsx')
const CAM = readCode('src/components/voucher/scan-camera.ts')

describe('① 카메라에 해상도를 요구한다', () => {
  it('1080p 를 ideal 로 요구한다 — exact 면 구형 기기에서 카메라가 아예 안 열린다', () => {
    expect(SCAN_VIDEO_CONSTRAINTS.facingMode).toBe('environment')
    expect(SCAN_VIDEO_CONSTRAINTS.width).toEqual({ ideal: 1920 })
    expect(SCAN_VIDEO_CONSTRAINTS.height).toEqual({ ideal: 1080 })
    expect(JSON.stringify(SCAN_VIDEO_CONSTRAINTS)).not.toContain('exact')
  })

  it('두 경로 모두 같은 헬퍼를 쓴다 (한쪽만 올리면 그 기기에서만 고쳐진다)', () => {
    // 🩸 첫 판은 `applyConstraints({ width: ...` 를 **화면 파일에서** 찾았는데, 그 호출을 SSOT 로
    //   옮기자 앵커가 사라져 빨간불이 났다(가드가 제 일을 한 경우다 — 지우지 않고 재조준한다).
    //   화면은 **위임**만 하고, 제약을 실제로 거는 곳은 `scan-camera.ts` 다.
    expect(SRC).toMatch(/getUserMedia\(\{ video: SCAN_VIDEO_CONSTRAINTS \}\)/)
    // 네이티브·wasm **두 경로 모두** 헬퍼를 부른다(둘 중 하나만이면 그 기기에서만 고쳐진다).
    expect([...SRC.matchAll(/applyBestCameraSettings\(/g)]).toHaveLength(2)
    expect(CAM).toMatch(/applyConstraints\(\{ width: \{ ideal: 1920 \}/)
    // 종전의 맨 facingMode 요청이 남아 있으면 안 된다.
    expect(SRC).not.toMatch(/getUserMedia\(\{ video: \{ facingMode: 'environment' \} \}\)/)
  })

  it('🔑 초점 제약도 함께 건다 — 근거리 QR 은 초점이 안 맞으면 해상도가 무의미하다', () => {
    expect(CAM).toMatch(/focusMode: 'continuous'/)
    // 지원 못 하는 기기에서 **던지면 카메라가 통째로 안 열린다** — 반드시 삼킨다.
    expect(CAM).toMatch(/focusMode: 'continuous'[\s\S]{0,160}catch/)
  })

  it('헬퍼는 트랙이 없거나 거부해도 던지지 않는다 (fail-soft)', async () => {
    await expect(applyBestCameraSettings(null)).resolves.toBeUndefined()
    await expect(applyBestCameraSettings(undefined)).resolves.toBeUndefined()
    const hostile = {
      applyConstraints: () => Promise.reject(new Error('OverconstrainedError')),
      getCapabilities: () => { throw new Error('nope') },
    } as unknown as MediaStreamTrack
    await expect(applyBestCameraSettings(hostile, { zoom: 2 })).resolves.toBeUndefined()
  })

  it('확대는 기기가 보고한 범위 안에서만 — 범위 밖 값을 밀어 넣지 않는다', async () => {
    const seen: unknown[] = []
    const track = {
      applyConstraints: (c: unknown) => { seen.push(c); return Promise.resolve() },
      getCapabilities: () => ({ zoom: { min: 1, max: 1.5 } }),
    } as unknown as MediaStreamTrack
    await applyBestCameraSettings(track, { zoom: 2 })
    const zoomCall = seen.find((c) => JSON.stringify(c).includes('zoom')) as
      | { advanced: Array<{ zoom: number }> }
      | undefined
    expect(zoomCall?.advanced?.[0]?.zoom).toBe(1.5)
  })

  /**
   * 🩸 첫 판은 `getCapabilities: () => ({})` 만 썼는데, 그 경우엔 조기반환을 지워도 **다음 줄의
   *   `z.max` 가 던져서** try/catch 가 삼킨다 → 결함을 심어도 초록이었다(주입 러너가 잡았다).
   *   진짜 위험한 모양은 **zoom 을 보고하는데 범위가 없는** 기기다. 거기서는 조기반환이 없으면
   *   의미 없는 `zoom: 1` 제약이 나가고, 그 거부가 같이 보낸 설정까지 날릴 수 있다.
   */
  it('확대를 못 하는 기기에는 요구하지 않는다 (거부가 다른 제약까지 날릴 수 있다)', async () => {
    const calls = async (caps: unknown) => {
      const seen: unknown[] = []
      const track = {
        applyConstraints: (c: unknown) => { seen.push(c); return Promise.resolve() },
        getCapabilities: () => caps,
      } as unknown as MediaStreamTrack
      await applyBestCameraSettings(track, { zoom: 2 })
      return seen.filter((c) => JSON.stringify(c).includes('zoom'))
    }
    expect(await calls({})).toHaveLength(0)                      // zoom 을 아예 안 보고하는 기기
    expect(await calls({ zoom: { min: 1, max: 1 } })).toHaveLength(0)  // 보고하지만 범위가 없다
  })
})

describe('⑤ 못 읽을 때 화면이 말한다 · 사진으로 읽는다', () => {
  it('영원히 조용하지 않다 — 일정 시간 한 건도 못 읽으면 안내가 뜬다', () => {
    expect(SCAN_HELP_AFTER_MS).toBeGreaterThanOrEqual(4000)
    expect(SCAN_HELP_AFTER_MS).toBeLessThanOrEqual(15000)
    expect(SRC).toMatch(/if \(!sawAnyRef\.current\) setHelpOpen\(true\)/)
  })

  it('한 건이라도 읽혔으면 안내를 띄우지 않는다 (그 기기는 멀쩡하다)', () => {
    // 네이티브·wasm·사진 — 읽힌 모든 경로가 같은 표식을 올린다.
    expect([...SRC.matchAll(/sawAnyRef\.current = true/g)].length).toBeGreaterThanOrEqual(3)
  })

  it('사진으로 읽는 통로가 **늘** 있다 (카메라가 안 되는 이유는 우리가 못 고치는 것도 있다)', () => {
    expect(SRC).toMatch(/onChange=\{onPickPhoto\}/)
    expect(SRC).toMatch(/scanImageFile\(file\)/)
    // `capture` 를 붙이면 이미 찍어 둔 사진·노트북 스크린샷을 못 고른다.
    expect(SRC).not.toMatch(/capture=/)
  })

  it('사진에서 못 찾으면 말해 준다 (조용히 아무 일도 안 하면 안 된다)', () => {
    expect(SRC).toMatch(/else setCameraError\(/)
  })
})

describe('② "있다" 와 "읽는다" 를 구분한다', () => {
  it('지원 포맷을 실제로 묻고, qr_code 가 없으면 wasm 으로 간다', () => {
    expect(SRC).toContain('getSupportedFormats')
    expect(SRC).toMatch(/supported = fmts\.includes\('qr_code'\)/)
    expect(SRC).toMatch(/if \(!supported\) \{ await startWasm\(\); return \}/)
  })

  it('한 번도 못 읽으면 자동으로 넘긴다 — 빈 배열은 "QR 이 없다" 와 구분되지 않는다', () => {
    // 유예는 있어야 하고(즉시 전환하면 잘 도는 기기도 넘긴다), 너무 길면 수리가 무의미하다.
    expect(DETECTOR_GRACE_MS).toBeGreaterThanOrEqual(3000)
    expect(DETECTOR_GRACE_MS).toBeLessThanOrEqual(10000)
    // 전환 조건은 **아무것도 못 읽었을 때**에 걸려 있어야 한다. 한 번이라도 읽었으면 그 기기는
    // 멀쩡하므로 넘기지 않는다(그 조건이 빠지면 읽는 중에도 카메라가 재시작된다).
    expect(SRC).toMatch(/if \(!sawAnything && \([\s\S]{0,120}DETECTOR_GRACE_MS\)\) \{ handOver\(\); return \}/)
    expect(SRC).toMatch(/sawAnything = true/)
    // 넘기기 전에 스트림을 놓아야 카메라를 다시 열 수 있다.
    expect(SRC).toMatch(/handOver = \(\) => \{[\s\S]{0,400}getTracks\(\)[\s\S]{0,200}startWasm\(\)/)
  })

  it('🔒 네이티브 경로를 지우지 않는다 (dual-mode 유지 — 잘 도는 기기에선 더 가볍다)', () => {
    expect(SRC).toContain("BarcodeDetector({ formats: ['qr_code'] })")
    expect(SRC).toMatch(/hasDetector/)
  })
})

describe('③ 초당 검사 횟수', () => {
  it('마법의 숫자 350 이 아니라 상수이고, 초당 6회 이상이다', () => {
    expect(SCAN_TICK_MS).toBeLessThanOrEqual(150)
    expect(SCAN_TICK_MS).toBeGreaterThanOrEqual(60)
    expect(SRC).toMatch(/setTimeout\(tick, SCAN_TICK_MS\)/)
    expect(SRC).not.toMatch(/setTimeout\(tick, 350\)/)
  })
})

describe('④ 보이는 만큼 판독한다 (wasm 경로)', () => {
  it('중앙 크롭이 아니라 전체 프레임이다', () => {
    const r = fullFrameScanRegion({ videoWidth: 1920, videoHeight: 1080 })
    expect(r.x).toBe(0)
    expect(r.y).toBe(0)
    expect(r.width).toBe(1920)
    expect(r.height).toBe(1080)
  })

  it('해상도를 올린 만큼 다운스케일도 올린다 — 기본 400 이면 1080p 디테일을 도로 버린다', () => {
    const big = fullFrameScanRegion({ videoWidth: 1920, videoHeight: 1080 })
    expect(Math.max(big.downScaledWidth, big.downScaledHeight)).toBe(960)
    expect(big.downScaledWidth).toBeGreaterThan(400)
    // 비율이 유지돼야 한다(찌그러지면 디코더가 못 읽는다).
    expect(big.downScaledWidth / big.downScaledHeight).toBeCloseTo(1920 / 1080, 2)
  })

  it('작은 프레임은 늘리지 않는다 (업스케일은 정보를 더하지 않는다)', () => {
    const small = fullFrameScanRegion({ videoWidth: 640, videoHeight: 480 })
    expect(small.downScaledWidth).toBe(640)
    expect(small.downScaledHeight).toBe(480)
  })

  it('프레임 크기를 아직 모를 때도 0 을 돌려주지 않는다 (0 이면 디코더가 통째로 멎는다)', () => {
    const zero = fullFrameScanRegion({ videoWidth: 0, videoHeight: 0 })
    expect(zero.width).toBeGreaterThan(0)
    expect(zero.downScaledWidth).toBeGreaterThan(0)
  })

  it('그 함수가 실제로 배선돼 있다 (기본값은 보이지 않는 중앙 일부만 본다)', () => {
    expect(SRC).toMatch(/calculateScanRegion: fullFrameScanRegion/)
  })
})
