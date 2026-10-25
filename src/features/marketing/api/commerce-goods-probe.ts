/**
 * 🏷️ **취급품목 필드 탐침** — 코드표가 필요한지를 **라이브 응답으로** 판정한다 (2026-10-24).
 *
 * ## 왜 있나
 *
 * 통신판매 리드 412,428건의 `subcategory` 가 **전부 `'통신판매'`** 다(업종 분류가 사실상 비어 있다 —
 * 대표가 *"업종 구별이 완벽하지 않음, 정확도가 많이 낮음"* 이라고 지적한 그 숫자). 원재료인 취급품목은
 * `detail`(등록상세)에만 오고, 라이브에 들어온 값은 **숫자 코드**(`'12'` · `'01 06'`)인데 **코드표를
 * 모른다**. 포털 활용가이드에 있지만 이 환경은 `data.go.kr` 을 DNS 부터 막는다.
 *
 * 🔑 그런데 수집 코드의 별칭 목록엔 `ntslPrdlstCn`(판매품목)이 **차선으로** 있다. `g()` 는 첫 값만
 * 쓰므로 `trtmntPrdlstNm` 이 있으면 그 필드를 **한 번도 안 본다**. 그게 한글이면 **코드표가 아예
 * 필요 없다**(그 필드를 쓰면 된다). 시험 픽스처에 `'여성의류, 패션잡화'` 같은 한글이 들어 있는 것도
 * 그 가능성을 가리킨다.
 *
 * ⇒ 이 탐침이 **어드민 화면에서 그 답을 바로 보여 준다**: 어떤 필드가 왔나 · 값이 숫자 코드냐 글자냐.
 *   추가 API 요청 0(이미 받아 저장해 둔 `diag.by_service[*].sample` 을 읽을 뿐).
 *
 * ## 판정
 *
 * · `none` — 별칭 중 어느 것도 값이 없다(그 엔드포인트엔 취급품목이 안 온다)
 * · `code` — 숫자·공백만(`'12'` · `'01 06'`) ⇒ 코드표가 필요할 수 있다 **(아래 ⚠️ 를 먼저 읽을 것)**
 * · `text` — 글자가 있다(`'여성의류, 패션잡화'`) ⇒ **코드표 불필요**, 그 필드를 쓰면 된다
 *
 * ⚠️ 못 보는 것 ①: 표본 **한 건**으로 판정한다(그 엔드포인트의 모든 행이 같은 모양이라는 보장은 없다).
 *   `kind` 가 섞여 나오면 `by_service` 의 다른 회차 샘플을 더 봐야 한다.
 *
 * ⚠️ 못 보는 것 ② — **이게 더 크다(2026-10-25 정정)**: 이 함수는 `GOODS_FIELD_ALIASES` **여섯 개만**
 *   본다. 그래서 *"아는 필드가 코드다"* 는 말해 주지만 *"우리가 안 보는 텍스트 필드가 있다"* 는
 *   **구조적으로 못 본다.** ⇒ **`kind: 'code'` 를 곧바로 "코드표가 필요하다" 로 읽지 말 것.**
 *
 *   근거(라이브 실측): 저장된 5,425건의 품목 원문이 **전부 숫자 코드**이고 고유 코드가 **정확히 12개**
 *   (`01`~`12`, 텍스트 토큰 0건 · 분포 `12`:1596 `06`:1544 `01`:1238 `08`:850 …). 그런데
 *   ⓐ 공정위 **웹 페이지**는 같은 항목을 **텍스트**로 보여 준다(`'가전, 컴퓨터/사무용품'` — 웹 검색 실측)
 *   ⓑ 같은 부처의 형제 API 수집 코드(`market-collect.ts:13`)가 적어 둔 실응답 샘플은
 *      **`"trtmntPrdlst":"의류+…"`** 다 — **접미사 `Nm` 이 없고 값이 한글**이다.
 *   즉 우리 별칭 `trtmntPrdlstNm` 과 **이름이 한 글자 다른** 텍스트 필드가 있을 수 있다.
 *   ⚠️ 단 `market-collect` 는 **다른 엔드포인트**(시장·상점가)라 그 이름이 통신판매 등록상세에도
 *   있다고 **단정하면 안 된다**(형제 레인의 규칙을 일반화하는 것이 이 레포가 반복해 당한 오류다).
 *
 *   ⇒ **판정은 이 탐침이 아니라 `CommerceStats.diag.by_service.detail.coverage` 로 한다.** 그건
 *   `fieldCoverage()` 가 만든 **필드 이름 전수 + 채움률 + 예시값**이라 별칭 밖의 형제를 보여 준다
 *   (status 쪽은 그렇게 18개 필드가 다 보인다). 거기 텍스트 품목 필드가 있으면 **별칭 하나 추가로
 *   끝이고 코드표는 필요 없다**. 없을 때에만 대표께 코드표(`01`~`12` 이름)를 요청한다.
 *   ⚠️ 별칭은 `g()` **뒤에 덧붙인다** — 순서를 바꾸면 status 쪽 판정이 흔들린다.
 */

