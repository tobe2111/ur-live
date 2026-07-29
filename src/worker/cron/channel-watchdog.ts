/**
 * 🔔 2026-07-01: 알림 채널 설정 회귀 감시(watchdog).
 *
 * 배경: 웹푸시가 VAPID secret 미설정으로 **수개월 조용히 죽어 있었음**(라이브 전수조사에서 발견).
 *   각 채널(웹푸시/네이티브푸시/이메일/알림톡)은 키가 없으면 fail-open 으로 조용히 no-op 하는
 *   설계라, secret 이 실수로 삭제/로테이트 누락되면 **아무 에러 없이 채널 전체가 죽는다**.
 *   /api/version 진단·어드민 배지는 "보러 가야" 보이는 pull 가시성 — 이 크론이 push 경보를 채운다.
 *
 * 동작: 매시간 채널별 설정 존재여부 스냅샷을 platform_settings 에 저장하고,
 *   이전 스냅샷에서 **LIVE(true) → 죽음(false) 전환**을 감지하면 reportCronFailure(critical)
 *   → cron_failures 영구 기록 + 어드민 대시보드 벨. 전환 시 1회만 경보(스냅샷 갱신으로 스팸 0).
 *   한 번도 설정된 적 없는 채널(false→false, 예: 이메일 미도입)은 경보 안 함 — 노이즈 0.
 */
import { reportCronFailure } from '../utils/cron-reporter'
import type { Env } from '../types/env'

const SNAPSHOT_KEY = 'notification_channel_snapshot'

const CHANNEL_LABELS: Record<string, string> = {
  webpush: '웹푸시(VAPID)',
  nativepush: '네이티브푸시(FCM)',
  email: '이메일(Resend)',
  alimtalk: '알림톡(Aligo)',
}

function readChannels(env: Env): Record<string, boolean> {
  return {
    webpush: !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT),
    nativepush: !!(env.FIREBASE_PROJECT_ID && env.FIREBASE_PRIVATE_KEY && env.FIREBASE_CLIENT_EMAIL),
    email: !!env.RESEND_API_KEY,
    alimtalk: !!(env.ALIGO_API_KEY && env.ALIGO_USER_ID),
  }
}

export async function handleChannelWatchdog(env: Env): Promise<void> {
  const DB = env.DB
  if (!DB) return

  const current = readChannels(env)

  // 이전 스냅샷 로드 (없으면 첫 실행 — 저장만 하고 경보 없음)
  let prev: Record<string, boolean> | null = null
  try {
    const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
      .bind(SNAPSHOT_KEY).first<{ value: string }>()
    if (row?.value) prev = JSON.parse(row.value) as Record<string, boolean>
  } catch { /* platform_settings 미존재 등 — 첫 실행 취급 */ }

  // LIVE → 죽음 전환 감지 (채널별 1회 경보)
  if (prev) {
    for (const [key, wasLive] of Object.entries(prev)) {
      if (wasLive && !current[key]) {
        await reportCronFailure(
          env,
          'channel-watchdog',
          new Error(
            `${CHANNEL_LABELS[key] || key} 채널 설정이 사라졌습니다 — 해당 채널 알림이 조용히 발송 중단됩니다. ` +
            `Cloudflare Variables and Secrets 에서 키 복구 필요 (확인: /api/version, /admin/system-monitoring).`,
          ),
          { channel: key },
          'critical',
        )
      }
    }
  }

  // 스냅샷 저장 (변경 시에만 write — 무료 한도 고려)
  const json = JSON.stringify(current)
  if (!prev || JSON.stringify(prev) !== json) {
    try {
      await DB.prepare(`
        INSERT INTO platform_settings (key, value, description)
        VALUES (?, ?, '알림 채널 설정 스냅샷 (channel-watchdog 자동 관리)')
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
      `).bind(SNAPSHOT_KEY, json).run()
    } catch { /* fail-soft — 다음 시간에 재시도 */ }
  }
}
