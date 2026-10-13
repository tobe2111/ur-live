/**
 * 🏪 가게명 + 상품명을 **같은 말을 두 번 하지 않고** 잇는다 — 2026-10-13
 *
 * 매장이 자기 가게 이름을 상품명에 그대로 넣는 것은 자연스럽다(실측 `/pass/2919`:
 * 가게 `달빛한스푼` · 상품 `달빛한스푼 닭도리탕`). 그걸 그대로 `${store} ${name}` 으로
 * 이으면 검색결과 설명이 **`달빛한스푼 달빛한스푼 닭도리탕`** 이 된다 — 에러가 안 나고
 * 화면도 안 깨져서 **재 본 사람만 안다.**
 *
 * 🔑 이 규칙은 새로 만든 것이 아니다 — `crawler-noscript.ts` 가 2026-10-12 에
 * 교환권 목록에서 이미 쓰고 있었고(`네이버페이 포인트 — 네이버페이 포인트 500원`),
 * **`detail-ssr-meta.ts` 만 그 규칙 밖에 있었다.** 두 벌로 두면 또 갈리므로 여기 하나로 모은다.
 *
 * ⚠️ 이 함수는 **잇는 방법을 정하지 않는다** — 부르는 쪽이 구분자를 고른다
 * (목록은 ` — `, 상세 설명은 ` `). 가르는 판단만 공유한다.
 *
 * 🔴 `includes` 가 아니라 `startsWith` 다. 가게명이 상품명 **가운데**나 **뒤**에 들어간
 * 경우(`닭도리탕 (달빛한스푼)`)는 사람이 일부러 쓴 꼬리일 수 있어 지우면 뜻이 바뀐다.
 */
export function storeNameParts(store: unknown, name: unknown): string[] {
  const st = String(store ?? '').trim()
  const nm = String(name ?? '').trim()
  if (!st) return nm ? [nm] : []
  if (!nm) return [st]
  return nm.startsWith(st) ? [nm] : [st, nm]
}

/** 가게명·상품명을 구분자로 이은 한 줄(둘 중 하나가 비면 있는 것만). */
export function storeNameJoin(store: unknown, name: unknown, sep = ' '): string {
  return storeNameParts(store, name).join(sep)
}
