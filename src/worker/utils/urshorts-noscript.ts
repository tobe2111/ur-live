/**
 * 🎬 2026-10-13 — `/urshorts` **크롤러 본문** (대표 "너가 할 수 있는 건 최대한 이상적으로 다 해줘").
 *
 * ## 왜
 *
 * 라이브 실측(Googlebot UA): `/urshorts` 는 `index, follow` 인데 서버 문서의 **본문이 6자**였다
 * (로더 워드마크뿐). 색인해 달라고 선언해 놓고 읽을 것을 한 줄도 안 주고 있었다.
 *
 * ## 시드가 공짜다
 *
 * `/api/urshorts` 는 `cache-prewarm` 의 `HOT_PATHS` 에 **이미 있는 키**다. 그 키를 그대로 쓰면
 * **새 캐시 키도 새 왕복도 0** 이다(`/stays` 가 MAIN 시드를 재사용한 그 수법 — 2026-10-12).
 *
 * ## 🔴 `VideoObject` 를 내지 않는다
 *
 * 이 영상들은 **남의 유튜브 영상**이다. 실측 채널: 부산일보TV · 해피푸게더 · 슬아투니 ·
 * 부산이야 · 파인예플 · 재슐랭가이드. 우리가 업로더가 아닌 영상에 `VideoObject` 를 발행하면
 * 원 채널의 리치결과와 경쟁하면서 **우리가 그 영상의 출처**라고 말하는 셈이다 — 이 레포가
 * `sameAs`·`aggregateRating`·`brand` 에서 지키는 **지어내지 않는다** 와 같은 축이다.
 *
 * 같은 이유로 각 줄에 **채널명을 반드시 함께** 쓴다(출처 표기). 그 표기를 빼면 남의 콘텐츠를
 * 우리 것처럼 말하는 글이 된다.
 *
 * ⚠️ 우리가 직접 올린 영상이 생기면 **그 건에만** 낼 것(그때는 업로더가 우리다).
 *
 * ## 🔒 주입하지 않는다
 *
 * 화면(`UrShortsBrowsePage`)은 `/api/urshorts?all=1`(**전량**)을 받고 이 시드는 **10편**이다.
 * `initialData` 로 먹이면 사용자가 보던 목록이 **도로 짧아진다**(2026-10-12 지역 요약에서 값을
 * 치른 규율 — 크롤러 본문용 payload 와 주입용 payload 를 변수로 가른다). 그래서 워커가
 * `ssrPayload = null` 로 끊고 이 함수에만 넘긴다.
 *
 * ## ⚠️ 이 모듈이 못 하는 것
 *
 * - `<noscript>` 라 JS 가 돌면 렌더조차 안 된다 ⇒ 사람 화면 **byte-동일 · 밀림 0**(그게 의도다)
 * - 구글·네이버가 이 글을 실제로 색인하는지 — 색인 수일~수주, 판정은 서치콘솔에서 **대표만** 본다
 */
import { esc, h1Of } from './crawler-noscript'
import { SURFACE_LIST_MAX } from './surface-list-jsonld'

/** 라이브 `/api/urshorts` 응답 한 행에서 **쓰는 필드만**. 나머지는 의도적으로 안 읽는다. */
interface UrshortsRow {
  title?: unknown
  /** 출처 채널 — 남의 영상이라 **반드시** 함께 쓴다. */
  channel?: unknown
  store_name?: unknown
  region_si?: unknown
}

/**
 * @param ssrPayload `/api/urshorts` 응답(`{ success, data: [] }`). 없거나 깨지면 `''`.
 * @param h1 호출부가 만든 `<h1>` — 라벨은 `CONSUMER_SURFACE_SEO[...].crumb` 한 곳에서 온다
 *           (빵부스러기와 **같은 SSOT**. 손으로 적으면 둘이 갈린다).
 */
export function buildUrshortsNoscript(ssrPayload: string | null | undefined, h1: string): string {
  try {
    const raw = (JSON.parse(ssrPayload || 'null') as { data?: unknown } | null)?.data
    const rows: UrshortsRow[] = Array.isArray(raw) ? (raw as UrshortsRow[]) : []
    const lines = rows.slice(0, SURFACE_LIST_MAX).map((v) => {
      // 제목이 없는 행은 거른다 — 빈 `<li>` 는 글자수만 늘리고 읽을 것을 안 준다.
      const head = String(v.title ?? '').trim()
      if (!head) return ''
      const by = String(v.channel ?? '').trim()
      const where = [v.store_name, v.region_si].map((x) => String(x ?? '').trim()).filter(Boolean).join(' · ')
      return `${esc(head)}${by ? ` (${esc(by)})` : ''}${where ? ` · ${esc(where)}` : ''}`
    }).filter(Boolean)
    // 시드가 없거나 쓸 행이 0 이면 **아무것도 내지 않는다**(지어내지 않는다 — 호출부가 종전 로더로 폴백).
    return lines.length
      ? `<noscript>${h1}<ul>${lines.map((l) => `<li>${l}</li>`).join('')}</ul></noscript>`
      : ''
  } catch {
    return ''
  }
}
