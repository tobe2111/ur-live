#!/usr/bin/env node
/**
 * 🔧 Pages(ur-live) 의 plain_text 설정을 cron 워커(ur-live) 에 시크릿으로 옮긴다 — `.github/workflows/ops-copy-pages-var.yml` 전용.
 * 2026-11-17 대표 영구 위임(*"계속 너한테 무한정 맡기고 싶어. 영구적으로"*)의 첫 장치. 규칙은 워크플로 머리말:
 *   추가·갱신만 · plain_text 만 · 값은 로그에 안 찍음 · 전후 대조.
 * 환경: CLOUDFLARE_API_TOKEN · CLOUDFLARE_ACCOUNT_ID · NAMES("A,B")
 */
import { spawnSync } from 'node:child_process'

const CF = 'https://api.cloudflare.com/client/v4'
const PROJECT = 'ur-live'
const WORKER = 'ur-live'
const { CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: ACC, NAMES = '' } = process.env

export function parseNames(raw) {
  const names = String(raw).split(',').map((s) => s.trim()).filter(Boolean)
  if (names.length === 0) throw new Error('names 가 비었다')
  for (const n of names) if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(n)) throw new Error(`이름 형식이 아니다: ${JSON.stringify(n)}`)
  return [...new Set(names)]
}

/** Pages 설정에서 옮길 값을 고른다 — plain_text 가 아니면(=값을 못 읽으면) 실패. */
export function pickPlainValues(envVars, names) {
  const out = {}
  for (const n of names) {
    const v = envVars?.[n]
    if (!v) throw new Error(`Pages(${PROJECT}) production 에 ${n} 이 없다`)
    if (v.type !== 'plain_text' || typeof v.value !== 'string' || v.value === '') {
      throw new Error(`${n} 은 ${v.type} 라 값을 읽을 수 없다 — 이 워크플로로 옮길 수 없다`)
    }
    out[n] = v.value
  }
  return out
}

async function cf(path) {
  const r = await fetch(`${CF}${path}`, { headers: { Authorization: `Bearer ${TOKEN}` } })
  const j = await r.json()
  if (!j.success) throw new Error(`${path} 실패: ${JSON.stringify(j.errors)}`)
  return j.result
}

async function workerNames() {
  const s = await cf(`/accounts/${ACC}/workers/scripts/${WORKER}/settings`)
  return new Set((s.bindings || []).map((b) => b.name))
}

async function main() {
  if (!TOKEN || !ACC) throw new Error('CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID 가 없다')
  const names = parseNames(NAMES)
  const proj = await cf(`/accounts/${ACC}/pages/projects/${PROJECT}`)
  const values = pickPlainValues(proj?.deployment_configs?.production?.env_vars, names)
  const before = await workerNames()
  for (const n of names) {
    const r = spawnSync('npx', ['--yes', 'wrangler@3', 'secret', 'put', n, `--name=${WORKER}`, '--config=wrangler.toml'], {
      input: values[n], stdio: ['pipe', 'inherit', 'inherit'], env: process.env,
    })
    if (r.status !== 0) throw new Error(`${n} 넣기 실패 (exit ${r.status})`)
  }
  const after = await workerNames()
  for (const n of names) {
    console.log(`${n}: 길이 ${values[n].length} · 전 ${before.has(n) ? '있음' : '없음'} → 후 ${after.has(n) ? '있음' : '없음'}`)
    if (!after.has(n)) throw new Error(`${n} 이 넣은 뒤에도 워커에 없다`)
  }
  console.log(`✅ ${names.length}개 → 워커(${WORKER})`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(`::error::${e.message}`); process.exit(1) })
}
