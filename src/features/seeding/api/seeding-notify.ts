/**
 * 🎁 무상 체험 제공 — 알림 (2026-10-31 대표 "알림톡으로 하는걸로 일단 하자")
 *
 * 알림톡(돈 드는 채널) + 앱 알림(공짜)을 같이 보낸다. 알림톡 템플릿이 카카오 승인 전이면
 * `sendSystemAlimtalk` 가 보내지 않고 기록만 남긴다 — 어드민 `alimtalk_approved_templates` 에
 * 이름을 적는 순간 나가기 시작한다(배포 불필요). 앱 알림은 그 전에도 간다.
 * 문안 정본: `shared/seeding.ts` msg* · 콘솔 등록본: docs/alimtalk-register-list.md §무상 체험.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { sendSystemAlimtalk } from '../../../lib/system-alimtalk'
import { notifyUser, notifySeller } from '../../../lib/notifications'
import { storeGoPath } from '../../../shared/store-deep-link'

export async function storePhone(DB: D1Database, sellerId: number | null, productId: number): Promise<string | null> {
  const r = await DB.prepare(
    `SELECT COALESCE(NULLIF(s.phone, ''), NULLIF(p.restaurant_phone, '')) AS phone
     FROM products p LEFT JOIN sellers s ON s.id = ? WHERE p.id = ?`,
  ).bind(sellerId, productId).first<{ phone: string | null }>().catch(() => null)
  return r?.phone || null
}

export async function userPhone(DB: D1Database, userId: number): Promise<string | null> {
  const r = await DB.prepare(`SELECT phone FROM users WHERE id = ?`).bind(userId).first<{ phone: string | null }>().catch(() => null)
  return r?.phone || null
}

export async function toStore(
  env: unknown, DB: D1Database, a: { sellerId: number | null; productId: number; appId: number },
  tpl: string, message: string, title: string,
): Promise<void> {
  if (a.sellerId) {
    await notifySeller(DB, a.sellerId, 'seeding', title, message.split('\n').slice(2, 5).join(' · '), storeGoPath(a.sellerId, 'seeding')).catch(() => null)
  }
  const phone = await storePhone(DB, a.sellerId, a.productId)
  if (phone) {
    await sendSystemAlimtalk(env, phone, tpl, message, { sellerId: a.sellerId ?? undefined, dedupKey: `seed:${a.appId}:${tpl}` }).catch(() => null)
  }
}

export async function toInfluencer(
  env: unknown, DB: D1Database, a: { userId: number; appId: number },
  tpl: string, message: string, title: string,
): Promise<void> {
  await notifyUser(DB, String(a.userId), 'seeding', title, message.split('\n').slice(2, 4).join(' · '), '/my-seeding').catch(() => null)
  const phone = await userPhone(DB, a.userId)
  if (phone) await sendSystemAlimtalk(env, phone, tpl, message, { dedupKey: `seed:${a.appId}:${tpl}` }).catch(() => null)
}
