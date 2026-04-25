import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { securityHeaders } from '../../worker/middleware/security-headers';

describe('Security Headers Middleware', () => {
  it('adds X-Content-Type-Options: nosniff to all responses', async () => {
    const app = new Hono();
    app.use('*', securityHeaders());
    app.get('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('adds Referrer-Policy', async () => {
    const app = new Hono();
    app.use('*', securityHeaders());
    app.get('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test');
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('adds Strict-Transport-Security', async () => {
    const app = new Hono();
    app.use('*', securityHeaders());
    app.get('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test');
    expect(res.headers.get('Strict-Transport-Security')).toContain('max-age=31536000');
  });

  it('uses DENY X-Frame-Options for JSON responses', async () => {
    const app = new Hono();
    app.use('*', securityHeaders());
    app.get('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('uses SAMEORIGIN X-Frame-Options for HTML responses', async () => {
    const app = new Hono();
    app.use('*', securityHeaders());
    app.get('/test', (c) => c.html('<p>test</p>'));

    const res = await app.request('/test');
    expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
  });

  it('adds Permissions-Policy', async () => {
    const app = new Hono();
    app.use('*', securityHeaders());
    app.get('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test');
    expect(res.headers.get('Permissions-Policy')).toContain('geolocation=()');
  });
});
