/**
 * 🧭 2026-10-14 — 색인 대상인데 크롤러 본문 6자인 표면 셋의 주입.
 *
 * 근거·실측·처방이 왜 표면마다 다른지는
 * `src/tests/unit/thin-indexable-surfaces-2026-10-14.test.ts` 머리말.
 *
 * 🔴 **절반이 반대 방향이다.** 이 처방은 "더 막는" 쪽으로 틀리면 피해가 훨씬 크다 — thin 표면을
 *    빼는 이득은 작은데, 그 의도를 받는 랜딩(`/partners`·`/influencer`)까지 noindex 가 되면
 *    *"유어딜 입점"*·*"딜 소개로 수익"* 질의에 **아무것도 안 서고** 색인 복구는 수주다.
 *    그리고 색인을 뺄 때 `Disallow` 를 함께 걸면 크롤러가 noindex 를 **못 읽어** 영구히 남는다.
 */
const TEST = 'src/tests/unit/thin-indexable-surfaces-2026-10-14.test.ts'
const THIN = 'src/tests/unit/thin-surface-copy-2026-10-12.test.ts'
const SEO = 'src/shared/seo/consumer-surfaces.ts'
const COPY = 'src/shared/seo/surface-copy.ts'
const ROBOTS = 'public/robots.txt'

