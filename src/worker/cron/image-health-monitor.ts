/**
 * 🖼️ 2026-07-22 (대표 "이미지 자동 모니터링" — 이번 세션 '이미지 안 뜸'을 대표가 여러 번 직접 발견한 뒤):
 *   커버 이미지 깨짐을 **시스템이 먼저** 감지해 알림. 대표가 화면에서 눈치채기 전에 운영팀이 먼저 안다.
 *
 * 설계(무비용·안전):
 *   - 활성 상품 중 **외부(http) 커버**를 무작위 표본(30개) 서버측 검증(no-referer fetch).
 *     내부(/api/media)는 항상 서빙되므로 검증 생략 → 이관 진행될수록 표본이 줄고 오탐도 0.
 *   - 깨짐 비율이 임계(30%) 이상이고 표본이 충분(≥12)할 때만 `sendAlert`(warn) — dedup 12h 로 스팸 방지.
 *   - 저장 쓰기 0(알림 dedup 은 기존 RATE_LIMIT_KV). cron 은 절대 throw 안 함(safeCron 래핑).
 *
 * 🩺 2026-11-18 (대표 "개선할 것 더 찾아줘") — 라이브 하트비트가 한 회 **181초**에 결과가 안 남았다.
 *   외부 커버 2,248장 중 2,244장이 giftishow 이고, 그 호스트는 한국 밖(Cloudflare 포함)을 막는다(`cf-image.ts`
 *   `isRawOnlyImageHost` — 화면도 그래서 손님 브라우저가 원본을 바로 받는다). 표본 30장이 하나씩 6초 시간 초과 →
 *   그게 '깨짐' 으로 세어져 매번 깨짐 100% 가 됐다(진짜 깨진 게 아니라 우리 서버가 못 닿는 것).
 *   ⇒ ① 브라우저 전용 호스트는 표본에서 뺀다(서버가 판정할 수 없다) ② 응답 없음(unreachable)은 깨짐이 아니다
 *     ③ 5장씩 나란히 · 4초 ④ 결과를 하트비트에 남긴다.
 */
import type { Env } from '../types/env'
import { imageLoadStatus } from '../utils/rehost-image'
import { isRawOnlyImageHost } from '../../utils/cf-image'
import { sendAlert } from '../utils/alerts'

const SAMPLE = 30
const PARALLEL = 5

export interface ImageHealthResult { checked: number; broken: number; unreachable: number; skipped: number; ratio: number }

export async function imageHealthMonitor(env: Env): Promise<ImageHealthResult> {
  const DB = env.DB
  // 브라우저 전용 호스트를 빼고도 표본이 차도록 넉넉히 뽑는다.
  const { results } = await DB.prepare(
    `SELECT id, image_url FROM products
       WHERE COALESCE(is_active,1)=1 AND image_url LIKE 'http%'
       ORDER BY RANDOM() LIMIT 120`
  ).all<{ id: number; image_url: string }>()
    .catch(() => ({ results: [] as { id: number; image_url: string }[] }))
  let skipped = 0
  const rows: { id: number; image_url: string }[] = []
  for (const r of results || []) {
    let host = ''
    try { host = new URL(r.image_url).hostname } catch { /* 이상한 주소 — 그대로 검사 */ }
    if (host && isRawOnlyImageHost(host)) { skipped++; continue }
    if (rows.length < SAMPLE) rows.push(r)
  }
  let checked = 0, broken = 0, unreachable = 0
  const hosts: string[] = []
  for (let i = 0; i < rows.length; i += PARALLEL) {
    const batch = rows.slice(i, i + PARALLEL)
    const st = await Promise.all(batch.map((r) => imageLoadStatus(r.image_url).catch(() => 'unreachable' as const)))
    st.forEach((s, j) => {
      if (s === 'unreachable') { unreachable++; return }
      checked++
      if (s === 'broken') {
        broken++
        if (hosts.length < 5) { try { hosts.push(new URL(batch[j].image_url).hostname) } catch { /* noop */ } }
      }
    })
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
  return { checked, broken, unreachable, skipped, ratio }
}

/** 하트비트 한 줄 — `skipped=` 키는 cron-beat-blocked 가 '못 했다' 로 읽으니 쓰지 않는다(browser_only 로 적는다). */
export function imageHealthLine(r: ImageHealthResult): string {
  return `checked=${r.checked} broken=${r.broken} unreachable=${r.unreachable} browser_only=${r.skipped}`
}
