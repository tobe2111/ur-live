#!/usr/bin/env node
/**
 * 🪦 ur-wholesale 묘비 게이트 (2026-10-12) — `build-prepare.mjs` 끝에서 부른다(= `npm run build` 의 마지막 단계).
 *
 * ur-wholesale Pages 프로젝트는 GitHub 에 **직접 연결**돼 있어서, Cloudflare 가 main push 마다
 * (그리고 모든 브랜치마다 미리보기로) `npm run build` 를 돌려 **소비자 앱 전체를 운영 D1 에 붙여**
 * 배포한다(실측 2026-10-13: production `github:push main` 배포가 매번 있었다). 워크플로에서
 * 묘비를 올려도 다음 main push 가 덮어쓴다.
 *
 * ⇒ 빌드가 **ur-wholesale 프로젝트 안에서 돌 때만** 산출물(`dist/client`)을 묘비 하나로 바꾼다.
 *   판정: Cloudflare Pages 빌더(`CF_PAGES=1`)이고, 배포 주소가 `*.ur-wholesale.pages.dev` 이거나
 *   그 프로젝트에만 있는 환경변수 `WHOLESALE_BUNDLE=1` 이 있을 때. 그 외(ur-live · GitHub Actions ·
 *   로컬)는 아무것도 안 한다.
 *
 * 프로젝트를 대시보드에서 삭제하면 이 파일과 묘비 폴더·워크플로를 함께 지운다.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export function isWholesaleProjectBuild(env = process.env) {
  if (env.CF_PAGES !== '1') return false
  const url = String(env.CF_PAGES_URL || '')
  return /\.ur-wholesale\.pages\.dev\b/.test(url) || env.WHOLESALE_BUNDLE === '1'
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'dist/client')
const TOMB = join(ROOT, 'deploy/ur-wholesale-tombstone/_worker.js')

/** 산출물을 묘비로 바꾼다. ur-wholesale 빌드가 아니면 아무것도 안 하고 false. */
export function runTombstoneGate(env = process.env) {
  if (!isWholesaleProjectBuild(env)) return false
  if (!existsSync(TOMB)) {
    // 앱 사본을 그대로 올리느니 빌드를 실패시킨다
    throw new Error('[tombstone-gate] 묘비 파일이 없다: ' + TOMB)
  }
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })
  cpSync(TOMB, join(OUT, '_worker.js'))
  console.log('[tombstone-gate] ur-wholesale 빌드 — dist/client 를 410 묘비로 교체했다')
  return true
}
