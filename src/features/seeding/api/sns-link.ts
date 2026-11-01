/**
 * 🔗 인플루언서 SNS 연동 — 인스타그램 · 유튜브 · 틱톡 (2026-10-31 대표 "할 수 있는거 다 하고싶은데")
 *
 * 목적은 하나다: **그 계정이 본인 것이고, 팔로워가 몇 명인가** 를 플랫폼에서 직접 받는다.
 *   스스로 적은 숫자는 믿지 않는다 — 무상 체험 조건(최소 팔로워)이 그 숫자로 자동 판정되기 때문이다.
 *
 * 플랫폼별 사정(반드시 알아야 할 것):
 *  - 인스타그램: Instagram API with Instagram Login(비즈니스 로그인). **프로페셔널(크리에이터·비즈니스)
 *    계정만** 로그인·팔로워 조회가 된다. 개인 계정은 연결 자체가 안 된다. 앱은 자동DM 과 같은 메타 앱
 *    (`ig_autodm_account` 의 app_id/secret)을 쓴다 — 메타 앱 설정에 리디렉션 주소
 *    `https://urdeal.kr/api/sns-link/instagram/callback` 을 **추가로 등록**해야 한다.
 *  - 유튜브: 구글 로그인 + `youtube.readonly` → 내 채널의 구독자 수. `YOUTUBE_CLIENT_ID/SECRET`.
 *    구글 콘솔에 `https://urdeal.kr/api/sns-link/youtube/callback` 등록. 구독자 수를 숨긴 채널은 읽지 못한다.
 *  - 틱톡: Login Kit `user.info.stats` 범위가 팔로워 수를 준다. **틱톡 앱 심사**에서 그 범위를 승인받아야
 *    실제로 나온다. `TIKTOK_CLIENT_KEY/SECRET`, 리디렉션 `https://urdeal.kr/api/sns-link/tiktok/callback`.
 *
 * 설정이 없으면 그 플랫폼 버튼은 "준비 중" 으로 보인다(에러 아님).
 * state 는 JWT_SECRET 으로 서명한다 — 누구의 연결인지가 실려 있어, 서명 없이 믿으면 남의 계정에 붙는다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { getAppConfig } from '../../instagram-autodm/api/autodm-store'
import { encryptAtRest } from '../../../worker/utils/data-crypto'
import { isSeedingPlatform, type SeedingPlatform } from '../../../shared/seeding'

export const SNS_ORIGIN = 'https://urdeal.kr'
export const callbackPath = (p: SeedingPlatform) => `/api/sns-link/${p}/callback`

/** 연결 뒤 돌아갈 곳 — 이 목록 밖은 받지 않는다(오픈 리다이렉트 차단). */
export const SNS_RETURN_PATHS = ['/my-seeding', '/user/profile'] as const
export function safeSnsReturn(p: unknown): string {
  const s = String(p ?? '')
  if ((SNS_RETURN_PATHS as readonly string[]).includes(s)) return s
  // 이용권 상세에서 시작했으면 그 상세로 돌아간다(숫자 id 만).
  if (/^\/pass\/\d{1,9}$/.test(s)) return s
  return '/my-seeding'
}

export interface SnsEnv {
  DB: D1Database
  JWT_SECRET?: string
  DATA_ENCRYPTION_KEY?: string
  YOUTUBE_CLIENT_ID?: string
  YOUTUBE_CLIENT_SECRET?: string
  TIKTOK_CLIENT_KEY?: string
  TIKTOK_CLIENT_SECRET?: string
}

// ── 서명 state ─────────────────────────────────────────────────────

interface SnsState { u: number; p: SeedingPlatform; r: string; e: number; n: string }
const enc = new TextEncoder()
const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0))
async function hmac(secret: string, data: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data))))
}
const STATE_TTL_MS = 10 * 60 * 1000

export async function signSnsState(secret: string, s: { u: number; p: SeedingPlatform; r: string }, now = Date.now()): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify({ ...s, e: now + STATE_TTL_MS, n: b64url(crypto.getRandomValues(new Uint8Array(9))) })))
  return `${body}.${await hmac(`sns-link:${secret}`, body)}`
}

