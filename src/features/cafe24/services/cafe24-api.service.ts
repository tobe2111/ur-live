/**
 * Cafe24 API Service
 *
 * Handles OAuth token exchange, token refresh, and product API calls
 * against the Cafe24 Open API v2.
 *
 * API Base: https://{mall_id}.cafe24api.com/api/v2
 * Auth:     https://{mall_id}.cafe24api.com/api/v2/oauth/token
 */

import type {
  Cafe24OAuthTokens,
  Cafe24Product,
  Cafe24ProductListResponse,
  Cafe24ProductDetailResponse,
  Cafe24TokenRow,
  SyncResult,
} from '../types';

// ── helpers ────────────────────────────────────────────────────────

function apiBase(mallId: string) {
  return `https://${mallId}.cafe24api.com/api/v2`;
}

function tokenUrl(mallId: string) {
  return `${apiBase(mallId)}/oauth/token`;
}

function basicAuth(clientId: string, clientSecret: string) {
  return 'Basic ' + btoa(`${clientId}:${clientSecret}`);
}

// ── OAuth ──────────────────────────────────────────────────────────

/**
 * Exchange an authorization code for access + refresh tokens
 */
export async function exchangeCodeForTokens(
  mallId: string,
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
): Promise<Cafe24OAuthTokens> {
  const res = await fetch(tokenUrl(mallId), {
    method: 'POST',
    headers: {
      Authorization: basicAuth(clientId, clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[Cafe24] Token exchange failed:', res.status, err);
    throw new Error(`Cafe24 token exchange failed: ${res.status}`);
  }

  return (await res.json()) as Cafe24OAuthTokens;
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(
  mallId: string,
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<Cafe24OAuthTokens> {
  const res = await fetch(tokenUrl(mallId), {
    method: 'POST',
    headers: {
      Authorization: basicAuth(clientId, clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[Cafe24] Token refresh failed:', res.status, err);
    throw new Error(`Cafe24 token refresh failed: ${res.status}`);
  }

  return (await res.json()) as Cafe24OAuthTokens;
}

// ── Token persistence (D1) ─────────────────────────────────────────

export async function saveTokens(
  db: D1Database,
  mallId: string,
  tokens: Cafe24OAuthTokens,
): Promise<void> {
  const scopes = Array.isArray(tokens.scopes) ? tokens.scopes.join(',') : (tokens.scopes ?? '');
  // Upsert: if mall_id already exists, update tokens
  const existing = await db
    .prepare('SELECT id FROM cafe24_auth WHERE mall_id = ?')
    .bind(mallId)
    .first<{ id: number }>();

  if (existing) {
    await db
      .prepare(
        `UPDATE cafe24_auth
         SET access_token = ?, refresh_token = ?, expires_at = ?, scopes = ?, updated_at = datetime('now')
         WHERE mall_id = ?`,
      )
      .bind(tokens.access_token, tokens.refresh_token, tokens.expires_at, scopes, mallId)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO cafe24_auth (mall_id, access_token, refresh_token, expires_at, scopes)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(mallId, tokens.access_token, tokens.refresh_token, tokens.expires_at, scopes)
      .run();
  }
}

export async function getStoredTokens(
  db: D1Database,
  mallId: string,
): Promise<Cafe24TokenRow | null> {
  return db
    .prepare('SELECT * FROM cafe24_auth WHERE mall_id = ? LIMIT 1')
    .bind(mallId)
    .first<Cafe24TokenRow>();
}

/**
 * Returns a valid access token, refreshing if expired.
 */
export async function getValidAccessToken(
  db: D1Database,
  mallId: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const stored = await getStoredTokens(db, mallId);
  if (!stored) throw new Error('Cafe24 not connected. Please authorize first.');

  // Check expiry (with 5 min buffer)
  const expiresAt = new Date(stored.expires_at).getTime();
  if (Date.now() < expiresAt - 5 * 60 * 1000) {
    return stored.access_token;
  }

  // Refresh
  const newTokens = await refreshAccessToken(mallId, clientId, clientSecret, stored.refresh_token);
  await saveTokens(db, mallId, newTokens);
  return newTokens.access_token;
}

// ── Product API ────────────────────────────────────────────────────

/**
 * Fetch products from Cafe24 (paginated)
 */
export async function fetchProducts(
  mallId: string,
  accessToken: string,
  options: { limit?: number; offset?: number; since?: string } = {},
): Promise<Cafe24Product[]> {
  const params = new URLSearchParams();
  params.set('limit', String(options.limit ?? 100));
  params.set('offset', String(options.offset ?? 0));
  if (options.since) {
    params.set('since_product_no', options.since);
  }

  const url = `${apiBase(mallId)}/admin/products?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Cafe24-Api-Version': '2024-06-01',
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[Cafe24] Fetch products failed:', res.status, err);
    throw new Error(`Cafe24 product fetch failed: ${res.status}`);
  }

  const data = (await res.json()) as Cafe24ProductListResponse;
  return data.products || [];
}

/**
 * Fetch all products (handles pagination automatically)
 */
export async function fetchAllProducts(
  mallId: string,
  accessToken: string,
): Promise<Cafe24Product[]> {
  const allProducts: Cafe24Product[] = [];
  let offset = 0;
  const limit = 100;
  // ✅ FIX (M8): Hard cap iterations to avoid runaway loops
  const MAX_PAGES = 100;
  let pages = 0;

  while (pages < MAX_PAGES) {
    const batch = await fetchProducts(mallId, accessToken, { limit, offset });
    allProducts.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
    pages++;
  }
  if (pages === MAX_PAGES) {
    console.warn('[Cafe24] fetchAllProducts hit MAX_PAGES, stopping');
  }

  return allProducts;
}

// ── Sync logic ─────────────────────────────────────────────────────

/**
 * Sync Cafe24 products into our local `products` + `cafe24_product_map` tables.
 * Creates new products or updates existing mapped ones.
 */
export async function syncProductsToLocal(
  db: D1Database,
  mallId: string,
  cafe24Products: Cafe24Product[],
): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const cp of cafe24Products) {
    try {
      // Check if we already have a mapping
      const existing = await db
        .prepare(
          'SELECT product_id FROM cafe24_product_map WHERE cafe24_product_no = ? AND cafe24_mall_id = ?',
        )
        .bind(cp.product_no, mallId)
        .first<{ product_id: number }>();

      // ✅ Defensive numeric parse: NaN / Infinity / 음수 → 0 으로 정규화.
      //    parseFloat 만으로는 'abc' 같은 손상 입력이 NaN → DB 저장 시 오류를 일으킴.
      const rawPrice = parseFloat(cp.price);
      const price = Number.isFinite(rawPrice) && rawPrice >= 0 ? Math.round(rawPrice) : 0;
      const rawSupply = cp.supply_price ? parseFloat(cp.supply_price) : 0;
      const supplyPrice = Number.isFinite(rawSupply) && rawSupply >= 0 ? Math.round(rawSupply) : 0;
      const rawRetail = cp.retail_price ? parseFloat(cp.retail_price) : null;
      const retailPrice = rawRetail !== null && Number.isFinite(rawRetail) && rawRetail >= 0
        ? Math.round(rawRetail)
        : null;
      const stock = cp.stock_quantity ?? 0;
      const imageUrl = cp.detail_image || cp.list_image || '';
      const description = cp.summary_description || cp.description || '';
      const isActive = cp.display === 'T' && cp.selling === 'T' ? 1 : 0;

      if (existing) {
        // Update existing product
        await db
          .prepare(
            `UPDATE products SET
              name = ?, description = ?, price = ?, compare_at_price = ?,
              supply_price = ?, stock = ?, image_url = ?, is_active = ?,
              updated_at = datetime('now')
            WHERE id = ?`,
          )
          .bind(
            cp.product_name, description, price, retailPrice,
            supplyPrice, stock, imageUrl, isActive,
            existing.product_id,
          )
          .run();

        // Update sync timestamp
        await db
          .prepare(
            "UPDATE cafe24_product_map SET last_synced_at = datetime('now') WHERE cafe24_product_no = ? AND cafe24_mall_id = ?",
          )
          .bind(cp.product_no, mallId)
          .run();

        result.updated++;
      } else {
        // Create new product
        const insertResult = await db
          .prepare(
            `INSERT INTO products (
              name, description, price, compare_at_price, supply_price,
              stock, image_url, category, product_type, is_active,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'cafe24', 'synced', ?, datetime('now'), datetime('now'))`,
          )
          .bind(
            cp.product_name, description, price, retailPrice,
            supplyPrice, stock, imageUrl, isActive,
          )
          .run();

        const productId =
          (insertResult.meta as any)?.last_row_id ?? insertResult.meta?.changes;

        if (productId) {
          await db
            .prepare(
              `INSERT INTO cafe24_product_map (cafe24_product_no, product_id, cafe24_mall_id)
               VALUES (?, ?, ?)`,
            )
            .bind(cp.product_no, productId, mallId)
            .run();
        }

        result.created++;
      }
    } catch (err) {
      result.errors.push(`product_no=${cp.product_no}: ${(err as Error).message}`);
    }
  }

  return result;
}
