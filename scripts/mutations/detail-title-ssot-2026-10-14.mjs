/**
 * 🏷️ 2026-10-14 — 상세 `<title>` SSOT 의 주입.
 *
 * 근거·실측은 `src/shared/seo/detail-title.ts` 머리말, 가드는
 * `src/tests/unit/detail-title-ssot-2026-10-14.test.ts`.
 *
 * 🔴 **절반이 반대 방향이다** — 이 처방은 "더 바꾸는" 쪽으로 틀리면 피해가 크다:
 *    숙소 지역을 주소 우선으로 바꾸면 49건이 `강원` → `강원특별자치도` 로 길어지며
 *    `/region/강원` 슬러그 표기와도 어긋난다.
 *    🔁 2026-10-15: 이용권 제목 동결(결재 #35)은 **승인으로 해제**됐다 — 그 주입은
 *    "공동구매 라는 말이 SSOT 에 다시 들어온다" 로 재조준했고, 생성기 규칙은
 *    `scripts/mutations/pass-title-voucher-2026-10-15.mjs` 가 본다.
 *
 * 🧭 이름에 `상세 제목` 을 공유한다 — 러너의 `--only` 는 정규식이 아니라 **부분일치**다.
 */
const SSOT = 'src/shared/seo/detail-title.ts'
const META = 'src/worker/utils/detail-ssr-meta.ts'
const TEST = 'src/tests/unit/detail-title-ssot-2026-10-14.test.ts'

