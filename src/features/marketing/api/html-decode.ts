/**
 * 🔤 웹페이지 바이트 → 글자 (2026-11-02 대표 *"B2B 파트너 필터링 잘 되고 있어?"* → 깨진 상호 222곳 수리).
 *
 * 🩸 **왜 생겼나**: 보강 크롤(`contact-enrich.ts`)이 `res.text()` 로 페이지를 읽었다. `text()` 는 **무조건
 *   UTF-8** 로 해석하므로, 아직 EUC-KR(옛 한글 인코딩)인 국내 사이트는 한글이 전부 U+FFFD(`�`)로 뭉개진다.
 *   그 뭉개진 `<title>` 이 이름 치유(`enrich-name-heal.ts`)를 거쳐 **상호로 저장**됐다
 *   (라이브 실측 222행 · 전부 `webkr` · 2026-11 에도 계속 생기는 중이었다). 같은 클래스를 카페 레인이
 *   먼저 밟았다(`influencer-cafe-members.ts` 머리말 — 18/18 실패의 원인이 이것이었다).
 *
 * 처방은 둘이고 **둘 다** 둔다:
 *   ① 페이지가 스스로 밝힌 문자셋(응답 헤더 → `<meta charset>`)이 EUC-KR 계열이면 그걸로 디코딩한다.
 *   ② 런타임이 `euc-kr` 디코더를 안 주면(Workers 지원 여부를 이 환경에서 확인할 수 없다) UTF-8 로 떨어지고,
 *      그때 생기는 `�` 는 **`hasBrokenText` 가 잡아 상호로 채택하지 않는다**(허위보다 빈칸이 낫다).
 */

/** 깨진 글자(U+FFFD)가 섞였는가 — 이게 있으면 그 문자열은 상호로 쓰지 않는다. */
export function hasBrokenText(s: string | null | undefined): boolean {
  return !!s && s.includes('�')
}

const KOREAN_LEGACY = /^(euc-?kr|ks_c_5601-1987|ksc5601|cp949|x-windows-949|windows-949|korean)$/i

/** 응답 헤더 또는 문서 앞부분(ASCII 로만 읽어도 된다)에서 선언된 문자셋 라벨을 찾는다. */
export function declaredCharset(contentType: string | null | undefined, head: Uint8Array): string | null {
  const fromHeader = /charset=["']?([\w.:-]+)/i.exec(contentType || '')?.[1]
  if (fromHeader) return fromHeader.toLowerCase()
  let ascii = ''
  for (let i = 0, n = Math.min(head.length, 4096); i < n; i++) {
    const c = head[i]!
    ascii += c < 0x80 ? String.fromCharCode(c) : ' '
  }
  const fromMeta = /<meta[^>]+charset=["']?\s*([\w.:-]+)/i.exec(ascii)?.[1]
  return fromMeta ? fromMeta.toLowerCase() : null
}

/** 바이트를 페이지가 선언한 문자셋으로 디코딩. 실패하면 UTF-8(깨진 글자는 `hasBrokenText` 가 거른다). */
export function decodeHtmlBytes(bytes: Uint8Array, contentType?: string | null): string {
  const cs = declaredCharset(contentType, bytes)
  if (cs && KOREAN_LEGACY.test(cs)) {
    try { return new TextDecoder('euc-kr').decode(bytes) } catch { /* 런타임 미지원 → 아래 UTF-8 */ }
  }
  return new TextDecoder().decode(bytes)
}
