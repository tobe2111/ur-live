/**
 * ✅ 사장님 QR 스캔 — 확인한 뒤에만 사용 처리 (2026-10-06 대표)
 *
 *   *"매장 사장이 손님의 QR을 찍을 때 그래도 찍고나서 확인될 때 팝업창으로
 *     사용처리 하시겠습니까? 라고 물어보는게 맞잖아."*
 *
 * 종전엔 비추는 **순간** `use-by-seller` 가 나갔다. 사용은 되돌릴 수 없고(환불 자격이 바뀐다),
 * 카메라는 옆 손님 화면이나 사진 속 QR 도 읽는다.
 *
 * 지키는 것:
 *   ① 카메라·수동 입력은 **조회만** 한다(`/verify/` — 소비하지 않는 엔드포인트)
 *   ② `useVoucher`(= 사용 처리)는 확인 버튼 한 곳에서만 불린다
 *   ③ 확인창이 "사용 처리하시겠습니까?" 를 묻고, 못 쓰는 이용권엔 버튼을 안 낸다
 *   ④ 카메라 루프가 콜백 변화로 재시작되지 않는다(ref 로 부른다 — 매 상태 변화마다 카메라가 꺼졌다 켜지면 안 된다)
 *
 * ⚠️ 못 막는 것: 실제 카메라 인식 · 확인창이 뜬 동안 다른 QR 을 무시하는지(런타임 상태). 그 판정은 매장 실기기다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const SRC = stripComments(readFileSync('src/components/voucher/VoucherScanner.tsx', 'utf-8'))

describe('✅ 스캔 → 확인 → 사용 처리', () => {
  it('① 조회는 소비하지 않는 /verify/ 로 한다', () => {
    expect(SRC).toMatch(/api\.get\(`\/api\/group-buy\/verify\//)
  })

  it('② 사용 처리(useVoucher 호출)는 확인 버튼 한 곳뿐이다', () => {
    const calls = SRC.match(/\buseVoucher\(code\)/g) || []
    expect(calls.length, '카메라·수동 입력이 useVoucher 를 직접 부르면 확인 없이 소비된다').toBe(1)
    const at = SRC.indexOf('useVoucher(code)')
    const confirmAt = SRC.indexOf('const confirmPending')
    expect(confirmAt).toBeGreaterThan(-1)
    expect(at, '그 한 곳이 confirmPending 안이어야 한다').toBeGreaterThan(confirmAt)
  })

  it('카메라 두 경로와 수동 입력이 모두 확인 단계로 간다', () => {
    expect((SRC.match(/requestUseRef\.current\(code\)/g) || []).length).toBe(2)
    // 2026-10-08: 손 입력은 결과 종류('manual')를 함께 넘긴다(기록용) — 확인 단계로 가는 것은 그대로다.
    expect(SRC).toMatch(/void requestUse\(code, 'manual'\)/)
  })

  it('③ 확인창이 묻고, 못 쓰는 이용권엔 버튼을 안 낸다', () => {
    expect(SRC).toMatch(/사용 처리하시겠습니까\?/)
    expect(SRC).toMatch(/usable && !blocked && \(/)
  })

  /**
   * 🩸 2026-10-07 재조준: 네이티브→wasm **자동 폴백**이 생겨 `startCamera` 의 의존성이
   *   `[hasDetector, t]` → `[hasDetector, startWasm, t]` 가 됐다(`startWasm` 자신은 `t` 에만
   *   의존한다). 종전 앵커는 그 문자열을 그대로 찾아서 빨간불이 났다 — **지키려던 것은 목록의
   *   모양이 아니라 "매 스캔마다 바뀌는 상태가 그 목록에 없다"** 는 것이다. 그래서 루프는
   *   `requestUseRef` 로 부른다. 불변식으로 다시 쓴다.
   */
  it('④ 카메라 루프가 콜백 변화로 재시작되지 않는다', () => {
    const i = SRC.indexOf('const startCamera = useCallback')
    expect(i).toBeGreaterThan(0)
    const deps = SRC.slice(i).match(/\n  \}, \[([^\]]*)\]\)/)
    expect(deps).not.toBeNull()
    const list = deps![1].split(',').map((x) => x.trim()).filter(Boolean)
    expect(list.length).toBeGreaterThan(0)
    // 안정적인 것만 — 상태(pending·results·busy·cameraOn…)가 끼면 매 스캔마다 카메라가 재시작된다.
    const STABLE = ['hasDetector', 't', 'startWasm']
    for (const d of list) expect(STABLE).toContain(d)
    // 그리고 루프는 ref 로 부른다(그래서 위 목록에 요청 함수가 없어도 최신 것을 쓴다).
    expect(SRC).toMatch(/requestUseRef\.current\(code\)/)
  })
})
