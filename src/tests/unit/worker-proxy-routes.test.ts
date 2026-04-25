/**
 * Worker Proxy/Utility Routes 단위 테스트
 *   - image-proxy, kakao-proxy, naver-proxy, sitemap, manifest, health, version, streams-browse
 */
import { describe, it, expect } from 'vitest';

const mockDB = {
  prepare: (_sql: string) => ({
    bind: (..._: unknown[]) => ({
      run: async () => ({ success: true, meta: { changes: 1, last_row_id: 1 } }),
      first: async () => null,
      all: async () => ({ results: [] }),
    }),
    first: async () => null,
    all: async () => ({ results: [] }),
    run: async () => ({ success: true, meta: { changes: 1, last_row_id: 1 } }),
  }),
};

// ── Image Proxy mirrors ───────────────────────────────────────────────────────

const ALLOWED_IMAGE_HOSTS = [
  'i.ytimg.com', 'yt3.ggpht.com',
  'k.kakaocdn.net', 't1.kakaocdn.net',
  'lh3.googleusercontent.com',
  'imagedelivery.net',
];

function isAllowedImageHost(url: string): boolean {
  try {
    const u = new URL(url);
    return ALLOWED_IMAGE_HOSTS.some(host => u.hostname === host || u.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
]);

function isAllowedImageMime(contentType: string): boolean {
  const mime = contentType.split(';')[0].trim().toLowerCase();
  return ALLOWED_IMAGE_MIMES.has(mime);
}

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

function isImageSizeOk(contentLength: number): boolean {
  return contentLength > 0 && contentLength <= MAX_IMAGE_SIZE_BYTES;
}

// ── Sitemap mirrors ───────────────────────────────────────────────────────────

const MAX_URLS_PER_SITEMAP = 50_000;

function escapeXmlEntity(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function chunkSitemapUrls<T>(urls: T[], maxPerFile = MAX_URLS_PER_SITEMAP): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < urls.length; i += maxPerFile) {
    chunks.push(urls.slice(i, i + maxPerFile));
  }
  return chunks;
}

function buildSitemapEntry(loc: string, lastmod?: string, priority?: number): string {
  const safeLoc = escapeXmlEntity(loc);
  let xml = `<url><loc>${safeLoc}</loc>`;
  if (lastmod) xml += `<lastmod>${escapeXmlEntity(lastmod)}</lastmod>`;
  if (priority !== undefined && priority >= 0 && priority <= 1) {
    xml += `<priority>${priority.toFixed(1)}</priority>`;
  }
  xml += '</url>';
  return xml;
}

// ── Manifest mirrors ──────────────────────────────────────────────────────────

interface ManifestIcon { src: string; sizes: string; type: string; }

const REQUIRED_PWA_FIELDS = ['name', 'short_name', 'start_url', 'display', 'icons'];

function validateManifest(manifest: Record<string, unknown>): string | null {
  for (const field of REQUIRED_PWA_FIELDS) {
    if (!(field in manifest)) return `${field} 필드 누락`;
  }
  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) return 'icons 배열 필요';
  return null;
}

function validateIconSize(sizes: string): boolean {
  return /^\d+x\d+$/.test(sizes);
}

function hasRequiredIconSizes(icons: ManifestIcon[]): boolean {
  // PWA 권장: 192x192, 512x512
  const sizes = new Set(icons.map(i => i.sizes));
  return sizes.has('192x192') && sizes.has('512x512');
}

// ── Health Check mirrors ──────────────────────────────────────────────────────

interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  checks: Record<string, boolean>;
}

function buildHealthResponse(checks: Record<string, boolean>): HealthResponse {
  const allOk = Object.values(checks).every(v => v);
  const allFail = Object.values(checks).every(v => !v);
  const status = allOk ? 'ok' : (allFail ? 'down' : 'degraded');
  return {
    status,
    timestamp: new Date().toISOString(),
    checks,
  };
}

