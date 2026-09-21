/**
 * 🖱️ 매장 등록 모달 — 스크롤 표면 하나 + 사업자번호 자동 하이픈 (2026-09-21, 대표 신고).
 *
 * 대표: *"여기 스크롤하는게 어려워. 어느 부분에 손가락이나 마우스 커서를 대고 내리는지에 따라서 차이가 있어."*
 * 지도 단계에 스크롤 표면이 **셋**이었다 — 모달 바디 · 카카오 지도(제스처를 통째로 먹는다) ·
 * 결과 목록(`max-h-64` 자체 스크롤). 목록에 닿으려면 지도를 지나쳐야 하는데 지도 위에서는 아무것도 안 내려간다.
 *
 * ⚠️ **jsdom 은 레이아웃이 없다** — 실제로 "스크롤이 되는가" 는 여기서 못 잰다(이 레포의 알려진 한계).
 * 그래서 이 시험은 *스크롤을 만드는 클래스가 어디에 붙어 있는가* 를 고정한다. 눈으로 보는 판정은 별도.
 * 못 막는 것: 카카오 지도가 휠을 먹는 것(SDK 동작) · 높이가 실제로 충분한지.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { formatBusinessNumber } from '@/pages/seller-register/RegisterFields'

const picker = readCode('src/components/KakaoMapPicker.tsx')
const modal = readCode('src/components/seller/StoreRegisterModal.tsx')

describe('KakaoMapPicker — fill 레이아웃', () => {
  it('fill 이면 부모 높이를 채우는 한 칸, 아니면 종전 문서 흐름', () => {
    expect(picker).toContain("fill ? 'flex flex-col h-full min-h-0 gap-3' : 'space-y-3'")
  })

  it('fill 에서 스크롤되는 곳은 결과 목록 하나 — max-h 두 번째 표면이 아니다', () => {
    expect(picker).toContain("${fill ? 'flex-1 min-h-0' : 'max-h-64'} overflow-y-auto overscroll-contain")
  })

  it('검색창과 지도는 고정(shrink-0) — 지나칠 것이 없어야 한다', () => {
    expect(picker).toContain("flex gap-2${fill ? ' shrink-0' : ''}")
    expect(picker).toContain("border border-line${fill ? ' shrink-0' : ''}")
  })

  it('📐 지도 높이가 바뀌면 relayout — 안 부르면 줄어든 자리에 회색 띠가 남는다', () => {
    expect(picker).toContain('mapRef.current.relayout()')
    expect(picker).toMatch(/const shrunk = fill && results\.length > 0/)
  })

  it('기본값은 false — 페이지 안 호출부(스토어정보·이용권 등록)는 종전 그대로', () => {
    expect(picker).toContain('fill = false')
  })
})

describe('StoreRegisterModal — 지도 단계만 바디 스크롤을 끈다', () => {
  it('mapStep 이면 overflow-hidden, 폼 단계는 overflow-y-auto', () => {
    expect(modal).toContain("mapStep ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'")
    expect(modal).toContain('const mapStep = step === 0 && (!picked || showMap)')
  })

  it('지도를 fill 로 넘긴다 (안 넘기면 셋이 그대로다)', () => {
    expect(modal).toMatch(/<KakaoMapPicker\s+fill\b/)
  })
})

describe('사업자번호 자동 하이픈', () => {
  it('타이핑하는 대로 000-00-00000', () => {
    expect(formatBusinessNumber('4790902930')).toBe('479-09-02930')
    expect(formatBusinessNumber('479')).toBe('479')
    expect(formatBusinessNumber('47909')).toBe('479-09')
    // 이미 하이픈이 있어도 다시 계산한다(붙여넣기)
    expect(formatBusinessNumber('479-09-02930')).toBe('479-09-02930')
  })

  it('모달 입력이 그 함수를 쓴다 — 가입 폼과 같은 SSOT', () => {
    expect(modal).toContain('setBno(formatBusinessNumber(e.target.value))')
    expect(modal).toContain("placeholder=\"000-00-00000\"")
  })

  it('전송은 여전히 숫자만 — 하이픈이 서버로 새지 않는다', () => {
    expect(modal).toContain("business_number: bno.replace(/-/g, '') || undefined")
  })
})
