/**
 * 🔔 IndexNow — **네이버·Bing 에 "이 URL 이 바뀌었다" 를 즉시 알린다** (2026-10-14, 대표 "다 해주고").
 *
 * ## 왜
 *
 * 지금 우리에겐 색인을 **요청하는 수단이 없다** — sitemap 의 `lastmod` 를 크롤러가 **언제 다시
 * 읽을지 기다리는 것**이 전부다. 새 이용권이 올라가거나 가격이 바뀌어도 그게 검색에 반영되는
 * 시점을 우리가 못 당긴다.
 *
 * 📡 **네이버 서치어드바이저가 2023-07 부터 IndexNow 를 지원한다.** 그리고 한 곳에 제출하면
 *    **Bing · Yandex · Seznam · Yep 이 같은 피드를 공유**한다 ⇒ 호출 하나로 다섯에 닿는다.
 *    대표 지시 *"네이버도 해주고"* 와 바로 닿는 자리다.
 *    🔴 **구글은 IndexNow 를 지원하지 않는다** — 구글은 여전히 sitemap·크롤이다(기대를 섞지 말 것).
 *
 * ## 🔑 sitemap 이 제출하는 URL 만 보낸다
 *
 * 선택 술어를 **다시 적지 않는다**. 우리 `/sitemap.xml` 을 읽어 그 안의 `<loc>` 중 `<lastmod>` 가
 * 커서보다 새 것만 고른다. 이 레포가 반복해 값을 치른 *"두 벌이 갈린다"* 를 구조적으로 막는 길이고
 * (한쪽만 고치면 **색인하지 말라고 한 URL 로 크롤을 부르게 된다**), sitemap 의 noindex·thin 게이트가
 * 자동으로 상속된다.
 *
 * ⚠️ 그래서 **`lastmod` 가 없는 URL 은 영원히 제출되지 않는다**(실측 451건 중 71건 — 지역 43 ·
 *    유어샵·셀러 4 · 정적 표면). 그건 결함이 아니라 *언제 바뀌었는지 모르는 것을 모른다고 두는 것*이다
 *    (2026-10-12 에 날짜를 지어내지 않기로 한 그 결정과 같은 축).
 *
 * ## ⚠️ 첫 회차는 **아무것도 보내지 않는다**
 *
 * 커서가 비어 있으면 **커서만 세우고 끝난다**. 안 그러면 첫 실행이 380건을 한꺼번에 밀어 넣는데,
 * 그건 우리에게 쓸모도 없고(전부 이미 알려진 URL) 받는 쪽에는 스팸으로 보인다.
 *
 * ## 🔒 이 모듈은 네트워크를 모른다
 *
 * 전부 순수 함수다 — 제출은 `worker/cron/indexnow-submit.ts` 가 하고, 그쪽에 **게이트**가 있다.
 */

/**
 * 제출 엔드포인트 — **엔진마다 직접** 보낸다(2026-10-31 대표 "모두 해줘").
 *
 * 🩸 종전엔 공유 중계 `api.indexnow.org` 하나만 썼는데 전수·변경분이 둘 다 **429** 를 받았고,
 *    중계가 거절하면 어느 엔진에도 안 간다(한 곳이 막히면 전부 막힌다). 네이버(국내 검색의 본류)와
 *    빙(빙·코파일럿·덕덕고)에 각각 보내면, 규격상 참여 엔진끼리 공유되므로 **한 곳만 받아도 전파된다.**
 * ⇒ 판정은 "하나라도 200/202 면 성공" 이다(커서를 올린다). 전부 실패해야 커서를 유지한다.
 */
export const INDEXNOW_ENDPOINTS: readonly string[] = [
  'https://searchadvisor.naver.com/indexnow',
  'https://www.bing.com/indexnow',
]

/** 한 회차 상한. IndexNow 규격은 1회 10,000까지지만 우리 변경량은 하루 수십 건이다. */
export const INDEXNOW_MAX_URLS = 100

/** 커서를 담는 `platform_settings` 키. */
export const INDEXNOW_CURSOR_KEY = 'indexnow_cursor'

/**
 * 키 파일 경로. IndexNow 는 `https://<host>/<key>.txt` 에 그 키가 **그대로** 적혀 있어야
 * 제출을 받아 준다(소유 증명). 키는 **비밀이 아니다** — 공개되는 것이 규격이다.
 */
export function indexNowKeyPath(key: string): string {
  return `/${key}.txt`
}

/** 키 형식 — IndexNow 는 8~128자의 `a-z A-Z 0-9 -` 만 받는다. */
export function isValidIndexNowKey(key: string | undefined | null): boolean {
  return typeof key === 'string' && /^[A-Za-z0-9-]{8,128}$/.test(key)
}

export interface SitemapEntry { loc: string; lastmod: string }

/**
 * sitemap XML → `<loc>`·`<lastmod>` 쌍. **둘 다 있는 항목만** 돌려준다(위 ⚠️ 참조).
 *
 * 🩸 정규식으로 XML 을 파싱한다 — 워커엔 DOM 파서가 없고 이 문서는 **우리가 만든 것**이라
 *    모양이 고정이다(`sitemap.routes.ts`). 남의 XML 이면 이렇게 하지 않는다.
 */
