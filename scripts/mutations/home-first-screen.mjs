/**
 * 🧬 주입 — **모바일 홈의 서버 첫 화면** (2026-10-08 대표 *"처음에 유어딜 페이지 들어올 때
 * 만큼은 로딩 장면 없이"* → *"모두 다 하자"* → *"진행해줘"*)
 *
 * 워커는 React 를 못 돌리므로(번들 gzip 게이트) 카드 마크업이 **두 벌**이다. 그 둘이 갈리는 길은
 * 전부 **조용하다** — 빌드도 테스트도 초록이고 화면도 안 깨진다. 마운트 때 그 자리가 튀거나
 * 같은 사진을 두 번 받을 뿐이고, 그걸 아는 사람은 그 순간을 보고 있던 사람뿐이다.
 */
const UTIL = 'src/worker/utils/home-first-screen.ts'
const WORKER = 'src/worker/index.ts'
const T = 'src/tests/unit/home-ssr-first-screen-2026-10-08.test.tsx'

export default [
  {
    name: '🏠 홈 서버 첫 화면 — 워커 분기가 안 탄다',
    file: WORKER,
    find: "ssrSlot === 'MAIN' && ssrExtraPayload && isMainPage && isMobileUserAgent(c.req.header('user-agent'))",
    replace: "ssrSlot === 'MAIN' && ssrExtraPayload && false && isMobileUserAgent(c.req.header('user-agent'))",
    test: T,
    why:
      '분기가 안 타면 catch-all 유달이 로더로 떨어진다 = 이 수리 이전 상태. 화면은 멀쩡하고 ' +
      '로딩 장면만 돌아오므로 **아무도 신고하지 않는다**(대표가 직접 물어서 알았다).',
  },
  {
    name: '🏠 홈 서버 첫 화면 — 폴백이 사라져 흰 화면이 될 수 있다',
    file: WORKER,
    find: 'homeFirst || urdealLoaderHtml',
    replace: 'homeFirst',
    test: T,
    why:
      '시드 파싱 실패·섹션 0건이면 빌더가 `\'\'` 를 돌려준다. 그때 `||` 가 없으면 `#root` 가 ' +
      '**통째로 비어** 흰 화면이 된다(로더조차 없다). 폴백은 이 설계의 전제다.',
  },
  {
    name: '🏠 홈 카드 사진 폭이 preload 와 갈린다 (같은 사진을 두 번 받는다)',
    file: UTIL,
    find: 'cfImage(src, { width: HOME_CARD_IMG_WIDTH_BASE, format: \'auto\' })',
    replace: 'cfImage(src, { width: 320, format: \'auto\' })',
    test: T,
    why:
      '워커는 이미 `home-card-preload` 로 base 폭(200) 사진을 당긴다. 첫 화면이 다른 폭을 그리면 ' +
      '그 preload 가 **통째로 버려지고** 같은 사진을 다시 받는다 — 느려지고 트래픽만 두 배다.',
  },
  {
    name: '🏠 홈 카드 제목 클래스가 카드와 갈린다 (마운트 때 제목이 튄다)',
    file: UTIL,
    find: "title: 'text-[13px] font-bold line-clamp-2 leading-tight",
    replace: "title: 'text-[14px] font-bold line-clamp-2 leading-tight",
    test: T,
    why:
      '13 → 14px 은 두 줄 제목에서 높이를 바꾼다. 그 아래 주소·평점·가격이 통째로 밀리고 ' +
      '**에러는 안 난다** — 그래서 시험이 진짜 컴포넌트를 렌더해 토큰까지 대조한다.',
  },
  {
    name: '🏠 홈 카드에서 평점 줄이 사라진다 (클라에만 있는 줄 = 마운트 때 밀림)',
    file: UTIL,
    find: '    (rating > 0\n',
    replace: '    (false\n',
    test: T,
    why:
      '평점은 시드에 있다(라이브 숙소 카드 4.7). 서버가 그 줄을 빼면 마운트 때 한 줄이 ' +
      '**생기면서** 가격이 내려간다. 서버가 안 그린 것이 채워지는 건 밀림이 아니지만, ' +
      '**그릴 수 있는데 안 그린 것**은 밀림이다.',
  },
  {
    name: '🏠 홈 첫 화면이 위치 이름을 지어낸다 (돌아온 사람에게 틀린 동네)',
    file: UTIL,
    find: '<span class="${HOME_FS_CLASS.locLabel}">&nbsp;</span>',
    replace: '<span class="${HOME_FS_CLASS.locLabel}">전국</span>',
    test: T,
    why:
      '저장된 지역·마지막 측위는 `localStorage` 에 있어 서버가 모른다. 아는 척하면 ' +
      '동탄에 사는 사람에게 1초간 "전국"을, 또는 그 반대를 보여 준다 — 밀림은 아니지만 거짓말이다.',
  },
  {
    name: '🏠 홈 첫 화면이 lucide 를 워커로 끌고 들어온다 (번들 gzip 게이트)',
    file: UTIL,
    find: "import { DEAL_CAT_LABELS } from '../../shared/deal-cats'",
    replace: "import { DEAL_CATS as DEAL_CAT_LABELS } from '../../pages/pc-home/PcHomeRail'",
    test: T,
    why:
      '라벨을 순수 모듈이 아니라 lucide 를 import 하는 파일에서 가져오면 `_worker.js` 가 lucide 를 ' +
      '통째로 안는다. gzip 여유는 **40KB** 뿐이고 이 게이트는 이미 한 번 배포를 깨뜨렸다(#533 → #537).',
  },
]
