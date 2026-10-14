// 🎠 홈 상단 배너 (2026-10-13 대표 — 야놀자식 흰 글자 · 배너마다 이동 · 마지막→첫 장 순환)
//   가드: src/tests/unit/home-banner-yanolja-2026-10-13.test.tsx
//   ⚠️ 2026-10-12 의 "그림 밝기로 글자색 고르기"(banner-ink) 주입 둘은 그 모듈이 삭제되며 함께 걷었다.
const GUARD = 'src/tests/unit/home-banner-yanolja-2026-10-13.test.tsx'
const STRIP = 'src/components/home/HomeBannerStrip.tsx'
const LINK = 'src/components/home/banner-link.ts'

export default [
  {
    name: '🎠 배너 절대주소(https://urdeal.kr/…)가 다시 링크 없음이 된다',
    file: LINK,
    find: "  if (own) return internal(u)",
    replace: "  if (own) return null",
    test: GUARD,
    why: '어드민은 절대주소만 받는다. 우리 도메인을 못 알아보면 라이브 배너 전부가 눌러도 안 움직이는 div 가 된다 — 2026-10-13 실제로 그랬다.',
  },
  {
    name: '🎠 배너 링크가 javascript: 같은 스킴을 통과시킨다',
    file: LINK,
    find: "  if (!relative && !/^https?:\\/\\//i.test(v)) return null",
    replace: '',
    test: GUARD,
    why: '어드민 입력이 그대로 href 가 된다 — 스킴을 안 막으면 배너가 스크립트 실행 자리가 된다.',
  },
  {
    name: '🎠 배너 링크가 필터 쿼리를 지운다 (safeInternalPath 로 되돌림)',
    file: LINK,
    find: "  return { kind: 'internal', to: path + u.search + u.hash }",
    replace: "  return { kind: 'internal', to: path }",
    test: GUARD,
    why: '`/?category=meal_voucher` 를 가리킨 배너가 조용히 전체 목록으로 간다. 에러 0.',
  },
  {
    name: '🎠 사진 배너에 짙은 글자가 돌아온다 (장마다 글자색이 갈림)',
    file: STRIP,
    find: 'line-clamp-2 text-white dark:text-white',
    replace: 'line-clamp-2 text-gray-900 dark:text-gray-900',
    test: GUARD,
    why: '대표 *"제주·강원 모두 폰트 흰색"* — 실사 사진의 밝은 하늘·바다가 짙은 글자를 부른다.',
  },
  {
    name: '🎠 배너 글자가 다시 가운데로 뜬다 (야놀자 문법 이탈)',
    file: STRIP,
    find: 'aspect-[2/1] flex flex-col justify-end',
    replace: 'aspect-[2/1] flex flex-col justify-center',
    test: GUARD,
    why: '대표 *"글자 위치가 더 내려가야 … 야놀자 스러워야"*.',
  },
  {
    name: '🎠 마지막 장에서 오른쪽으로 넘겨도 첫 장이 안 온다 (복제 칸 제거)',
    file: STRIP,
    find: '  const slides = many ? [...banners, ...banners.slice(0, perView)] : banners',
    replace: '  const slides = banners',
    test: GUARD,
    why: '대표 *"마지막페이지에서 또 오른쪽으로 넘기면 첫페이지로"*. 네이티브 스크롤은 끝에서 멈춘다.',
  },
  {
    name: '🎠 복제 칸에 멈춰도 진짜 첫 장으로 안 옮긴다 (한 바퀴 뒤 숫자·스냅이 어긋남)',
    file: STRIP,
    find: '      if (at >= banners.length) jumpTo(at - banners.length)',
    replace: '      void 0',
    test: GUARD,
    why: '복제 칸에 남으면 다음 넘김이 갈 곳이 없다 — 두 바퀴째부터 캐러셀이 멈춘다.',
  },
  {
    name: '🎠 복제 카드가 스크린리더·탭 순서에 끼어든다',
    file: STRIP,
    find: "  const a11y = clone ? { 'aria-hidden': true as const, tabIndex: -1 } : {}",
    replace: '  const a11y = {}',
    test: GUARD,
    why: '같은 배너가 두 번 읽히고 탭으로 두 번 간다.',
  },
  {
    name: '🖥️ PC 배너가 다시 한 장짜리 2:1 이 된다 (1440px 에서 높이 ~670px)',
    file: STRIP,
    find: " ${many ? PC_CARD_W : ''} overflow-hidden",
    replace: ' overflow-hidden',
    test: GUARD,
    why: '대표 *"PC버전은 너무 무식하게 배너가 큰데?"* → 시안 a(한 줄 세 장) 확정.',
  },
  {
    name: '🖥️ PC 화살표가 사라진다 (마우스로는 둘째 장 이후를 볼 수 없다)',
    file: STRIP,
    find: 'onClick={goNext} aria-label="다음 배너"',
    replace: 'aria-label="다음 배너"',
    test: GUARD,
    why: '대표 *"좌우 스크롤도 안되고"* — 마우스엔 가로 스와이프가 없다.',
  },
  {
    name: '🖥️ 첫 장에서 이전을 누르면 아무 일도 안 일어난다 (순환 반쪽)',
    file: STRIP,
    find: '    jumpTo(banners.length)\n    requestAnimationFrame(() => goTo(banners.length - 1))',
    replace: '    goTo(0)',
    test: GUARD,
    why: '끝에서 오른쪽이 처음으로 이어지면 처음에서 왼쪽도 끝으로 이어져야 한다.',
  },
]
