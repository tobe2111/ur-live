/**
 * 🛡️ 2026-05-21: 라이브 썸네일 자동 갱신 (5분 cron).
 *
 * 배경: YouTube 가 라이브 시작 후 1~5분 사이에 실제 셀러 화면을 캡처해서
 *   maxresdefault.jpg 를 자동 생성/갱신함. 우리 DB 의 thumbnail_url 은 cache-busting
 *   timestamp 가 박혀 있어서 한번 fetch 한 뒤에는 갱신 안 됨 → 셀러가 수동으로
 *   /refresh-thumbnail 호출해야 했음.
 *
 * 자동화: 5분 cron 으로 status='live' + custom_thumbnail_url 비어있는 stream 의
 *   thumbnail_url 의 ?v= timestamp 를 매번 갱신. 비용 0 (외부 API 호출 없음).
 *
 * 멱등: 같은 stream 에 매번 새 timestamp 가 박혀도 문제 없음 (브라우저가 새 이미지 fetch).
 */
import type { Env } from '../types/env'
import { logInfo, logError } from '../utils/logger'

interface LiveStream {
  id: number
  youtube_video_id: string
  custom_thumbnail_url: string | null
  started_at: string | null
}

// 🛡️ 2026-05-21: 라이브 시작 후 maxresdefault 가 생성되기까지 ~5분 소요.
//   그 사이엔 hqdefault (항상 존재, 480x360) 사용 → 콘솔 404 노이즈 제거.
//   5분 경과 후 maxresdefault (1280x720) 로 자동 업그레이드.
const MAXRES_AVAILABLE_AFTER_MS = 5 * 60 * 1000

export async function handleYoutubeThumbnailRefresh(env: Env): Promise<void> {
  const DB = env.DB
  if (!DB) return

  try {
    // 셀러가 직접 올린 custom thumbnail 이 없는 live stream 만 — YouTube 자동 캡처에 의존
    const rows = await DB.prepare(
      `SELECT id, youtube_video_id, custom_thumbnail_url, started_at
         FROM live_streams
        WHERE status = 'live'
          AND youtube_video_id IS NOT NULL
          AND youtube_video_id != ''
          AND (custom_thumbnail_url IS NULL OR custom_thumbnail_url = '')
        LIMIT 100`,
    ).all<LiveStream>().catch(() => ({ results: [] as LiveStream[] }))

    const list = rows.results || []
    if (list.length === 0) return

    const cacheBust = Date.now()
    let updated = 0
    for (const s of list) {
      // 라이브 시작 5분 미만 → hqdefault (항상 존재), 5분+ → maxresdefault.
      const startedMs = s.started_at ? new Date(s.started_at).getTime() : 0
      const ageMs = startedMs > 0 ? Date.now() - startedMs : Infinity
      const variant = ageMs >= MAXRES_AVAILABLE_AFTER_MS ? 'maxresdefault' : 'hqdefault'
      const newUrl = `https://i.ytimg.com/vi/${s.youtube_video_id}/${variant}.jpg?v=${cacheBust}`
      try {
        await DB.prepare(
          `UPDATE live_streams SET thumbnail_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        ).bind(newUrl, s.id).run()
        updated++
      } catch (e) {
        logError('[yt-thumb-refresh] update failed', { id: s.id, error: (e as Error).message })
      }
    }
    if (updated > 0) logInfo(`[yt-thumb-refresh] refreshed ${updated} live streams`)
  } catch (e) {
    logError('[yt-thumb-refresh] failed', { error: (e as Error).message })
  }
}
