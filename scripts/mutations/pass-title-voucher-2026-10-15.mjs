/**
 * 🏷️ 이용권 상세 제목 "공동구매" → "이용권" (2026-10-15 대표 승인) — 주입 매니페스트.
 * 가드: src/tests/unit/pass-title-voucher-2026-10-15.test.ts
 */
const TEST = 'src/tests/unit/pass-title-voucher-2026-10-15.test.ts'
const SSOT = 'src/shared/seo/detail-title.ts'
const SERVER = 'src/worker/utils/detail-ssr-meta.ts'
const CLIENT = 'src/pages/GroupBuyDetailPage.tsx'
const SEO = 'src/components/SEO.tsx'

export default [
  {
    name: '[pass-title] 제목이 다시 공동구매라고 말한다',
    file: SSOT, find: "`${n} 이용권`", replace: "`${n} 공동구매`", test: TEST,
    why: '310건의 검색 제목이 즉시판매 상품을 "여러 명이 모여야 하는 것"처럼 말하던 그 결함으로 되돌아간다.',
  },
  {
    name: '[pass-title] 같은 말을 두 번 한다',
    file: SSOT, find: 'KWON_WORD.test(n) ? n :', replace: 'false ? n :', test: TEST,
    why:
      '`1개월 이용권 + 운동복 이용권` · `평일 1박 숙박권 (…) 이용권` — 라이브 55건이 그렇게 된다. ' +
      '🔁 2026-10-15 재조준: 판정이 `includes(\'이용권\')` → `KWON_WORD` 로 넓어졌다(불변식 동일).',
  },
  {
    name: '[pass-title] 권종 판정을 글자 일치로 좁힌다 (수리 전 상태)',
    file: SSOT, find: 'KWON_WORD.test(n)', replace: "n.includes('이용권')", test: TEST,
    why:
      '배포 후 실측한 **그 결함**이다 — 글자가 같은 2건만 걸러 나머지 53건이 `평일 1박 숙박권 ' +
      '(스탠다드 룸) 이용권` 으로 나갔다. `교환권 교환권` 과 같은 클래스인데 단어가 달라 안 걸렸다.',
  },
  {
    name: '[pass-title] 권 복합어 경계를 없앤다 — 한 글자 권 이 접미사를 삼킨다',
    file: SSOT, find: 'const KWON_WORD = /[가-힣A-Za-z0-9]권/', replace: 'const KWON_WORD = /권/', test: TEST,
    why:
      '**반대 방향** — 앞 글자 경계가 없으면 이름 아무 데나 띄어 쓴 `권` 한 글자가 권종으로 읽혀 ' +
      '접미사가 사라진다. 넓히다가 306건이 무엇인지 말하지 않는 제목이 되는 쪽이 더 비싸다.',
  },
  {
    name: '[pass-title] 꼬리를 가게 이름 대신 사이트 이름으로',
    file: SSOT, find: '${store || siteName}`', replace: '${siteName}`', test: TEST,
    why: '310건이 전부 같은 꼬리가 되어 가게 이름(로컬 질의의 핵심)을 검색 결과에서 잃는다.',
  },
  {
    name: '[pass-title] 사이트 이름을 접미사로 덧붙인다',
    file: SSOT, find: '${store || siteName}`', replace: '${store || siteName} - 유어딜`', test: TEST,
    why: '제목이 23~35자라 사이트 이름을 더하면 검색 결과에서 잘린다(머리말 🔴).',
  },
  {
    name: '[pass-title] 앞 공백을 다시 남긴다',
    // 🔁 2026-10-15 재조준: 판정이 `KWON_WORD` 로 넓어졌다. 지키는 불변식은 그대로 —
    //    이름이 비어도 `<title>` 이 공백으로 시작하지 않는다.
    file: SSOT, find: '(KWON_WORD.test(n) ? n : `${n} 이용권`).trim()', replace: '(KWON_WORD.test(n) ? n : `${n} 이용권`)', test: TEST,
    why: '이름이 비면 `<title>` 이 공백으로 시작한다.',
  },
  {
    name: '[pass-title] 서버가 제목을 손으로 조립한다',
    file: SERVER, find: 'const pageTitle = passDetailTitle(name, store)',
    replace: "const pageTitle = `${name} 이용권 - ${store || '유어딜'}`", test: TEST,
    why: '서버·클라 두 벌이 되어 Googlebot(JS 렌더)과 Yeti(서버 HTML)가 다른 제목을 본다 — 2026-10-14 에 값을 치른 그 클래스.',
  },
  {
    name: '[pass-title] 클라가 제목을 손으로 조립한다',
    file: CLIENT, find: 'title={passDetailTitle(detail.name, detail.restaurant_name)}',
    replace: "title={`${detail.name} 이용권 - ${detail.restaurant_name || '유어딜'}`}", test: TEST,
    why: '같은 두 벌 — 이쪽은 react-helmet 이라 Googlebot 만 본다.',
  },
  {
    name: '[pass-title] 설명 폴백이 다시 공동구매',
    file: SERVER, find: '`${storeName} 이용권`', replace: '`${storeName} 공동구매`', test: TEST,
    why: '설명이 없는 상품의 검색 스니펫이 다시 틀린 단어를 쓴다.',
  },
  {
    name: '[pass-title] 공구 서비스(몰)의 공동구매까지 지운다',
    file: 'src/worker/utils/mall-ssr-meta.ts', find: '공동구매', replace: '이용권', test: TEST,
    why: '**반대 방향** — 운영자 몰의 픽업 공구는 실제로 여러 명이 모여 사는 것이고 서비스가 다르다(CLAUDE.md 서비스 분리).',
  },
  {
    name: '[pass-title] 죽은 twitter:site 를 이 자리에 되살린다',
    file: SEO, find: '      {/* 🐦 2026-10-15', replace: "      <meta name=\"twitter:site\" content={'@urdeal_kr'} />\n      {/* 🐦 2026-10-15", test: TEST,
    why: '봇 셸이 아니라 react-helmet 에 되살리면 Twitterbot(JS 미실행)에 또 도달하지 않는다 — 고친 것이 없는 채 코드만 늘어난다.',
  },
]
