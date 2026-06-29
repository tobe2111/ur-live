/**
 * 🆕 2026-06-27 유어애즈 — 부정클릭 방지 Phase 1 (수집·탐지·리포트. 차단 0).
 *   설계: docs/design/urads-clickfraud-design.md.
 *
 *   프라이버시 바이 디자인(대표 "가장 이상적으로"):
 *     - 자사 픽셀의 1자 수집(광고주 사이트에 스크립트) + 광고주 도메인 검증(스푸핑 차단).
 *     - IP: 그룹핑용 salted 해시 + 원문 병행(차단 단계엔 원문 필요) — 광고주별 격리, 90일 후 자동삭제.
 *     - 위치: 국가 수준만(Cloudflare 헤더 — 외부 위치조회 안 함).
 *     - 목적 제한: 부정클릭 방지 전용. 마케팅 재사용 금지.
 *   ⚠️ Phase 1 은 차단 없음(탐지·리포트만). 차단(노출제한 IP)은 Phase 2(결정 B 후).
 */
import { swallow } from '@/worker/utils/swallow'

const RETENTION_DAYS = 90
const SUSPICION_MIN_CLICKS = 8 // 7일 내 같은 IP 클릭 ≥ 이 값 → 의심

const _schemaDone = new WeakSet<object>()
export async function ensureClickguardSchema(DB: D1Database): Promise<void> {
  if (_schemaDone.has(DB)) return
  _schemaDone.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_clickguard_sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    advertiser_key TEXT NOT NULL,
    domain TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(advertiser_key)
  )`).run().catch(swallow('clickguard:sites'))
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_click_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    advertiser_key TEXT NOT NULL,
    ip TEXT,
    ip_hash TEXT,
    country TEXT,
    ua TEXT,
    referrer TEXT,
    landing_url TEXT,
    is_ad_inflow INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(swallow('clickguard:events'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_clickevt_key_time ON ad_click_events(advertiser_key, created_at)').run().catch(swallow('clickguard:idx1'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_clickevt_key_hash ON ad_click_events(advertiser_key, ip_hash)').run().catch(swallow('clickguard:idx2'))
  // Phase 2 — 차단 목록(검색광고센터 노출제한 IP 복붙용). 공식 API 가 열리면 자동 등록으로 전환.
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_blocked_ips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    ip TEXT NOT NULL,
    reason TEXT,
    created_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(seller_id, ip)
  )`).run().catch(swallow('clickguard:blocked'))
}

const IP_RE = /^[0-9]{1,3}(\.[0-9]{1,3}){3}$|^[0-9a-fA-F:]{3,45}$/ // IPv4 또는 IPv6(느슨)

export async function addBlockedIp(DB: D1Database, sellerId: number, ip: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  await ensureClickguardSchema(DB)
  const clean = ip.trim()
  if (!IP_RE.test(clean)) return { ok: false, error: '올바른 IP 형식이 아닙니다' }
  const cnt = await DB.prepare('SELECT COUNT(*) AS c FROM ad_blocked_ips WHERE seller_id = ?').bind(sellerId).first<{ c: number }>().catch(() => null)
  if ((Number(cnt?.c) || 0) >= 600) return { ok: false, error: '차단 목록은 최대 600개입니다 (네이버 노출제한 IP 한도)' }
  await DB.prepare('INSERT OR IGNORE INTO ad_blocked_ips (seller_id, ip, reason) VALUES (?, ?, ?)').bind(sellerId, clean, reason.slice(0, 100)).run()
  return { ok: true }
}

export async function listBlockedIps(DB: D1Database, sellerId: number): Promise<Array<{ ip: string; reason: string | null; created_at: string }>> {
  await ensureClickguardSchema(DB)
  const r = await DB.prepare('SELECT ip, reason, created_at FROM ad_blocked_ips WHERE seller_id = ? ORDER BY id DESC LIMIT 600')
    .bind(sellerId).all<{ ip: string; reason: string | null; created_at: string }>().catch(() => null)
  return r?.results || []
}

export async function removeBlockedIp(DB: D1Database, sellerId: number, ip: string): Promise<void> {
  await ensureClickguardSchema(DB)
  await DB.prepare('DELETE FROM ad_blocked_ips WHERE seller_id = ? AND ip = ?').bind(sellerId, ip.trim()).run()
}

