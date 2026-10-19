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
    // 🔁 2026-09-28 재조준: 마이가 **여섯 단계 스케일**(28/24/17/15/13/12)로 정리되면서 11px 이
    //   사라졌다(스케일 바닥은 12). 지키려던 것은 *잔글씨 한 줄*이지 `11` 이라는 숫자가 아니다 —
    //   앵커만 스케일 바닥으로 옮긴다. 가드: `my-type-scale-2026-09-28`.
    expect(tag, '버전 줄이 스케일 바닥(12px) 잔글씨가 아니다').toContain('text-[12px]')
    // 🔁 2026-10-18 재조준: 지키려던 것은 *위의 링크 줄과 같은 정렬* 이다. 그 링크 줄이 2026-09-30 에 왼쪽
    //   정렬(가운뎃점 제거)로 바뀌면서 이 단언이 오히려 **두 정렬이 섞인 상태**를 고정하고 있었다(실측:
    //   링크 왼쪽 ↔ 버전·탈퇴 가운데). 이제 둘 다 왼쪽이고, 링크 줄 쪽도 함께 대조한다.
    expect(tag, '버전 줄만 가운데 정렬이다 — 위의 링크 줄(왼쪽)과 어긋난다').not.toContain('text-center')
    const page = readFileSync('src/pages/UserProfilePage.tsx', 'utf-8')
    const linkRow = page.slice(page.indexOf("userProfile.kakaoConsult'") - 400, page.indexOf("userProfile.kakaoConsult'"))
    expect(linkRow, '링크 줄이 가운데로 바뀌었다면 버전 줄도 같이 옮길 것').not.toContain('justify-center')
  })

  it('④ 업데이트 버튼은 새 버전이 있을 때만 선다', () => {
    // 🔁 2026-10-18 재조준: 상태 분기(`isLatest ?` · 확인 버튼)가 사라져 `hasUpdate &&` 하나가 됐다.
    //   지키려던 것(버튼이 항상 보이지 않는다)은 그대로다.
    const gateAt = body.indexOf('hasUpdate && (')
    const btnAt = body.indexOf('bg-brand')
    expect(gateAt, 'hasUpdate 게이트가 없다').toBeGreaterThan(0)
    expect(btnAt, '브랜드 버튼이 없다').toBeGreaterThan(0)
    expect(btnAt, '브랜드 버튼이 hasUpdate 게이트보다 앞이다 — 항상 보인다는 뜻').toBeGreaterThan(gateAt)
    expect(body, 'hasUpdate 는 서버·로컬 버전이 둘 다 있고 다를 때만 참이어야 한다')
      .toMatch(/const hasUpdate = !loading && serverVersion && localBuildVersion && serverVersion !== localBuildVersion/)
  })

  /**
   * 🔁 2026-10-18 (대표 *"나머지 다 가장 이상적으로"*) — 종전 ⑤는 *"미확인이면 확인 버튼"* 을 고정했다.
   *   그 버튼과 `최신 버전이에요` 문구는 **이미 자동으로 하는 일**(`version-check` 가 5분마다·탭 복귀마다
   *   확인해 `NewVersionBanner` 를 띄운다)을 사람에게 시키는 개발자용 표시였다 ⇒ 뺐다.
   *   이제 지키는 것은 반대 방향이다 — 그 둘과 괄호 속 빌드 번호가 되살아나지 않는다.
   */
  it('⑤ 평소엔 버전 한 줄뿐 — 확인 버튼·최신 문구·빌드 번호가 화면에 없다', () => {
    expect(body, '"최신 버전인지 확인" 버튼이 되살아났다').not.toContain('accountSettings.checkLatest')
    expect(body, '"최신 버전이에요" 문구가 되살아났다').not.toContain('accountSettings.isLatest')
    expect(body, '수동 확인 핸들러가 되살아났다').not.toContain('handleCheck')
    // 빌드 번호는 `title` 로만 — 본문 텍스트로 찍히면 `v1.0.676 (20261018.0940)` 이 돌아온다.
    expect(body, '빌드 번호가 본문에 다시 찍힌다').not.toMatch(/\{BUILD_HASH && <span/)
    expect(body).toContain('title={BUILD_HASH || undefined}')
  })

  it('⑥ 띄어 쓴 가운뎃점으로 값을 잇지 않는다 (check-middle-dot-chain 래칫)', () => {
    expect(body).not.toMatch(/\s·\s/)
  })
})