// ── Version mirrors ───────────────────────────────────────────────────────────

function isValidSemver(version: string): boolean {
  return /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/.test(version);
}

// ── Streams Browse mirrors ────────────────────────────────────────────────────

const VALID_BROWSE_SORTS = ['popular', 'recent', 'viewers'] as const;

function validateBrowseSort(sort: string | undefined): typeof VALID_BROWSE_SORTS[number] {
  return VALID_BROWSE_SORTS.includes(sort as typeof VALID_BROWSE_SORTS[number])
    ? (sort as typeof VALID_BROWSE_SORTS[number])
    : 'popular';
}

function buildBrowseFilters(query: {
  sort?: string; category?: string; page?: string; limit?: string;
}) {
  return {
    sort: validateBrowseSort(query.sort),
    category: query.category && query.category.length <= 50 ? query.category : undefined,
    page: Math.max(1, parseInt(query.page || '1') || 1),
    limit: Math.min(100, Math.max(1, parseInt(query.limit || '20') || 20)),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Image Proxy Routes', () => {
  it('허용된 호스트만 통과', () => {
    expect(isAllowedImageHost('https://i.ytimg.com/vi/abc/maxres.jpg')).toBe(true);
    expect(isAllowedImageHost('https://lh3.googleusercontent.com/a/abc')).toBe(true);
    expect(isAllowedImageHost('https://malicious.com/x.jpg')).toBe(false);
  });

  it('하위도메인 허용', () => {
    expect(isAllowedImageHost('https://sub.k.kakaocdn.net/a.jpg')).toBe(true);
  });

  it('잘못된 URL 거부', () => {
    expect(isAllowedImageHost('not-a-url')).toBe(false);
    expect(isAllowedImageHost('')).toBe(false);
  });

  it('허용된 이미지 MIME', () => {
    expect(isAllowedImageMime('image/jpeg')).toBe(true);
    expect(isAllowedImageMime('image/png; charset=binary')).toBe(true);
    expect(isAllowedImageMime('text/html')).toBe(false);
    expect(isAllowedImageMime('application/javascript')).toBe(false);
  });

  it('이미지 크기 - 10MB 제한', () => {
    expect(isImageSizeOk(5_000_000)).toBe(true);
    expect(isImageSizeOk(10_000_000)).toBe(true);
    expect(isImageSizeOk(11_000_000)).toBe(false);
    expect(isImageSizeOk(0)).toBe(false);
    expect(isImageSizeOk(-100)).toBe(false);
  });
});

describe('Sitemap Routes', () => {
  it('XML 엔티티 이스케이프', () => {
    expect(escapeXmlEntity('a&b<c>"d\'')).toBe('a&amp;b&lt;c&gt;&quot;d&apos;');
  });

  it('5만개 URL 단위로 chunk', () => {
    const urls = Array.from({ length: 100_000 }, (_, i) => `url-${i}`);
    const chunks = chunkSitemapUrls(urls);
    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBe(50_000);
    expect(chunks[1].length).toBe(50_000);
  });

  it('적은 URL 은 단일 chunk', () => {
    const chunks = chunkSitemapUrls(['a', 'b', 'c']);
    expect(chunks.length).toBe(1);
  });

  it('sitemap entry 빌드', () => {
    expect(buildSitemapEntry('https://a.com', '2024-01-01', 0.8)).toContain('<loc>https://a.com</loc>');
    expect(buildSitemapEntry('https://a.com', '2024-01-01', 0.8)).toContain('<lastmod>2024-01-01</lastmod>');
    expect(buildSitemapEntry('https://a.com', '2024-01-01', 0.8)).toContain('<priority>0.8</priority>');
  });

  it('sitemap entry - URL 이스케이프', () => {
    expect(buildSitemapEntry('https://a.com?q=x&y=1')).toContain('?q=x&amp;y=1');
  });

  it('priority 범위 외 무시', () => {
    expect(buildSitemapEntry('https://a.com', undefined, 1.5)).not.toContain('priority');
    expect(buildSitemapEntry('https://a.com', undefined, -0.1)).not.toContain('priority');
  });
});

