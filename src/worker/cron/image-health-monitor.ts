/**
 * 🖼️ 2026-07-22 (대표 "이미지 자동 모니터링" — 이번 세션 '이미지 안 뜸'을 대표가 여러 번 직접 발견한 뒤):
 *   커버 이미지 깨짐을 **시스템이 먼저** 감지해 알림. 대표가 화면에서 눈치채기 전에 운영팀이 먼저 안다.
 *
 * 설계(무비용·안전):
 *   - 활성 상품 중 **외부(http) 커버**를 무작위 표본(30개) 서버측 검증(validateImageLoads, no-referer fetch).
 *     내부(/api/media)는 항상 서빙되므로 검증 생략 → 이관 진행될수록 표본이 줄고 오탐도 0.
 *   - 깨짐 비율이 임계(30%) 이상이고 표본이 충분(≥12)할 때만 `sendAlert`(warn) — dedup 12h 로 스팸 방지.
 *   - 저장 쓰기 0(알림 dedup 은 기존 RATE_LIMIT_KV). cron 은 절대 throw 안 함(safeCron 래핑).
 */
import type { Env } from '../types/env'
import { validateImageLoads } from '../utils/rehost-image'
import { sendAlert } from '../utils/alerts'

export async function imageHealthMonitor(env: Env): Promise<{ checked: number; broken: number; ratio: number }> {
  const DB = env.DB
  const { results } = await DB.prepare(
    `SELECT id, image_url FROM products
       WHERE COALESCE(is_active,1)=1 AND image_url LIKE 'http%'
       ORDER BY RANDOM() LIMIT 30`
  ).all<{ id: number; image_url: string }>()
    .catch(() => ({ results: [] as { id: number; image_url: string }[] }))
  const rows = results || []
  let checked = 0, broken = 0
  const hosts: string[] = []
  for (const r of rows) {
    checked++
    // 검증 자체가 네트워크 오류로 실패하면 broken 오탐 방지로 OK 취급.
    const ok = await validateImageLoads(r.image_url).catch(() => true)
    if (!ok) {
      broken++
      if (hosts.length < 5) { try { hosts.push(new URL(r.image_url).hostname) } catch { /* noop */ } }
    }
  }
  const ratio = checked > 0 ? broken / checked : 0
  if (checked >= 12 && ratio >= 0.3) {
    await sendAlert(env, {
      severity: 'warn',
      title: '이미지 커버 깨짐 감지',
      message: `활성 상품 커버 표본 ${checked}개 중 ${broken}개(${Math.round(ratio * 100)}%)가 서버검증 실패. `
        + `주요 호스트: ${hosts.join(', ') || 'n/a'}. `
        + `어드민 → 동네딜 데모 채우기 → 🖼️ 사진 정리 로 복구(또는 시간당 cron 이 자동 수렴).`,
      dedupSeconds: 43200,
    }).catch(() => {})
  }
  return { checked, broken, ratio }
}
