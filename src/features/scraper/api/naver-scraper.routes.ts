/**
 * 네이버 광고주 이메일 크롤러 (Cloudflare Worker 직접 실행)
 *
 * 브라우저 없이 fetch + HTMLRewriter + 정규식으로 처리
 * - 네이버 파워링크 검색 → 광고주 URL 추출
 * - 광고주 사이트 HTML fetch → 이메일 정규식 추출
 * - D1 scraped_advertisers 테이블에 저장
 *
 * Cloudflare Workers 제한 고려:
 * - 무료: 50 subrequests, 10ms CPU
 * - 유료: 1000 subrequests, 50ms CPU
 *
 * 전략: 키워드당 최대 10개 광고 + 광고당 1개 사이트 방문 = 20 subrequests
 */

import { Hono } from 'hono';
import type { Env } from '../../../worker/types/env';

const naverScraper = new Hono<{ Bindings: Env }>();

// 한국어 Bot 감지 회피용 헤더
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
};

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const BAD_EMAIL_DOMAINS = ['example.com', 'test.com', 'email.com', 'domain.com', 'sentry.io', 'wixpress.com', 'jsdelivr.net'];

function cleanEmails(html: string): string[] {
  const matches = html.match(EMAIL_RE) || [];
  const unique = new Set<string>();
  for (const e of matches) {
    const email = e.toLowerCase().trim();
    if (email.length > 50) continue; // 비정상적으로 긴 것 제외
    if (email.includes('..')) continue;
    const domain = email.split('@')[1];
    if (!domain || BAD_EMAIL_DOMAINS.some(b => domain.includes(b))) continue;
    if (/\.(png|jpg|gif|svg|css|js|woff|ico)$/i.test(email)) continue;
    unique.add(email);
  }
  return Array.from(unique);
}

/**
 * 네이버 검색광고 결과 페이지에서 광고주 URL 추출
 */
async function fetchAdvertisers(keyword: string): Promise<Array<{ url: string; title: string; description: string }>> {
  const searchUrl = `https://ad.search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(keyword)}`;
  const res = await fetch(searchUrl, { headers: HEADERS });
  if (!res.ok) return [];
  const html = await res.text();

  const ads: Array<{ url: string; title: string; description: string }> = [];
  const seenDomains = new Set<string>();

  // 1차: nclk.naver.com 또는 lavad.naver.com 광고 링크 추출 (정규식)
  const linkPattern = /<a[^>]+href=["']([^"']*(?:nclk\.naver\.com|lavad\.naver\.com|ader\.naver\.com)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(html)) !== null && ads.length < 15) {
    const href = match[1].replace(/&amp;/g, '&');
    const title = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (title && !ads.find(a => a.url === href)) {
      ads.push({ url: href, title, description: '' });
    }
  }

  // 2차: site= 파라미터에서 실제 URL 추출
  const enrichedAds = await Promise.all(
    ads.slice(0, 10).map(async (ad) => {
      try {
        // URL 파라미터에서 site/url 추출
        const urlMatch = ad.url.match(/[?&](?:url|site|u)=([^&]+)/i);
        if (urlMatch) {
          const decoded = decodeURIComponent(urlMatch[1]);
          if (decoded.startsWith('http')) {
            const domain = new URL(decoded).hostname.replace(/^www\./, '');
            if (!domain.includes('naver.com') && !seenDomains.has(domain)) {
              seenDomains.add(domain);
              return { url: decoded, title: ad.title, description: ad.description };
            }
          }
        }
        // HEAD 요청으로 리다이렉트 추적
        const res = await fetch(ad.url, {
          method: 'HEAD',
          headers: HEADERS,
          redirect: 'follow',
          signal: AbortSignal.timeout(5000),
        });
        const finalUrl = res.url;
        const domain = new URL(finalUrl).hostname.replace(/^www\./, '');
        if (!domain.includes('naver.com') && !seenDomains.has(domain)) {
          seenDomains.add(domain);
          return { url: finalUrl, title: ad.title, description: ad.description };
        }
      } catch {}
      return null;
    })
  );

  return enrichedAds.filter((a): a is NonNullable<typeof a> => a !== null);
}

/**
 * 광고주 사이트에서 이메일 추출
 */
