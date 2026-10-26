/**
 * 🔔 IndexNow 제출 cron (2026-10-14, 대표 "다 해주고").
 *
 * **왜·무엇을 보내는지는 `shared/seo/indexnow.ts` 머리말이 전부 적어 뒀다.** 여기는 배선뿐이다.
 *
 * ## 🔴 2단 스위치 — 기본 OFF
 *
 * `INDEXNOW_ENABLED === 'true'` **그리고** `INDEXNOW_KEY` 가 둘 다 있어야 한 글자도 나가지 않는다.
 * 이 레포가 외부 효과가 있는 모든 것에 쓰는 그 패턴이고(`SHOPPING_LEDGER_ENABLED` ·
 * `DISTRICT_AUTO_ISSUE_ENABLED` · `FEE_RESOLVER_ENABLED`), **게이트를 켜는 것은 대표의 일**이다
 * (CLAUDE.md: 게이트 ON 은 결재). 꺼져 있으면 하트비트에 *"꺼짐"* 만 남는다.
 *
 * ## 💰 비용
 *
 * 회차당 **self-fetch 1**(`/sitemap.xml` — 엣지 캐시 1시간) **+ 바깥 fetch 1** + D1 읽기·쓰기 1씩.
 * 하루 **한 번**(19:50 UTC = 04:50 KST — 비어 있던 슬롯)이라 서브리퀘스트 예산(무료 50/인보케이션)에
 * 영향이 없다.
 *
 * ## ⚠️ 못 하는 것
 *
 * - **구글엔 안 간다**(IndexNow 미지원). 구글은 sitemap·크롤 그대로다.
 * - 받는 쪽이 실제로 **언제** 크롤하는지는 외부 판정이다 — 200 은 *"접수했다"* 일 뿐이다.
 * - `lastmod` 없는 URL(지역 43 · 유어샵·셀러 4 · 정적)은 영원히 제출되지 않는다(의도).
 */
import type { Env } from '../types/env'
import {
  INDEXNOW_ENDPOINT, INDEXNOW_CURSOR_KEY, INDEXNOW_MAX_URLS,
  INDEXNOW_BACKFILL_KEY, INDEXNOW_BACKFILL_VERSION, INDEXNOW_SPEC_MAX,
  buildIndexNowBody, indexNowKeyPath, isValidIndexNowKey, needsIndexNowBackfill,
  parseSitemapEntries, parseSitemapLocs, planIndexNow,
} from '../../shared/seo/indexnow'

const ORIGIN = 'https://urdeal.kr'

