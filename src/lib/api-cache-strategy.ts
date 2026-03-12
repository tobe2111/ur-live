/**
 * Advanced API Caching Strategy for Cloudflare Workers
 * 
 * Features:
 * - Multi-tier caching (KV + Cache API)
 * - TTL-based expiration
 * - Cache invalidation patterns
 * - Stale-while-revalidate
 * - Cache warming
 * - Cache key generation
 */

export interface CacheConfig {
  ttl: number // Time to live in seconds
  staleWhileRevalidate?: number // SWR time in seconds
  cacheKey?: string
  tags?: string[] // For tag-based invalidation
  skipCache?: boolean
  bypassCache?: boolean
}

export interface CacheEntry<T = any> {
  data: T
  timestamp: number
  ttl: number
  tags?: string[]
}

/**
 * Cache Strategy Manager
 */
export class APICacheStrategy {
  private kvNamespace: KVNamespace
  private cacheKeyPrefix: string

  constructor(kvNamespace: KVNamespace, prefix: string = 'cache') {
    this.kvNamespace = kvNamespace
    this.cacheKeyPrefix = prefix
  }

  /**
   * Generate cache key from request
   */
  generateCacheKey(
    path: string,
    params?: Record<string, any>,
    userId?: string
  ): string {
    const paramsStr = params ? JSON.stringify(params) : ''
    const userStr = userId ? `user:${userId}` : 'public'
    return `${this.cacheKeyPrefix}:${path}:${userStr}:${paramsStr}`
  }

  /**
   * Get data from cache
   */
  async get<T = any>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const cached = await this.kvNamespace.get(key, 'json')
      if (!cached) return null

      const entry = cached as CacheEntry<T>
      const now = Date.now()

      // Check if expired
      if (now - entry.timestamp > entry.ttl * 1000) {
        await this.delete(key)
        return null
      }

      return entry
    } catch (error) {
      console.error('[Cache] Get error:', error)
      return null
    }
  }

  /**
   * Set data to cache
   */
  async set<T = any>(
    key: string,
    data: T,
    config: CacheConfig
  ): Promise<void> {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl: config.ttl,
        tags: config.tags,
      }

      // Store in KV with expiration
      await this.kvNamespace.put(key, JSON.stringify(entry), {
        expirationTtl: config.ttl,
      })
    } catch (error) {
      console.error('[Cache] Set error:', error)
    }
  }

  /**
   * Delete cache entry
   */
  async delete(key: string): Promise<void> {
    try {
      await this.kvNamespace.delete(key)
    } catch (error) {
      console.error('[Cache] Delete error:', error)
    }
  }

  /**
   * Invalidate cache by tag
   */
  async invalidateByTag(tag: string): Promise<void> {
    try {
      // List all keys with the tag (requires KV metadata support)
      // This is a simplified version; production would need a tag index
      const keys = await this.listKeysByPrefix(`${this.cacheKeyPrefix}:`)
      
      for (const key of keys) {
        const entry = await this.get(key)
        if (entry?.tags?.includes(tag)) {
          await this.delete(key)
        }
      }
    } catch (error) {
      console.error('[Cache] Invalidate by tag error:', error)
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidateByPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.listKeysByPrefix(pattern)
      await Promise.all(keys.map((key) => this.delete(key)))
    } catch (error) {
      console.error('[Cache] Invalidate by pattern error:', error)
    }
  }

  /**
   * List keys by prefix
   */
  private async listKeysByPrefix(prefix: string): Promise<string[]> {
    const keys: string[] = []
    let cursor: string | undefined

    try {
      do {
        const result = await this.kvNamespace.list({ prefix, cursor })
        keys.push(...result.keys.map((k) => k.name))
        cursor = (result as any).cursor
      } while (cursor)
    } catch (error) {
      console.error('[Cache] List keys error:', error)
    }

    return keys
  }

  /**
   * Warm cache with data
   */
  async warm(
    key: string,
    dataFetcher: () => Promise<any>,
    config: CacheConfig
  ): Promise<void> {
    try {
      const data = await dataFetcher()
      await this.set(key, data, config)
    } catch (error) {
      console.error('[Cache] Warm error:', error)
    }
  }

  /**
   * Get with stale-while-revalidate
   */
  async getSWR<T = any>(
    key: string,
    fetcher: () => Promise<T>,
    config: CacheConfig
  ): Promise<T> {
    const cached = await this.get<T>(key)

    if (cached) {
      const age = (Date.now() - cached.timestamp) / 1000

      // If within TTL, return cached data
      if (age < cached.ttl) {
        return cached.data
      }

      // If within SWR window, return stale data and revalidate in background
      if (config.staleWhileRevalidate && age < cached.ttl + config.staleWhileRevalidate) {
        // Revalidate in background (don't await)
        this.warm(key, fetcher, config).catch(console.error)
        return cached.data
      }
    }

    // Fetch fresh data
    const data = await fetcher()
    await this.set(key, data, config)
    return data
  }
}

