/**
 * 🧬 주입 — 통신판매 품목 **원문 승계** (2026-10-26)
 *    가드: src/tests/unit/company-description-promote-2026-10-26.test.ts
 *
 * 왜: `description` 이 ON CONFLICT 갱신 목록에 없어서 **한 번 쓰이면 영영 그대로**였다. detail(품목)
 * 레코드가 나중에 와도 업종만 승격되고 원문은 안 남았다 — 수집기 자신의 주석이 "원문이 있어야
 * 다음에 표를 고칠 수 있다" 고 적어 둔 그 의도가 조용히 깨져 있었다(라이브 실측: commerce
 * 424,299행 중 취급없음 417,156 · 숫자코드 5,713 · 한글 1,430).
 *
 * 규칙은 네 겹으로 좁혀져 있고, 아래 주입은 **그 네 겹이 각각 일하는지**를 본다. 넓히는 방향
 * (무조건 덮기)과 좁히는 방향(승계를 다시 없애기)을 **둘 다** 심는다 — 한쪽만 보면 "덮어써서
 * 크롤 소개문을 잃는 것" 과 "안 덮어써서 원문이 안 남는 것" 을 구분할 수 없다.
 */
const T = 'src/tests/unit/company-description-promote-2026-10-26.test.ts'
const S = 'src/features/marketing/api/company-save.ts'
const C = 'src/features/marketing/api/commerce-notify-collect.ts'
export default [
  {
    name: '원문 승계 — description 갱신을 다시 없앤다(종전 상태로 되돌림)',
    file: S,
    find: '         description = CASE\n           WHEN excluded.source = \'commerce\'',
    replace: '         description = CASE\n           WHEN 0',
    test: T,
    why: '종전 상태다 — 업종(subcategory)은 승격되는데 품목 **원문**은 영영 안 남는다. 그러면 나중에 '
      + '버킷 표를 넓혀 재분류를 돌릴 때 **읽을 재료가 없어 헛돈다**(숫자코드 5,713행이 이미 그 상태다).',
  },
  {
    name: '원문 승계 — commerce 출처 조건을 뺀다',
    file: S,
    find: "           WHEN excluded.source = 'commerce'\n                AND excluded.description LIKE '%취급 %'",
    replace: "           WHEN 1\n                AND excluded.description LIKE '%취급 %'",
    test: T,
    why: 'webkr 크롤 소개문에도 "취급" 이라는 낱말이 흔하다(실측: "애견용품 창고형 할인매장 … 취급 품종, '
      + '분양가를 확인하세요"). 출처를 안 보면 그런 소개문이 품목 원문으로 **잘못 승계**된다.',
  },
  {
    name: '원문 승계 — 저장값이 수집기 조립 문자열인지 안 본다(크롤 소개문을 덮어쓴다)',
    file: S,
    find: "                     OR (ad_company_leads.description LIKE '대표 %'",
    replace: "                     OR (1 = 1",
    test: T,
    why: '`대표 ` 로 시작하는지가 **"이 값은 수집기가 조립한 것"** 의 표식이다. 그걸 안 보면 사람이 볼 '
      + '가치가 있는 웹 크롤 소개문을 `대표 … · 취급 …` 로 **덮어쓴다** — 정보를 잃는 방향이다.',
  },
  {
    name: '원문 승계 — 저장값의 숫자코드 판정을 뺀다(숫자코드가 영영 안 고쳐진다)',
    file: S,
    find: "                              OR ad_company_leads.description LIKE '%취급 0%'\n                              OR ad_company_leads.description LIKE '%취급 1%')))",
    replace: "                              OR 0)))",
    test: T,
    why: '숫자코드가 든 저장값은 `NOT LIKE \'%취급 %\'` 가 거짓이므로, 숫자코드 판정이 없으면 **승계 대상에서 '
      + '빠진다** — 라이브 5,713행이 영영 `취급 01 02` 로 남는다(이 수리의 주된 대상이 그들이다).',
  },
  {
    name: '원문 승계 — 들어오는 값의 한글 판정을 뺀다(숫자코드가 한글을 되덮는다)',
    file: S,
    find: "                AND excluded.description NOT LIKE '%취급 0%' AND excluded.description NOT LIKE '%취급 1%'",
    replace: "                AND 1 = 1",
    test: T,
    why: '수리 전 detail 이 다시 오면 `취급 01 02` 가 이미 고쳐 둔 `취급 종합몰 …` 을 **되덮는다**. '
      + '승계는 한 방향이어야 한다 — 숫자코드 → 한글만.',
  },
  {
    name: '수집기 — 품목 별칭 순서를 숫자코드 우선으로 되돌린다(2026-10-25 사고 재현)',
    file: C,
    find: "const goods = g(it, 'ntslPrdlstCn', 'trtmntPrdlstNm'",
    replace: "const goods = g(it, 'trtmntPrdlstNm', 'ntslPrdlstCn'",
    test: T,
    why: '`g()` 는 **비어 있지 않은 첫 별칭**에서 멈춘다. 숫자코드 필드가 앞에 있으면 한글 정규식 분류기가 '
      + '한 건도 못 맞춰 업종이 전부 `통신판매` 로 굳는다 — 2026-10-25 에 93% 가 그 상태였던 원인이 '
      + '데이터가 아니라 **이 한 줄의 순서**였다.',
  },
  {
    name: '수집기 — 품목 원문을 description 에 안 남긴다',
    file: C,
    find: "      goods && `취급 ${goods.slice(0, 120)}`,",
    replace: "      null,",
    test: T,
    why: '버킷으로 요약만 하고 원문을 버리면 **표를 고쳐도 되돌릴 수 없다**. 수집기 주석이 "원문이 있어야 '
      + '다음에 표를 고칠 수 있다" 고 적어 둔 그 이유이고, 이번 승계 규칙의 전제이기도 하다.',
  },
  {
    name: '원문 승계 — 무조건 덮어쓴다(반대 방향 — 넓히면 더 나쁘다)',
    file: S,
    find: '         description = CASE\n           WHEN excluded.source',
    replace: '         description = COALESCE(excluded.description, ad_company_leads.description), -- CASE\n           WHEN excluded.source',
    test: T,
    why: '"갱신 목록에 넣으면 되지" 의 순진한 판이다. status 레코드(품목 없음)가 detail 이 채운 원문을 '
      + '되덮고, 웹 크롤 소개문도 날아간다. **네 겹은 장식이 아니라 각각 잃을 것을 막는다.**',
  },
]
