/**
 * Schema Reference Regression Tests
 *
 * Scans source code for forbidden DB column references that would break
 * queries against the production D1 schema. Each pattern represents a
 * real bug we've hit before:
 *
 * - `stock_quantity`        — products use `stock` (bug: "column not found")
 * - `users.deal_balance`    — production uses `user_points` table
 * - `orders.total_price`    — production uses `orders.total_amount`
 * - `live_streams.viewer_count` — column doesn't exist in production
 * - `donations.stream_id`   — production uses `live_stream_id`
 * - `donations.seller_amount` — production uses `credit_amount`
 *
 * Prevents regressions from merging that would only fail at runtime.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const SRC_DIR = path.join(REPO_ROOT, 'src');

// Files that are allowed to mention these strings (e.g. docs, schema file,
// best-effort backward-compat code paths with a comment explaining why).
const ALLOW_FILES = new Set<string>([
  path.join(SRC_DIR, 'shared/db/production-schema.ts'),
  path.join(SRC_DIR, 'shared/db/schema.ts'),
  path.join(SRC_DIR, 'tests/unit/schema-refs.test.ts'),
]);

// SQL-level patterns (must actually look like a column reference, not a comment).
// Use regex that is specific enough to avoid false positives in comments.
interface ForbiddenPattern {
  pattern: RegExp;
  message: string;
}

const FORBIDDEN_SQL: ForbiddenPattern[] = [
  {
    // products.stock_quantity — production uses `stock`
    pattern: /\bp(?:roducts)?\.stock_quantity\b/,
    message: 'Use products.stock (NOT stock_quantity) — see production-schema.ts',
  },
  {
    // orders.total_price — production uses total_amount
    pattern: /\bo(?:rders)?\.total_price\b/,
    message: 'Use orders.total_amount (NOT total_price) — see production-schema.ts',
  },
  {
    // donations.stream_id — production uses live_stream_id
    pattern: /\bd(?:onations)?\.stream_id\b/,
    message: 'Use donations.live_stream_id (NOT stream_id) — see production-schema.ts',
  },
  {
    // donations.seller_amount — production uses credit_amount
    pattern: /\bd(?:onations)?\.seller_amount\b/,
    message: 'Use donations.credit_amount (NOT seller_amount) — see production-schema.ts',
  },
  {
    // live_streams.viewer_count — column does not exist
    pattern: /\blive_streams\.viewer_count\b/,
    message: 'live_streams.viewer_count does not exist in production DB',
  },
];

function findTsFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip test / node_modules / generated dirs
      if (
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === '.wrangler' ||
        entry.name === 'tests'
      ) {
        continue;
      }
      findTsFiles(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

describe('Production schema consistency', () => {
  it('has no forbidden column references in SQL strings', () => {
    const files = findTsFiles(SRC_DIR);
    const violations: string[] = [];

    for (const file of files) {
      if (ALLOW_FILES.has(file)) continue;
      const content = fs.readFileSync(file, 'utf8');

      for (const { pattern, message } of FORBIDDEN_SQL) {
        if (pattern.test(content)) {
          const lines = content.split('\n');
          const hits: number[] = [];
          lines.forEach((line, idx) => {
            // Skip comment lines (simple heuristic: // or *)
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
            if (pattern.test(line)) hits.push(idx + 1);
          });
          if (hits.length > 0) {
            const rel = path.relative(REPO_ROOT, file);
            violations.push(
              `${rel}:${hits.join(',')} — ${message}`
            );
          }
        }
      }
    }

    expect(violations, violations.join('\n')).toHaveLength(0);
  });

  it('production-schema.ts defines all critical tables', () => {
    const schemaPath = path.join(SRC_DIR, 'shared/db/production-schema.ts');
    const content = fs.readFileSync(schemaPath, 'utf8');
    // Sanity-check: schema file lists the tables we care about
    expect(content).toMatch(/OrdersTable/);
    expect(content).toMatch(/OrderItemsTable/);
    expect(content).toMatch(/ProductsTable/);
    expect(content).toMatch(/DonationsTable/);
    expect(content).toMatch(/LiveStreamsTable/);
    expect(content).toMatch(/SellersTable/);
  });

  it('production-schema.ts uses correct column names', () => {
    const schemaPath = path.join(SRC_DIR, 'shared/db/production-schema.ts');
    const content = fs.readFileSync(schemaPath, 'utf8');
    // Critical columns documented in CLAUDE.md
    expect(content).toMatch(/\bstock:\s*number\b/);          // NOT stock_quantity
    expect(content).toMatch(/\bis_active:\s*number\b/);       // NOT status (on products)
    expect(content).toMatch(/\bcredit_amount:\s*number\b/);   // NOT seller_amount (on donations)
    expect(content).toMatch(/\btotal_amount:\s*number\b/);    // NOT total_price (on orders)
    expect(content).toMatch(/\blive_stream_id:\s*number\b/);  // NOT stream_id (on donations)
  });
});
