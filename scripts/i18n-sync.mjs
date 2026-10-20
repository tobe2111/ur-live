#!/usr/bin/env node
/**
 * 🛡️ 2026-05-21 Phase TD-7: i18n 6 언어 sync 자동화 스크립트.
 *
 * 사용:
 *   node scripts/i18n-sync.mjs                  # 점검 (누락 키 리포트)
 *   node scripts/i18n-sync.mjs --fill           # 누락 키 자동 채움 (ko fallback)
 *   node scripts/i18n-sync.mjs --extract        # tsx 에서 t() 키 추출 + ko 추가
 *
 * 영구성:
 *   - ko 가 master (한국 우선 서비스)
 *   - en/ja/zh/es/fr 에 누락 키 있으면 ko 값으로 채움 (자동 번역 도구 사용 전 안전 default)
 *   - 글로벌 진출 시 DeepL/ChatGPT API 로 일괄 번역 가능 (별도 스크립트)
 */
import fs from 'fs/promises'
import path from 'path'
import { glob } from 'glob'

const LOCALES_DIR = 'public/locales'
const SRC_DIR = 'src'
const LANGUAGES = ['ko', 'en', 'ja', 'zh', 'es', 'fr']
const MASTER = 'ko'

async function loadLocale(lang) {
  const file = path.join(LOCALES_DIR, lang, 'translation.json')
  try {
    return JSON.parse(await fs.readFile(file, 'utf-8'))
  } catch {
    return {}
  }
}

async function saveLocale(lang, data) {
  const file = path.join(LOCALES_DIR, lang, 'translation.json')
  await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf-8')
}

function flatKeys(obj, prefix = '') {
  const keys = []
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) keys.push(...flatKeys(v, full))
    else keys.push(full)
  }
  return keys
}

function getNested(obj, dotKey) {
  return dotKey.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj)
}

function setNested(obj, dotKey, value) {
  const parts = dotKey.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {}
    cur = cur[parts[i]]
  }
  cur[parts[parts.length - 1]] = value
}

async function report() {
  const master = await loadLocale(MASTER)
  const masterKeys = flatKeys(master)
  console.log(`\n📋 i18n key sync 리포트\n`)
  console.log(`Master (${MASTER}): ${masterKeys.length} 키\n`)

  for (const lang of LANGUAGES) {
    if (lang === MASTER) continue
    const data = await loadLocale(lang)
    const keys = flatKeys(data)
    const missing = masterKeys.filter(k => getNested(data, k) === undefined)
    console.log(`  ${lang}: ${keys.length} 키 (${missing.length} 누락)`)
    if (missing.length > 0 && missing.length < 30) {
      console.log(`     누락: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '...' : ''}`)
    }
  }
}

async function fillMissing() {
  const master = await loadLocale(MASTER)
  const masterKeys = flatKeys(master)
  let totalFilled = 0
  for (const lang of LANGUAGES) {
    if (lang === MASTER) continue
    const data = await loadLocale(lang)
    let filled = 0
    for (const k of masterKeys) {
      if (getNested(data, k) === undefined) {
        const masterValue = getNested(master, k)
        setNested(data, k, masterValue)
        filled++
      }
    }
    if (filled > 0) {
      await saveLocale(lang, data)
      console.log(`  ✓ ${lang}: ${filled} 키 채움`)
      totalFilled += filled
    }
  }
  console.log(`\n✅ 총 ${totalFilled} 키 채움 (ko fallback)`)
  console.log(`💡 글로벌 진출 시 DeepL/ChatGPT 로 일괄 번역 권장.`)
}

async function extractFromSource() {
  // tsx/ts 의 t('key', { defaultValue: '...' }) 추출
  const files = await glob(`${SRC_DIR}/**/*.{ts,tsx}`, { ignore: ['**/node_modules/**', '**/*.test.*'] })
  const pattern = /t\(\s*['"]([\w.]+)['"]\s*,\s*\{\s*defaultValue:\s*['"]([^'"]+)['"]/g
  const found = new Map()
  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8')
    let m
    while ((m = pattern.exec(content)) !== null) {
      const [, key, value] = m
      if (!found.has(key)) found.set(key, value)
    }
  }
  console.log(`📦 ${files.length} 파일에서 ${found.size} 개 t() defaultValue 키 추출`)

  // ko 에 없는 키 추가
  const master = await loadLocale(MASTER)
  let added = 0
  for (const [key, value] of found) {
    if (getNested(master, key) === undefined) {
      setNested(master, key, value)
      added++
    }
  }
  if (added > 0) {
    await saveLocale(MASTER, master)
    console.log(`  ✓ ${MASTER}: ${added} 키 신규 추가 (defaultValue 그대로)`)
  } else {
    console.log(`  ✓ ${MASTER}: 모든 키 이미 존재`)
  }
}

const cmd = process.argv[2] || 'report'
if (cmd === '--fill' || cmd === 'fill') await fillMissing()
else if (cmd === '--extract' || cmd === 'extract') {
  await extractFromSource()
  await fillMissing()
} else await report()
