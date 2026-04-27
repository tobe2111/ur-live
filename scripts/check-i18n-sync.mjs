#!/usr/bin/env node
/**
 * i18n 동기화 검증 스크립트 (TD-010)
 *
 * - 6개 언어 (ko/en/ja/zh/es/fr) 의 키 일관성 검사
 * - 누락된 키 자동 채우기 (`--fix` 플래그)
 * - 키 채울 때는 ko 의 값을 fallback 으로 사용 (translation 누락 표시)
 *
 * Usage:
 *   node scripts/check-i18n-sync.mjs           # 검사만
 *   node scripts/check-i18n-sync.mjs --fix     # 누락 키 ko 값으로 채우기
 */

import fs from 'node:fs';
import path from 'node:path';

const LANGS = ['ko', 'en', 'ja', 'zh', 'es', 'fr'];
const ROOT = 'public/locales';
const FIX = process.argv.includes('--fix');

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

/** Flatten nested object → { 'a.b.c': value } */
function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

/** Set nested value at dot-path */
function setNested(obj, dotPath, value) {
  const parts = dotPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') {
      cur[parts[i]] = {};
    }
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

const data = {};
for (const lang of LANGS) {
  const file = path.join(ROOT, lang, 'translation.json');
  if (!fs.existsSync(file)) {
    console.error(`❌ Missing: ${file}`);
    process.exit(1);
  }
  data[lang] = { raw: readJSON(file), flat: null };
  data[lang].flat = flatten(data[lang].raw);
}

// ko 를 마스터로 — ko 에 있는 키가 다른 언어에도 있어야 함
const masterKeys = new Set(Object.keys(data.ko.flat));

let totalMissing = 0;
let totalExtra = 0;

for (const lang of LANGS) {
  if (lang === 'ko') continue;
  const flat = data[lang].flat;
  const langKeys = new Set(Object.keys(flat));

  const missing = [...masterKeys].filter((k) => !langKeys.has(k));
  const extra = [...langKeys].filter((k) => !masterKeys.has(k));

  if (missing.length || extra.length) {
    console.log(`\n--- ${lang} ---`);
    if (missing.length) {
      console.log(`❌ Missing ${missing.length} keys (in ko, not in ${lang}):`);
      missing.slice(0, 10).forEach((k) => console.log(`  ${k}`));
      if (missing.length > 10) console.log(`  ... and ${missing.length - 10} more`);
      totalMissing += missing.length;
    }
    if (extra.length) {
      console.log(`⚠️  Extra ${extra.length} keys (in ${lang}, not in ko):`);
      extra.slice(0, 10).forEach((k) => console.log(`  ${k}`));
      if (extra.length > 10) console.log(`  ... and ${extra.length - 10} more`);
      totalExtra += extra.length;
    }

    if (FIX && missing.length) {
      // ko 값을 [TODO:lang] 접두사와 함께 복사 (번역자 식별 가능)
      for (const k of missing) {
        const koVal = data.ko.flat[k];
        if (typeof koVal === 'string') {
          setNested(data[lang].raw, k, `[TODO:${lang}] ${koVal}`);
        } else {
          setNested(data[lang].raw, k, koVal);
        }
      }
      const file = path.join(ROOT, lang, 'translation.json');
      writeJSON(file, data[lang].raw);
      console.log(`✅ Fixed: ${file} (${missing.length} keys added with [TODO:${lang}] prefix)`);
    }
  }
}

console.log(`\n=== Summary ===`);
console.log(`Total missing: ${totalMissing}, Total extra: ${totalExtra}`);
if (totalMissing === 0 && totalExtra === 0) {
  console.log(`✅ All 6 languages in sync.`);
  process.exit(0);
} else if (FIX) {
  console.log(`✅ Fix applied. Re-run without --fix to verify.`);
  process.exit(0);
} else {
  console.log(`Run with --fix to add missing keys (using ko fallback with [TODO:lang] marker).`);
  process.exit(1);
}
