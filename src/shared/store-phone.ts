/**
 * ☎️ **매장 전화번호를 어떻게 읽을 것인가** — 사기 방어의 갈림길 하나.
 *
 * ## 왜 이 판정이 필요한가 (2026-09-21)
 * 매장을 확인하는 가장 싸고 확실한 수단은 **전화 한 통**이다. 그런데 번호의 성격에 따라
 * 할 수 있는 일이 다르다:
 *   - **010 (휴대폰)** — 사장님 본인에게 닿는다. 알림톡도 보낼 수 있다.
 *   - **지역번호(02·031…) · 대표번호(15xx) · 없음** — 가게 카운터로 닿을 뿐이고
 *     알림톡은 못 보낸다 ⇒ **사람이 직접 걸어야 하는 큐**로 간다.
 *
 * ## ⚠️ 이 파일이 판정하지 않는 것
 * **"이 번호가 진짜 그 가게 번호인가"는 모른다.** 사기꾼은 자기 휴대폰을 적으면 그만이다.
 * 그래서 010 이라는 사실 자체가 안전을 뜻하지 않는다 — 그건 *연락 수단이 있다*는 뜻일 뿐이고,
 * 진짜 확인은 `store_verify_calls`(통화 기록)와 공개된 가게 번호 대조가 한다.
 */

/** 숫자만 남긴다(하이픈·공백·괄호·국가번호 `+82` 제거). 판정·중복키의 SSOT. */
export function normalizeKrPhone(raw: string | null | undefined): string {
  let d = String(raw ?? '').replace(/\D/g, '')
  // +82 10 1234 5678 → 01012345678 (국가번호 뒤 0 이 생략된 표기)
  if (d.startsWith('82')) d = '0' + d.slice(2)
  return d
}

/** 휴대폰(010·011·016~019)인가 — 알림톡·본인 통화가 가능한 번호. */
export function isMobileKr(raw: string | null | undefined): boolean {
  const d = normalizeKrPhone(raw)
  return /^01[0169]\d{7,8}$/.test(d)
}

/** 사람이 직접 걸어야 하는가 — 번호가 없거나 휴대폰이 아니면 true. */
export function needsManualCall(raw: string | null | undefined): boolean {
  return !isMobileKr(raw)
}
