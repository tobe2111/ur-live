/**
 * 📣 소개 파트너 모집 랜딩 `/influencer` 단일화 — 되돌려-검증 주입 (2026-10-31).
 * 규칙은 `src/tests/unit/influencer-landing-unify-2026-10-31.test.ts` 머리말에 있다.
 */
const T = 'src/tests/unit/influencer-landing-unify-2026-10-31.test.ts'

export default [
  {
    name: '📣 /creators 가 다시 별도 페이지가 된다',
    file: 'src/App.tsx',
    find: `<Route path="/creators" element={<Navigate to="/influencer" replace />} />`,
    replace: `<Route path="/creators" element={<CreatorsPage />} />`,
    test: T,
    why: '같은 사람에게 같은 말을 하는 랜딩이 다시 둘이 된다 — 검색에서 서로 경쟁하고 따로 낡는다.',
  },
  {
    name: '📣 옛 /creators 301 을 지운다',
    file: 'src/shared/seo/consumer-redirects.ts',
    find: `  '/creators': '/influencer',\n`,
    replace: ``,
    test: T,
    why: '푸터·안내 메일·sitemap 으로 밖에 뿌려진 링크가 크롤러에겐 홈 복제본(200)이 된다.',
  },
  {
    name: '📣 푸터가 다시 옛 주소로 링크한다',
    file: 'src/components/main/SiteFooter.tsx',
    find: `href="/influencer"`,
    replace: `href="/creators"`,
    test: T,
    why: '에러가 안 난다(301 로 도착한다). 매 클릭이 리다이렉트 한 홉을 더 타고 크롤러엔 정본이 흐려진다.',
  },
  {
    name: '📣 sitemap 이 301 되는 옛 주소를 제출한다',
    file: 'src/worker/routes/sitemap.routes.ts',
    find: `    { loc: '/influencer', priority: 0.85, changefreq: 'weekly' },\n`,
    replace: `    { loc: '/creators', priority: 0.85, changefreq: 'weekly' },\n`,
    test: T,
    why: '리다이렉트되는 URL 제출은 서치콘솔·서치어드바이저 수집 오류가 되고 사이트맵 신뢰도가 깎인다.',
  },
  {
    name: '📣 푸터 이름이 다시 "크리에이터 모집"',
    file: 'src/components/MobileFooter.tsx',
    find: `소개 파트너 모집</a>`,
    replace: `크리에이터 모집</a>`,
    test: T,
    why: '명칭 SSOT 위반 — 사람을 신분으로 부르지 않는다. 페이지 안에서는 "소개 파트너" 라 부른다.',
  },
  {
    name: '📣 /influencer 가 접두사 전체 화면이 되어 도구 화면 네비를 지운다',
    file: 'src/lib/consumer-chrome.ts',
    find: `export const fullScreenExactPaths = ['/influencer']`,
    replace: `export const fullScreenExactPaths: string[] = []\nfullScreenPrefixes.push('/influencer')`,
    test: 'src/tests/unit/landing-pc-2026-09-16.test.ts',
    why: '/influencer/dashboard·/settlement 는 폰 폭 도구라 하단 탭이 필요하다 — 접두사면 그 화면에서 네비가 사라진다.',
  },
]
