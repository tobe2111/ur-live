// ============================================================
// Auth Middleware - JWT verification
// ============================================================

import { createMiddleware } from 'hono/factory';
import type { Env } from '../types/env';

interface JWTPayloadInternal {
  sub: string;
  email: string;
  role: string;
  exp: number;
  iat: number;
}

// Simple JWT decode without crypto (for header/payload extraction)
function decodeJwtPayload(token: string): JWTPayloadInternal | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    if (!payload) return null;
    // Add padding
    const padded = payload + '='.repeat((4 - payload.length % 4) % 4);
    const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded) as JWTPayloadInternal;
  } catch {
    return null;
  }
}

// Verify JWT HMAC-SHA256 signature
async function verifyJwt(token: string, secret: string): Promise<JWTPayloadInternal | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const data = encoder.encode(`${parts[0]}.${parts[1]}`);
    const signaturePart = parts[2];
    if (!signaturePart) return null;
    const padded = signaturePart + '='.repeat((4 - signaturePart.length % 4) % 4);
    const signatureBytes = Uint8Array.from(
      atob(padded.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    );

    const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, data);
    if (!valid) return null;

    const payload = decodeJwtPayload(token);
    if (!payload) return null;

    // Check expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

export type AuthVariables = {
  user: {
    id: string;
    email: string;
    role: string;
  };
};

export const authMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: AuthVariables;
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyJwt(token, c.env.JWT_SECRET);

  if (!payload) {
    return c.json({ success: false, error: 'Invalid or expired token' }, 401);
  }

  c.set('user', {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
  });

  await next();
  return;
});

export const optionalAuthMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: { user?: { id: string; email: string; role: string } };
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = await verifyJwt(token, c.env.JWT_SECRET);
    if (payload) {
      c.set('user', {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      });
    }
  }
  await next();
});

// Helper to generate JWT
export async function createJwt(
  payload: { sub: string; email: string; role: string },
  secret: string,
  expiresInSeconds: number = 15 * 60
): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = btoa(JSON.stringify({
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${header}.${jwtPayload}`)
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return `${header}.${jwtPayload}.${sigB64}`;
}
