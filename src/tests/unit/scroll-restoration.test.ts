/**
 * 📜 뒤로가기는 있던 자리로 — 스크롤 복원 불변식 (2026-09-01 신설)
 *
 * 대표: *"메인에서 스크롤 내려 이용권에 들어갔다 뒤로 오면 맨 위로 나옴. 어떠한 페이지든 마찬가지.
 * 무조건."*
 *
 * ## 무엇을 지키나
 * 복원 코드는 2026-07-02 부터 **있었는데도** 동작하지 않았다. 저장된 자리를 **떠나는 순간
 * 0 이 덮어썼기** 때문이다. 그래서 여기서 지키는 것은 "복원 코드가 있다"가 아니라
 * **"떠난 페이지의 리스너가 저장을 못 하게 막혀 있다"** 이다.
 *
 * 실측(로컬 빌드, 홈/PC홈/숙소목록): 수정 전 0/3 → 수정 후 3/3.
 * 귀속 검증: cleanup 저장 제거 · sessionStorage · 복원 예산 3s 는 **각각 되돌려도 통과**했다.
 * 유일하게 되돌리면 깨지는 것이 아래 두 줄(렌더 중 키 갱신 + 리스너의 키 검사)이다.
 *
 * ## 이 테스트가 **못 막는 것**
 * - 실제 브라우저 동작. 소스가 맞아도 렌더 순서가 바뀌면 깨질 수 있다 →
 *   `.verify2.mjs` 류의 실측이 최종 판정이고, 그 방법은 파일 주석에 적어 두었다.
 * - 내부 컨테이너 스크롤 화면(문서 스크롤이 아닌 곳).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = 'src/components/ScrollToTop.tsx'
const src = readFileSync(resolve(__dirname, '../../..', SRC), 'utf-8')
/** 주석 제거 — 설명이 판정을 통과시키는 함정을 이 레포는 반복해 겪었다. */
const code = src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
  .join('\n')

describe('떠난 페이지가 저장된 자리를 덮어쓰지 못한다', () => {
  it('현재 키를 **렌더 중에** 갱신한다 (effect 로 미루면 늦다)', () => {
    // effect/useLayoutEffect 로 옮기면 라우터 상태 변경과 DOM 교체 사이의 창이 열려,
    // 그때 도착한 scroll 이벤트가 옛 키로 0 을 쓴다 — 그게 이 사고였다.
    expect(code, '렌더 중 키 갱신이 사라졌다').toMatch(/^\s*currentKeyRef\.current = entryKey\s*$/m)
    expect(code, '키 갱신이 effect 안으로 들어갔다 — 그러면 늦는다')
      .not.toMatch(/use(Layout)?Effect\(\s*\(\)\s*=>\s*\{\s*currentKeyRef\.current/)
  })

  it('scroll 리스너가 자기 키가 아니면 저장하지 않는다', () => {
    expect(code, '리스너의 키 검사가 사라졌다 — 저장이 0 으로 오염된다')
      .toMatch(/currentKeyRef\.current !== keyAtAttach\)\s*return/)
  })
})

describe('POP 이면 저장된 자리로 돌아간다', () => {
  it('POP 분기에서 저장값을 읽어 복원한다', () => {
    expect(code, 'POP 분기가 사라졌다').toMatch(/navType === 'POP'/)
    expect(code, '저장값을 안 읽는다').toMatch(/readPos\(entryKey\)/)
    // 복귀 직후엔 목록이 아직 짧다 — 높이가 자랄 때까지 재시도해야 목표 위치에 닿는다.
    expect(code, '높이가 자랄 때까지 재시도하지 않는다 — 짧은 순간에 clamp 돼 위로 간다')
      .toMatch(/requestAnimationFrame\(tryRestore\)/)
  })

  it('사용자가 직접 스크롤하면 복원을 멈춘다', () => {
    // 재시도 루프가 사용자의 스크롤과 싸우면 "스크롤이 안 먹는" 더 나쁜 버그가 된다.
    expect(code, '사용자 스크롤 시 중단이 없다').toMatch(/addEventListener\('(wheel|touchstart)'/)
  })
})

describe('내부 스크롤 영역도 복원된다 (문서만으로는 부족했다)', () => {
  it('data-scroll-restore 를 단 컨테이너를 저장·복원한다', () => {
    // 🩸 2026-09-01 전수 실측: 판정 가능한 표면은 전부 통과했는데 `/map` 만 남았다 —
    //   그 목록은 **문서가 아니라 컨테이너**가 스크롤돼(`flex-1 min-h-0 overflow-y-auto`)
    //   문서 스크롤만 다루던 복원이 닿지 않았다. 옵트인 표시로 일반화했다.
    expect(code, '컨테이너 옵트인 셀렉터가 사라졌다').toMatch(/data-scroll-restore/)
    expect(code, '컨테이너 위치를 저장하지 않는다').toMatch(/writePos\(paneKey\(/)
    expect(code, '컨테이너 위치를 복원하지 않는다').toMatch(/el\.scrollTop = Math\.min/)
  })

  it('capture 로 듣는다 — scroll 은 버블하지 않는다', () => {
    // window 리스너만으로는 컨테이너 스크롤을 **영원히 못 받는다**. 이 옵션이 빠지면
    // 저장이 조용히 0건이 되고, 화면은 그대로라 아무도 모른다.
    expect(code, 'capture 없이 듣고 있다 — 컨테이너 스크롤을 못 받는다')
      .toMatch(/addEventListener\('scroll',[^)]*capture:\s*true/)
  })

  it('지도 목록에 실제로 표시가 붙어 있다 (기능이 있는데 아무도 안 쓰면 없는 것)', () => {
    const map = readFileSync(resolve(__dirname, '../../..', 'src/pages/RestaurantMapPage.tsx'), 'utf-8')
    expect(map, '지도 목록의 data-scroll-restore 표시가 사라졌다').toMatch(/data-scroll-restore="map-list"/)
  })
})