/**
 * Predefined cache configurations for different endpoints
 */
export const CacheConfigs = {
  // Product data - cache for 5 minutes
  products: {
    ttl: 300,
    staleWhileRevalidate: 60,
    tags: ['products'],
  },

  // Product detail - cache for 10 minutes
  productDetail: {
    ttl: 600,
    staleWhileRevalidate: 120,
    tags: ['products', 'product-detail'],
  },

  // User profile - cache for 2 minutes
  userProfile: {
    ttl: 120,
    tags: ['user'],
  },

  // Orders - cache for 1 minute
  orders: {
    ttl: 60,
    tags: ['orders'],
  },

  // Cart - no cache (real-time data)
  cart: {
    ttl: 0,
    skipCache: true,
  },

  // Search results - cache for 5 minutes
  search: {
    ttl: 300,
    staleWhileRevalidate: 60,
    tags: ['search'],
  },

  // Static content - cache for 1 hour
  static: {
    ttl: 3600,
    staleWhileRevalidate: 300,
  },

  // Live streams - cache for 30 seconds
  liveStreams: {
    ttl: 30,
    tags: ['live'],
  },

  // Categories - cache for 15 minutes
  categories: {
    ttl: 900,
    staleWhileRevalidate: 180,
    tags: ['categories'],
  },
} as const

/**
 * Cache invalidation triggers
 */
export const CacheInvalidation = {
  // Invalidate product caches when product is updated
  onProductUpdate: (cacheStrategy: APICacheStrategy, productId: string) => {
    return Promise.all([
      cacheStrategy.invalidateByTag('products'),
      cacheStrategy.invalidateByPattern(`*:products:*`),
      cacheStrategy.invalidateByPattern(`*:product-detail:*:${productId}*`),
    ])
  },

  // Invalidate user caches when user data changes
  onUserUpdate: (cacheStrategy: APICacheStrategy, userId: string) => {
    return cacheStrategy.invalidateByPattern(`*:user:${userId}:*`)
  },

  // Invalidate order caches when new order is created
  onOrderCreate: (cacheStrategy: APICacheStrategy, userId: string) => {
    return Promise.all([
      cacheStrategy.invalidateByTag('orders'),
      cacheStrategy.invalidateByPattern(`*:orders:user:${userId}:*`),
    ])
  },

  // Invalidate search caches
  onSearchIndexUpdate: (cacheStrategy: APICacheStrategy) => {
    return cacheStrategy.invalidateByTag('search')
  },
}

/**
 * Helper to create cache middleware for Hono
 */
export function createCacheMiddleware(
  kvNamespace: KVNamespace,
  defaultConfig: CacheConfig = { ttl: 300 }
) {
  const cacheStrategy = new APICacheStrategy(kvNamespace)

  return async (c: any, next: any) => {
    const { skipCache, bypassCache } = c.req.query()

    if (skipCache || bypassCache) {
      return next()
    }

    const cacheKey = cacheStrategy.generateCacheKey(
      c.req.path,
      c.req.query(),
      c.get('userId')
    )

    const cached = await cacheStrategy.get(cacheKey)

    if (cached) {
      // Add cache headers
      c.header('X-Cache', 'HIT')
      c.header('X-Cache-Key', cacheKey)
      c.header('X-Cache-Age', Math.floor((Date.now() - cached.timestamp) / 1000).toString())
      return c.json(cached.data)
    }

    // Proceed with request
    await next()

    // Cache the response
    if (c.res.ok && c.res.headers.get('content-type')?.includes('application/json')) {
      const responseData = await c.res.clone().json()
      await cacheStrategy.set(cacheKey, responseData, defaultConfig)
      c.header('X-Cache', 'MISS')
    }
  }
}
