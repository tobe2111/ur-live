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
    name: '🏪 할인 분기만 되돌린다 — 한 문장만 고치면 새는 자리',
    why: '설명 문장이 **둘**(할인 있음/없음)이다. 할인 중인 딜에서만 중복이 되살아나면 평상시 측정에 안 잡힌다.',
    file: META,
    find: '      ? `🎉 ${discount}% 할인! ${storeName} — ${priceStr}원에 유어딜에서 바로 구매`',
    replace: '      ? `🎉 ${discount}% 할인! ${store} ${name} — ${priceStr}원에 유어딜에서 바로 구매`',
    test: T,
  },
  {
    name: '🏪 Product.description 폴백만 되돌린다',
    why: '설명이 빈 상품에서만 쓰이는 자리라 눈에 안 띈다. 구글이 읽는 구조화 데이터라 설명 메타보다 더 오래 남는다.',
    file: META,
    find: '`${storeName} 공동구매`',
    replace: '`${store} ${name} 공동구매`',
    test: T,
  },
  {
    name: '🏪 크롤러 요약이 판단을 다시 구현한다 — 두 벌이 된다',
    why: '이 결함의 근본 원인이 바로 *두 곳이 따로 판단한 것*이다. 되돌리면 겉보기 동작은 같지만 다음에 한쪽만 고쳐져 또 갈린다.',
    file: NS,
    find: '  const parts = storeNameParts(head, title)',
    replace: '  const parts = head && title.startsWith(head) ? [title] : [head, title]',
    test: T,
  },
]
