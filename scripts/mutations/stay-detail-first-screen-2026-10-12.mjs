/**
 * 🏨 숙소 상세 서버 첫 화면 (2026-10-12, 대표 "모두 다 진행해줘") — 주입 매니페스트.
 * 가드: src/tests/unit/stay-detail-ssr-first-screen-2026-10-12.test.ts
 *
 * 이 클래스의 결함은 **전부 에러가 안 난다** — 빌드도 테스트도 초록이고 화면도 안 깨진다.
 * 틀린 자리는 "마운트 순간 한 번 튀는 것" 뿐이라, 그 순간을 보고 있던 사람만 안다.
 */
const TEST = 'src/tests/unit/stay-detail-ssr-first-screen-2026-10-12.test.ts'
const BUILDER = 'src/worker/utils/stay-detail-ssr-body.ts'

export default [
  {
    name: '🏨 히어로 URL 을 손으로 조립한다 — 같은 사진을 두 번 받는다',
    file: BUILDER,
    find: 'const heroUrl = detailHeroMobileUrl(main, DETAIL_HERO_MOBILE_WIDTH)',
    replace: "const heroUrl = `/cdn-cgi/image/width=900/${main}`",
    test: TEST,
    why: '브라우저는 URL 이 한 글자만 달라도 preload 를 안 쓴다(2026-09-02 에 111KB 를 그렇게 버렸다).',
  },
  {
    name: '🏨 프레임이 3:2 가 아니다 — 마운트 때 사진 높이가 바뀐다',
    file: BUILDER,
    find: 'aspect-ratio:3/2',
    replace: 'aspect-ratio:1/1',
    test: TEST,
    why: '갤러리(`aspectRatio: \'3/2\'`)와 갈리면 사진이 130px 길어졌다 줄어들며 아래 전부를 민다.',
  },
  {
    name: '🏨 히어로 래퍼를 빼먹는다 — 풀블리드(-mx-4 -mt-5)가 깨진다',
    file: BUILDER,
    find: '`<div class="${STAY_HEAD.heroWrap}">${hero}${mobileThumbRowHtml(images)}</div>` +',
    replace: 'hero +',
    test: TEST,
    why: '`/pass/:id` 는 래퍼에 모바일 치수가 없어 생략해도 됐다 — 숙소는 그 래퍼가 좌우 16px·위 20px 를 만든다. 베끼면 틀린다.',
  },
  {
    name: '🏨 그라디언트를 그린다 — 숙소는 badges 를 안 넘기는데 서버만 어두워진다',
    file: BUILDER,
    find: "        '</div>' +\n      '</div>'\n\n    // ⭐",
    replace: "        '</div>' +\n        '<div style=\"position:absolute;inset:0 0 auto 0;height:110px;background:linear-gradient(180deg,rgba(0,0,0,.4),transparent)\"></div>' +\n      '</div>'\n\n    // ⭐",
    test: TEST,
    why: '`/pass/:id` 의 scrim 은 `badges` prop 으로 들어오는 것이다 — 베껴 오면 마운트 때 어둠이 걷힌다.',
  },
  {
    name: '🏨 성급이 없으면 그 div 를 아예 안 그린다 — 라이브 37건이 4px 튄다',
    file: BUILDER,
    find: '`<div class="${STAY_HEAD.metaRow}">${star}</div>` +',
    replace: '(star ? `<div class="${STAY_HEAD.metaRow}">${star}</div>` : \'\') +',
    test: TEST,
    why: 'React 는 값이 없어도 그 div 를 그린다(`mb-1` = 4px). 49건 중 별점이 있는 것은 12건뿐이다.',
  },
  {
    name: '🏨 경계를 넘어 주소까지 그린다 — 거리/아이콘이 없어 마운트 때 어긋난다',
    file: BUILDER,
    find: "      `<h1 class=\"${STAY_HEAD.h1}\">${escText(title)}</h1>` +",
    replace: "      `<h1 class=\"${STAY_HEAD.h1}\">${escText(title)}</h1>` +\n      `<div class=\"mt-1 text-[12px]\">${escText(String(p.address || ''))}</div>` +",
    test: TEST,
    why: '그 줄은 `PinIcon` SVG 를 품는다 — path 를 워커 문자열로 옮기는 것이 이 레포가 반복해 당한 두 벌 클래스다.',
  },
  {
    name: '🏨 PC 에도 본문을 그린다 — 제목 헤더가 끼어들며 히어로를 민다',
    file: BUILDER,
    find: '`<div class="${STAY_HEAD.gridPad} lg:hidden">` +',
    replace: '`<div class="${STAY_HEAD.gridPad}">` +',
    test: TEST,
    why: 'PC 제목(`DetailTitleHeader`)은 그리드 **밖**이고 `hidden lg:block` 이다 — 서버가 안 그리면 마운트 때 위에서 밀어 넣는다.',
  },
  {
    name: '🏨 치수 클래스를 손으로 적는다 — SSOT 를 우회한다',
    file: 'src/pages/StayDetailPage.tsx',
    find: 'className={STAY_HEAD.heroWrap}',
    replace: 'className="relative -mx-4 -mt-5 lg:mx-0 lg:mt-0 bg-gray-100 dark:bg-[#1D1F29] lg:rounded-2xl lg:overflow-hidden lg:border lg:border-gray-100 dark:lg:border-[#2C2F35]"',
    test: TEST,
    why: '같은 글자여도 두 벌이 되는 순간 다음 세션이 한쪽만 고친다 — 그게 이 SSOT 가 생긴 이유다.',
  },
  {
    name: '🍞 빵부스러기 항목 간격이 다시 갈린다 (gap-2 → gap-1.5)',
    file: 'src/worker/utils/detail-ssr-body.ts',
    find: "export const DETAIL_CRUMB_ITEM_CLASS = 'flex items-center gap-2 shrink-0'",
    replace: "export const DETAIL_CRUMB_ITEM_CLASS = 'flex items-center gap-1.5 shrink-0'",
    test: TEST,
    why: '2026-10-12 이전에 실제로 이랬다 — PC 상세의 빵부스러기가 마운트 때 6px → 8px 로 벌어지고 있었다(에러 0).',
  },
  {
    name: '🏨 워커가 유형 라벨 사본을 되살린다 — guesthouse 13건이 또 갈린다',
    file: 'src/worker/utils/detail-ssr-meta.ts',
    find: "    const typeLabel = p.property_type ? propertyTypeLabel(p.property_type) : '숙소'",
    replace: "    const STAY_TYPE_LABEL: Record<string, string> = { guesthouse: '게스트하우스' }\n    const typeLabel = p.property_type ? (STAY_TYPE_LABEL[p.property_type] || '숙소') : '숙소'",
    test: TEST,
    why: '화면은 "스테이", 서버 메타는 "게스트하우스" — 둘 다 그럴듯해서 재 본 사람만 안다(라이브 13건).',
  },
  {
    name: '📰 폴백 경로에도 skipTitle 을 쓴다 — 본문에서 숙소명이 통째로 사라진다',
    file: 'src/worker/index.ts',
    find: 'stayNoscriptFromPayload(ssrPayload) + urdealLoaderHtml',
    replace: 'stayNoscriptFromPayload(ssrPayload, { skipTitle: true }) + urdealLoaderHtml',
    test: TEST,
    why: '첫 화면이 `\'\'` 인 경우(사진 없음·파싱 실패)에 쓰이는 길이다 — 그릴 첫 화면이 없는데 이름까지 빼면 수리가 도로 무효다.',
  },
  {
    name: '📰 첫 화면 경로가 숙소명을 두 번 말한다 (규율 ② 위반)',
    file: BUILDER,
    find: 'stayNoscriptFromPayload(ssrPayload, { skipTitle: true }) +',
    replace: 'stayNoscriptFromPayload(ssrPayload) +',
    test: TEST,
    why: '첫 화면이 이미 그린 제목·성급을 요약이 반복하면 크롤러에게 같은 말을 두 번 한다.',
  },
  {
    name: '🧯 사진이 없어도 그린다 — 폴백이 사라진다',
    file: BUILDER,
    // 🩸 첫 판은 `if (!main) return ''` 를 앵커했는데 **헛돌았다** — `detailHeroMobileUrl('')` 도
    //    `''` 라 아래 가드가 같은 결과를 낸다(위 줄은 값싼 조기탈출일 뿐). 실일을 하는 줄로 재조준.
    find: "    if (!heroUrl || heroUrl.startsWith('data:')) return ''",
    replace: '    const _unusedHero = heroUrl',
    test: TEST,
    why: '사진이 없으면 React 는 유형 아이콘 폴백을 그린다 — 서버가 빈 프레임을 그리면 마운트 때 아이콘이 튀어나온다.',
  },
  {
    name: '🧯 첫 화면이 로더를 안 품는다 — 사진 아래가 빈 채로 멈춘 것처럼 보인다',
    file: BUILDER,
    find: "      '</div>' + shortLoader",
    replace: "      '</div>'",
    test: TEST,
    why: '아직 오는 중이라는 **정직한 신호**가 사라진다 — 사진·제목만 뜬 채 멈춘 화면으로 읽힌다.',
  },
  {
    name: '🧯 상품명 이스케이프를 건너뛴다 — 속성을 탈출한다',
    file: BUILDER,
    find: '`<img src="${escAttr(heroUrl)}" alt="${escAttr(title)}"',
    replace: '`<img src="${escAttr(heroUrl)}" alt="${title}"',
    test: TEST,
    why: '숙소명은 셀러-제어 값이다(2026-06-26 OG 인젝션 차단과 같은 클래스).',
  },
  {
    name: '🧯 워커가 첫 화면을 안 쓴다 — 빌더가 있어도 아무것도 안 바뀐다',
    file: 'src/worker/index.ts',
    find: 'const stayFirst = buildStayDetailFirstScreen(ssrPayload, urdealLoaderHtml);',
    replace: "const stayFirst = '';",
    test: TEST,
    why: '이 레포가 반복해 당한 **조용한 부재** — 파일은 멀쩡히 있고 아무도 안 부른다.',
  },
]
