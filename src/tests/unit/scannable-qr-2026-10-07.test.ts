/**
 * 🎟️ **스캔받는 QR 은 한 부품으로 그린다** (2026-10-07)
 *
 * ## ⚠️ 먼저 — 이것은 대표가 겪은 "안 읽힌다" 의 **원인이 아니다**
 * 대표가 바로잡아 줬다: *"QR사진이 문제가 아니라 촬영 카메라가 문제 아니야?"* 맞다 —
 * **같은 QR 을 네이티브 카메라는 읽었다.** 원인은 우리 카메라 파이프라인이고, 그쪽은
 * `scan-camera.ts` + `scan-camera-engine-2026-10-07.test.ts` 가 다룬다.
 *
 * 여기서 고치는 것은 **여유**다. 종전 `QRModal` 의 조합은 그 자체로 둘이 틀려 있었다:
 * 1. `includeMargin={false}` — QR 표준이 요구하는 **4모듈 조용영역이 없다**(밖의 `p-2` 는
 *    160px/25모듈 기준 1.25모듈). 스캐너는 그 여백으로 심볼 경계를 찾는다.
 * 2. `dark:bg-[#11141C]` — **다크모드에서 QR 둘레가 검정**이 된다. 모듈도 검정이니 파인더 패턴
 *    경계가 배경에 녹는다. 대표는 **노트북**으로 봤다. QR 은 테마를 따르는 그림이 아니다.
 * 여유가 없는 QR 은 좋은 카메라만 읽는다 — 네이티브는 읽고 480p 웹 스트림은 못 읽는 그 차이가
 * 정확히 "여유" 다.
 *
 * ## 왜 부품으로 묶나
 * 레포에 QR 을 그리는 자리가 **아홉 곳**이고 각자 속성을 손으로 적고 있었다(이 레포가 반복해
 * 당한 두 벌 드리프트). 스캔 성공률이 중요한 자리만 한 부품으로 고정한다 — 장식용(앱 다운로드·
 * 유어샵 링크)은 대상이 아니다. 거긴 스캔 실패가 손님을 세우지 않는다.
 *
 * ## ❌ 이 시험이 못 보는 것
 * 실제 인식률 · 화면 밝기 · 유리 반사. 그 판정은 기기에서 찍어 봐야 한다(E4).
 */
import { describe, it, expect } from 'vitest'
import { QUIET_ZONE_MODULES, SCANNABLE_QR_MIN_PX } from '@/components/voucher/ScannableQr'
import { readCode } from '../helpers/source-text'

const QR = readCode('src/components/voucher/ScannableQr.tsx')
/** 손님이 사장님에게 보여 주는 QR · 사장님이 직원 폰에 보여 주는 QR — 둘 다 "남이 찍는다". */
const SCANNED_BY_OTHERS = [
  'src/pages/my-vouchers/QRModal.tsx',
  'src/pages/seller-scan/ScanDeviceManager.tsx',
]

describe('① 규격을 지킨다', () => {
  it('조용영역 4모듈 — 줄이면 스캐너가 심볼 경계를 못 찾는다', () => {
    expect(QUIET_ZONE_MODULES).toBeGreaterThanOrEqual(4)
    expect(QR).toMatch(/marginSize=\{QUIET_ZONE_MODULES\}/)
    // 종전의 "여백 없음" 이 돌아오면 안 된다.
    expect(QR).not.toMatch(/includeMargin=\{false\}/)
  })

  it('테마와 무관하게 흰 바탕 · 검정 모듈 — 다크에서 둘레가 검정이 되면 안 된다', () => {
    expect(QR).toMatch(/bgColor="white"/)
    expect(QR).toMatch(/fgColor="black"/)
    expect(QR).toContain('light-island')  // 안쪽 `dark:` 를 통째로 끈다
    expect(QR).not.toMatch(/dark:bg-/)
  })

  it('스캔용 최소 크기 바닥이 있다 (호출부가 작게 넘겨도 내려가지 않는다)', () => {
    expect(SCANNABLE_QR_MIN_PX).toBeGreaterThanOrEqual(200)
    expect(QR).toMatch(/Math\.max\(SCANNABLE_QR_MIN_PX, size\)/)
  })
})

describe('② 남이 찍는 QR 은 손으로 그리지 않는다', () => {
  it.each(SCANNED_BY_OTHERS)('%s 가 부품을 쓴다', (f) => {
    const src = readCode(f)
    expect(src).toMatch(/<ScannableQr\b/)
    // 그 파일이 QR 속성을 다시 적고 있으면 두 벌이 되어 반드시 갈린다.
    expect(src).not.toMatch(/<QRCodeSVG\b/)
    expect(src).not.toMatch(/includeMargin|marginSize/)
  })
})
