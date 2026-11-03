import type { D1Database } from '@cloudflare/workers-types'
import { sameSnsAccount, type UShopSnsFollowers, type UShopSnsPlatform } from '../../shared/ushop-sns-followers'

/**
 * 📈 유어샵 이름표의 팔로워 수 — 2026-11-03 유어샵 B + SNS. 규칙 SSOT 는 `shared/ushop-sns-followers.ts`.
 * 플랫폼에서 직접 받은 값(`user_sns_links`)만 쓰고, 이름표 주소와 **같은 계정일 때만** 붙인다.
 * 표가 없거나 실패하면 빈 값 — 유어샵은 숫자 없이 그대로 뜬다.
 */
export async function loadUShopSnsFollowers(
  DB: D1Database,
  user: { id: number; youtube_url?: string | null; instagram_url?: string | null; tiktok_url?: string | null },
): Promise<UShopSnsFollowers> {
  const out: UShopSnsFollowers = {}
  try {
    const { results } = await DB.prepare(
      `SELECT platform, username, follower_count FROM user_sns_links WHERE user_id = ? AND follower_count IS NOT NULL`,
    ).bind(user.id).all<{ platform: string; username: string | null; follower_count: number }>()
    const urlOf: Record<UShopSnsPlatform, string | null | undefined> = { youtube: user.youtube_url, instagram: user.instagram_url, tiktok: user.tiktok_url }
    for (const l of results ?? []) {
      const p = l.platform as UShopSnsPlatform
      if (p in urlOf && sameSnsAccount(urlOf[p], l.username)) out[p] = Math.max(0, Number(l.follower_count) || 0)
    }
  } catch { /* 표 없음(연동 기능 전 환경) */ }
  return out
}
