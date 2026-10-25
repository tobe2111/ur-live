/**
 * 🔗 2026-10-12 — 지역 트리의 자식 링크(허브 → 시/도 → 시군구).
 *
 * 시험: src/tests/unit/region-child-links-2026-10-12.test.ts
 * 라이브 실측(그 시험 머리말): 색인 대상 지역 43~44개인데 그 트리로 들어가는 **a태그 0개**.
 */
const DG = 'src/shared/seo/region-digest.ts'
const NS = 'src/worker/utils/crawler-noscript.ts'
const TEST = 'src/tests/unit/region-child-links-2026-10-12.test.ts'

export default [
  {
    name: '🔗🗺️ 허브가 요약을 다시 못 받는다 — 링크를 만들 수 없다',
    why: '종전 상태가 정확히 이것이었다. `/region` 이 요약 대상이 아니어서 허브 본문이 120자에 '
       + 'a태그 0 이었고, 색인 대상 44개가 sitemap 으로만 발견됐다.',
    file: DG,
    find: "  return pathname === '/stays' || pathname === '/region' || REGION_PATH_RE.test(pathname)",
    replace: "  return pathname === '/stays' || REGION_PATH_RE.test(pathname)",
    test: TEST,
  },
  {
    name: '🔗🗺️ thin 지역도 링크한다 — 색인 말라고 한 URL 로 크롤 예산이 빠진다',
    why: '링크 집합과 색인 집합이 갈리면, 우리가 noindex 를 준 URL 을 우리가 내부 링크로 밀어 '
       + '준다. 오늘 교환권 상세·facet 에서 반복해 피한 그 모순이다.',
    file: DG,
    find: '    if (n < REGION_INDEX_MIN_DEALS) continue',
    replace: '    if (false) continue',
    test: TEST,
  },
  {
    name: '🔗🗺️ 요약이 없을 때 전국 시/도 목록을 지어낸다',
    why: '🔴 가장 위험한 방향. cron 전·KV miss 에 "그래도 허브는 링크가 있어야 한다" 는 생각으로 '
       + '정적 목록을 폴백으로 넣으면, 딜이 0건인 지역까지 내부 링크로 밀어 주고 그 URL 들은 '
       + 'noindex 다 — 아무 링크도 없는 것보다 나쁘다.',
    file: DG,
    find: '  const rows = digestRowsOf(digestJson)\n\n  // 후보를 모은다',
    replace: "  const rows = digestRowsOf(digestJson)\n  if (!rows.length) return ['서울', '경기', '인천'].map(sido => ({ label: sido, href: `/region/${encodeURIComponent(sido)}` }))\n\n  // 후보를 모은다",
    test: TEST,
  },
  {
    name: '🔗🗺️ 세는 루프가 교환권까지 센다 — 링크 집합이 색인 집합과 갈린다',
    why: '교환권(`deal_only=1`)은 매장이 없어 지역 페이지의 항목이 아니고 `regionThinByDigest` 도 '
       + '세지 않는다. 여기서 세면 브랜드 주소가 thin 지역을 임계값 위로 밀어 올려 **noindex 인 '
       + 'URL 을 내부 링크로** 밀어 준다(픽스처의 인천이 2 + 교환권 2 = 4 로 그 경우다).',
    file: DG,
    find: "    for (const r of rows) {\n      if (Number(r?.deal_only) === 1) continue\n      if (addressInRegion(",
    replace: '    for (const r of rows) {\n      if (addressInRegion(',
    test: TEST,
  },
  {
    name: '🔗🗺️ 시군구 잎에도 자식을 만든다 — 없는 트리를 한 단계 더 판다',
    why: '`/region/서울/종로구` 는 잎이다. 더 깊은 경로는 라우트가 없으므로 링크하면 404 로 '
       + '보낸다.',
    file: DG,
    find: "  if (seg[1] !== 'region' || seg.length > 3) return []",
    replace: "  if (seg[1] !== 'region') return []",
    test: TEST,
  },
  {
    name: '🔗🗺️ 주소를 손으로 조립한다 — 정규화되는 시/도에서 canonical 과 어긋난다',
    why: '`강원특별자치도` 주소는 `강원` 으로 정규화된다. 원문을 그대로 href 로 쓰면 canonical 과 '
       + '다른 URL 을 가리키는데 **에러가 전혀 안 난다**(같은 세션 빵부스러기 작업의 교훈).',
    file: DG,
    // 🔁 2026-10-13 재조준: 조립이 `regionPath` SSOT 로 옮겨갔다(다섯 벌 → 한 벌). 불변식
    //   (*canonical 과 같은 URL*)은 그대로이고, 같은 결함을 호출부에서 만든다.
    find: '    const href = regionPath(ref)',
    replace: "    const href = `/region/${encodeURIComponent(ref.sido)}-x`",
    test: TEST,
  },
  {
    name: '🔗🗺️ 허브 본문에 링크를 안 붙인다 — 배선만 빠진다',
    why: '판정 함수는 멀쩡한데 호출부가 없으면 **계산만 하고 아무 일도 안 한다**. 계산과 사용은 '
       + '다른 자리다(`check-guard-registry` 가 같은 교훈을 적어 둔 클래스).',
    file: NS,
    // 2026-10-12: 사이에 제목(`h1`) 한 줄이 끼었다 — 불변식(허브 본문이 자식 링크를 **쓴다**)은
    // 그대로이고, 앵커를 조립 표현 자체로 좁힌다(사이에 줄이 또 끼어도 안 낡는다).
    // 2026-10-25: 생활 허브 FAQ(`faqDl`)가 또 끼었다 — 불변식 그대로.
    find: "`<noscript>${h1}${lines}${faqDl}${kids}</noscript>`",
    replace: "`<noscript>${h1}${lines}${faqDl}</noscript>`",
    test: TEST,
  },
  {
    name: '🔗🗺️ 시/도 페이지에 자식 링크를 안 붙인다',
    why: '시군구 32곳이 색인 대상인데 그 트리로 들어가는 내부 링크가 0 이던 것이 원래 증상이다. '
       + '허브만 고치면 한 단계만 열린다.',
    file: NS,
    find: "      + `${childLinksHtml(path, ssrPayload)}</noscript>`",
    replace: '      + `</noscript>`',
    test: TEST,
  },
  {
    name: '🔗🗺️ 자식 링크 마크업을 조립부에서 직접 쓴다 — 탈출이 두 벌이 된다',
    why: '조립이 두 자리로 갈리면 한쪽이 `esc()` 를 빠뜨린다(이 레포가 반복해 밟은 클래스). '
       + '마크업은 `childLinksHtml` 한 곳에서만 만든다.',
    file: NS,
    find: '  return `<ul>${kids.map(k => `<li><a href="${esc(k.href)}">${esc(k.label)}</a></li>`).join(\'\')}</ul>`',
    replace: '  return `<ul>${kids.map(k => `<li><a href="${k.href}">${k.label}</a></li>`).join(\'\')}</ul>`',
    test: TEST,
  },
]