export async function verifySnsState(secret: string | undefined, token: string | null | undefined, now = Date.now()): Promise<SnsState | null> {
  if (!secret || !token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = await hmac(`sns-link:${secret}`, body)
  if (expected.length !== sig.length) return null
  let diff = 0
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  if (diff !== 0) return null
  try {
    const st = JSON.parse(new TextDecoder().decode(fromB64url(body))) as SnsState
    if (typeof st.e !== 'number' || st.e < now) return null
    if (!(Number(st.u) > 0) || !isSeedingPlatform(st.p)) return null
    return { ...st, r: safeSnsReturn(st.r) }
  } catch {
    return null
  }
}

// ── 플랫폼별 설정 ──────────────────────────────────────────────────

const IG_GRAPH = 'https://graph.instagram.com/v23.0'

export async function platformAvailability(env: SnsEnv): Promise<Record<SeedingPlatform, boolean>> {
  const ig = await getAppConfig(env.DB, env.DATA_ENCRYPTION_KEY).catch(() => null)
  return {
    instagram: !!(ig?.app_id && ig?.app_secret),
    youtube: !!(env.YOUTUBE_CLIENT_ID && env.YOUTUBE_CLIENT_SECRET),
    tiktok: !!(env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET),
  }
}

export async function authorizeUrlFor(env: SnsEnv, p: SeedingPlatform, state: string): Promise<string | null> {
  const redirect = `${SNS_ORIGIN}${callbackPath(p)}`
  if (p === 'instagram') {
    const ig = await getAppConfig(env.DB, env.DATA_ENCRYPTION_KEY).catch(() => null)
    if (!ig?.app_id) return null
    const q = new URLSearchParams({
      client_id: ig.app_id, redirect_uri: redirect, response_type: 'code',
      scope: 'instagram_business_basic', state, enable_fb_login: '0', force_reauth: 'true',
    })
    return `https://www.instagram.com/oauth/authorize?${q}`
  }
  if (p === 'youtube') {
    if (!env.YOUTUBE_CLIENT_ID) return null
    const q = new URLSearchParams({
      client_id: env.YOUTUBE_CLIENT_ID, redirect_uri: redirect, response_type: 'code',
      scope: 'https://www.googleapis.com/auth/youtube.readonly', access_type: 'offline', prompt: 'consent', state,
    })
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`
  }
  if (!env.TIKTOK_CLIENT_KEY) return null
  const q = new URLSearchParams({
    client_key: env.TIKTOK_CLIENT_KEY, redirect_uri: redirect, response_type: 'code',
    scope: 'user.info.basic,user.info.profile,user.info.stats', state,
  })
  return `https://www.tiktok.com/v2/auth/authorize/?${q}`
}

export interface FetchedAccount {
  external_id: string
  username: string | null
  display_name: string | null
  profile_url: string | null
  follower_count: number | null
  account_type: string | null
  access_token: string
  refresh_token: string | null
  expires_in: number | null
}

type Res = { ok: true; account: FetchedAccount } | { ok: false; error: string }
const j = async (r: Response) => (await r.json().catch(() => ({}))) as Record<string, any>
const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Math.floor(Number(v)) : null)

/** code → 토큰 → 계정·팔로워. throw 하지 않는다(이유를 돌려준다). */
export async function exchangeAndFetch(env: SnsEnv, p: SeedingPlatform, code: string): Promise<Res> {
  const redirect = `${SNS_ORIGIN}${callbackPath(p)}`
  try {
    if (p === 'instagram') {
      const ig = await getAppConfig(env.DB, env.DATA_ENCRYPTION_KEY)
      if (!ig.app_id || !ig.app_secret) return { ok: false, error: '인스타그램 연동이 아직 준비되지 않았어요' }
      const r1 = await fetch('https://api.instagram.com/oauth/access_token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: ig.app_id, client_secret: ig.app_secret, grant_type: 'authorization_code', redirect_uri: redirect, code: code.replace(/#_$/, '') }).toString(),
      })
      const b1 = await j(r1)
      const short = (Array.isArray(b1.data) ? b1.data[0] : b1) as { access_token?: string }
      if (!r1.ok || !short?.access_token) return { ok: false, error: '인스타그램 승인 코드를 바꾸지 못했어요' }
      const r2 = await fetch(`https://graph.instagram.com/access_token?${new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: ig.app_secret, access_token: short.access_token })}`)
      const b2 = await j(r2)
      const token = String(b2.access_token || short.access_token)
      const me = await j(await fetch(`${IG_GRAPH}/me?fields=user_id,username,name,account_type,followers_count&access_token=${encodeURIComponent(token)}`))
      const id = String(me.user_id || me.id || '')
      if (!id) return { ok: false, error: '인스타그램 계정 정보를 받지 못했어요' }
      return { ok: true, account: {
        external_id: id, username: me.username || null, display_name: me.name || null,
        profile_url: me.username ? `https://www.instagram.com/${me.username}/` : null,
        follower_count: num(me.followers_count), account_type: me.account_type || null,
        access_token: token, refresh_token: null, expires_in: num(b2.expires_in),
      } }
    }
    if (p === 'youtube') {
      if (!env.YOUTUBE_CLIENT_ID || !env.YOUTUBE_CLIENT_SECRET) return { ok: false, error: '유튜브 연동이 아직 준비되지 않았어요' }
      const t = await j(await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: env.YOUTUBE_CLIENT_ID, client_secret: env.YOUTUBE_CLIENT_SECRET, redirect_uri: redirect, grant_type: 'authorization_code' }).toString(),
      }))
      if (!t.access_token) return { ok: false, error: '구글 승인 코드를 바꾸지 못했어요' }
      const ch = await j(await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', { headers: { Authorization: `Bearer ${t.access_token}` } }))
      const item = Array.isArray(ch.items) ? ch.items[0] : null
      if (!item?.id) return { ok: false, error: '이 구글 계정에 유튜브 채널이 없어요' }
      const hidden = item.statistics?.hiddenSubscriberCount === true
      const custom = item.snippet?.customUrl ? String(item.snippet.customUrl).replace(/^@/, '') : null
      return { ok: true, account: {
        external_id: String(item.id), username: custom, display_name: item.snippet?.title || null,
        profile_url: custom ? `https://www.youtube.com/@${custom}` : `https://www.youtube.com/channel/${item.id}`,
        follower_count: hidden ? null : num(item.statistics?.subscriberCount), account_type: hidden ? 'hidden_subscribers' : 'channel',
        access_token: String(t.access_token), refresh_token: t.refresh_token || null, expires_in: num(t.expires_in),
      } }
    }
    if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET) return { ok: false, error: '틱톡 연동이 아직 준비되지 않았어요' }
    const t = await j(await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_key: env.TIKTOK_CLIENT_KEY, client_secret: env.TIKTOK_CLIENT_SECRET, code, grant_type: 'authorization_code', redirect_uri: redirect }).toString(),
    }))
    if (!t.access_token) return { ok: false, error: '틱톡 승인 코드를 바꾸지 못했어요' }
    const info = await j(await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,username,display_name,profile_deep_link,follower_count', { headers: { Authorization: `Bearer ${t.access_token}` } }))
    const u = info.data?.user
    if (!u?.open_id) return { ok: false, error: '틱톡 계정 정보를 받지 못했어요' }
    return { ok: true, account: {
      external_id: String(u.open_id), username: u.username || null, display_name: u.display_name || null,
      profile_url: u.username ? `https://www.tiktok.com/@${u.username}` : (u.profile_deep_link || null),
      // 심사 전에는 follower_count 가 안 온다 — 0 으로 위장하지 않고 null(= 읽지 못함).
      follower_count: num(u.follower_count), account_type: null,
      access_token: String(t.access_token), refresh_token: t.refresh_token || null, expires_in: num(t.expires_in),
    } }
  } catch {
    return { ok: false, error: '연동 중 오류가 났어요' }
  }
}

