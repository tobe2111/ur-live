// ============================================================
// i18n Middleware for Worker
// Detects locale from Accept-Language header
// Attaches locale to context for all routes
// ============================================================
import { createMiddleware } from 'hono/factory';
import { getLocaleFromHeader, getCurrencyForCountry, } from '../../shared/utils/i18n';
export const i18nMiddleware = createMiddleware(async (c, next) => {
    // 1. Check explicit header (X-Locale)
    const explicitLocale = c.req.header('X-Locale');
    // 2. Check Accept-Language header
    const acceptLanguage = c.req.header('Accept-Language');
    const detectedLocale = explicitLocale ?? getLocaleFromHeader(acceptLanguage);
    // 3. Country from Cloudflare header (CF-IPCountry)
    const country = c.req.header('CF-IPCountry') ?? 'KR';
    const currency = getCurrencyForCountry(country);
    c.set('locale', detectedLocale);
    c.set('currency', currency);
    c.set('country', country);
    // Add locale info to response headers
    c.header('Content-Language', detectedLocale);
    await next();
});
