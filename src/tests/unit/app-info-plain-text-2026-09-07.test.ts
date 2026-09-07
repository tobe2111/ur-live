/**
 * 📱 마이페이지 앱 정보 — 카드에서 줄글로 (2026-09-07 대표 시안 "안 2")
 *
 * 대표: *"앱 정보 부분에 지금 디자인? 너무 별로야. 그냥 줄글로 보여주면 되는데 굳이 여기도
 * 이렇게 보여줄 필요는 없는 것 같아."* → 시안 3안 중 **안 2**(한 줄 + 상태) 확정.
 *
 * 종전엔 [섹션 라벨 `앱 정보` + 흰 카드 + 구분선 3줄]. 문제는 카드 자체가 아니라 **바로 위와의
 * 낙차**였다(그 위는 이미 11px 잔글씨 한 줄). 그리고 세 줄 중 행동이 있는 줄은 하나이고 그
 * 행동은 새 버전이 있을 때만 의미가 있어 95% 의 시간 동안 빈 무게였다.
 *
 * 이건 취향이 아니라 이미 정해 둔 규칙이기도 하다(CLAUDE.md 🎫 표면 규칙 ⑥ "섹션 라벨 0",
 * ③ "숫자가 주인공"). 그래서 되돌아가지 않게 고정한다.
 *
 * ⚠️ 이 가드가 **못 보는 것**: 실제 렌더 결과(간격·대비)와 다른 화면의 카드들. 여기서 고정하는
 *   것은 이 한 컴포넌트의 배선뿐이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const FILE = 'src/pages/user-profile/AccountControlsSection.tsx'
const src = readFileSync(FILE, 'utf-8')

/**
 * `AppVersionSection` 함수 본문만 잘라 본다 — 같은 파일의 다른 섹션에 오염되지 않게.
 *
 * 🩸 그리고 **주석을 걷어낸다.** 첫 판에서 "`앱 정보` 라벨이 없다" 가 빨간불이었는데 원인은 코드가
 *   아니라 *이 수정을 설명하는 내 주석* 이 그 낱말을 담고 있어서였다. 사라졌는지 보는 검사는
 *   사라진 것을 설명하는 글까지 세면 영원히 통과할 수 없다.
 */
function appVersionSection(): string {
  const start = src.indexOf('export function AppVersionSection')
  expect(start, `${FILE} 에서 AppVersionSection 을 못 찾았다 — 앵커가 낡았다`).toBeGreaterThan(0)
  const after = src.indexOf('\n}\n', start)
  expect(after, 'AppVersionSection 의 끝을 못 찾았다').toBeGreaterThan(start)
  return src.slice(start, after)
    .replace(/\/\*[\s\S]*?\*\//g, '')   // 블록 주석
    .replace(/^\s*\/\/.*$/gm, '')       // 줄 주석
}

describe('마이페이지 앱 정보 — 줄글 (안 2)', () => {
  const body = appVersionSection()

  it('① 섹션 라벨이 없다 (표면 규칙 ⑥ "섹션 라벨 0")', () => {
    expect(body, '`앱 정보` 섹션 라벨이 되살아났다').not.toContain('앱 정보')
    expect(body, 'accountSettings.appInfo 키가 되살아났다').not.toContain('accountSettings.appInfo')
  })

  it('② 카드 표면이 없다 (흰 판 + 구분선 행)', () => {
    // 카드 = 자체 배경을 가진 둥근 상자. 이 영역은 페이지 바탕 위에 글자만 얹는다.
    expect(body, '카드 배경(bg-white / dark:bg-[#1D1F29])이 되살아났다').not.toMatch(/bg-white|#1D1F29/)
    expect(body, '행 구분선(border-t)이 되살아났다').not.toContain('border-t')
  })

  it('③ 버전은 한 줄 잔글씨다', () => {
    // ⚠️ `APP_VERSION` 은 여는 <p> 태그의 **다음 줄**에 있다 — 그 줄만 보면 className 을 놓친다.
    //    값을 감싼 <p> 요소 전체를 잡아서 본다.
    const at = body.indexOf('APP_VERSION')
    expect(at, '버전 값을 못 찾았다').toBeGreaterThan(0)
    const open = body.lastIndexOf('<p ', at)
    expect(open, '버전을 감싼 <p> 를 못 찾았다').toBeGreaterThan(0)
    const tag = body.slice(open, body.indexOf('>', open))
    expect(tag, '버전 줄이 11px 잔글씨가 아니다').toContain('text-[11px]')
    expect(tag, '버전 줄이 가운데 정렬이 아니다 — 위의 링크 줄과 어긋난다').toContain('text-center')
  })

  it('④ 업데이트 버튼은 새 버전이 있을 때만 선다', () => {
    // 버튼이 hasUpdate 분기 안에 있어야 한다. 항상 보이면 종전 카드와 같은 실수다.
    const hasUpdateAt = body.indexOf('hasUpdate ?')
    const isLatestAt = body.indexOf('isLatest ?')
    const btnAt = body.indexOf('bg-brand')
    expect(hasUpdateAt, 'hasUpdate 분기가 없다').toBeGreaterThan(0)
    expect(btnAt, '브랜드 버튼이 없다').toBeGreaterThan(0)
    expect(btnAt, '브랜드 버튼이 hasUpdate 분기보다 앞이다 — 항상 보인다는 뜻').toBeGreaterThan(hasUpdateAt)
    expect(btnAt, '브랜드 버튼이 isLatest 분기 뒤다 — 최신일 때도 뜬다는 뜻').toBeLessThan(isLatestAt)
  })

  it('⑤ 조회 실패/미확인일 때 "최신" 이라고 말하지 않는다', () => {
    // isLatest 는 서버·로컬 버전이 **둘 다 있고 같을 때만** 참이어야 한다.
    expect(body).toMatch(/const isLatest = !loading && serverVersion && localBuildVersion/)
    // 마지막 분기(둘 중 하나가 없는 경우)는 단정이 아니라 다시 확인하는 버튼이다.
    //
    // 🩸 처음엔 `toContain('handleCheck')` 였는데 **되돌려-검증이 그걸 잡았다**: 배선을
    //    `onClick={() => {}}` 으로 끊어도 초록이었다. 같은 이름이 이 함수 안에 *정의*로도
    //    있기 때문이다(`const handleCheck = async () => {`). 존재가 아니라 **배선**을 봐야 한다.
    expect(body, '미확인 상태의 확인 버튼이 handleCheck 에 연결돼 있지 않다')
      .toContain('onClick={handleCheck}')
  })

  it('⑥ 띄어 쓴 가운뎃점으로 값을 잇지 않는다 (check-middle-dot-chain 래칫)', () => {
    expect(body).not.toMatch(/\s·\s/)
  })
})