export default [
  {
    name: '🏷️ 상세 제목 — 교환권 중복 제거를 없앤다 (수리 전 상태)',
    file: SSOT,
    find: "  return `${n.includes('교환권') ? n : `${n} 교환권`} - ${siteName}`",
    replace: "  return `${n} 교환권 - ${siteName}`",
    test: TEST,
    why:
      '라이브 실측 100건 중 **6건**이 이름에 이미 `교환권` 을 품었고 그대로 덧붙여 ' +
      '`스타벅스 e카드 5만원 교환권 교환권 - 유어딜` 이 나왔다(2,260건 추정 ~135건). ' +
      '이 레포엔 바로 그 규칙의 SSOT(`store-name-dedupe`)가 있는데 제목만 밖에 있었다.',
  },
  {
    name: '🏷️ 상세 제목 — 교환권 판정을 startsWith 로 (가운데 중복을 놓친다)',
    file: SSOT,
    find: "n.includes('교환권')",
    replace: "n.startsWith('교환권')",
    test: TEST,
    why:
      '실측 6건은 `교보문고 기프트카드 교환권 10만원권`·`롯데모바일교환권 5만원권` 처럼 ' +
      '**가운데**에 들었다. `store-name-dedupe` 가 일부러 `startsWith` 인 것과 **규칙이 다른** ' +
      '이유이고(그쪽은 꼬리가 사람이 쓴 것일 수 있다) 시험 ②-3 이 그 차이를 적어 둔다.',
  },
  {
    name: '🏷️ 상세 제목 — 숙소 지역을 빼고 이름만 (클라의 수리 전 상태)',
    file: SSOT,
    find: "  return `${n}${r ? ` (${r})` : ''} - ${siteName}`",
    replace: "  return `${n} - ${siteName}`",
    test: TEST,
    why:
      '수리 전 클라가 바로 이 값을 냈고 react-helmet 이 서버 제목을 덮어 **Googlebot 이 지역을 ' +
      '잃고 있었다**(Yeti 는 받았다 — 한 URL 두 값). 지역 키워드는 로컬 질의의 핵심이다.',
  },
  {
    // 🔁 2026-10-18 재조준 — 지역 공식이 `stayRegionShort` 로 옮겨갔다. 지키는 방향 둘은 그대로다:
    //   긴 표기(`강원특별자치도`)로 새지 않는다 · 일치하는 37건은 byte-동일. 결함은 *원문 주소를 자르는*
    //   쪽(긴 표기)으로 심는다.
    name: '🏷️ 상세 제목 — 반대 방향: 숙소 지역을 주소 원문으로 (49건이 길어진다)',
    file: SSOT,
    find: "  const r = stayRegionShort(region?.sido, region?.sigungu, region?.address)",
    replace: "  const r = String(region?.address ?? '').trim().split(/\\s+/).slice(0, 2).join(' ') || [region?.sido, region?.sigungu].filter(Boolean).join(' ')",
    test: TEST,
    why:
      '**이 방향이 조용히 비싸다** — 주소에서 뽑으면 `강원` → `강원특별자치도` 가 되어 라이브 49건의 ' +
      '제목이 길어지고 `/region/강원` 슬러그 표기와 어긋난다. 그리고 같은 파일의 **설명**은 컬럼 ' +
      '공식을 쓰므로 한 문서 안에서 지역이 두 값이 된다. 컬럼 우선이라야 byte-동일이다.',
  },
  {
    name: '🏷️ 상세 제목 — 빈 지역에 빈 괄호를 만든다',
    file: SSOT,
    find: "${r ? ` (${r})` : ''}",
    replace: "${` (${r})`}",
    test: TEST,
    why:
      '빈 라벨만 남는 것이 없는 것보다 나쁘다는 것은 이 레포의 요약 규율이다(`crawler-noscript` ' +
      '머리말). 지역 컬럼·주소가 모두 빈 숙소에서 `무지개펜션 () - 유어딜` 이 된다.',
  },
  {
    name: '🏷️ 상세 제목 — 서버 교환권이 리터럴로 돌아간다',
    file: META,
    find: "      const title = voucherDetailTitle(name)",
    replace: "      const title = `${name} 교환권 - 유어딜`",
    test: TEST,
    why:
      '리터럴이 남으면 SSOT 를 고쳐도 **봇 셸(검색 크롤러가 받는 유일한 문서)** 에 전달되지 않는다 — ' +
      '2026-10-11 `#organization` 과 같은 자리(*파일에 있다 ≠ 크롤러가 받는다*).',
  },
  {
    name: '🏷️ 상세 제목 — 서버 숙소가 리터럴로 돌아간다',
    file: META,
    find: "    const pageTitle = stayDetailTitle(stayName, { sido: p.region_sido, sigungu: p.region_sigungu, address: p.address })",
    replace: "    const pageTitle = `${stayName}${region ? ` (${region})` : ''} - 유어딜`",
    test: TEST,
    why:
      '값이 같아 보여도 **두 벌이면 반드시 갈린다** — 오늘 제목·`og:image:alt`·robots 에서 세 번 ' +
      '같은 클래스를 고쳤다. 클라가 SSOT 를 쓰는 동안 서버만 리터럴이면 다음 수정에서 어긋난다.',
  },
  {
    name: '🏷️ 상세 제목 — 클라 숙소가 리터럴로 돌아간다 (지역 없음)',
    file: 'src/pages/StayDetailPage.tsx',
    find: "title={stayDetailTitle(stay.restaurant_name || stay.name, { sido: stay.region_sido, sigungu: stay.region_sigungu, address: stay.address })}",
    replace: "title={`${stay.restaurant_name || stay.name} - 유어딜`}",
    test: TEST,
    why: '이게 수리 전 라이브 상태다 — Googlebot 이 받는 제목에서 지역이 사라진다.',
  },
  {
    name: '🏷️ 상세 제목 — 클라 교환권이 리터럴로 돌아간다 (교환권 교환권)',
    file: 'src/pages/VoucherDetailPage.tsx',
    find: "title={voucherDetailTitle(product.name)}",
    replace: "title={`${product.name} 교환권 - 유어딜`}",
    test: TEST,
    why: '이게 수리 전 라이브 상태다 — ~135건이 `교환권 교환권` 으로 브라우저 탭·공유 카드에 뜬다.',
  },
  {
    name: '🏷️ 상세 제목 — SSOT 에 공동구매 를 쓰는 함수가 다시 생긴다',
    file: SSOT,
    find: "export function voucherDetailTitle(",
    replace: "export function groupBuyDetailTitle(name: unknown, store: unknown): string {\n  return `${String(name ?? '').trim()} 공동구매 - ${String(store ?? '').trim() || CONSUMER_SITE_NAME}`\n}\nexport function voucherDetailTitle(",
    test: TEST,
    why:
      '🔁 2026-10-15 재조준 — 종전 이 주입은 **결재 #35 대기**(이용권 제목 동결)를 지키려고 ' +
      '`passDetailTitle` 을 심었다. 승인이 왔으므로 그 함수는 이제 정상이고, 지켜야 하는 것은 ' +
      '**그 말이 다시 들어오는 것**이다: 이 상품은 모여서 사는 게 아니다(2026-05-30 즉시판매 단일가). ' +
      '시험 ⑤-1 이 생성기 한 줄이 아니라 **SSOT 파일 전체**를 보는 이유가 이 주입이다 — ' +
      '다음 세션이 이름만 다른 함수로 그 말을 되살리면 310건 제목이 조용히 되돌아간다.',
  },
  {
    name: '🏷️ 상세 제목 — 사이트 이름을 리터럴로 박는다',
    file: SSOT,
    find: "  siteName: string = CONSUMER_SITE_NAME,\n): string {\n  const n = String(name ?? '').trim()\n  const r = stayRegionShort",
    replace: "  siteName: string = '유어딜',\n): string {\n  const n = String(name ?? '').trim()\n  const r = stayRegionShort",
    test: TEST,
    why:
      '브랜드 이름은 `CONSUMER_SITE_NAME` 한 곳이다 — 리터럴로 박으면 이름이 바뀌는 날 제목만 옛 ' +
      '이름으로 남는다(이 레포가 "링크샵 → 유어샵" 에서 치른 그 클래스).',
  },
]
