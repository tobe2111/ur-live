/**
 * 🩹 네이버 블로거 **핸들 복구** (2026-07-28 — 라이브 실측으로 특정)
 *
 *   ## 무슨 일이 있었나 (추측 아님 — 어드민 API 로 직접 조회한 행)
 *   `ad_influencer_leads` 의 네이버 블로거 28,049명 중 **약 12,357명(44%)** 이 이렇게 저장돼 있다:
 *
 *     handle = 'blog.naver.com'          ← 호스트가 통째로 핸들 자리에
 *     channel_id = 'blog.naver.com/zq333'  ← 진짜 id 는 여기 있다
 *     url        = 'blog.naver.com/zq333'  ← 스킴도 없어 어드민에서 클릭하면 상대경로로 샌다
 *
 *   원인은 이미 고쳐진 파서다: 네이버 검색 API 는 `bloggerlink` 를 **스킴 없이** 준다.
 *   `ensureScheme()` 도입(F-22) 전에는 `'blog.naver.com/zq333'` 이 그대로 key 가 됐고,
 *   핸들 추출 정규식(`^https?://(m\.)?blog\.naver\.com/`)이 스킴이 없어 매칭에 실패 →
 *   `[/?#].*$` 만 잘려 **`blog.naver.com`** 이 남았다. 파서는 고쳐졌지만 **그때 저장된 행은 아무도 안 고쳤다.**
 *
 *   ## 왜 이게 치명적인가 — 블로거 보강 레인 전체가 이것 때문에 멈춰 있었다
 *   `enrichNaverActivity` 는 핸들이 형식 밖이면 **측정을 건너뛰고 `perf_checked_at` 스탬프만** 찍는다.
 *   그런데 선택 순서가 `(perf_checked_at IS NULL) DESC` 라 미측정 행이 먼저 오고, 그 앞머리가 통째로
 *   이 12,357행이었다. 결과: 매 라운드 10건을 뽑아 **전부 스킵**(`tried:0`) → 정상 블로거 15,692명은
 *   **한 번도 차례가 오지 않았다**. 실측 스냅샷이 라운드마다 `naver.tried:0` 인데 `nb_unmeasured` 는
 *   ~10씩 줄던 것이 바로 이 "뽑아서 버리는" 동작이다.
 *
 *   ⇒ 그래서 스탬프도 되돌린다. 이 행들의 `perf_checked_at` 은 **측정한 적 없는 거짓 스탬프**이고,
 *     남겨두면 복구 후에도 큐 맨 뒤로 밀려 백로그 숫자가 실제보다 작아 보인다(진행률 오판).
 *
 *   ⚠️ 파괴적 작업 금지: 중복(정상 표기 쌍둥이 행)이 있어도 **삭제하지 않는다**. 핸들만 살려 측정 가능하게
 *      만들고, 중복 통합은 기존 `mergeDuplicatePool`(이메일/인스타/링크/이름 기준)에 맡긴다.
 *   ⚠️ 서비스 분리: `ad_influencer_leads` + `platform_settings` 만 접촉(소비자/도매 무관).
 */
import type { D1Database } from '@cloudflare/workers-types'
import type { OpBudget } from './maintenance-budget'
import { ensureInfluencerSchema } from './influencer-discovery'

/**
 * 🔤 핸들 규칙(형식·추출)은 `influencer-handle.ts` 가 SSOT — **저장 직전 검증**(influencer-save.ts)도
 *   같은 규칙을 써야 하는데 그 경로에서 이 파일을 import 하면 순환이 된다(heal → discovery → …).
 *   기존 import 경로(테스트 포함)를 깨지 않도록 그대로 재수출한다.
 */
export { NAVER_HANDLE_RE, naverBlogUrl, deriveNaverHandle } from './influencer-handle'
import { NAVER_HANDLE_RE, deriveNaverHandle, naverBlogUrl } from './influencer-handle'

export interface HandleHealResult {
  scanned: number     // 이번 회차에 검사한 손상 후보 행
  fixed: number       // 핸들을 복구한 행
  unfixable: number   // channel_id/url 어디에도 id 가 없어 복구 못 한 행(방치 — 파괴 금지)
  reopened: number    // 거짓 스탬프(perf_checked_at)를 지워 보강 큐에 되돌린 행
  done: boolean       // 전수 1회전 완료(커서 리셋)
}

