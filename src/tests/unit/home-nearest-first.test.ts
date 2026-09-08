/**
 * 🧭 홈 딜 목록은 **가까운 순이 먼저** — 대표 2026-09-08
 *
 * > "여기엔 거리순, 가장 가까운 순이 먼저 떠야해"
 *
 * ## 🩸 무엇이 어긋나 있었나 (대표 실측 화면)
 * 헤더는 **"동탄5동"** 인데 목록 첫 카드가 **서울 강동구·강남구**였고 알약은 **"인기순"** 이었다.
 * 원인이 둘 겹쳐 있었다:
 *
 * ① **저장된 지역이 위치를 이겼다.** 기본 정렬 조건이 `readCachedLoc() && !readHomeRegion().regionKey`
 *    라서, 예전에 지역을 한 번 골라 둔 사람은 위치가 잡혀 있어도 영영 '인기순'이었다. 그런데 헤더는
 *    `located` 를 우선해 동네 이름을 띄운다 — **화면과 목록이 서로 다른 말을 했다.** 게다가 그 지역에
 *    딜이 0건이면 전체 폴백이 걸려 엉뚱한 도시 딜이 그 동네 이름 아래 떴다.
 * ② **모바일엔 거리순 알약이 없었다.** `'near'` 는 `PcHomePage` 전용이었고 모바일 메뉴엔 없었다.
 *    `SortMenu` 는 `value` 가 `options` 에 없으면 조용히 `options[0]` 을 그린다 — 그래서 실제로
 *    거리순인 화면이 **"인기순"이라고 적혀 있었고**, 다른 정렬을 한 번 고르면 돌아갈 길이 없었다.
 *
 * ## 이 테스트가 못 막는 것
 * - **좌표가 없는 사람**에게 거리순이 뜨는지는 여기서 못 본다(만들 값이 없으니 '인기순'이 맞다).
 *   홈이 위치를 새로 묻지 않는다는 2026-09-05 결정은 그대로다.
 * - 실제로 가까운 순으로 **보이는지**는 눈으로 봐야 한다. 여기서는 배선만 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'

const FEED = readCode('src/pages/main-home/GroupBuyFeed.tsx')

/**
 * ① **기본 정렬 규칙은 여기서 안 검사한다.** 주인은 `home-top-banner-and-near-default.test.ts` §② 다
 *   (2026-09-08 에 그 파일의 계약을 새 규칙으로 재조준했다). 같은 규칙을 두 파일에 적으면 반드시
 *   갈라지므로 — 실제로 이 파일을 먼저 쓰는 바람에 두 파일이 **서로 반대**를 주장했고 CI 가 잡았다.
 *   여기서는 그 파일이 그 일을 하고 있는지만 확인한다(주인이 사라지면 빨강).
 */
describe('① 기본 정렬 규칙의 주인이 있다', () => {
  it('near 기본값 계약을 다른 파일이 갖고 있다', () => {
    // ⚠️ 정규식 대신 **테스트 제목**을 앵커로 쓴다. 소유 파일의 단언은 정규식 리터럴이라
    //   여기서 다시 정규식으로 맞추려면 이스케이프가 두 겹이 되고, 그 자체가 틀리기 쉽다(실제로 틀렸다).
    const owner = readCode('src/tests/unit/home-top-banner-and-near-default.test.ts')
    expect(owner, 'near 기본값 계약이 사라졌다').toContain('캐시된 위치가 있으면 near 로 시작한다')
    expect(owner, '좌표 우선 규칙이 사라졌다').toContain('좌표가 있으면 저장된 지역을 안 씌운다')
  })
})

describe('② 정렬 알약이 거짓말하지 않는다', () => {
  it('모바일 메뉴에 거리순이 있다', () => {
    expect(FEED).toMatch(/const NEAR_SORT: SortOptionItem<'near'> = \{ key: 'near', label: '거리순'/)
  })

  it('위치가 있을 때만 낀다 — 좌표 없이 거리순은 고를 수 없다', () => {
    expect(FEED).toMatch(/options=\{userLoc \? \[NEAR_SORT, \.\.\.SORTS\] : SORTS\}/)
  })

  it('🔴 value 를 options 밖 타입으로 캐스팅하지 않는다 (그게 라벨이 어긋나던 자리다)', () => {
    // 예전: `value={sort as typeof SORTS[number]['key']}` — 'near' 를 SORTS 키인 척 넘겨
    //       SortMenu 의 `options.find(...) || options[0]` 폴백이 '인기순'을 그렸다.
    expect(FEED).not.toMatch(/value=\{sort as typeof SORTS\[number\]\['key'\]\}/)
    expect(FEED).toMatch(/<SortMenu<SortKey> value=\{sort\}/)
  })

  it('SortMenu 는 여전히 options 밖 값을 조용히 삼킨다 — 그래서 위 배선이 필요하다', () => {
    // 이 단언이 깨지면(=SortMenu 가 스스로 방어하게 되면) 위 세 검사의 근거가 약해진다.
    // 그때는 이 테스트를 지우지 말고 **SortMenu 쪽 방어를 고정하는 검사로 바꿔** 쓸 것.
    expect(readCode('src/components/ui/sort-menu.tsx'))
      .toMatch(/options\.find\(\(o\) => o\.key === value\) \|\| options\[0\]/)
  })
})
