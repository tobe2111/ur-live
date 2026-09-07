/**
 * 🏨 숙소 상세 PC 예약 패널(B안) · 연박 · 달력↔지도 겹침 계약 (2026-09-02)
 *
 * ■ 무엇이 났나 (대표 라이브 화면 신고)
 *   ① 연박 불가 — 달력 첫 클릭이 늘 "체크인+1박"으로 범위를 닫아 두 번째 클릭이 체크아웃이 아니라
 *      새 체크인이 됐다. 서버는 연박을 받는데 달력이 막았다.
 *   ② 달력 팝오버가 카카오맵 아래로 깔림 — sticky 아사이드가 z 없이 스택 컨텍스트를 만들어 지도
 *      레이어(z≥1)가 위로 올라왔다.
 *   ③ 오른쪽 열이 날짜 상자 하나뿐 · 날짜 트리거가 두 줄/잘림 · 제목 위 라벨이 원본 값 "hotel".
 *
 * ■ 계약
 *   pickRange 는 **순수함수**라 실제 클릭 순서로 검증한다(텍스트 매칭이 아니다).
 *   나머지는 소스 계약 — 렌더 색·실제 스택 순서는 못 본다(배포 후 눈으로).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pickRange } from '@/pages/stay-detail/StayDateGuestPicker'

const R = (p: string) => readFileSync(resolve(__dirname, '../../', p), 'utf-8')
const TODAY = '2026-09-01'

describe('① 연박 — pickRange 실제 클릭 순서', () => {
  it('초기 1박 상태에서 [2일 → 5일] 을 누르면 2박 이상 범위가 잡힌다', () => {
    let s: ReturnType<typeof pickRange> = { draftIn: '2026-09-02', draftOut: '2026-09-03', phase: 'in' }
    s = pickRange(s.draftIn, s.draftOut, s.phase, '2026-09-02', TODAY)
    expect(s).toEqual({ draftIn: '2026-09-02', draftOut: '2026-09-03', phase: 'out' })
    s = pickRange(s.draftIn, s.draftOut, s.phase, '2026-09-05', TODAY)
    expect(s).toEqual({ draftIn: '2026-09-02', draftOut: '2026-09-05', phase: 'in' })
  })
  it('체크아웃 단계에서 체크인보다 앞/같은 날을 누르면 새 체크인으로 다시 시작한다', () => {
    const s = pickRange('2026-09-05', '2026-09-06', 'out', '2026-09-03', TODAY)
    expect(s).toEqual({ draftIn: '2026-09-03', draftOut: '2026-09-04', phase: 'out' })
  })
  it('지난 날은 무시한다', () => {
    expect(pickRange('2026-09-05', '2026-09-06', 'out', '2026-08-30', TODAY)).toEqual({ draftIn: '2026-09-05', draftOut: '2026-09-06', phase: 'out' })
  })
  it('범위를 닫은 뒤 다시 누르면 새 체크인이다 (종전 버그의 반대 방향도 확인)', () => {
    const s = pickRange('2026-09-02', '2026-09-05', 'in', '2026-09-10', TODAY)
    expect(s).toEqual({ draftIn: '2026-09-10', draftOut: '2026-09-11', phase: 'out' })
  })
})

describe('② 달력이 지도 아래로 안 깔린다', () => {
  const page = R('pages/StayDetailPage.tsx')
  it('sticky 아사이드에 z-index, 지도는 isolate — 한 쌍', () => {
    expect(page).toMatch(/<aside className="hidden lg:block lg:sticky lg:top-\[116px\] lg:z-20">/)
    expect(page).toMatch(/<div className="relative isolate z-0">\s*<RestaurantMiniMap/)
  })
})

describe('③ PC 예약 패널(B안) · 트리거 · 라벨', () => {
  const page = R('pages/StayDetailPage.tsx')
  const panel = R('pages/stay-detail/StayBookingPanel.tsx')
  const picker = R('pages/stay-detail/StayDateGuestPicker.tsx')
  it('아사이드가 StayBookingPanel 을 그리고, 객실 카드는 PC 에서 숨긴다(두 곳에 그리지 않는다)', () => {
    expect(page).toMatch(/<StayBookingPanel\b/)
    expect(page).toMatch(/<div className="mb-5 lg:hidden">\s*<SectionTitle className="mb-3">객실 선택/)
  })
  it('패널: 객실 행 + 총액 + 단일 주 행동, 카드 테두리 0', () => {
    expect(panel).toMatch(/rounded-2xl bg-white dark:bg-\[#1D1F29\] shadow-lift/)
    expect(panel).toMatch(/예약하기/)
    expect(panel).not.toMatch(/border border-gray/)
  })
  it('날짜·인원 트리거는 세로 두 줄 (한 줄이면 360px 에서 날짜가 잘린다)', () => {
    expect(picker).toMatch(/<div className="flex flex-col gap-2">/)
  })
  it('제목 위 라벨은 원본 값이 아니라 한글 라벨', () => {
    expect(page).toMatch(/storeName=\{propertyTypeLabel\(stay\.property_type\)\}/)
  })
  it('취소 정책 문장은 본문과 패널이 같은 함수를 쓴다', () => {
    expect((page.match(/cancellationLabel\(stay\.cancellation_policy\)/g) || []).length).toBe(2)
  })
})