/** 저장 — 같은 SNS 계정이 다른 유어딜 계정에 붙어 있으면 거절한다. */
export async function saveSnsLink(env: SnsEnv, userId: number, p: SeedingPlatform, a: FetchedAccount): Promise<{ ok: boolean; error?: string }> {
  const taken = await env.DB.prepare(`SELECT user_id FROM user_sns_links WHERE platform = ? AND external_id = ?`)
    .bind(p, a.external_id).first<{ user_id: number }>().catch(() => null)
  if (taken && Number(taken.user_id) !== userId) return { ok: false, error: '이 계정은 이미 다른 유어딜 계정에 연동돼 있어요' }
  const kek = env.DATA_ENCRYPTION_KEY
  const at = await encryptAtRest(a.access_token, kek).catch(() => null)
  const rt = a.refresh_token ? await encryptAtRest(a.refresh_token, kek).catch(() => null) : null
  const exp = a.expires_in ? new Date(Date.now() + a.expires_in * 1000).toISOString().replace('T', ' ').slice(0, 19) : null
  await env.DB.prepare(
    `INSERT INTO user_sns_links (user_id, platform, external_id, username, display_name, profile_url, follower_count, account_type,
       access_token_enc, refresh_token_enc, token_expires_at, verified_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
     ON CONFLICT(user_id, platform) DO UPDATE SET external_id = excluded.external_id, username = excluded.username,
       display_name = excluded.display_name, profile_url = excluded.profile_url, follower_count = excluded.follower_count,
       account_type = excluded.account_type, access_token_enc = excluded.access_token_enc,
       refresh_token_enc = COALESCE(excluded.refresh_token_enc, user_sns_links.refresh_token_enc),
       token_expires_at = excluded.token_expires_at, verified_at = datetime('now'), updated_at = datetime('now')`,
  ).bind(userId, p, a.external_id, a.username, a.display_name, a.profile_url, a.follower_count, a.account_type, at, rt, exp).run()
  return { ok: true }
}

export interface SnsLinkRow {
  platform: SeedingPlatform; username: string | null; display_name: string | null; profile_url: string | null
  follower_count: number | null; account_type: string | null; verified_at: string
}

export async function listSnsLinks(DB: D1Database, userId: number): Promise<SnsLinkRow[]> {
  const r = await DB.prepare(
    `SELECT platform, username, display_name, profile_url, follower_count, account_type, verified_at FROM user_sns_links WHERE user_id = ?`,
  ).bind(userId).all<SnsLinkRow>().catch(() => ({ results: [] as SnsLinkRow[] }))
  return (r.results ?? []).filter((x) => isSeedingPlatform(x.platform))
}
