/**
 * 🗑️ 2026-07-22 (R2 최적화 #3 — 대표 "미래 대비 다 하자"): R2 고아 객체 정리.
 *
 *   셀러/유저가 이미지를 교체·삭제하면 옛 R2 객체(uploads/…)가 DB 참조 없이 남는다(고아).
 *   시간이 지나면 저장 용량 낭비. 이 크론이 참조되지 않는 오래된 객체를 찾아 정리한다.
 *
 * 🛡️ **안전 설계 (오삭제 = 라이브 이미지 파괴, blast radius 큼)**:
 *   - **기본 리포트-온리**: env `R2_ORPHAN_CLEANUP_ENABLED === 'true'` 일 때만 실제 삭제. 아니면 카운트만.
 *   - **나이 게이트**: 업로드 60일 경과 객체만 후보(최근 업로드가 참조 배선 전이어도 안전).
 *   - **biz-cert 제외**: `uploads/biz-cert/` 는 법적 문서 — 절대 삭제 안 함.
 *   - **회당 캡**: 삭제는 회당 최대 50개(폭주 방지).
 *   - **참조 스캔이 완전하다고 검증되기 전엔 삭제 켜지 말 것** — 스캔에서 빠진 컬럼이 있으면
 *     그 객체가 고아로 오판돼 삭제될 수 있다. 아래 REF_SOURCES 가 이미지-URL 저장 컬럼을 모두 포함하는지
 *     확인 후 flag 를 켠다.
 */
import type { Env } from '../types/env'

// 이미지 URL(/api/media/uploads/… 또는 media.ur-team.com/uploads/…)을 저장하는 (테이블, 컬럼) 목록.
//   ⚠️ 삭제 활성화 전 이 목록이 **완전한지** 검증 필수(누락 = 오삭제 위험).
const REF_SOURCES: Array<[string, string]> = [
  ['products', 'image_url'],
  ['products', 'images'],
  ['products', 'detail_images'],
  ['products', 'thumbnail_url'],
  ['products', 'custom_thumbnail_url'],
  ['product_stay_rooms', 'image_urls'],
  ['sellers', 'profile_image'],
  ['sellers', 'banner_image'],
  ['sellers', 'business_registration_image_url'],
  ['users', 'profile_image'],
  ['product_reviews', 'photos'],
  ['product_reviews', 'images'],
]

const KEY_RE = /uploads\/[A-Za-z0-9._/-]+/g

export interface OrphanReport {
  /** 바인딩 부재 등으로 **아예 못 돌았을 때**의 사유. 전부 0 인 보고와 구분하기 위한 것(2026-08-31). */
  skipped?: string
  scanned: number         // 검사한 uploads/ 객체 수
  referenced: number      // DB 에서 참조 확인된 수(스캔 범위)
  candidates: number      // 고아 후보(참조 없음 + 60일 경과 + biz-cert 아님)
  candidateBytes: number  // 후보 총 용량
  deleted: number         // 실제 삭제 수(리포트-온리면 0)
  enabled: boolean        // 삭제 활성 여부
  truncated: boolean      // 이번 스캔이 잘렸는지(다음 실행에서 이어감)
}

export async function r2OrphanCleanup(env: Env, opts?: { maxList?: number; maxDelete?: number }): Promise<OrphanReport> {
  const bucket = (env as unknown as { MEDIA_BUCKET?: R2Bucket }).MEDIA_BUCKET
  const enabled = (env as unknown as { R2_ORPHAN_CLEANUP_ENABLED?: string }).R2_ORPHAN_CLEANUP_ENABLED === 'true'
  const report: OrphanReport = { scanned: 0, referenced: 0, candidates: 0, candidateBytes: 0, deleted: 0, enabled, truncated: false }
  // 🔴 2026-08-31: demo-image-rehost 와 같은 침묵이었다 — 바인딩이 없으면 전부 0 으로 보고돼
  //   "정리할 게 없었다"와 구분이 안 된다. 못 한 것은 못 했다고 남긴다.
  if (!bucket) return { ...report, skipped: 'NO_MEDIA_BUCKET' }

  // 1) 참조된 키 집합 수집(각 소스 fail-soft — 없는 컬럼은 건너뜀).
  const referenced = new Set<string>()
  for (const [table, col] of REF_SOURCES) {
    try {
      const { results } = await env.DB.prepare(
        `SELECT ${col} AS v FROM ${table} WHERE ${col} LIKE '%uploads/%'`
      ).all<{ v: string | null }>()
      for (const row of results || []) {
        const v = String(row.v || '')
        const matches = v.match(KEY_RE)
        if (matches) for (const m of matches) referenced.add(m)
      }
    } catch { /* 없는 테이블/컬럼 → skip(그 소스 참조는 미집계) */ }
  }
  report.referenced = referenced.size

  // 2) R2 uploads/ 나열 → 참조 없음 + 60일 경과 + biz-cert 아님 = 고아 후보.
  const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000
  const maxList = opts?.maxList ?? 2000
  const maxDelete = opts?.maxDelete ?? 50
  let cursor: string | undefined
  const toDelete: string[] = []
  while (report.scanned < maxList) {
    const listed = await bucket.list({ prefix: 'uploads/', cursor, limit: 1000 }).catch(() => null)
    if (!listed) break
    for (const obj of listed.objects) {
      report.scanned++
      if (obj.key.startsWith('uploads/biz-cert/')) continue          // 법적 문서 보존
      if (referenced.has(obj.key)) continue                          // 참조됨
      const uploadedMs = obj.uploaded ? new Date(obj.uploaded).getTime() : Date.now()
      if (uploadedMs > cutoff) continue                              // 60일 미경과
      report.candidates++
      report.candidateBytes += obj.size || 0
      if (toDelete.length < maxDelete) toDelete.push(obj.key)
    }
    if (!listed.truncated) { cursor = undefined; break }
    cursor = listed.cursor
    report.truncated = true
  }

  // 3) 삭제 — flag 켜졌을 때만, 회당 캡 이내.
  if (enabled && toDelete.length > 0) {
    for (const key of toDelete) {
      try { await bucket.delete(key); report.deleted++ } catch { /* skip */ }
    }
  }
  return report
}
