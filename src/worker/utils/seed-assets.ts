/**
 * 🌱 시드 산문 정적 자산 로더 (2026-08-19 — 대표 확정 "지금 배포만 먼저 + 시드 외부화").
 *
 * ## 왜 있나
 * 가이드·블로그 시드는 **한국어 산문 428KB**(워커 번들의 11%)인데, 실제로는 **시드 버전이 오를 때만**
 * 쓰인다. 그런데 `.ts` 로 있으면 워커에 항상 상주해서, Cloudflare 무료 플랜의 **압축 후 1MB** 한도를
 * 밀어 올린다. 2026-08-19 배포가 실제로 이것 때문에 82바이트 차이로 막혔다(그 전날에도 한 번).
 * ⇒ 산문을 빌드 시 JSON 으로 뽑아 **정적 자산**으로 서빙하고, 필요할 때만 읽는다.
 *
 * ## 🚨 이 파일이 막는 사고
 * `env.ASSETS` 는 **없는 파일에 SPA `index.html` 을 200 으로** 돌려준다(워커 `/assets/*` 핸들러가
 * 같은 함정을 주석으로 남겨 뒀다 — 그 버그가 실제로 났었다). 그대로 `.json()` 하면 예외가 나거나,
 * 더 나쁘게는 **빈 시드로 판단**된다. 빈 시드로 동기화가 "성공"하면 호출부가 버전을 올려 버리고,
 * 그 다음부터는 **버전이 최신이라 재시드를 영영 건너뛴다** — 라이브 문서가 조용히 낡는다.
 * ⇒ ① `res.ok` ② content-type 이 JSON ③ 파싱 성공 ④ 기대한 모양 — **넷 다 통과해야만** 값을 준다.
 *   하나라도 어긋나면 `null` 을 주고, **호출부는 null 이면 버전을 올리지 않는다**(다음 요청에서 재시도).
 */

/** ASSETS 바인딩만 쓰면 되므로 Env 전체를 요구하지 않는다(테스트에서 가짜 주입이 쉬워진다). */
export interface SeedAssetEnv {
  ASSETS?: { fetch: (req: Request) => Promise<Response> }
}

/** 정적 자산 경로 SSOT — 빌드 스크립트(`scripts/build-seed-assets.mjs`)와 **같은 이름**을 써야 한다. */
export const SEED_ASSET_PATHS = {
  blog: '/seed/blog.json',
  guides: '/seed/guides.json',
} as const

/**
 * 시드 자산을 읽는다. **읽을 수 없으면 `null`** — 호출부는 null 일 때 아무것도 하지 말아야 한다
 * (특히 시드 버전을 올리면 안 된다).
 *
 * @param isValid 기대한 모양인지 확인하는 술어. 빈 배열/빈 객체를 시드로 오인하지 않게 호출부가 정한다.
 */
export async function loadSeedAsset<T>(
  env: SeedAssetEnv | undefined,
  path: string,
  isValid: (v: unknown) => v is T,
): Promise<T | null> {
  const assets = env?.ASSETS
  if (!assets?.fetch) return null
  try {
    // 호스트는 의미 없다(ASSETS 는 경로로 찾는다) — 실제 요청 URL 에 의존하지 않으려고 고정값을 쓴다.
    const res = await assets.fetch(new Request(`https://seed.internal${path}`))
    if (!res.ok) return null
    // ⚠️ 미존재 파일 → SPA index.html(text/html, 200). 이걸 걸러야 '빈 시드'로 오인하지 않는다.
    const ctype = res.headers.get('content-type') || ''
    if (!ctype.includes('json')) return null
    const parsed: unknown = await res.json()
    return isValid(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** 블로그 시드 모양 검사 — 글이 **한 편이라도** 있어야 시드로 인정한다(빈 배열은 사고 신호). */
export function isBlogSeed(v: unknown): v is Array<{
  slug: string; title: string; summary: string; tags: string; content: string
}> {
  return Array.isArray(v) && v.length > 0 && typeof (v[0] as { slug?: unknown })?.slug === 'string'
}

/** 가이드 시드 모양 검사 — 역할별 배열 맵. 최소 한 역할에 섹션이 있어야 한다. */
export function isGuideSeed(v: unknown): v is Record<string, Array<{
  key: string; icon: string; title: string; order: number; content: string
}>> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false
  const vals = Object.values(v as Record<string, unknown>)
  return vals.length > 0 && vals.some((a) => Array.isArray(a) && a.length > 0)
}