export function parseSitemapEntries(xml: string | null | undefined): SitemapEntry[] {
  if (!xml) return []
  const out: SitemapEntry[] = []
  for (const m of String(xml).matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const block = m[1]
    const loc = block.match(/<loc>([\s\S]*?)<\/loc>/)?.[1]?.trim()
    const lastmod = block.match(/<lastmod>([\s\S]*?)<\/lastmod>/)?.[1]?.trim()
    if (loc && lastmod) out.push({ loc, lastmod })
  }
  return out
}

export interface IndexNowPlan {
  /** 보낼 URL. 커서가 비었으면 **빈 배열**(첫 회차는 커서만 세운다). */
  urls: string[]
  /** 다음 커서(이 회차에서 본 가장 새 `lastmod`). 변경이 없으면 기존 커서 그대로. */
  cursor: string
  /** 사람이 읽는 한 줄(하트비트에 남는다). */
  note: string
}

/**
 * 어떤 URL 을 보낼지 정한다 — **순수 함수**라 시험이 동작으로 판정한다.
 *
 * @param cursor 지난 회차의 최대 `lastmod`(ISO 또는 `YYYY-MM-DD`). 비면 첫 회차.
 */
export function planIndexNow(
  entries: SitemapEntry[],
  cursor: string | null | undefined,
  max: number = INDEXNOW_MAX_URLS,
): IndexNowPlan {
  const maxLastmod = entries.reduce((a, e) => (e.lastmod > a ? e.lastmod : a), '')
  const prev = (cursor || '').trim()

  // 첫 회차: 커서만 세운다(380건을 한꺼번에 밀어 넣지 않는다).
  if (!prev) return { urls: [], cursor: maxLastmod, note: `첫 회차: 커서만 세움(${entries.length}건 관측)` }

  const changed = entries.filter((e) => e.lastmod > prev)
  // 🔴 **새 것부터** 자른다 — 상한에 걸리면 오래된 변경이 아니라 **최신 변경**이 먼저 가야 한다.
  changed.sort((a, b) => (a.lastmod < b.lastmod ? 1 : a.lastmod > b.lastmod ? -1 : 0))
  const urls = changed.slice(0, max).map((e) => e.loc)
  return {
    urls,
    // ⚠️ 상한에 잘렸으면 커서를 **올리지 않는다** — 올리면 못 보낸 변경이 영구히 빠진다.
    cursor: changed.length > max ? prev : (maxLastmod || prev),
    note: `변경 ${changed.length}건 중 ${urls.length}건 제출${changed.length > max ? ' (상한에 잘림, 커서 유지)' : ''}`,
  }
}

/**
 * 🧺 2026-10-25 **일회성 전수 제출(backfill)** — 대표 *"코드로 할 수 있는 거 최대한 다 해줘"*.
 *
 * 위 *"첫 회차는 아무것도 보내지 않는다"* 는 **이미 알려진** URL 을 다시 밀지 않으려는 규칙이었는데,
 * 실측해 보니 그 전제가 틀렸다 — 새 도메인(2026-07-20 이전)이라 구글 색인이 **1건**이고(서치콘솔),
 * 빙·네이버도 대부분을 아직 모른다. 그런데 지금 설계는 **바뀐 것만** 보내므로, 안 바뀐 페이지
 * (실측 476건 중 커서 2026-10-20 이전 전부 + `lastmod` 없는 90건)는 **영원히 한 번도 제출되지 않는다.**
 * ChatGPT 검색은 빙 색인을 크게 쓰므로, 그 공백이 곧 AI 답변의 공백이다.
 *
 * ⇒ 버전 표식(`INDEXNOW_BACKFILL_KEY`)이 현재 값과 다르면 **sitemap 의 모든 `<loc>`** 를 한 번 보내고
 *    표식을 세운다. 그 뒤로는 종전처럼 변경분만. 다시 전수를 보내야 할 일이 생기면(도메인 이전 등)
 *    `INDEXNOW_BACKFILL_VERSION` 을 올린다.
 *
 * 🔒 선택 술어는 여전히 **sitemap 하나**다 — 여기서 URL 을 지어내지 않는다(noindex·thin 게이트 상속).
 * 🔒 IndexNow 규격 상한은 1회 10,000건이고 우리는 ~500 이라 한 번에 간다. 넘으면 앞에서 자른다.
 */
export const INDEXNOW_BACKFILL_KEY = 'indexnow_backfill_v'
export const INDEXNOW_BACKFILL_VERSION = '1'
export const INDEXNOW_SPEC_MAX = 10000

/** sitemap 의 **모든** `<loc>` (lastmod 유무 무관, 중복 제거, 순서 보존). */
export function parseSitemapLocs(xml: string | null | undefined): string[] {
  if (!xml) return []
  const seen = new Set<string>()
  for (const m of String(xml).matchAll(/<url>[\s\S]*?<loc>([\s\S]*?)<\/loc>[\s\S]*?<\/url>/g)) {
    const loc = m[1].trim()
    if (loc) seen.add(loc)
  }
  return [...seen]
}

/** 전수 제출이 필요한가 — 표식이 현재 버전과 다르면(비었으면 포함) 필요하다. */
export function needsIndexNowBackfill(marker: string | null | undefined): boolean {
  return (marker || '').trim() !== INDEXNOW_BACKFILL_VERSION
}

/** 제출 본문. 호스트가 섞이면 받는 쪽이 전체를 거절하므로 **한 호스트만** 담는다. */
export function buildIndexNowBody(host: string, key: string, keyLocation: string, urlList: string[]) {
  return { host, key, keyLocation, urlList }
}
