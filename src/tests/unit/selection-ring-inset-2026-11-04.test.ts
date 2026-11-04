/**
 * 🔵 선택 테두리는 **안쪽(ring-inset)** 으로 (2026-11-04 대표 *"윗칸에 파란색 테두리가 잘리는 경우가 많아 페이지들"*).
 *
 * 왜: `ring-2` 는 상자 **바깥**에 그린다(box-shadow). 스크롤 영역(`overflow-y-auto` · 시트 · 가로 넘김) 맨 위 칸이 선택되면
 *   바깥으로 나간 2px 가 영역에 잘려 **위 테두리만 없어진다**(실측: 이사 견적 6/8 '엘리베이터' 첫 칸). `ring-inset` 은 상자 안에 그려서
 *   어떤 영역에서도 안 잘린다. 줄·칸처럼 글자가 가장자리에 붙지 않는 선택지는 전부 이것으로 쓴다.
 *
 * ⚠️ 예외(ALLOW): 사진이 칸을 꽉 채우는 것 — 안쪽 테두리는 그림 **밑에** 그려져 가려진다. 그런 곳은 바깥 여백으로 공간을 준다.
 * ⚠️ 못 보는 것: 조건식이 아닌 자리의 ring · 변수로 조립한 클래스 · `border` 로 그린 선택(안쪽이라 원래 안 잘린다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const ALLOW: Record<string, string> = {
  'src/pages/vouchers/shared.tsx': '로고 그림이 칸을 채운다 — 줄에 py-1 px-1 여백을 둬 바깥 테두리 자리를 만들었다(VouchersPage 627)',
  'src/pages/curator-page/LinkshopPinPicker.tsx': '사진 카드 — 페이지 격자라 스크롤 영역에 안 잘린다',
  'src/components/shipping/TrackingModal.tsx': '배송 단계 점(장식 후광) — 선택 칸이 아니다',
  'src/components/main/BottomNav.tsx': '아바타 사진 — 잠금 파일, 스크롤 영역 아님',
}
const files = execSync("git ls-files 'src/pages/*.tsx' 'src/pages/**/*.tsx' 'src/components/*.tsx' 'src/components/**/*.tsx'", { encoding: 'utf8' })
  .trim().split('\n').filter((f) => !/admin|\/seller|Seller[A-Z]|agency|wholesale|supplier/i.test(f))

describe('선택 테두리 = ring-inset', () => {
  it('검사 대상이 손님 화면 전체다', () => { expect(files.length).toBeGreaterThan(500) })
  it('조건부 선택 ring 은 안쪽으로 그린다', () => {
    const bad: string[] = []
    for (const f of files) {
      if (ALLOW[f]) continue
      const s = readFileSync(f, 'utf8')
      for (const m of s.matchAll(/\?\s*['`]([^'`\n]*\bring-(?:1|2)\b[^'`\n]*)['`]/g)) {
        if (/ring-brand/.test(m[1]) && !/ring-inset/.test(m[1])) bad.push(`${f}: ${m[1]}`)
      }
    }
    expect(bad, '바깥 ring 은 스크롤 영역 맨 위 칸에서 위 테두리가 잘린다 — ring-inset 을 붙일 것').toEqual([])
  })
})
