/**
 * 📝 이용권 설명 SSOT (2026-10-15) — 되돌려-검증 매니페스트.
 *
 * 근거는 `src/shared/seo/detail-description.ts` 머리말, 가드는
 * `src/tests/unit/pass-description-ssot-2026-10-15.test.ts`.
 *
 * 🔴 **절반이 반대 방향이다.** 이 처방은 "두 벌을 한 벌로" 인데, 그걸 되돌리는 방향(클라가 다시
 *    자기 문장을 만든다)과 **더 나아가는 방향**(설명을 고치면서 잠금표 성질을 약화한다) 둘 다
 *    위험하다. 후자가 조용하다 — 설명은 멀쩡히 좋아지고 SSR 시드만 죽는다.
 *
 * 🧭 이름에 `[pass-desc]` 를 공유한다 — 러너의 `--only` 는 정규식이 아니라 **부분일치**다.
 */
const SSOT = 'src/shared/seo/detail-description.ts'
const CLIENT = 'src/pages/GroupBuyDetailPage.tsx'
const SERVER = 'src/worker/utils/detail-ssr-meta.ts'
const TEST = 'src/tests/unit/pass-description-ssot-2026-10-15.test.ts'

export default [
  {
    name: '[pass-desc] 클라가 다시 자기 문장을 만든다 (수리 전 라이브 상태)',
    file: CLIENT,
    // 🔁 2026-10-15 재조준 — 공유 카드도 같은 SSOT 를 쓰게 되어 이 문자열이 두 곳에 맞는다.
    //    지키려는 불변식(`<SEO>` 메타가 SSOT 를 지난다)은 그대로다 — 뒤 줄까지 포함해 가른다.
    find: '        description={passDetailDescription(detail)}\n        url={`/pass/${productId}`}',
    replace: '        description={`${detail.restaurant_name || \'\'} ${detail.name} 이용권, ${detail.group_buy_current}명 함께 구매 중`}\n        url={`/pass/${productId}`}',
    test: TEST,
    why:
      '이게 수리 전 라이브다 — **활성 359건 중 357건이 `0명`** 이고 react-helmet 이 서버 메타를 ' +
      '덮으므로 Googlebot 이 받는 스니펫이 "아무도 안 산 물건" 이라고 말한다. 게다가 그 기제는 ' +
      '존재하지 않는다(2026-05-30 즉시판매 단일가 · 2026-09-04 "마감 개념은 없어").',
  },
  {
    name: '[pass-desc] 생성기가 참가자 수를 읽는다 (서버까지 번진다)',
    file: SSOT,
    find: '  const priceStr = formatNumber(price)',
    replace: '  const priceStr = `${formatNumber(price)}원, ${Number((d as { group_buy_current?: unknown }).group_buy_current) || 0}명 함께 구매 중`',
    test: TEST,
    why:
      '이제 서버·클라가 **한 함수**를 쓰므로 이 자리가 새면 두 표면이 함께 되돌아간다. ' +
      '한 함수로 모은 이득의 짝이 이 위험이고, 그래서 가드가 생성기 소스까지 본다.',
  },
  {
    name: '[pass-desc] 서버가 다시 리터럴로 조립한다 (두 벌로 돌아간다)',
    file: SERVER,
    find: '    const description = passDetailDescription(d)',
    replace: '    const description = `${storeName} ${price.toLocaleString(\'ko-KR\')}원, 유어딜에서 할인가로 바로 구매`',
    test: TEST,
    why:
      '값이 같아 보여도 **두 벌이면 반드시 갈린다** — 제목에서 이미 치른 자리다(2026-10-14). ' +
      '리터럴이 남으면 SSOT 를 고쳐도 봇 셸(검색 크롤러가 받는 유일한 문서)에 전달되지 않는다.',
  },
  {
    name: '[pass-desc] 가게명 중복 제거를 없앤다 (달빛한스푼 달빛한스푼 닭도리탕)',
    file: SSOT,
    find: '  const storeName = storeNameJoin(store, name)',
    replace: '  const storeName = `${store} ${name}`.trim()',
    test: TEST,
    why:
      '종전 클라가 정확히 이 값을 냈다(`달빛한스푼 달빛한스푼 닭도리탕`). 이 레포엔 그 규칙의 ' +
      'SSOT(`store-name-dedupe`)가 있고 서버는 쓰는데 클라만 밖이었다.',
  },
  {
    name: '[pass-desc] 🔴 반대 방향 — 설명을 고치면서 SSR 시드 소비를 죽인다',
    file: CLIENT,
    find: 'useMemo<GroupBuyDetail | null>(() => pickSeedDetail<GroupBuyDetail>(Number(id), {',
    replace: 'useMemo<GroupBuyDetail | null>(() => (false as boolean) ? pickSeedDetail<GroupBuyDetail>(Number(id), {',
    test: TEST,
    why:
      '**이 방향이 조용하다** — 설명은 멀쩡히 좋아지고 첫 페인트만 느려진다(잠금표가 지키는 ' +
      '0-RTT 가 사라져도 에러·화면 깨짐이 0이다). 잠금표 파일을 만지는 PR 의 진짜 위험은 ' +
      '여기이고, 그래서 가드가 **지문 개수**를 함께 고정한다.',
  },
  {
    name: '[pass-desc] 생성기에 줄표를 섞는다 (#79 가 0 으로 동결한 문자)',
    file: SSOT,
    find: '    ? `${ratingPrefix}${regionStr}${storeName} ${priceStr}원${origStr} ${pd.discount}% 할인${tail}`',
    replace: '    ? `${ratingPrefix}${regionStr}${storeName} — ${priceStr}원${origStr} ${pd.discount}% 할인${tail}`',
    test: TEST,
    why:
      '대표가 2026-08-31 에 직접 "AI 티" 로 지적한 문자다. 이제 서버·클라 양쪽 스니펫에 뜬다 — ' +
      '`meta-copy-no-emdash` 와 **중복이 아니다**: 그쪽은 가드 래칫을, 이쪽은 출력을 본다.',
  },
]
