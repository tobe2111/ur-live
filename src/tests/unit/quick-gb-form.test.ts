/**
 * ⚡ **3분 등록 폼** 불변식 〔세션 ③-b, O4 · 대표 UX 기준 ④〕
 *
 * *"사진·가격·마감만으로 3분 내 등록 완주"* · *"모바일 **한 손 조작** 기준"*.
 *
 * 이 폼이 특별히 위험한 지점은 **두 API 를 순서대로 부르는데 원자적이지 않다**는 것이다:
 * ① 상품 생성 → ② 공구 설정. **②가 실패하면 ①은 남는다.**
 * 그걸 숨기면 운영자는 같은 상품을 계속 다시 만든다 — 화면엔 에러만 뜨고 DB엔 쓰레기가 쌓인다.
 *
 * ⚠️ 이 테스트가 **못** 막는 것:
 *   - 실제 렌더·입력 동작(그건 E2E 몫)
 *   - 서버 응답 shape 변경(런타임에만 드러난다 — 그래서 아래 주석에 근거 라인을 박아뒀다)
 *   - "3분 안에 되는가" 자체(👤 대표 왕복 판정)
 */
import { describe, it, expect } from 'vitest'
import { readCode, sliceFrom } from '../helpers/source-text'

// 🔧 `readCode` = 주석(라인 **+ 블록**) 제거. 파일 헤더 JSDoc 에 남은 이름을 코드로 착각하지 않는다
//    — 이 테스트를 쓰면서 실제로 그 함정에 걸려 헬퍼를 만들었다(helpers/source-text.ts 참조).
const code = readCode('src/pages/SellerQuickGbPage.tsx')

describe('🔴 두 API 사이의 실패를 숨기지 않는다', () => {
  it('①만 성공한 상태를 기억한다 — 재시도 시 상품을 또 만들지 않는다', () => {
    expect(code).toContain('orphanId')
    // 이미 만들어졌으면 생성을 건너뛰어야 한다.
    expect(code).toMatch(/if \(!productId\)/)
  })

  it('그 상태를 **화면에 말한다** — 조용히 삼키면 중복 상품이 쌓인다', () => {
    // 에러 블록 안에서 orphanId 를 노출해야 한다.
    const errBlock = sliceFrom(code, '{error &&', undefined, 700)
    expect(errBlock).toContain('orphanId')
  })
})

describe('🔴 한 손 조작 (UX 기준 ④)', () => {
  it('숫자 입력은 숫자 키패드를 띄운다', () => {
    // inputMode 없으면 모바일에서 문자 키보드가 떠서 금액 입력이 두 배로 느려진다.
    expect((code.match(/inputMode="numeric"/g) || []).length).toBeGreaterThanOrEqual(2)
  })

  it('제출 버튼이 하단 고정 — 스크롤해서 찾지 않는다', () => {
    expect(code).toMatch(/fixed[^"']*bottom-0/)
  })

  it('마감은 프리셋 버튼 — 날짜 피커를 쓰지 않는다', () => {
    // ⚠️ *"파일 전체에 date 입력이 없다"* 로 쓰면 안 된다 — **픽업일은 날짜 피커가 맞다**(④-a 에서 추가).
    //   지킬 것은 "마감이 프리셋인가"지 "date 입력을 아예 안 쓰는가"가 아니다.
    expect(code).toContain('DEADLINE_PRESETS')
    // 마감 블록 안에 date 입력이 없어야 한다.
    const deadlineBlock = sliceFrom(code, 'DEADLINE_PRESETS.map', '</div>', 600)
    expect(deadlineBlock).not.toMatch(/type="date"|type="datetime-local"/)
  })

  it('📦 픽업일은 **날짜 피커가 맞다** — 임의의 미래 날짜라 프리셋이 안 맞는다', () => {
    // 마감(3·7·14일)과 달리 픽업일은 운영자가 매장 사정에 맞춰 고른다.
    // 대신 `min` 으로 마감 이전을 미리 좁혀 서버 거절 왕복을 줄인다.
    expect(code).toMatch(/id="q-pickup"[\s\S]{0,200}type="date"|type="date"[\s\S]{0,200}id="q-pickup"/)
    expect(code).toContain('min=')
  })

  it('입력 높이가 엄지 타겟(56px = h-14) 이상', () => {
    expect(code).toMatch(/h-14/)
  })
})

describe('🔴 셀러 대시보드는 라이트 고정 (CLAUDE.md 절대 룰)', () => {
  it('`dark:` variant 가 코드에 없다', () => {
    // 주석의 설명 문구는 제외하고 **코드**만 본다.
    expect(code).not.toMatch(/\bdark:/)
  })
})

describe('가격 방향 — 올리는 공구를 만들지 않는다', () => {
  it('제출 전에 `공구가 < 정가` 를 확인한다', () => {
    // 서버(validateGbSession)가 어차피 거부하지만, 제출 후에 알면 3분이 깨진다.
    expect(code).toMatch(/gb\s*<\s*list/)
  })

  it('클라이언트 검증이 **서버를 대체하지 않는다** — 서버 에러 메시지를 그대로 보여준다', () => {
    expect(code).toMatch(/response\?\.data\?\.error/)
  })
})

describe('몰 스탬프는 서버 몫', () => {
  it('클라이언트가 `mall_id` 를 보내지 않는다', () => {
    // 보내면 셀러가 남의 몰에 상품을 꽂을 수 있다(서버가 무시하지만 의도를 코드에 남기지 않는다).
    expect(code).not.toMatch(/\bmall_id\b/)
  })
})
