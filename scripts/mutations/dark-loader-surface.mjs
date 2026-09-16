/**
 * 🌑 로더는 도착 화면의 색을 미리 입는다 (2026-09-16 대표 — "로딩도 좀 문제 있어보이고").
 *
 * 라이트 테마에서 `/videos` 로 갈 때 [흰 로더 → 검은 로더] 로 튀던 것. 배선이 셋으로 나뉘어 있어
 * (술어 · 호출 · 프롭 전달) **어느 한 곳만 끊겨도 조용히 원래대로 돌아간다** — 셋을 각각 깨뜨린다.
 */
const APP = 'src/App.tsx'
const LOADER = 'src/components/brand/BrandLoader.tsx'
const TEST = 'src/tests/unit/dark-loader-surface-2026-09-16.test.ts'

export default [
  {
    name: '🌑 다크 표면 목록에서 /videos 가 빠진다',
    file: APP,
    find: "const isDarkLoaderSurface = (pathname: string) => /^\\/videos(\\/|$)/.test(pathname)",
    replace: "const isDarkLoaderSurface = (pathname: string) => /^\\/__none__(\\/|$)/.test(pathname)",
    test: TEST,
    why: '목록이 비면 /videos 가 다시 테마 추종 로더를 받아 라이트 사용자에게 흰→검정 점프가 돌아온다.',
  },
  {
    name: '🌑 청크 로더 배선이 끊긴다 (술어는 남고 호출만 사라짐)',
    file: APP,
    find: 'const PageLoader = () => <BootFirstScreenLoader forceDark={isDarkLoaderSurface(window.location.pathname)} />',
    replace: 'const PageLoader = () => <BootFirstScreenLoader />',
    test: TEST,
    why:
      '이 레포가 반복해 당한 모양 — 술어는 정의돼 있고 이름도 파일에 남아 있어서, 이름 존재만 ' +
      '보는 검사는 초록이 뜬다. 정작 로더는 종전처럼 테마를 따라간다.',
  },
  {
    name: '🌑 로더가 forceDark 를 받기만 하고 안 넘긴다',
    file: LOADER,
    find: '  if (!node) return <BrandLoader fullScreen forceDark={forceDark} />',
    replace: '  if (!node) return <BrandLoader fullScreen />',
    test: TEST,
    why: '프롭을 받아 두고 버리면 타입도 통과하고 빌드도 통과한다 — 화면만 예전 그대로다.',
  },
]
