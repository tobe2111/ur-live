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
import { CARD_BG } from '../helpers/surface-class'

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
    // 🔁 2026-09-14 (안 B): 하단 바의 '객실 고르기' 목적지로 `id="stay-sec-rooms"` 가 붙었다.
    //   지키는 성질은 그대로 — 모바일 객실 목록이 `lg:hidden` 인가(PC 는 우측 패널이 담당).
    expect(page).toMatch(/<div id="stay-sec-rooms"[^>]*className="mb-5 lg:hidden"[\s\S]{0,120}?<SectionTitle className="mb-3">객실 선택/)
  })
  it('패널: 객실 행 + 총액 + 단일 주 행동, 카드 테두리 0', () => {
    expect(panel).toMatch(new RegExp(`rounded-2xl ${CARD_BG} shadow-lift`))
    expect(panel).toMatch(/예약하기/)
    expect(panel).not.toMatch(/border border-gray/)
  })
  it('날짜와 인원은 각자 다른 행 (한 줄이면 360px 에서 날짜가 잘린다)', () => {
    // 🎫 2026-09-14 재조준: 지키려는 성질은 "날짜와 인원이 한 줄에 안 눌린다" 이지
    //    `flex flex-col gap-2` 라는 특정 마크업이 아니었다. 안 B(분할 카드)는 그 성질을
    //    행을 나누는 방식으로 지킨다 — 가드를 지우지 말고 성질로 다시 겨눈다.
    //    구조 자체는 `stay-detail-b.test.ts` 가 더 촘촘히 본다.
    expect(picker, '날짜 행이 없다').toMatch(/<FieldSplit\b/)
    expect(picker, '인원이 날짜와 같은 행에 눌렸다').toMatch(/<FieldRow\b[\s\S]{0,200}label="인원"/)
  })
  it('제목 위 라벨은 원본 값이 아니라 한글 라벨', () => {
    expect(page).toMatch(/storeName=\{propertyTypeLabel\(stay\.property_type\)\}/)
  })
  it('취소 정책 문장은 본문과 패널이 같은 함수를 쓴다', () => {
    /* 🔀 2026-09-24: 본문의 '이용 안내' 표가 `StayInfoSections` 로 옮겨졌다(대표 문서 ⑥ —
       '비슷한 스테이' 를 붙이며 상세가 파일크기 래칫에 걸려 추출). **불변식은 두 자리가 같은
       함수를 쓴다** 이므로 가드를 풀지 않고 옮겨간 자리를 합쳐서 센다. */
    const info = readFileSync('src/pages/stay-detail/StayInfoSections.tsx', 'utf8')
    // 패널은 `stay.cancellation_policy` 를 직접, 본문 표는 prop 으로 받은 같은 값을 넘긴다.
    expect((page + info).match(/cancellationLabel\(/g)?.length).toBe(2)
    expect(page, '패널이 같은 함수를 안 쓴다').toContain('cancellationLabel(stay.cancellation_policy)')
    expect(info, '본문 표가 같은 함수를 안 쓴다(문장이 두 벌이 된다)').toContain('cancellationLabel(policy)')
    expect(page, '본문 표에 취소 정책이 안 내려간다').toMatch(/<StayPolicyInfo[\s\S]{0,120}policy=\{stay\.cancellation_policy\}/)
  })
})