/**
 * 🩹 손상 핸들 일괄 복구 — id 커서로 회차를 이어받는다(무료 플랜 예산에선 한 번에 전수를 못 돈다).
 *   `DB` 는 예산 래핑된 핸들(budgetedDb)을 받고, `opts.budget.exhausted` 로 중단 지점을 판단한다
 *   — 정비 파이프라인의 다른 단계(reextract/reclassify)와 **완전히 같은 관용구**.
 */
export async function healNaverHandles(DB: D1Database, opts?: { budget?: OpBudget }): Promise<HandleHealResult> {
  await ensureInfluencerSchema(DB)
  const CURSOR_KEY = 'ads_nb_handle_heal_cursor'
  const PAGE = 500
  let cursor = 0
  const cRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(CURSOR_KEY)
    .first<{ value: string }>().catch(() => null)
  if (cRaw?.value) cursor = Math.max(0, parseInt(cRaw.value, 10) || 0)

  let scanned = 0, fixed = 0, unfixable = 0, reopened = 0, done = false
  for (;;) {
    // 손상 후보만 — 정상 핸들(`영문/숫자/_/-`)엔 `.` 도 `/` 도 없다. NULL 도 복구 대상(url 에서 살릴 수 있다).
    const rows = (await DB.prepare(`SELECT id, handle, channel_id, url, perf_checked_at FROM ad_influencer_leads
        WHERE account_id = ? AND platform = 'naver_blog' AND id > ?
          AND (handle IS NULL OR handle = '' OR handle LIKE '%.%' OR handle LIKE '%/%')
        ORDER BY id ASC LIMIT ?`).bind(POOL, cursor, PAGE)
      .all<{ id: number; handle: string | null; channel_id: string | null; url: string | null; perf_checked_at: string | null }>().catch(() => null))?.results || []
    if (!rows.length) { if (!opts?.budget?.exhausted) done = true; break }
    const pageStart = cursor
    for (const r of rows) cursor = Math.max(cursor, r.id)
    scanned += rows.length

    const ups: ReturnType<typeof DB.prepare>[] = []
    for (const r of rows) {
      const h = deriveNaverHandle(r)
      if (!h) { unfixable++; continue }
      // 📝 거짓 스탬프 되돌리기 — 손상 핸들이면 측정 경로를 **탈 수 없었다**(스킵 경로만 스탬프를 찍는다).
      //    따라서 여기 남은 perf_checked_at 은 전부 "뽑아서 버림"의 흔적이고, 지우는 것이 정확하다.
      const reopen = !!r.perf_checked_at
      if (reopen) reopened++
      fixed++
      // channel_id 는 UNIQUE(account_id, platform, channel_id) — 정상 표기 쌍둥이가 있으면 충돌한다.
      //   충돌 시 UPDATE 전체가 실패하면 핸들 복구까지 잃으므로 **핸들/URL 먼저, channel_id 는 별도 문장**으로 나눈다.
      ups.push(DB.prepare(`UPDATE ad_influencer_leads SET handle = ?, url = ?${reopen ? ', perf_checked_at = NULL' : ''} WHERE id = ? AND account_id = ?`)
        .bind(h, naverBlogUrl(h), r.id, POOL))
      if (r.channel_id !== naverBlogUrl(h)) {
        // 쌍둥이가 이미 있으면 이 문장만 조용히 실패한다(D1 batch 는 문장 단위) — 중복 통합은 merge 단계 몫.
        ups.push(DB.prepare(`UPDATE ad_influencer_leads SET channel_id = ? WHERE id = ? AND account_id = ?
            AND NOT EXISTS (SELECT 1 FROM ad_influencer_leads x WHERE x.account_id = ? AND x.platform = 'naver_blog' AND x.channel_id = ?)`)
          .bind(naverBlogUrl(h), r.id, POOL, POOL, naverBlogUrl(h)))
      }
    }
    for (let i = 0; i < ups.length; i += 100) await DB.batch(ups.slice(i, i + 100)).catch(() => null)
    if (opts?.budget?.exhausted) { cursor = pageStart; scanned -= rows.length; break } // 쓰기가 잘림 → 이 페이지 재시도
    if (rows.length < PAGE) { done = true; break }
  }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind(CURSOR_KEY, String(done ? 0 : cursor)).run().catch(() => null)
  return { scanned, fixed, unfixable, reopened, done }
}
