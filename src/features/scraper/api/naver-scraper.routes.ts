/**
 * 네이버 광고주 이메일 크롤러 (Cloudflare Worker 직접 실행)
 *
 * 2단계 분할 방식으로 Workers subrequest 제한 회피:
 *   1단계: POST /collect  → 네이버 검색 → 광고주 URL 목록 반환 (subreq ~15)
 *   2단계: POST /extract  → URL 배치 → 이메일 추출 (subreq ~10/배치)
 *   통합:  POST /scrape   → 1단계+2단계 자동 (키워드당 ~10개, 빠른 테스트용)
 *
 * 프론트엔드가 collect → extract × N 반복으로 무제한 수집 가능
 *
 * ⚠️ [LEGAL/PIPA] 개인정보 보호법 리스크
 *    수집된 이메일·전화번호를 마케팅 발송 목적으로 활용하려면
 *    정보주체의 사전 명시적 동의가 필수입니다 (제15조, 제22조).
 *    현재 구현은 동의 플로우가 없으므로 기본적으로 비활성화하고,
 *    `SCRAPER_ENABLED=true` 환경에서만 관리자 연구·내부 분석용으로 제한합니다.
 *    기본 환경에서는 503을 반환합니다.
 */

import { Hono } from 'hono';
import type { Env } from '../../../worker/types/env';
import { rateLimit } from '../../../worker/middleware/rate-limit';

/**
 * 크롤러 기능 활성화 가드. SCRAPER_ENABLED가 'true'가 아니면 503을 반환.
 * PIPA 동의 플로우가 구현되기 전까지 프로덕션에서는 절대 활성화하지 말 것.
 */
function scraperDisabledResponse(c: { env: Env; json: (data: unknown, status?: number) => Response }): Response | null {
  if (c.env.SCRAPER_ENABLED !== 'true') {
    return c.json(
      { success: false, error: '이 기능은 현재 비활성화 상태입니다. (PIPA 동의 플로우 준비 중)' },
      503
    );
  }
  return null;
}

const naverScraper = new Hono<{ Bindings: Env }>();

const HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
};

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const BAD_DOMAINS = ['example.com', 'test.com', 'email.com', 'domain.com', 'sentry.io', 'wixpress.com', 'jsdelivr.net'];

function cleanEmails(html: string): string[] {
  const matches = html.match(EMAIL_RE) || [];
  const unique = new Set<string>();
  for (const e of matches) {
    const email = e.toLowerCase().trim();
    if (email.length > 50 || email.includes('..')) continue;
    const domain = email.split('@')[1];
    if (!domain || BAD_DOMAINS.some(b => domain.includes(b))) continue;
    if (/\.(png|jpg|gif|svg|css|js|woff|ico)$/i.test(email)) continue;
    unique.add(email);
  }
  return Array.from(unique);
}