/** 수집 코드(`mapCommerceLead`)가 쓰는 **그 순서 그대로**의 별칭. 두 벌이 되면 탐침과 저장이 갈린다. */
export const GOODS_FIELD_ALIASES = ['trtmntPrdlstNm', 'ntslPrdlstCn', 'upteNm', 'dclsfNm', 'idustyNm', 'taskNm'] as const

export interface GoodsProbe {
  /** 값이 실제로 들어 있던 필드 이름(없으면 undefined). */
  field?: string
  /** 그 값(가림 없음 — 공개 등록 정보이고 품목명이라 개인정보가 아니다). 120자로 자른다. */
  value?: string
  kind: 'none' | 'code' | 'text'
  /** 별칭별로 값이 있었나 — "차선 별칭이 한글인가" 를 한눈에 본다. */
  byField?: Record<string, string>
}

/** 포털이 '값 없음'을 문자열로 주는 모양들 — `isNoValue` 와 같은 규약(여기 모듈은 의존을 안 만든다). */
const isBlank = (v: unknown): boolean => {
  const s = String(v ?? '').trim()
  return !s || s === 'N/A' || s === '-' || s.toLowerCase() === 'null' || s === '해당없음'
}

export function probeGoodsField(sample: unknown): GoodsProbe {
  if (!sample || typeof sample !== 'object') return { kind: 'none' }
  const row = sample as Record<string, unknown>
  const byField: Record<string, string> = {}
  let field: string | undefined
  let value: string | undefined
  for (const k of GOODS_FIELD_ALIASES) {
    if (isBlank(row[k])) continue
    const v = String(row[k]).trim().slice(0, 120)
    byField[k] = v
    if (!field) { field = k; value = v }   // 수집 코드와 같은 우선순위(첫 값이 이긴다)
  }
  if (!field || value === undefined) return { kind: 'none' }
  // 숫자·공백만이면 코드(복합 `'01 06'` 포함). 한 글자라도 글자가 섞이면 text.
  const kind = /^[0-9\s]+$/.test(value) ? 'code' : 'text'
  return { field, value, kind, byField }
}

/** 어드민 상태줄이 받는 모양. 키 목록 + 이메일 필드 유무 + 엔드포인트별 취급품목 판정. */
export interface CommerceProbe {
  keys?: string[]
  hasEmail?: boolean
  emailField?: string
  /** 🏷️ 엔드포인트별 취급품목 — **코드표가 필요한지**를 라이브 응답으로 답한다. */
  goods?: Record<string, GoodsProbe>
}

/**
 * `ads_commerce_stats.diag` 한 덩어리에서 어드민 탐침을 조립한다.
 *
 * ⚠️ `by_service` 가 없으면(옛 스냅샷) 공유 `sample` 로라도 재 본다 — 그래야 *"아직 안 돌았다"* 와
 *   *"그 필드가 없다"* 가 구분된다(둘을 섞으면 다음 세션이 또 코드표를 찾아 나선다).
 */
export function buildCommerceProbe(diag: unknown): CommerceProbe | undefined {
  const d = (diag ?? {}) as Record<string, unknown>
  const sample = d.sample as Record<string, unknown> | undefined
  if (!sample || typeof sample !== 'object') return undefined
  const keys = Object.keys(sample).slice(0, 40)
  // 이메일 필드 존재 = ① 키 이름이 이메일계열(eml/mail/emladr) 또는 ② 어떤 값이 이메일 형태.
  //   (대표자 이메일 rprsvEmladr 은 선택입력이라 첫 레코드 값이 비어도 필드는 존재 — 키로 판정.)
  const emailField = keys.find(k => /eml|email|mail/i.test(k))
  const hasEmailVal = Object.values(sample).some(v => /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i.test(String(v ?? '')))
  const bySvc = d.by_service as Record<string, { sample?: unknown }> | undefined
  const goods: Record<string, GoodsProbe> = {}
  for (const [name, slot] of Object.entries(bySvc || { shared: { sample } })) {
    goods[name] = probeGoodsField(slot?.sample)
  }
  return { keys, hasEmail: !!emailField || hasEmailVal, emailField, goods }
}