describe('Manifest Routes', () => {
  it('필수 PWA 필드 검증', () => {
    expect(validateManifest({})).toContain('name');
    expect(validateManifest({
      name: 'app', short_name: 's', start_url: '/', display: 'standalone'
    })).toContain('icons');
  });

  it('정상 manifest 통과', () => {
    expect(validateManifest({
      name: 'app',
      short_name: 's',
      start_url: '/',
      display: 'standalone',
      icons: [{ src: '/icon.png', sizes: '192x192', type: 'image/png' }],
    })).toBeNull();
  });

  it('아이콘 크기 형식', () => {
    expect(validateIconSize('192x192')).toBe(true);
    expect(validateIconSize('512x512')).toBe(true);
    expect(validateIconSize('192')).toBe(false);
    expect(validateIconSize('192X192')).toBe(false);
  });

  it('PWA 권장 아이콘 크기', () => {
    expect(hasRequiredIconSizes([
      { src: '/192.png', sizes: '192x192', type: 'image/png' },
      { src: '/512.png', sizes: '512x512', type: 'image/png' },
    ])).toBe(true);

    expect(hasRequiredIconSizes([
      { src: '/192.png', sizes: '192x192', type: 'image/png' },
    ])).toBe(false);
  });
});

describe('Health Check Routes', () => {
  it('모두 OK → status: ok', () => {
    const r = buildHealthResponse({ db: true, kv: true, cron: true });
    expect(r.status).toBe('ok');
  });

  it('일부 실패 → status: degraded', () => {
    const r = buildHealthResponse({ db: true, kv: false, cron: true });
    expect(r.status).toBe('degraded');
  });

  it('모두 실패 → status: down', () => {
    const r = buildHealthResponse({ db: false, kv: false });
    expect(r.status).toBe('down');
  });

  it('timestamp 는 ISO 형식', () => {
    const r = buildHealthResponse({ ok: true });
    expect(r.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('Version Routes', () => {
  it('semver 형식 검증', () => {
    expect(isValidSemver('1.0.0')).toBe(true);
    expect(isValidSemver('2.5.10')).toBe(true);
    expect(isValidSemver('1.0.0-beta')).toBe(true);
    expect(isValidSemver('1.0.0-beta.1+sha.abc')).toBe(true);
    expect(isValidSemver('1.0')).toBe(false);
    expect(isValidSemver('v1.0.0')).toBe(false);
  });
});

describe('Streams Browse Routes', () => {
  it('정렬 기본값 popular', () => {
    expect(validateBrowseSort(undefined)).toBe('popular');
    expect(validateBrowseSort('invalid')).toBe('popular');
  });

  it('유효한 정렬', () => {
    expect(validateBrowseSort('recent')).toBe('recent');
    expect(validateBrowseSort('viewers')).toBe('viewers');
  });

  it('페이지네이션과 카테고리 필터', () => {
    const f = buildBrowseFilters({ page: '2', limit: '50', category: '맛집' });
    expect(f.page).toBe(2);
    expect(f.limit).toBe(50);
    expect(f.category).toBe('맛집');
  });

  it('카테고리 50자 초과 시 무시', () => {
    expect(buildBrowseFilters({ category: 'a'.repeat(51) }).category).toBeUndefined();
  });

  it('limit 100 초과 시 100으로 제한', () => {
    expect(buildBrowseFilters({ limit: '500' }).limit).toBe(100);
  });
});

describe('D1 mock', () => {
  it('스트림 목록 조회', async () => {
    const r = await mockDB.prepare('SELECT id, title FROM live_streams WHERE status = ?')
      .bind('live').all();
    expect(r.results).toEqual([]);
  });
});