function getDomain(url: string): string | null {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

async function verifyAdmin(c: any): Promise<boolean> {
  const auth = c.req.header('Authorization');
  if (!auth) return false;
  try {
    const { verify } = await import('hono/jwt');
    const payload = await verify(auth.replace('Bearer ', ''), c.env.JWT_SECRET, 'HS256');
    return (payload as any).type === 'admin';
  } catch { return false; }
}

async function ensureTable(DB: D1Database) {
  await DB.prepare(`CREATE TABLE IF NOT EXISTS scraped_advertisers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT, advertiser_name TEXT, site_url TEXT, email TEXT,
    phone TEXT, description TEXT,
    scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP, session_name TEXT,
    UNIQUE(keyword, email)
  )`).run().catch(() => {});
}

// ════════════════════════════════════════════════════════════════════
// 1단계: 광고주 URL 수집 (subrequest ~15)
// ════════════════════════════════════════════════════════════════════
naverScraper.post('/collect', async (c) => {
  const disabled = scraperDisabledResponse(c);
  if (disabled) return disabled;
  if (!await verifyAdmin(c)) return c.json({ error: 'Admin only' }, 401);

  const { keyword, pages = 3 } = await c.req.json<{ keyword: string; pages?: number }>();
  if (!keyword?.trim()) return c.json({ success: false, error: '키워드를 입력하세요' }, 400);

  const allAds: Array<{ nclkUrl: string; title: string }> = [];

  // 여러 페이지 크롤링
  for (let page = 1; page <= Math.min(pages, 5); page++) {
    try {
      const start = (page - 1) * 15 + 1;
      const url = `https://ad.search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(keyword.trim())}&start=${start}`;
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) continue;
      const html = await res.text();

      // nclk/lavad 광고 링크 추출
      const linkRe = /<a[^>]+href=["']([^"']*(?:nclk\.naver\.com|lavad\.naver\.com|ader\.naver\.com)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let m: RegExpExecArray | null;
      while ((m = linkRe.exec(html)) !== null) {
        const href = m[1].replace(/&amp;/g, '&');
        const title = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);
        if (title && !allAds.find(a => a.nclkUrl === href)) {
          allAds.push({ nclkUrl: href, title });
        }
      }

      // 일반 검색 결과의 광고 (class에 ad 포함)
      const adBlockRe = /class="[^"]*(?:ad_area|power_link|lst_ad)[^"]*"[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      while ((m = adBlockRe.exec(html)) !== null) {
        const href = m[1].replace(/&amp;/g, '&');
        const title = m[2].replace(/<[^>]+>/g, '').trim().slice(0, 200);
        if (title && href.startsWith('http') && !allAds.find(a => a.nclkUrl === href)) {
          allAds.push({ nclkUrl: href, title });
        }
      }
    } catch {}
  }

  // nclk URL → 실제 광고주 URL 리다이렉트 추적
  const seenDomains = new Set<string>();
  const resolved: Array<{ url: string; title: string; domain: string }> = [];

  await Promise.all(
    allAds.slice(0, 30).map(async (ad) => {
      try {
        // URL 파라미터에서 직접 추출 시도
        const paramMatch = ad.nclkUrl.match(/[?&](?:url|site|u|lurl)=([^&]+)/i);
        if (paramMatch) {
          const decoded = decodeURIComponent(paramMatch[1]);
          if (decoded.startsWith('http')) {
            const domain = getDomain(decoded);
            if (domain && !domain.includes('naver.com') && !seenDomains.has(domain)) {
              seenDomains.add(domain);
              resolved.push({ url: decoded, title: ad.title, domain });
              return;
            }
          }
        }

        // HEAD 요청으로 리다이렉트 추적
        const res = await fetch(ad.nclkUrl, {
          method: 'GET',
          headers: HEADERS,
          redirect: 'follow',
          signal: AbortSignal.timeout(5000),
        });
        const finalUrl = res.url;
        const domain = getDomain(finalUrl);
        if (domain && !domain.includes('naver.com') && !seenDomains.has(domain)) {
          seenDomains.add(domain);
          resolved.push({ url: finalUrl, title: ad.title, domain });
        }
      } catch {}
    })
  );

  return c.json({
    success: true,
    data: {
      keyword: keyword.trim(),
      total: resolved.length,
      advertisers: resolved,
    },
  });
});

// ════════════════════════════════════════════════════════════════════
// 2단계: 이메일 추출 (URL 배치, subrequest ~15)
// ════════════════════════════════════════════════════════════════════
naverScraper.post('/extract', async (c) => {
  const disabled = scraperDisabledResponse(c);
  if (disabled) return disabled;
  if (!await verifyAdmin(c)) return c.json({ error: 'Admin only' }, 401);

  const { keyword, advertisers, sessionName } = await c.req.json<{
    keyword: string;
    advertisers: Array<{ url: string; title: string; domain: string }>;
    sessionName?: string;
  }>();

  if (!advertisers?.length) return c.json({ success: false, error: '광고주 목록이 없습니다' }, 400);

  await ensureTable(c.env.DB);
  const session = sessionName || `quick_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}`;

  const results: Array<{ url: string; domain: string; companyName: string; emails: string[]; phone: string | null }> = [];

  await Promise.all(
    advertisers.slice(0, 10).map(async (ad) => {
      try {
        const res = await fetch(ad.url, {
          headers: HEADERS,
          redirect: 'follow',
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return;
        const html = await res.text();

        let emails = cleanEmails(html);

        // 전화번호
        const phoneMatch = html.match(/\b(0[17]0|02|0[3-9]\d)[-\s.]?\d{3,4}[-\s.]?\d{4}\b/);
        const phone = phoneMatch ? phoneMatch[0].replace(/[^\d-]/g, '') : null;

        // 회사명
        const siteNameMatch = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const companyName = (siteNameMatch?.[1] || titleMatch?.[1] || ad.title).trim().slice(0, 100);

        // 이메일 없으면 contact 페이지 시도
        if (emails.length === 0) {
          const origin = new URL(ad.url).origin;
          for (const path of ['/contact', '/about', '/company', '/info']) {
            try {
              const cr = await fetch(origin + path, { headers: HEADERS, signal: AbortSignal.timeout(3000) });
              if (cr.ok) {
                emails = cleanEmails(await cr.text());
                if (emails.length > 0) break;
              }
            } catch {}
          }
        }

        results.push({ url: ad.url, domain: ad.domain, companyName, emails, phone });

        // D1 저장
        for (const email of emails) {
          await c.env.DB.prepare(`
            INSERT OR IGNORE INTO scraped_advertisers (keyword, advertiser_name, site_url, email, phone, description, session_name)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(keyword, companyName, ad.url, email, phone, ad.title, session).run().catch(() => {});
        }
      } catch {}
    })
  );

  return c.json({
    success: true,
    data: {
      processed: results.length,
      withEmail: results.filter(r => r.emails.length > 0).length,
      totalEmails: results.reduce((s, r) => s + r.emails.length, 0),
      results: results.filter(r => r.emails.length > 0),
    },
  });
});

// ════════════════════════════════════════════════════════════════════
// 통합: 1단계 + 2단계 한번에 (빠른 테스트용, 키워드당 ~10개)
// SECURITY (HIGH-4): rate limit — 시간당 10회 (외부 트래픽 남용 방지)
// ════════════════════════════════════════════════════════════════════
naverScraper.post('/scrape', rateLimit({ action: 'scraper_scrape', max: 10, windowSec: 3600 }), async (c) => {
  if (!await verifyAdmin(c)) return c.json({ error: 'Admin only' }, 401);

  const { keyword } = await c.req.json<{ keyword: string }>();
  if (!keyword?.trim()) return c.json({ success: false, error: '키워드를 입력하세요' }, 400);

  await ensureTable(c.env.DB);
  const session = `quick_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}`;
  const startTime = Date.now();

  // 1단계: 광고주 수집 (1페이지만)
  let advertisers: Array<{ url: string; title: string; domain: string }> = [];
  try {
    const url = `https://ad.search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(keyword.trim())}`;
    const res = await fetch(url, { headers: HEADERS });
    if (res.ok) {
      const html = await res.text();
      const seenDomains = new Set<string>();
      const linkRe = /<a[^>]+href=["']([^"']*(?:nclk|lavad|ader)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let m: RegExpExecArray | null;
      const raw: Array<{ nclkUrl: string; title: string }> = [];
      while ((m = linkRe.exec(html)) !== null && raw.length < 15) {
        raw.push({ nclkUrl: m[1].replace(/&amp;/g, '&'), title: m[2].replace(/<[^>]+>/g, '').trim().slice(0, 200) });
      }

      const resolved = await Promise.all(raw.slice(0, 10).map(async (ad) => {
        try {
          const r = await fetch(ad.nclkUrl, { method: 'GET', headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(5000) });
          const d = getDomain(r.url);
          if (d && !d.includes('naver.com') && !seenDomains.has(d)) { seenDomains.add(d); return { url: r.url, title: ad.title, domain: d }; }
        } catch {}
        return null;
      }));
      advertisers = resolved.filter((a): a is NonNullable<typeof a> => !!a);
    }
  } catch {}

  if (advertisers.length === 0) {
    return c.json({ success: true, data: { keyword, found: 0, emails: 0, duration: Date.now() - startTime, results: [] } });
  }

  // 2단계: 이메일 추출
  const results: Array<{ url: string; domain: string; companyName: string; emails: string[]; phone: string | null }> = [];
  await Promise.all(advertisers.map(async (ad) => {
    try {
      const res = await fetch(ad.url, { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(8000) });
      if (!res.ok) return;
      const html = await res.text();
      const emails = cleanEmails(html);
      const phoneMatch = html.match(/\b(0[17]0|02|0[3-9]\d)[-\s.]?\d{3,4}[-\s.]?\d{4}\b/);
      const siteNameMatch = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const companyName = (siteNameMatch?.[1] || titleMatch?.[1] || ad.title).trim().slice(0, 100);

      results.push({ url: ad.url, domain: ad.domain, companyName, emails, phone: phoneMatch ? phoneMatch[0] : null });
      for (const email of emails) {
        await c.env.DB.prepare('INSERT OR IGNORE INTO scraped_advertisers (keyword, advertiser_name, site_url, email, phone, description, session_name) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(keyword.trim(), companyName, ad.url, email, phoneMatch?.[0] || null, ad.title, session).run().catch(() => {});
      }
    } catch {}
  }));

  return c.json({
    success: true,
    data: {
      keyword: keyword.trim(),
      found: advertisers.length,
      emails: results.reduce((s, r) => s + r.emails.length, 0),
      saved: results.filter(r => r.emails.length > 0).length,
      duration: Date.now() - startTime,
      results: results.filter(r => r.emails.length > 0),
    },
  });
});

export { naverScraper };
