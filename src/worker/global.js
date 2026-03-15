/**
 * UR-Live Global Worker
 *
 * For https://world.ur-team.com
 * International version with Google OAuth
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { compress } from 'hono/compress';
import { serveStatic } from 'hono/cloudflare-workers';
const app = new Hono();
// CORS
app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
// Compression
app.use('*', compress());
// Health Check
app.get('/health', (c) => {
    return c.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        worker: 'ur-live-global-worker',
        version: '1.0.0',
        region: 'WORLD',
        message: 'UR-Live Global Service is running'
    });
});
// API Response (temporary - redirects to main service)
app.get('/api/*', (c) => {
    return c.json({
        success: false,
        error: 'Please use the main API at https://live.ur-team.com/api',
        redirect: 'https://live.ur-team.com' + c.req.path
    }, 302);
});
// Static files
app.get('*', serveStatic({ root: './' }));
// SPA Fallback
app.get('*', async (c) => {
    const path = c.req.path;
    if (path.startsWith('/api/')) {
        return c.notFound();
    }
    try {
        const indexHtml = await c.env.ASSETS.fetch(new Request('https://dummy.com/index.html')).then(r => r.text());
        return c.html(indexHtml);
    }
    catch (error) {
        console.error('[SPA Fallback] Failed to serve index.html:', error);
        return c.html('<h1>UR-Live Global</h1><p>Welcome to UR-Live International Service</p>');
    }
});
export default app;
