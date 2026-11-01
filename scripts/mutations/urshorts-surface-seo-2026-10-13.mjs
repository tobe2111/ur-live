/**
 * 🎬 유어쇼츠 두 표면의 서버 메타 — 2026-10-13
 *
 * `/urshorts`·`/videos` 가 `CONSUMER_SURFACE_SEO` 에 없어 **제목·설명이 홈과 완전히 같았고**,
 * `/videos` 는 클라가 `noindex` 를 선언하는데 서버가 `index, follow` 를 줬다.
 * 가드: `src/tests/unit/urshorts-surface-seo-2026-10-13.test.ts`.
 */
const SEO = 'src/shared/seo/consumer-surface-table.ts' // 🗂️ 2026-11-01 표 분리(불변식 불변 — 대상 파일만 옮겨갔다)
const VID = 'src/pages/VideosPage.tsx'
const BRW = 'src/pages/UrShortsBrowsePage.tsx'
const T = 'src/tests/unit/urshorts-surface-seo-2026-10-13.test.ts'

export default [
  {
    name: '🎬 /urshorts 가 표에서 빠진다',
    why: '종전 상태로의 회귀 — 제목·설명이 홈과 같아져 검색결과에서 홈의 중복으로 보인다(에러 0)',
    file: SEO,
    find: "  '/urshorts': {\n    crumb: '유어쇼츠',",
    replace: "  '/urshorts_disabled': {\n    crumb: '유어쇼츠',",
    test: T,
  },
  {
    name: '🎬 /videos 가 표에서 빠진다',
    why: '뷰어의 noindex 가 다시 클라에만 남아 Yeti·AI 봇에는 무효가 된다',
    file: SEO,
    find: "  '/videos': {",
    replace: "  '/videos_disabled': {",
    test: T,
  },
  {
    name: '🎬 뷰어가 색인 가능해진다',
    why: '같은 영상이 /urshorts 와 /videos 두 URL 로 색인 경쟁한다 — 그 페이지는 스스로 noindex 를 원한다',
    file: SEO,
    find: "    description: '영상으로 보고 바로 구매하는 이용권',\n    noindex: true,",
    replace: "    description: '영상으로 보고 바로 구매하는 이용권',",
    test: T,
  },
  {
    name: '🎬 /urshorts 까지 noindex 로 묶는다',
    why: '반대 방향 — 뷰어만 빼면 되는데 전체보기 그리드까지 색인에서 빼면 유어쇼츠가 검색에서 통째로 사라진다',
    file: SEO,
    find: "  '/urshorts': {\n    crumb: '유어쇼츠',",
    replace: "  '/urshorts': {\n    crumb: '유어쇼츠',\n    noindex: true,",
    test: T,
  },
  {
    name: '🎬 noindex 표면에 빵부스러기를 단다',
    why: '색인 말라고 한 URL 을 빵부스러기 체인에 넣는 것은 서로 반대되는 신호다',
    file: SEO,
    find: "  '/videos': {\n    // ⚠️ noindex 표면은 `crumb` 를 **일부러 비워 둔다**(가드가 양방향으로 고정).\n    title: '유어쇼츠',",
    replace: "  '/videos': {\n    crumb: '유어쇼츠 뷰어',\n    title: '유어쇼츠',",
    test: T,
  },
  {
    name: '🎬 뷰어 페이지가 noindex 전달을 멈춘다',
    why: '표에만 noindex 가 있고 클라가 안 넘기면 JS 렌더 크롤러에는 색인 가능으로 보인다(양쪽이 어긋난다)',
    file: VID,
    find: '        url="/videos"\n        noindex\n      />',
    replace: '        url="/videos"\n      />',
    test: T,
  },
  {
    name: '🎬 뷰어가 문구를 다시 손으로 적는다',
    why: '문구가 두 벌이 되면 서버와 클라가 다른 제목을 내보내는 날이 온다 — 에러는 안 난다',
    file: VID,
    find: "        title={CONSUMER_SURFACE_SEO['/videos'].title}",
    replace: '        title="유어쇼츠 - 유어딜"',
    test: T,
  },
  {
    name: '🎬 전체보기가 문구를 다시 손으로 적는다',
    why: '같은 드리프트 — 표를 고쳐도 화면이 안 따라온다',
    file: BRW,
    find: "        title={CONSUMER_SURFACE_SEO['/urshorts'].title}",
    replace: '        title="유어쇼츠 - 유어딜"',
    test: T,
  },
  {
    name: '🎬 화면의 설명 한 줄을 지운다',
    why: '메타에만 설명이 남으면 검색 스니펫과 도착 화면이 다른 말을 한다(종전 이 페이지엔 설명이 0줄이었다)',
    file: BRW,
    find: '        영상으로 먼저 보고 바로 사는 동네 이용권. 도시·종류로 골라 보세요.\n      </p>',
    replace: '        &nbsp;\n      </p>',
    test: T,
  },
  {
    name: '🎬 남의 유튜브 영상을 VideoObject 로 선언한다',
    why: '영상이 전부 제3자 채널이다(부산일보TV·해피푸게더 …) — 우리 페이지의 영상이라 선언하면 거짓 주장이고, 브랜드 sameAs 를 비워 둔 것과 같은 규율을 깬다',
    file: BRW,
    find: "import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'",
    replace: "import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'\nconst SCHEMA_KIND = 'VideoObject'\nvoid SCHEMA_KIND",
    test: T,
  },
]
