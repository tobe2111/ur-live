/**
 * 📱 2026-10-19 대표 신고 — 모바일 홈 맨 위 위치 제목이 "공..." 으로 잘리고 현 위치 버튼이 아래 줄로 떨어졌다.
 *
 * 원인: 2026-10-17 (#1878) 이 PC 왼쪽 필터 열(`panel`)의 넘침을 고치려고 위치 바 안쪽 줄을
 *   `flex flex-col` 로 바꿨는데, 그 조건이 `!hero` 라 **`title`(모바일 홈 제목)까지** 세로로 쌓였다.
 *   세로로 쌓이면 제목 칸 폭이 짧아져 동 이름이 잘리고, 현 위치 버튼이 두 번째 줄로 내려간다.
 *   에러도 경고도 없고 PC 에서만 확인하면 보이지 않는다.
 *
 * 불변식: 세로 쌓기는 `panel` 하나에만. `title` 은 한 줄이다.
 * ⚠️ 이 시험이 못 보는 것: 실제 폭(jsdom 에 레이아웃이 없다). 렌더 실측은 2026-10-19 Playwright 로 했다
 *   (전 `truncated:true · 현 위치 y=48` → 후 `truncated:false · y=6`).
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'

const SRC = readCode('src/pages/pc-home/PcHomeLocationBar.tsx')

describe('홈 위치 제목 — 한 줄', () => {
  it('세로 쌓기(flex-col)는 panel 톤에만 걸린다', () => {
    const m = SRC.match(/:\s*tone === 'panel'\s*\?\s*'flex flex-col gap-2'\s*:\s*'flex items-center gap-2'/)
    expect(m, '안쪽 줄의 flex-col 이 panel 조건 없이 걸렸다 — 모바일 홈 제목이 두 줄로 무너진다').not.toBeNull()
  })
  it('flex-col 은 파일에 정확히 한 번(panel 분기)만 나온다', () => {
    expect((SRC.match(/flex flex-col gap-2/g) || []).length).toBe(1)
  })
})
