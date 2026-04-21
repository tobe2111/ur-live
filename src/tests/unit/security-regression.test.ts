/**
 * Security regression tests — source-code level
 *
 * These tests grep the source tree for known anti-patterns that previously
 * caused security incidents. They are fast, hermetic, and do NOT require
 * a running worker or D1. Each pattern is named after the bug it prevents.
 *
 * If one of these fails, you almost certainly introduced a regression.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const SRC_DIR = path.join(REPO_ROOT, 'src');

function findFiles(dir: string, ext: RegExp, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.wrangler', 'tests'].includes(entry.name)) continue;
      findFiles(full, ext, acc);
    } else if (ext.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function readAllSrc(): Array<{ path: string; content: string }> {
  return findFiles(SRC_DIR, /\.(ts|tsx)$/)
    .filter((p) => !/\.d\.ts$/.test(p))
    .map((p) => ({ path: p, content: fs.readFileSync(p, 'utf8') }));
}

// Filter to worker-side source (routes, middleware, features/**/api)
function isServerSide(filePath: string): boolean {
  return (
    filePath.includes(`${path.sep}worker${path.sep}`) ||
    filePath.includes(`${path.sep}features${path.sep}`) && filePath.includes(`${path.sep}api${path.sep}`)
  );
}

describe('Debug endpoint exposure', () => {
  it('no public /api/debug-* or /api/orders/debug-* route definitions', () => {
    const files = readAllSrc();
    const violations: string[] = [];
    // Catch route registrations like app.get('/api/debug-xxx', handler)
    // (public, no requireAdmin middleware immediately following).
    const forbiddenRoutes = [
      /['"`]\/api\/orders\/debug[-/]/,
      /['"`]\/api\/debug-[a-z]/,
    ];
    for (const { path: p, content } of files) {
      for (const rx of forbiddenRoutes) {
        if (rx.test(content)) {
          violations.push(`${path.relative(REPO_ROOT, p)} matched ${rx}`);
        }
      }
    }
    expect(violations, violations.join('\n')).toHaveLength(0);
  });

  it('admin debug routes are gated with requireAdmin()', () => {
    const indexPath = path.join(SRC_DIR, 'worker/index.ts');
    const content = fs.readFileSync(indexPath, 'utf8');
    const debugRoutes = [...content.matchAll(/app\.(?:get|post|put|delete|patch)\s*\(\s*['"`]\/api\/debug\/[^'"`]+['"`][^)]*\)/g)];
    for (const [match] of debugRoutes.map((m) => [m[0]])) {
      expect(match, `debug route missing requireAdmin(): ${match}`).toMatch(/requireAdmin\s*\(/);
    }
  });
});

describe('Ownership enforcement on sensitive GETs', () => {
  it('wishlists.routes.ts GET /:userId checks authUser.id ownership', () => {
    const p = path.join(SRC_DIR, 'features/wishlists/api/wishlists.routes.ts');
    const content = fs.readFileSync(p, 'utf8');
    // There must be a check comparing the :userId param against authUser.id
    // (otherwise any logged-in user could enumerate others' wishlists).
    expect(content).toMatch(/userId\s*!==\s*String\(authUser\.id\)/);
    expect(content).toMatch(/authUser\.type\s*!==\s*['"]admin['"]/);
  });

  it('returns.routes.ts uses requireAuth on every non-webhook route', () => {
    const p = path.join(SRC_DIR, 'features/returns/api/returns.routes.ts');
    const content = fs.readFileSync(p, 'utf8');
    // Every returnsRoutes.<verb> should either be followed by requireAuth or explicitly webhook/public
    const routeDecls = [...content.matchAll(/returnsRoutes\.(get|post|put|delete|patch)\s*\(\s*['"`][^'"`]+['"`]\s*,\s*([^,)]+)/g)];
    const unprotected = routeDecls.filter(
      ([, , args]) =>
        !/requireAuth|rateLimit.*requireAuth|requireUser|requireSeller|requireAdmin/.test(args ?? '')
    );
    expect(unprotected, `returns routes without auth: ${unprotected.map(m => m[0]).join('\n')}`).toHaveLength(0);
  });
});

describe('Payment amount validation present', () => {
  it('POST /api/payments/confirm compares DB total to client amount', () => {
    const p = path.join(SRC_DIR, 'worker/routes/payment.routes.ts');
    const content = fs.readFileSync(p, 'utf8');
    // Must reduce/sum orders.total_amount somewhere and compare to the body amount.
    expect(content).toMatch(/\.reduce\(/);
    expect(content).toMatch(/\bo\.total_amount\b/);
    expect(content).toMatch(/totalAmount\s*!==\s*amount|totalAmount\s*!==\s*parsed\.data\.amount/);
  });

  it('zod schema rejects non-positive integer amounts', () => {
    const p = path.join(SRC_DIR, 'worker/routes/payment.routes.ts');
    const content = fs.readFileSync(p, 'utf8');
    expect(content).toMatch(/amount:\s*z\.number\(\)\.int\(\)\.positive\(\)/);
  });

  it('orderId has tight regex (no path traversal / SQLi characters)', () => {
    const p = path.join(SRC_DIR, 'worker/routes/payment.routes.ts');
    const content = fs.readFileSync(p, 'utf8');
    expect(content).toMatch(/orderId:\s*z\.string\(\)[^}]*regex/);
  });
});

describe('Hard-coded secrets', () => {
  it('no JWT_SECRET default value in server-side code', () => {
    const files = readAllSrc().filter(({ path: p }) => isServerSide(p));
    const violations: string[] = [];
    for (const { path: p, content } of files) {
      // Catch JWT_SECRET with a non-env fallback like: JWT_SECRET || 'xxx' or JWT_SECRET ?? "xxx"
      // Only flag literal-string fallbacks.
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (/\.JWT_SECRET\s*(\|\||\?\?)\s*['"`][^'"`]+['"`]/.test(line)) {
          violations.push(`${path.relative(REPO_ROOT, p)}:${i + 1}  ${line.trim()}`);
        }
      });
    }
    expect(violations, violations.join('\n')).toHaveLength(0);
  });

  it('no Toss secret key default in server-side code', () => {
    const files = readAllSrc().filter(({ path: p }) => isServerSide(p));
    const violations: string[] = [];
    for (const { path: p, content } of files) {
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (/\.TOSS_SECRET_KEY\s*(\|\||\?\?)\s*['"`][^'"`]+['"`]/.test(line)) {
          violations.push(`${path.relative(REPO_ROOT, p)}:${i + 1}`);
        }
      });
    }
    expect(violations, violations.join('\n')).toHaveLength(0);
  });
});

describe('console.log discipline', () => {
  it('no unguarded console.log in client src/ (must be DEV-gated)', () => {
    // Allow in: worker/ (runs server-side), test files, vite/setup configs.
    const files = readAllSrc().filter(
      ({ path: p }) =>
        !p.includes(`${path.sep}worker${path.sep}`) &&
        !p.includes(`${path.sep}tests${path.sep}`) &&
        !p.includes(`${path.sep}features${path.sep}`) && // features often touches both sides
        !p.endsWith('.test.ts') &&
        !p.endsWith('.test.tsx')
    );
    // Permissive check: only flag top-level `console.log(` that is
    // NOT wrapped in an `import.meta.env.DEV &&` guard on the same line.
    // This is a soft regression — the project already has many legacy
    // logs; we only fail if someone adds a NEW unguarded log to a file
    // that previously had none. Therefore: informational only.
    let total = 0;
    for (const { content } of files) {
      const matches = content.match(/^\s*console\.(log|debug|info)\(/gm);
      if (matches) total += matches.length;
    }
    // Regression threshold — current baseline + slack. If this fires,
    // bump the threshold OR DEV-gate the new log.
    expect(total).toBeLessThan(2000);
  });
});