export default [
  {
    name: '🧭 /partnership 이 표에서 사라진다 — 제네릭 홈 제목으로 돌아간다',
    file: SEO,
    find: "  '/partnership': {",
    replace: "  '/partnership-GONE': {",
    test: TEST,
    why:
      '라이브 실측에서 이 경로만 **제네릭 홈 제목**(`유어딜 - 돈버는 쇼핑, …`)을 받고 있었다 — ' +
      '표에 없으면 서버 rewrite 를 안 타고, 클라 `<SEO>` 는 react-helmet 이라 비-JS 크롤러엔 무효다. ' +
      '푸터가 전 페이지에서 링크하므로 크롤러는 확실히 온다.',
  },
  {
    name: '🧭 /partnership 이 다시 색인 대상 — 4줄 문의 폼이 /partners 와 경쟁한다',
    file: SEO,
    // 🔀 2026-10-14 재조준 ×2: 접미사가 표에서 빠지며 앵커가 한 번 낡고, 그 **주석을 다시 고쳐**
    //   또 낡았다. ⇒ 앵커를 **주석이 아니라 코드 두 줄**로 옮겼다(그 사이에 주석을 넣지 말라고
    //   소스에 적어 뒀다). 지키는 불변식(*이 경로는 noindex 다*)은 그대로다.
    //   🧭 교훈: 주입 앵커는 **내가 고칠 가능성이 있는 산문**에 걸지 말 것.
    find: "    noindex: true,\n    title: '광고/제휴 문의',",
    replace: "    title: '광고/제휴 문의',",
    test: TEST,
    why:
      '이 화면의 글자는 넷(하나는 입력 안내, 하나는 접수 토스트)이고 합쳐 50자 남짓이다. 같은 ' +
      '의도(*매장 입점*·*제휴*)는 `/partners`(237자 · sitemap 제출)가 받으므로, 색인시키면 thin URL 을 ' +
      '같은 질의에 **경쟁**시키는 것이다(선례 `/search`·`/gb-market` 과 같은 판단).',
  },
  {
    name: '🧭 /influencer/rankings 가 다시 색인 대상 — 본문 20자인데 index',
    file: SEO,
    find: "    noindex: true,\n    title: '이 달의 소개 랭킹',",
    replace: "    title: '이 달의 소개 랭킹',",
    test: TEST,
    why:
      '그 화면의 글자는 제목(= 이 title 과 같은 말) · `지역별 매출 Top` · 표 머리뿐이라 **20자**다. ' +
      '나머지는 로그인·데이터가 있어야 그려지는 표라 본문을 **정직하게 채울 수가 없다** — 110자를 ' +
      '채우려고 문장을 지어내는 것이 이 레포가 금지한 쪽이다(2026-10-13 `/urshorts` 와 같은 판단).',
  },
  {
    name: '🧭 반대 방향 — /partners 를 noindex 로 (매장 입점 질의에 아무것도 안 선다)',
    file: SEO,
    find: "  '/partners': {\n    crumb: '매장 입점',",
    replace: "  '/partners': {\n    noindex: true,",
    test: TEST,
    why:
      '**이 방향이 훨씬 비싸다.** `/partnership` 을 noindex 로 돌린 처방 전체가 *"같은 의도는 ' +
      '`/partners` 가 받는다"* 에 기대고 있다 — 그 랜딩이 색인에서 빠지면 사장님 유입이 통째로 사라지고 ' +
      '복구는 수주다. (crumb 를 함께 지운 것은 noindex 표면 규약을 맞춰 **그 가드로 새어 잡히지 않게** ' +
      '한 것이다 — 이 주입이 재는 것은 "랜딩이 색인 대상으로 남는가" 하나다.)',
  },
  {
    name: '🧭 반대 방향 — /influencer 를 noindex 로 (소개 수익 질의가 사라진다)',
    file: SEO,
    find: "  '/influencer': {\n    crumb: '소개 파트너',",
    replace: "  '/influencer': {\n    noindex: true,",
    test: TEST,
    why:
      '`/influencer/rankings` 를 noindex 로 돌린 근거가 *"같은 질의는 `/influencer`(237자, 제출 중)가 ' +
      '받는다"* 다. 그 랜딩까지 빼면 소개 프로그램 유입이 0 이 된다.',
  },
  {
    name: '📧 /gdpr 본문에 이메일 줄을 싣는다',
    file: COPY,
    find: "      'We use essential cookies for authentication and session management. No third-party tracking cookies are used without consent.',",
    replace:
      "      'We use essential cookies for authentication and session management. No third-party tracking cookies are used without consent.',\n" +
      "      'For privacy inquiries: jiwon@ur-team.com',",
    test: TEST,
    why:
      '`<noscript>` 는 **사람이 받는 응답에도 그대로 실린다** — 이메일을 거기 또 심으면 수확 표면이 ' +
      '하나 늘 뿐 색인에 보탬이 0 이다(화면엔 이미 공개돼 있다는 것이 심을 이유가 되지 않는다).',
  },
  {
    name: '🔥 /gdpr 본문에 낡은 법정 문구(Firebase)를 승격한다',
    file: COPY,
    find: "      'Lister Corporation (\"YourDeal\") is the data controller for personal data processed through urdeal.kr.',",
    replace:
      "      'Data is processed on Cloudflare (global edge network) and Firebase (Google Cloud). Both providers maintain adequate safeguards for international data transfers.',\n" +
      "      'Lister Corporation (\"YourDeal\") is the data controller for personal data processed through urdeal.kr.',",
    test: TEST,
    why:
      'Firebase 클라이언트는 2026-08-04 에 **전면 삭제**됐다(#804). 낡았을 수 있는 **법정 문구**를 ' +
      'SEO SSOT 로 승격하면 그 주장을 검색결과에서 키우는 셈이고, 문구 자체의 수정은 법정 문서라 ' +
      '**대표 확인**이다(별건으로 올렸다).',
  },
  {
    name: '🧾 /gdpr 을 sitemap 에서 뺀다 — 본문은 있는데 제출하지 않는다',
    file: 'src/worker/routes/sitemap.routes.ts',
    find: "    { loc: '/gdpr', priority: 0.3, changefreq: 'yearly' },",
    replace: '',
    test: TEST,
    why:
      '`/urshorts` 와 같은 **짝 주장**이다 — 본문을 얻은 색인 대상은 제출한다(6자 → 382자). 순서를 ' +
      '뒤집으면(제출 먼저) soft-404 를 쌓고, 빠뜨리면 네이버 Yeti 가 **존재 자체를 모른다**' +
      '(내부 링크만으로는 사실상 도달하지 못한다 — 이 파일 2026-08-26 주석의 실측).',
  },
  {
    name: '🤖 반대 방향 — robots 의 Allow: /influencer/rankings 를 지운다',
    file: ROBOTS,
    find: 'Allow: /influencer/rankings',
    replace: '# Allow: /influencer/rankings',
    test: TEST,
    why:
      '`/influencer/` 가 Disallow 라 이 예외가 없으면 크롤러가 그 페이지의 **noindex 를 읽을 수 없다** ' +
      '— 이미 색인된 URL 이 영구히 남는다. 폐기·색인제외 처리에서 가장 흔한 실수이고 CLAUDE.md 가 ' +
      '그래서 *"지울 때는 크롤을 열어 둬야 한다"* 를 적어 뒀다.',
  },
  {
    name: '🤖 반대 방향 — robots 에 Disallow: /partnership 을 넣는다',
    file: ROBOTS,
    find: 'Disallow: /influencer/',
    replace: 'Disallow: /influencer/\nDisallow: /partnership',
    test: TEST,
    why: '같은 함정의 반대 얼굴 — 색인을 빼려고 크롤까지 막으면 noindex 가 전달되지 않는다.',
  },
  {
    name: '↩️ /business 별칭 301 을 지운다 — 측정 오류로 보고했던 그 경로',
    file: 'src/shared/seo/consumer-redirects.ts',
    find: "  '/business': '/partners',",
    replace: '',
    test: TEST,
    why:
      '2026-10-14 에 이 경로를 *"제네릭 홈 제목 + 본문 6자"* 결함으로 보고했다가 **측정 오류였음을 ' +
      '확인했다**(프로브에 `-L` 이 없어 301 의 빈 본문을 읽었다). 그 301 이 사라지면 그때는 **정말로** ' +
      '결함이 되고, 같은 오보를 다시 하게 된다.',
  },
  {
    name: '🔤 크롤러 본문 측정이 HTML 엔티티를 디코드하지 않는다',
    file: THIN,
    find: "    .replace(/&quot;/g, '\"')",
    replace: '',
    test: THIN,
    why:
      '빌더의 `esc()` 는 옳고 **재는 쪽**이 틀렸던 자리다 — 한글 표면 열에는 escape 대상 문자가 ' +
      '한 글자도 없어 몇 달간 아무도 안 밟았는데, `/gdpr`(`("YourDeal")`)을 넣자 *코드는 멀쩡한데* ' +
      '빨간불이 났다. 크롤러는 엔티티를 디코드해서 읽으므로 그걸 흉내 내야 측정이 사실과 같아진다.',
  },
  {
    name: '✂️ /gdpr 본문 줄 하나를 지운다 — 길이 바닥이 잡는다',
    file: COPY,
    find: "      'We retain personal data for as long as your account is active. Order data is kept for 5 years for tax compliance. You can delete your account at any time.',\n",
    replace: '',
    test: THIN,
    why:
      '길이 **하한**은 thin 은 막지만 *줄이 조용히 빠지는 것*은 못 막는다 — 그래서 표면별 래칫이 ' +
      '있다(2026-10-12 에 `/introduce` 에서 값을 치르고 배운 자리).',
  },
  {
    name: '🧭 /influencer/rankings 를 surface-copy 에 넣는다 (verbatim 이지만 thin)',
    file: COPY,
    find: "  '/gdpr': {",
    replace:
      "  '/influencer/rankings': {\n" +
      "    lines: ['이 달의 소개 랭킹', '지역별 매출 Top'],\n" +
      "    source: ['src/pages/InfluencerRankingsPage.tsx'],\n" +
      "  },\n  '/gdpr': {",
    test: TEST,
    why:
      '화면에 **실재하는** 글자만 넣어도(= 클로킹 가드는 통과한다) 합쳐 20자다. 그러면 본문이 ' +
      '생긴 것처럼 보이지만 thin 인 사실은 그대로이고, noindex 쪽이 정직한 처방이라는 판단이 ' +
      '조용히 뒤집힌다. 지키려는 것은 *"그 표면은 표에 들어오지 않는다"* 다.',
  },
]
