/**
 * 🔭 **QR 은 메인 렌즈로 읽는다** (2026-10-07 — 대표 *"이제 다 된거야? 가장 이상적이야?"*)
 *
 * ## 첫 수리에서 놓친 것 — 이것이 원인일 수 있다
 * 후면 렌즈가 여럿인 폰에서 `facingMode: 'environment'` 는 **어느 렌즈를 줄지 보장하지 않는다.**
 * 안드로이드 크롬은 기종에 따라 **초광각(0.5x)** 을 주는데, 초광각은 피사체가 작게 잡히고
 * **근거리 자동초점이 없거나 약하다** — 20~30cm 의 QR 이 흐릿하게 맺혀 해상도·초점 제약을
 * 아무리 걸어도 못 읽는다(그 렌즈엔 걸 초점이 없다). **네이티브 카메라 앱은 메인 렌즈로 자동
 * 전환한다.** 대표가 본 *"폰 카메라는 되는데 우리 건 안 된다"* 와 정확히 맞는 모양이다.
 *
 * ⚠️ 라벨로는 못 가른다 — 삼성은 `camera2 0, facing back` 처럼 이름에 렌즈 종류가 없다.
 * 그래서 각 렌즈를 잠깐 열어 **연속 초점 지원** 여부로 고른다(초광각은 대개 `fixed` 뿐).
 *
 * ## ❌ 이 시험이 못 보는 것
 * 실제 기기의 렌즈 구성과 그 렌즈가 정말 QR 을 읽는지. 여기서는 **판정 규칙**만 잰다 —
 * 가짜 `mediaDevices` 로 "어떤 렌즈를 고르는가" 를 실제로 돌려 본다.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  pickBestBackCamera,
  cachedBackCamera,
  needsLensRepick,
  listBackCameras,
  nextCamera,
  isAuxLensLabel,
  isFrontLabel,
  SCAN_CAMERA_KEY,
} from '@/components/voucher/scan-camera'
import { readCode } from '../helpers/source-text'

type Lens = { id: string; label: string; focus?: string[]; fails?: boolean }

/** 가짜 기기: 렌즈 목록 + 렌즈별 초점 능력. 어떤 렌즈를 열었는지 기록한다. */
function device(lenses: Lens[]) {
  const opened: string[] = []
  const stopped: string[] = []
  const md = {
    enumerateDevices: async () =>
      lenses.map((l) => ({ kind: 'videoinput', deviceId: l.id, label: l.label, groupId: '', toJSON() {} })) as MediaDeviceInfo[],
    getUserMedia: async (c: MediaStreamConstraints) => {
      const id = ((c.video as MediaTrackConstraints).deviceId as { exact: string }).exact
      const lens = lenses.find((l) => l.id === id)!
      if (lens.fails) throw new Error('NotReadableError')
      opened.push(id)
      const track = {
        getCapabilities: () => ({ focusMode: lens.focus ?? [] }),
        stop: () => { stopped.push(id) },
      }
      return { getVideoTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream
    },
  }
  return { md, opened, stopped }
}

beforeEach(() => { localStorage.clear() })

describe('🔭 렌즈 선택 (2026-10-07)', () => {
  it('🔴 ① 삼성형(이름에 렌즈 종류 없음) — 연속 초점 렌즈를 고른다, 초광각이 먼저여도', async () => {
    // 크롬이 초광각을 먼저 내놓는 그 모양이다.
    const { md } = device([
      { id: 'cam2', label: 'camera2 2, facing back', focus: ['fixed'] },          // 초광각
      { id: 'cam0', label: 'camera2 0, facing back', focus: ['continuous', 'single-shot'] }, // 메인
    ])
    expect(await pickBestBackCamera(md)).toBe('cam0')
  })

  it('🔴 ② 아이폰형(이름이 알려 줌) — 초광각·망원을 이름으로 먼저 거른다', async () => {
    const { md, opened } = device([
      { id: 'uw', label: 'Back Ultra Wide Camera', focus: ['continuous'] },
      { id: 'tele', label: 'Back Telephoto Camera', focus: ['continuous'] },
      { id: 'main', label: 'Back Camera', focus: ['continuous'] },
    ])
    expect(await pickBestBackCamera(md)).toBe('main')
    // 이름으로 걸러진 렌즈는 **열어 보지도 않는다**(첫 방문 지연을 줄인다).
    expect(opened).not.toContain('uw')
    expect(opened).not.toContain('tele')
  })

  it('③ 앞면 카메라는 후보가 아니다', async () => {
    const { md } = device([
      { id: 'front', label: 'Front Camera', focus: ['continuous'] },
      { id: 'back', label: 'Back Camera', focus: ['continuous'] },
    ])
    expect((await listBackCameras(md)).map((d) => d.deviceId)).toEqual(['back'])
    expect(await pickBestBackCamera(md)).toBe('back')
  })

  it('④ 검사하며 연 렌즈는 **전부 닫는다** — 안 닫으면 카메라를 하나만 열 수 있는 기기에서 본 스트림이 안 열린다', async () => {
    const { md, opened, stopped } = device([
      { id: 'a', label: 'camera2 2, facing back', focus: ['fixed'] },
      { id: 'b', label: 'camera2 0, facing back', focus: ['continuous'] },
    ])
    await pickBestBackCamera(md)
    expect(stopped.sort()).toEqual(opened.sort())
  })

  it('⑤ 고른 렌즈를 기억하고, 다음엔 열어 보지 않고 바로 쓴다', async () => {
    const lenses: Lens[] = [
      { id: 'a', label: 'camera2 2, facing back', focus: ['fixed'] },
      { id: 'b', label: 'camera2 0, facing back', focus: ['continuous'] },
    ]
    await pickBestBackCamera(device(lenses).md)
    expect(localStorage.getItem(SCAN_CAMERA_KEY)).toBe('b')
    const second = device(lenses)
    expect(await pickBestBackCamera(second.md)).toBe('b')
    expect(second.opened).toHaveLength(0)
  })

  it('⑥ 기억한 렌즈가 사라졌으면 다시 고른다 (다른 폰·렌즈 교체)', async () => {
    localStorage.setItem(SCAN_CAMERA_KEY, 'gone')
    const { md } = device([
      { id: 'a', label: 'camera2 2, facing back', focus: ['fixed'] },
      { id: 'b', label: 'camera2 0, facing back', focus: ['continuous'] },
    ])
    expect(await pickBestBackCamera(md)).toBe('b')
  })

  it('⑦ 권한 전(라벨·id 가 비어 있다)엔 아무것도 열지 않고 null — 기본 facingMode 로 간다', async () => {
    const { md, opened } = device([
      { id: '', label: '' },
      { id: '', label: '' },
    ])
    expect(await pickBestBackCamera(md)).toBeNull()
    expect(opened).toHaveLength(0)
  })

  it('⑧ 렌즈가 열리지 않아도 던지지 않는다 (여기서 던지면 카메라가 통째로 안 열린다)', async () => {
    const { md } = device([
      { id: 'a', label: 'camera2 0, facing back', fails: true },
      { id: 'b', label: 'camera2 1, facing back', focus: ['continuous'] },
    ])
    await expect(pickBestBackCamera(md)).resolves.toBe('b')
  })

  it('⑨ 연속 초점 렌즈가 하나도 없으면 첫 후보로 (아무것도 안 고르는 것보다 낫다)', async () => {
    const { md } = device([
      { id: 'a', label: 'camera2 0, facing back', focus: ['fixed'] },
      { id: 'b', label: 'camera2 1, facing back', focus: ['manual'] },
    ])
    expect(await pickBestBackCamera(md)).toBe('a')
    // 기억해야 한다 — 안 그러면 능력을 안 알려 주는 기기에서 계산대를 열 때마다 렌즈를 전부 다시 연다.
    expect(localStorage.getItem(SCAN_CAMERA_KEY)).toBe('a')
  })

  it('⑩ 직접 넘기기 — 다음 렌즈로 돌고, 고른 것을 기억한다', () => {
    const list = [{ deviceId: 'a' }, { deviceId: 'b' }, { deviceId: 'c' }] as MediaDeviceInfo[]
    expect(nextCamera(list, 'a')).toBe('b')
    expect(nextCamera(list, 'c')).toBe('a')
    expect(localStorage.getItem(SCAN_CAMERA_KEY)).toBe('a')
  })

  it('⑪ 이름 판정', () => {
    expect(isAuxLensLabel('Back Ultra Wide Camera')).toBe(true)
    expect(isAuxLensLabel('Back Telephoto Camera')).toBe(true)
    expect(isAuxLensLabel('camera2 0, facing back')).toBe(false)
    expect(isAuxLensLabel('Back Camera')).toBe(false)
    expect(isFrontLabel('Front Camera')).toBe(true)
    expect(isFrontLabel('camera2 1, facing front')).toBe(true)
  })
})

describe('🔌 배선', () => {
  const SRC = readCode('src/components/voucher/VoucherScanner.tsx')

  it('두 경로 모두 렌즈를 고른다 (한쪽만이면 그 기기에서만 고쳐진다)', () => {
    expect([...SRC.matchAll(/await pickBestBackCamera\(\)/g)].length).toBeGreaterThanOrEqual(2)
    expect([...SRC.matchAll(/await cachedBackCamera\(\)/g)].length).toBeGreaterThanOrEqual(2)
    expect([...SRC.matchAll(/needsLensRepick\(/g)].length).toBeGreaterThanOrEqual(2)
    expect(SRC).toMatch(/preferredCamera: chosen \?\? 'environment'/)
  })

  // ⚡ 2026-10-08 대표 "처음 카메라 불러오는데에도 시간이 많이 걸리네?" — 카메라를 띄우기 **전에**
  // 렌즈를 하나씩 열어 보던 것(렌즈마다 0.5~1초)이 원인이었다. 띄운 뒤, 필요할 때만 고른다.
  it('카메라를 띄우기 전에 렌즈를 열어 보지 않는다 (먼저 띄우고, 필요할 때만 고른다)', () => {
    expect(SRC).not.toMatch(/let chosen = await pickBestBackCamera\(\)/)
    expect(SRC).not.toMatch(/const chosen = await pickBestBackCamera\(\)/)
    expect(SRC).toMatch(/if \(!chosen && needsLensRepick\(stream\.getVideoTracks\(\)\[0\], cams\.length\)\)/)
    expect(SRC).toMatch(/if \(!chosen && needsLensRepick\(opened, cams\.length\)\)/)
  })

  it('첫 방문 재선택 전에 스트림을 놓는다 (카메라를 하나만 여는 기기)', () => {
    expect(SRC).toMatch(/stream\.getTracks\(\)\.forEach\(\(tr\) => tr\.stop\(\)\)\s*\n\s*chosen = await pickBestBackCamera\(\)/)
    expect(SRC).toMatch(/scanner\.stop\(\)\s*\n\s*const better = await pickBestBackCamera\(\)/)
  })

  it('렌즈를 정하면 facingMode 를 빼고 연다 (둘이 충돌하면 기기가 거부한다)', () => {
    expect(SRC).toMatch(/\{ deviceId: \{ exact: id \}, width:/)
  })

  it('렌즈가 둘 이상일 때만 전환 버튼을 낸다', () => {
    expect(SRC).toMatch(/cameraOn && backCams\.length > 1 &&/)
  })

  // 2026-10-07 대표 "카메라 전환버튼? 그런게 필요해?" — 평소엔 자동 선택이 맞으므로 늘 떠 있는
  // 버튼은 소음이다. 7초 동안 한 건도 못 읽었을 때 뜨는 도움말 안에만 둔다.
  it('전환 버튼은 도움말 패널 안에만 있다 (카메라 위에 늘 떠 있지 않다)', () => {
    const calls = [...SRC.matchAll(/void switchCamera\(\)/g)]
    expect(calls.length).toBe(1)
    const help = SRC.indexOf('{helpOpen && !cameraError && (')
    expect(help).toBeGreaterThan(0)
    const end = SRC.indexOf('\n      )}', help)
    expect(calls[0].index!).toBeGreaterThan(help)
    expect(calls[0].index!).toBeLessThan(end)
  })
})

describe('⚡ 빠른 길 (2026-10-08 — 카메라가 늦게 뜬다)', () => {
  const track = (label: string, focus?: string[]) =>
    ({ label, getCapabilities: () => (focus ? { focusMode: focus } : {}) }) as unknown as MediaStreamTrack

  it('기본 렌즈가 연속 초점이면 다시 고르지 않는다 (대부분의 폰)', () => {
    expect(needsLensRepick(track('camera2 0, facing back', ['continuous', 'manual']), 3)).toBe(false)
  })
  it('🔴 연속 초점이 없다고 알려 주면 다시 고른다 (초광각)', () => {
    expect(needsLensRepick(track('camera2 2, facing back', ['fixed']), 3)).toBe(true)
  })
  it('🔴 이름이 초광각·망원이면 다시 고른다', () => {
    expect(needsLensRepick(track('Back Ultra Wide Camera', ['continuous']), 3)).toBe(true)
  })
  it('능력을 안 알려 주면 기본 렌즈를 믿는다 (근거 없이 렌즈를 다 열지 않는다)', () => {
    expect(needsLensRepick(track('Back Camera'), 3)).toBe(false)
  })
  it('렌즈가 하나뿐이면 바꿀 곳이 없다', () => {
    expect(needsLensRepick(track('camera2 2, facing back', ['fixed']), 1)).toBe(false)
  })
  it('기억해 둔 렌즈는 **열어 보지 않고** 돌려준다, 사라졌으면 null', async () => {
    const { md, opened } = device([
      { id: 'a', label: 'camera2 0, facing back', focus: ['continuous'] },
      { id: 'b', label: 'camera2 2, facing back', focus: ['fixed'] },
    ])
    expect(await cachedBackCamera(md)).toBeNull()
    localStorage.setItem(SCAN_CAMERA_KEY, 'b')
    expect(await cachedBackCamera(md)).toBe('b')
    localStorage.setItem(SCAN_CAMERA_KEY, 'gone')
    expect(await cachedBackCamera(md)).toBeNull()
    expect(opened).toEqual([])
  })
})
