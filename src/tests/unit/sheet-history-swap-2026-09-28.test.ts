/**
 * 🔙 **시트를 갈아 끼울 때 히스토리 칸이 새 시트를 닫지 않는다** (2026-09-28)
 *
 * ## 무엇이 깨져 있었나 (에러 0으로 조용히)
 * 마이 `전체 도구` 에서 도구를 고르면 **아무 일도 안 일어나는 것처럼 보였다.** 실제로는
 * 도구 시트가 한 프레임 떴다가 스스로 닫혀 전체 도구로 되돌아온 것이다. 원인은 히스토리다:
 *
 * ```
 * A(전체 도구) 정리 → history.back()      ← A 가 쌓아 둔 칸을 빼려는 것
 * B(도구)      설치 → pushState
 * …popstate 도착 → B 가 "뒤로가기" 로 읽고 닫는다   ← A 가 빼려던 칸을 B 가 뒤집어썼다
 * ```
 *
 * 🔬 **실측으로 확정했다**: 같은 빌드에서 `history.back()` 한 줄만 임시로 빼자
 *    `전체 도구 → 셀러 등급` 이 시트 안에 정상으로 떴다(`scripts/visual-preview.mjs`).
 *
 * ## 이 시험이 지키는 것
 * 규약은 **"칸은 시트마다가 아니라 열려 있는 동안 하나"** 다. 갈아 끼우기(1→0→1)에서는
 * 쌓지도 빼지도 않는다. 판정을 `sheet-history.ts` 순수 모듈로 빼 둔 이유가 이 시험이다 —
 * jsdom 의 히스토리 구현(비동기 `back()`·popstate)에 기대면 시험이 환경에 따라 흔들린다.
 *
 * ⚠️ **이 시험이 못 하는 것**: `Sheet.tsx` 가 이 판정을 실제로 따르는지는 마지막 한 건
 *   (배선 검사)만 본다. 브라우저에서의 최종 판정은 하네스다:
 *   `node scripts/visual-preview.mjs --route=/user/profile --auth=user --stores=1 --click="찾아서 바로 열기>>셀러 등급"`
 */
import { describe, it, expect } from 'vitest'
import {
  browserPopped, closeSheet, initialSheetHistory, openSheet, settleClose,
} from '@/pages/user-profile/seller-section/sheet-history'

describe('시트 히스토리 — 칸은 열려 있는 동안 하나', () => {
  it('처음 열릴 때만 칸을 쌓는다', () => {
    const a = openSheet(initialSheetHistory())
    expect(a.push).toBe(true)
    // 두 번째가 겹쳐 열려도 또 쌓지 않는다(뒤로가기를 두 번 눌러야 하는 일이 없게).
    expect(openSheet(a.next).push).toBe(false)
  })

  it('🔴 갈아 끼우기(A 닫힘 → B 열림)에서는 칸을 빼지 않는다 — 이게 그 버그였다', () => {
    let s = openSheet(initialSheetHistory()).next        // A 열림
    const closed = closeSheet(s, false)                   // A 정리 (닫기인지 교체인지 아직 모른다)
    s = closed.next
    expect(closed.schedule).toBe(true)                    // 판정을 한 틱 미룬다
    s = openSheet(s).next                                 // ← 같은 커밋에서 B 설치
    const settled = settleClose(s)                        // 미뤄 둔 판정이 이제 돈다
    expect(settled.back).toBe(false)                      // 🔴 back() 을 부르면 B 가 닫힌다
    expect(settled.next.pushed).toBe(true)                // 칸은 그대로 남아 있어야 한다
  })

  it('마지막 하나가 진짜 닫히면 칸을 뺀다 (안 빼면 뒤로가기를 한 번 먹는다)', () => {
    const s = openSheet(initialSheetHistory()).next
    const closed = closeSheet(s, false)
    expect(closed.schedule).toBe(true)
    const settled = settleClose(closed.next)
    expect(settled.back).toBe(true)
    expect(settled.next).toEqual({ open: 0, pushed: false })
  })

  it('뒤로가기로 닫혔으면 칸은 이미 소비됐다 — 또 빼지 않는다', () => {
    let s = openSheet(initialSheetHistory()).next
    s = browserPopped(s)                                  // popstate 도착
    const closed = closeSheet(s, true)
    expect(closed.schedule).toBe(false)
    expect(closed.next).toEqual({ open: 0, pushed: false })
  })

  it('뒤로가기 표시만으로도 칸을 안 뺀다 — `browserPopped` 가 빠져도 (겹겹이 방어)', () => {
    // ⚠️ 실제 `Sheet` 는 popstate 에서 `browserPopped` 도 같이 부른다. 이 시험은 그 한 줄이
    //   사라진 날을 위한 것이다 — 그때 남는 방어가 `poppedByUser` 인자뿐이다.
    const closed = closeSheet({ open: 1, pushed: true }, true)
    expect(closed.schedule).toBe(false)
    expect(closed.next).toEqual({ open: 0, pushed: false })
  })

  it('겹쳐 열린 둘이 차례로 닫혀도 칸은 한 번만 빠진다', () => {
    let s = openSheet(initialSheetHistory()).next
    s = openSheet(s).next                                 // 둘 열림
    const first = closeSheet(s, false)
    expect(first.schedule).toBe(false)                    // 아직 하나 남았다
    s = first.next
    const second = closeSheet(s, false)
    expect(second.schedule).toBe(true)
    expect(settleClose(second.next).back).toBe(true)
  })

  it('🔴 이 판정이 실제로 배선돼 있다 (지우면 종전처럼 튕긴다)', async () => {
    const { readCode } = await import('../helpers/source-text')
    const src = readCode('src/pages/user-profile/seller-section/Sheet.tsx')
    expect(src).toContain('openSheet(')
    expect(src).toContain('settleClose(')
    expect(src).toContain('queueMicrotask(')
    // 판정을 거치지 않는 날것의 back() 이 다시 생기면 그 즉시 같은 사고다.
    expect(src).not.toMatch(/if\s*\(!popped\)\s*\{\s*try\s*\{\s*window\.history\.back\(\)/)
  })
})
