#!/usr/bin/env node
/**
 * 🔢 목록 응답에서 **첫 항목의 id** 하나를 꺼낸다 — 배포 후 스모크의 상세 검사용.
 *
 * 🩸 2026-11-01 실사고에서 나왔다. `main.yml` 의 상품 상세 스모크가 이 일을 YAML 안
 *   python 일행으로 하고 있었다:
 *       items=(d.get('data') or {}).get('products') or d.get('data') or d.get('products') or []
 *   라이브 `/api/products` 는 `{success, data:[…], pagination}` 이라 **`data` 가 리스트**다(실측).
 *   리스트는 truthy 이므로 첫 분기의 `.get` 에서 **AttributeError** 가 나고, 뒤에 붙은 `or` 폴백
 *   셋은 **도달조차 못 한다**. 그 예외를 `2>/dev/null` 이 숨기고 `|| echo ""` 가 빈 값으로 바꿔
 *   `⚠️ 상품 목록 파싱 실패 — 상품 상세 smoke skip` 이 됐다.
 *   ⇒ **모든 배포에서 조용히 건너뛰어졌다.** 그 검사는 2026-06-10 교환권 상세 500 사고
 *   (`SELECT p.*` 컬럼 한도 — 목록은 멀쩡한데 상세만 깨진다)를 잡으려고 만든 바로 그 검사다.
 *
 * 🧭 그래서 두 가지를 구조로 바꿨다:
 *   ① **일행을 쓰지 않는다** — 제어 흐름을 못 쓰니 `or` 사슬이 생기고, 그 사슬이 흔한 경우에서
 *      먼저 터졌다. 순수 함수로 빼면 분기를 쓸 수 있고 **시험이 실제 모양으로 돌릴 수 있다**.
 *   ② **"못 찾았다" 와 "없다" 를 가른다** — 종전엔 둘 다 빈 문자열이라 호출부가 구분할 수 없었다.
 *      못 찾은 것은 통과가 아니다(호출부가 실패시킨다).
 *
 * 출력(한 줄): `<숫자 id>` · `__EMPTY__`(목록이 비었다 — 검사할 게 없다) · `__FAIL__ <이유>`
 * 종료코드는 늘 0 이다 — 판정은 호출부가 **출력으로** 한다(파이프 뒤 exit code 를 그 명령의
 * 결과로 읽는 함정을 만들지 않는다).
 */

/** 이 레포의 목록 응답 세 모양을 전부 받는다. 모양을 **짐작하지 않고** 타입으로 가른다. */
export function pickFirstId(doc) {
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    return { fail: `최상위가 객체가 아니다(${Array.isArray(doc) ? 'array' : typeof doc})` }
  }
  const data = doc.data
  let items
  if (Array.isArray(data)) items = data                       // { data: [...] }        ← 라이브 /api/products
  else if (data && typeof data === 'object') items = data.products  // { data: { products: [...] } }
  if (items === undefined || items === null) items = doc.products   // { products: [...] }
  if (!Array.isArray(items)) {
    return { fail: `목록을 못 찾았다(최상위 키: ${Object.keys(doc).join(',') || '없음'})` }
  }
  if (items.length === 0) return { empty: true }
  const first = items[0]
  if (first === null || typeof first !== 'object' || Array.isArray(first)) {
    return { fail: `첫 항목이 객체가 아니다(${Array.isArray(first) ? 'array' : typeof first})` }
  }
  const id = first.id
  // 🔴 숫자로 읽히는 것만 받는다. 호출부가 URL 에 그대로 붙이므로 문자열을 통과시키면
  //    `/api/products/undefined` 같은 요청이 **404 로 "정상"** 처리된다(또 조용해진다).
  if (typeof id === 'number' && Number.isFinite(id)) return { id }
  if (typeof id === 'string' && /^\d+$/.test(id)) return { id: Number(id) }
  return { fail: `첫 항목에 숫자 id 가 없다(id=${JSON.stringify(id)})` }
}

/** 출력 한 줄로 바꾼다 — 호출부(셸)가 읽는 계약. */
export function formatPick(r) {
  if (r.fail) return `__FAIL__ ${r.fail}`
  if (r.empty) return '__EMPTY__'
  return String(r.id)
}

// CLI: stdin 으로 JSON 을 받는다. 이 파일을 직접 실행했을 때만.
if (import.meta.url === `file://${process.argv[1]}`) {
  let raw = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) raw += chunk
  let doc
  try { doc = JSON.parse(raw) } catch (e) {
    console.log(`__FAIL__ JSON 이 아니다(${(e && e.message || '').slice(0, 80)} · ${raw.length}바이트)`)
    process.exit(0)
  }
  console.log(formatPick(pickFirstId(doc)))
}