export async function handleIndexNowSubmit(env: Env): Promise<string> {
  const key = (env.INDEXNOW_KEY || '').trim()
  if (env.INDEXNOW_ENABLED !== 'true') return 'indexnow: 꺼짐 (INDEXNOW_ENABLED 미설정)'
  if (!isValidIndexNowKey(key)) return 'indexnow: 키 없음/형식 오류 (INDEXNOW_KEY)'

  const DB = env.DB
  if (!DB) return 'indexnow: DB 없음'

  // sitemap 을 우리 자신에게서 읽는다 — 선택 술어를 두 벌로 적지 않기 위한 설계다.
  const res = await fetch(`${ORIGIN}/sitemap.xml`, { headers: { 'User-Agent': 'ur-live-indexnow/1.0' } })
    .catch(() => null)
  if (!res || !res.ok) return `indexnow: sitemap 읽기 실패 (${res ? res.status : 'fetch 실패'})`
  const xml = await res.text()
  const entries = parseSitemapEntries(xml)

  // 🧺 일회성 전수 제출 — 근거는 `shared/seo/indexnow.ts` 의 backfill 머리말.
  const mark = await DB.prepare(`SELECT value FROM platform_settings WHERE key = ?`)
    .bind(INDEXNOW_BACKFILL_KEY).first<{ value: string }>().catch(() => null)
  // 🩸 2026-10-26 — 전수가 실패해도 **변경분은 그대로 보낸다**. 첫 회차(10-25 19:50 UTC)가 429 를 받았는데
  //    종전엔 여기서 반환해, 전수가 계속 거절되는 동안 **변경분 제출까지 통째로 멎었다**(에러 0 · 하트비트만
  //    "실패, 표식 유지"). 전수는 다음 날 다시 시도되고, 그 사이 새로 바뀐 상품은 지금처럼 간다.
  if (needsIndexNowBackfill(mark?.value)) {
    const locs = parseSitemapLocs(xml).slice(0, INDEXNOW_SPEC_MAX)
    // 🔴 0건이면 표식을 세우지 않는다 — sitemap 이 깨진 날 "보냈다" 로 기록되면 전수가 영영 안 간다.
    if (!locs.length) {
      return `indexnow: 전수 제출 대상 0건(sitemap 이상), 표식 유지 · ${await submitChanges(DB, key, entries)}`
    }
    const ok = await submitUrls(key, locs)
    if (!ok.ok) {
      return `indexnow: 전수 제출 실패 (${ok.status}) · ${locs.length}건, 표식 유지 · ${await submitChanges(DB, key, entries)}`
    }
    await upsertSetting(DB, INDEXNOW_BACKFILL_KEY, INDEXNOW_BACKFILL_VERSION)
    // 전수에 이미 실렸으니 변경분 커서도 지금으로 맞춘다(다음 회차에 같은 URL 을 또 보내지 않게).
    const maxLastmod = entries.reduce((a, e) => (e.lastmod > a ? e.lastmod : a), '')
    if (maxLastmod) await upsertSetting(DB, INDEXNOW_CURSOR_KEY, maxLastmod)
    return `indexnow: 전수 제출 ${locs.length}건 (v${INDEXNOW_BACKFILL_VERSION}) · 커서 ${maxLastmod || '(없음)'}`
  }

  return `indexnow: ${await submitChanges(DB, key, entries)}`
}

/** 변경분(lastmod 커서 이후)만 보낸다. 반환은 하트비트에 실릴 한 줄(접두어 없이). */
async function submitChanges(
  DB: D1Database, key: string, entries: ReturnType<typeof parseSitemapEntries>,
): Promise<string> {
  if (!entries.length) return 'sitemap 에 lastmod 가 있는 항목이 0건, 보내지 않았다'

  const cur = await DB.prepare(`SELECT value FROM platform_settings WHERE key = ?`)
    .bind(INDEXNOW_CURSOR_KEY).first<{ value: string }>().catch(() => null)
  const plan = planIndexNow(entries, cur?.value, INDEXNOW_MAX_URLS)

  if (plan.urls.length) {
    const ok = await submitUrls(key, plan.urls)
    // 🔴 실패하면 **커서를 올리지 않는다** — 올리면 그 변경이 영구히 빠진다.
    if (!ok.ok) return `제출 실패 (${ok.status}) · ${plan.urls.length}건, 커서 유지`
  }

  if (plan.cursor && plan.cursor !== (cur?.value || '')) {
    await upsertSetting(DB, INDEXNOW_CURSOR_KEY, plan.cursor)
  }
  return `${plan.note} · 커서 ${plan.cursor || '(없음)'}`
}

async function submitUrls(key: string, urls: string[]): Promise<{ ok: boolean; status: string }> {
  const body = buildIndexNowBody(new URL(ORIGIN).host, key, `${ORIGIN}${indexNowKeyPath(key)}`, urls)
  const post = await fetch(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  }).catch(() => null)
  if (!post) return { ok: false, status: 'fetch 실패' }
  return { ok: post.status === 200 || post.status === 202, status: String(post.status) }
}

async function upsertSetting(DB: D1Database, key: string, value: string): Promise<void> {
  await DB.prepare(
    `INSERT INTO platform_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).bind(key, value).run().catch(() => null)
}