/** 16자 랜덤 advertiser_key(픽셀 토큰). */
export function genAdvertiserKey(): string {
  const b = new Uint8Array(12)
  crypto.getRandomValues(b)
  return [...b].map(x => x.toString(36).padStart(2, '0')).join('').slice(0, 16)
}

/** salted SHA-256(ip) → 그룹핑용(원문 노출 없이 동일성 판정). */
export async function hashIp(ip: string, salt: string | undefined): Promise<string> {
  const data = new TextEncoder().encode(`${salt || 'urads'}:${ip}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].slice(0, 12).map(x => x.toString(16).padStart(2, '0')).join('')
}

/** 도메인 검증 — origin/referrer host 가 등록 도메인과 일치(또는 서브도메인)인지. */
export function domainMatches(registered: string, originOrReferer: string | null): boolean {
  if (!originOrReferer) return true // 헤더 없으면 best-effort 허용(일부 브라우저)
  try {
    const host = new URL(originOrReferer).hostname.toLowerCase().replace(/^www\./, '')
    const reg = registered.toLowerCase().replace(/^www\./, '')
    return host === reg || host.endsWith('.' + reg)
  } catch { return false }
}

interface SiteRow { seller_id: number; domain: string }
// isolate 캐시(키→사이트) — 픽셀 hit 당 DB read 회피. 5분 TTL.
const _siteCache = new Map<string, { at: number; site: SiteRow | null }>()

export async function lookupSite(DB: D1Database, key: string): Promise<SiteRow | null> {
  const hit = _siteCache.get(key)
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.site
  await ensureClickguardSchema(DB)
  const row = await DB.prepare('SELECT seller_id, domain FROM ad_clickguard_sites WHERE advertiser_key = ?')
    .bind(key).first<SiteRow>().catch(() => null)
  _siteCache.set(key, { at: Date.now(), site: row || null })
  return row || null
}

export async function registerSite(DB: D1Database, sellerId: number, domain: string): Promise<{ ok: boolean; advertiser_key?: string; error?: string }> {
  await ensureClickguardSchema(DB)
  const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '')
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(clean)) return { ok: false, error: '올바른 도메인을 입력해주세요 (예: example.com)' }
  const key = genAdvertiserKey()
  await DB.prepare('INSERT INTO ad_clickguard_sites (seller_id, advertiser_key, domain) VALUES (?, ?, ?)')
    .bind(sellerId, key, clean).run()
  return { ok: true, advertiser_key: key }
}

export async function listSites(DB: D1Database, sellerId: number): Promise<Array<{ advertiser_key: string; domain: string; created_at: string }>> {
  await ensureClickguardSchema(DB)
  const r = await DB.prepare('SELECT advertiser_key, domain, created_at FROM ad_clickguard_sites WHERE seller_id = ? ORDER BY id DESC')
    .bind(sellerId).all<{ advertiser_key: string; domain: string; created_at: string }>().catch(() => null)
  return r?.results || []
}

export async function deleteSite(DB: D1Database, sellerId: number, key: string): Promise<void> {
  await ensureClickguardSchema(DB)
  await DB.prepare('DELETE FROM ad_clickguard_sites WHERE seller_id = ? AND advertiser_key = ?').bind(sellerId, key).run()
  await DB.prepare('DELETE FROM ad_click_events WHERE seller_id = ? AND advertiser_key = ?').bind(sellerId, key).run()
  _siteCache.delete(key)
}

export interface HitInput { key: string; ip: string; country: string; ua: string; referrer: string; landingUrl: string; isAd: boolean; originOrReferer: string | null }

// 픽셀 남용 캡(isolate 메모리 — DB 비용 0). 픽셀은 공개 엔드포인트라 누구나 호출 가능 →
// 단일 IP/키가 무한정 행을 적재해 ① 광고주 DB 비대 ② 의심리포트 오염 ③ D1 write 비용 폭증.
//  · (key, ipHash) 하루 ≥ PER_IP_DAILY → 더 안 쌓음(봇이 한 IP 로 수백만행 적재 차단. 의심신호는 8+ 에서 이미 확보).
//  · key 전체 하루 ≥ PER_KEY_DAILY → 분산 플러드 백스톱.
// 날짜(UTC day) 바뀌면 맵 통째 리셋 → 메모리는 하루치 distinct (key,ip) 로 제한. 비정상 폭증 시 하드 size 가드.
const PER_IP_DAILY = 300
const PER_KEY_DAILY = 200_000
const _hitCount = new Map<string, { n: number }>()
let _hitDay = -1
function allowHit(key: string, ipHash: string): boolean {
  const day = Math.floor(Date.now() / 86_400_000)
  if (day !== _hitDay || _hitCount.size > 200_000) { _hitCount.clear(); _hitDay = day }
  const keyId = `k:${key}`
  const kc = _hitCount.get(keyId) || { n: 0 }
  if (kc.n >= PER_KEY_DAILY) return false
  if (ipHash) {
    const ipId = `i:${key}:${ipHash}`
    const ic = _hitCount.get(ipId) || { n: 0 }
    if (ic.n >= PER_IP_DAILY) return false
    ic.n++; _hitCount.set(ipId, ic)
  }
  kc.n++; _hitCount.set(keyId, kc)
  return true
}

/** 픽셀 hit 기록 — 도메인 검증 통과 시 1행 insert. 가끔 90일 초과분 정리(best-effort). */
export async function recordHit(DB: D1Database, salt: string | undefined, h: HitInput): Promise<{ ok: boolean }> {
  const site = await lookupSite(DB, h.key)
  if (!site) return { ok: false }
  if (!domainMatches(site.domain, h.originOrReferer)) return { ok: false }
  const ipHash = h.ip ? await hashIp(h.ip, salt) : ''
  // 남용 캡 초과 시 조용히 OK 반환(픽셀에 차단신호 안 줌) — 행만 안 쌓음.
  if (!allowHit(h.key, ipHash)) return { ok: true }
  await DB.prepare(`INSERT INTO ad_click_events (seller_id, advertiser_key, ip, ip_hash, country, ua, referrer, landing_url, is_ad_inflow)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(site.seller_id, h.key, h.ip.slice(0, 45), ipHash, h.country.slice(0, 4), h.ua.slice(0, 300), h.referrer.slice(0, 500), h.landingUrl.slice(0, 500), h.isAd ? 1 : 0)
    .run().catch(() => null)
  // 보관기간 초과 정리(가끔만 — write 부하 회피).
  if (Math.random() < 0.02) {
    await DB.prepare(`DELETE FROM ad_click_events WHERE created_at < datetime('now', '-${RETENTION_DAYS} days')`).run().catch(() => null)
  }
  return { ok: true }
}

export interface SuspiciousIp { ip: string; country: string; clicks: number; adClicks: number; lastSeen: string; suspicious: boolean }
export interface ClickReport { days: number; totalClicks: number; uniqueIps: number; adClicks: number; suspects: SuspiciousIp[] }

/** 의심 IP 리포트 — 최근 N일, IP별 클릭수(광고유입 포함) 집계. 차단 없음(탐지만). */
export async function clickReport(DB: D1Database, sellerId: number, days = 7): Promise<ClickReport> {
  await ensureClickguardSchema(DB)
  const span = Math.min(90, Math.max(1, Math.round(days)))
  const since = `datetime('now', '-${span} days')`
  const totals = await DB.prepare(`SELECT COUNT(*) AS total, COUNT(DISTINCT ip_hash) AS uniq, SUM(is_ad_inflow) AS ads
    FROM ad_click_events WHERE seller_id = ? AND created_at >= ${since}`).bind(sellerId)
    .first<{ total: number; uniq: number; ads: number }>().catch(() => null)
  const rows = await DB.prepare(`SELECT MAX(ip) AS ip, MAX(country) AS country, COUNT(*) AS clicks,
      SUM(is_ad_inflow) AS adClicks, MAX(created_at) AS lastSeen
    FROM ad_click_events WHERE seller_id = ? AND created_at >= ${since}
    GROUP BY ip_hash ORDER BY clicks DESC LIMIT 100`).bind(sellerId)
    .all<{ ip: string; country: string; clicks: number; adClicks: number; lastSeen: string }>().catch(() => null)
  const suspects: SuspiciousIp[] = (rows?.results || []).map(r => ({
    ip: r.ip || '', country: r.country || '', clicks: Number(r.clicks) || 0, adClicks: Number(r.adClicks) || 0,
    lastSeen: r.lastSeen || '', suspicious: (Number(r.clicks) || 0) >= SUSPICION_MIN_CLICKS,
  }))
  return {
    days: span,
    totalClicks: Number(totals?.total) || 0,
    uniqueIps: Number(totals?.uniq) || 0,
    adClicks: Number(totals?.ads) || 0,
    suspects,
  }
}