async function fetchEmails(siteUrl: string): Promise<{ emails: string[]; phone: string | null; companyName: string | null }> {
  try {
    // 1차: 메인 페이지
    const res = await fetch(siteUrl, {
      headers: HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { emails: [], phone: null, companyName: null };
    const html = await res.text();

    const emails = cleanEmails(html);

    // 전화번호 추출 (한국식)
    const phoneMatch = html.match(/\b(0[17]0|02|0[3-9]\d)[-\s.]?\d{3,4}[-\s.]?\d{4}\b/);
    const phone = phoneMatch ? phoneMatch[0].replace(/[^\d]/g, '') : null;

    // 회사명 추출 (<title> 또는 og:site_name)
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const siteNameMatch = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);
    const companyName = (siteNameMatch?.[1] || titleMatch?.[1] || '').trim().slice(0, 100) || null;

    // 2차: 이메일이 없으면 contact 페이지 시도
    if (emails.length === 0) {
      try {
        const origin = new URL(siteUrl).origin;
        for (const path of ['/contact', '/contact.html', '/about', '/company']) {
          const contactRes = await fetch(origin + path, {
            headers: HEADERS,
            signal: AbortSignal.timeout(3000),
          });
          if (contactRes.ok) {
            const contactHtml = await contactRes.text();
            const found = cleanEmails(contactHtml);
            if (found.length > 0) return { emails: found, phone, companyName };
          }
        }
      } catch {}
    }

    return { emails, phone, companyName };
  } catch {
    return { emails: [], phone: null, companyName: null };
  }
}

async function verifyAdminToken(c: any): Promise<boolean> {
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
    keyword TEXT,
    advertiser_name TEXT,
    site_url TEXT,
    email TEXT,
    phone TEXT,
    description TEXT,
    scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    session_name TEXT,
    UNIQUE(keyword, email)
  )`).run().catch(() => {});
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_scraped_email ON scraped_advertisers(email)').run().catch(() => {});
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_scraped_keyword ON scraped_advertisers(keyword)').run().catch(() => {});
}

// ── POST /scrape — 키워드로 즉시 크롤링 ──
naverScraper.post('/scrape', async (c) => {
  if (!await verifyAdminToken(c)) return c.json({ error: 'Admin only' }, 401);

  const { keyword } = await c.req.json<{ keyword: string }>();
  if (!keyword?.trim()) return c.json({ success: false, error: '키워드를 입력하세요' }, 400);

  await ensureTable(c.env.DB);

  const startTime = Date.now();
  const sessionName = `quick_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;

  try {
    // 1. 광고주 URL 목록 추출
    const advertisers = await fetchAdvertisers(keyword.trim());
    if (advertisers.length === 0) {
      return c.json({
        success: true,
        data: { keyword, found: 0, emails: 0, duration: Date.now() - startTime, results: [] },
      });
    }

    // 2. 각 광고주 사이트에서 이메일 추출 (병렬)
    const results = await Promise.all(
      advertisers.map(async (ad) => {
        const { emails, phone, companyName } = await fetchEmails(ad.url);
        return {
          url: ad.url,
          domain: new URL(ad.url).hostname.replace(/^www\./, ''),
          title: ad.title,
          companyName: companyName || ad.title,
          emails,
          phone,
        };
      })
    );

    // 3. D1에 저장 (이메일 있는 것만)
    let savedCount = 0;
    for (const r of results) {
      for (const email of r.emails) {
        try {
          await c.env.DB.prepare(`
            INSERT OR IGNORE INTO scraped_advertisers
              (keyword, advertiser_name, site_url, email, phone, description, session_name)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(
            keyword.trim(),
            r.companyName,
            r.url,
            email,
            r.phone,
            r.title,
            sessionName,
          ).run();
          savedCount++;
        } catch {}
      }
    }

    return c.json({
      success: true,
      data: {
        keyword: keyword.trim(),
        found: results.length,
        emails: results.reduce((sum, r) => sum + r.emails.length, 0),
        saved: savedCount,
        duration: Date.now() - startTime,
        results: results.filter(r => r.emails.length > 0),
      },
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message || '크롤링 실패' }, 500);
  }
});

export { naverScraper };
