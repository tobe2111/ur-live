/**
 * 🏪 가게명을 두 번 말하지 않는다 — 2026-10-13
 *
 * 실측: `/pass/2919` description 이 `달빛한스푼 달빛한스푼 닭도리탕 — …` 이었다.
 * 규칙은 `crawler-noscript` 에 이미 있었고 `detail-ssr-meta` 만 밖이었다.
 * 가드: `src/tests/unit/store-name-dedupe-2026-10-13.test.ts`.
 */
const SSOT = 'src/shared/seo/store-name-dedupe.ts'
const META = 'src/worker/utils/detail-ssr-meta.ts'
const NS = 'src/worker/utils/crawler-noscript.ts'
// 🔁 2026-10-14 — 행·글자 조립이 `crawler-noscript-rows.ts` 로 **추출**됐다(685줄 → 래칫 600 초과).
//    아래 앵커들의 결함은 한 글자도 안 바꿨고 **파일 경로만** 따라갔다.
const NS_ROWS = 'src/worker/utils/crawler-noscript-rows.ts'
const T = 'src/tests/unit/store-name-dedupe-2026-10-13.test.ts'

export default [
  {
    name: '🏪↩️ 가게명을 다시 말한다 — 이 결함의 실측 재현',
    why: '종전 상태가 정확히 이것이었다. `달빛한스푼 달빛한스푼 닭도리탕` 이 검색결과 설명으로 나갔고, 그 1건이 **유일한 실제 입점 매장**이다.',
    file: SSOT,
    find: '  return nm.startsWith(st) ? [nm] : [st, nm]',
    replace: '  return [st, nm]',
    test: T,
  },
  {
    name: '🏪 가게명이 안 겹칠 때 가게명을 버린다 — 정보를 잃는다',
    why: '반대 방향. 중복을 지우려다 **겹치지 않는 가게명까지** 버리면, 검색결과가 어느 가게 딜인지 말하지 않게 된다(로컬 검색이 본류인 서비스에서).',
    file: SSOT,
    find: '  return nm.startsWith(st) ? [nm] : [st, nm]',
    replace: '  return [nm]',
    test: T,
  },
  {
    name: '🏪 `startsWith` 를 `includes` 로 넓힌다 — 사람이 쓴 꼬리를 지운다',
    why: '`닭도리탕 (달빛한스푼)` 처럼 가운데·뒤에 든 가게명은 일부러 쓴 것이다. 지우면 뜻이 바뀐다 — 중복 제거가 아니라 내용 삭제가 된다.',
    file: SSOT,
    find: 'nm.startsWith(st)',
    replace: 'nm.includes(st)',
    test: T,
  },
  {
    name: '🏪 상세 설명이 SSOT 를 우회해 손으로 잇는다',
    why: '고친 자리가 바로 여기다. SSOT 는 그대로 남아 있어도 이 호출이 빠지면 결함이 되살아나고, **import 가 남아 있어 문자열 검사는 통과한다**.',
    file: META,
    find: '    const storeName = storeNameJoin(store, name)',
    replace: '    const storeName = `${store} ${name}`',
    test: T,
  },
  {
    // 🔁 2026-10-14 재조준 — 앵커에서 줄표가 빠졌다(#79). 불변식(가게명을 두 번 말하지
    //    않는다 · 두 분기 중 하나만 고치면 할인 중인 딜에서 되살아난다)은 그대로다.
    name: '🏪 할인 분기만 되돌린다 — 한 문장만 고치면 새는 자리',
    why: '설명 문장이 **둘**(할인 있음/없음)이다. 할인 중인 딜에서만 중복이 되살아나면 평상시 측정에 안 잡힌다.',
    file: 'src/shared/seo/detail-description.ts',
    // 🔁 2026-10-14 재조준: #85 로 할인 분기 문구가 바뀌었다. 지키는 불변식은 그대로 —
    //   **`storeNameJoin` 이 두 분기 모두에 걸려야 한다**(한쪽만 고치면 그 분기로 샌다).
    // 🔁 2026-10-15 재조준: 생성기가 `shared/seo/detail-description.ts` 로 옮겨갔다(클라가 같은
    //   함수를 쓰게 만든 커밋 · 출력 byte-불변). 지키는 불변식은 그대로다.
    find: "    ? `${ratingPrefix}${regionStr}${storeName} ${priceStr}원${origStr} ${pd.discount}% 할인${tail}`",
    replace: "    ? `${ratingPrefix}${regionStr}${store} ${name} ${priceStr}원${origStr} ${pd.discount}% 할인${tail}`",
    test: T,
  },
  {
    name: '🏪 Product.description 폴백만 되돌린다',
    why: '설명이 빈 상품에서만 쓰이는 자리라 눈에 안 띈다. 구글이 읽는 구조화 데이터라 설명 메타보다 더 오래 남는다.',
    file: META,
    // 🔁 2026-10-15 재조준: 그 폴백 문구가 `공동구매` → `이용권` 으로 바뀌었다(제목 SSOT 작업).
    //    지키는 불변식은 그대로다 — **가게 이름을 한 번만** 말한다(`${store} ${name}` 중복 금지).
    find: '`${storeName} 이용권`',
    replace: '`${store} ${name} 이용권`',
    test: T,
  },
  {
    name: '🏪 크롤러 요약이 판단을 다시 구현한다 — 두 벌이 된다',
    why: '이 결함의 근본 원인이 바로 *두 곳이 따로 판단한 것*이다. 되돌리면 겉보기 동작은 같지만 다음에 한쪽만 고쳐져 또 갈린다.',
    file: NS_ROWS,
    find: '  const parts = storeNameParts(head, title)',
    replace: '  const parts = head && title.startsWith(head) ? [title] : [head, title]',
    test: T,
  },
]
