#!/usr/bin/env node
/**
 * 🌱 시드 산문 → 정적 JSON 자산 (2026-08-19).
 *
 * 가이드·블로그 시드는 한국어 산문 428KB 인데 **시드 버전이 오를 때만** 쓰인다. `.ts` 로 두면
 * 워커 번들에 항상 상주해 Cloudflare 무료 플랜의 압축 1MB 한도를 밀어 올린다(2026-08-19 배포가
 * 실제로 이것 때문에 막혔다). ⇒ 빌드 시 JSON 으로 뽑아 정적 자산으로 서빙한다.
 *
 * 출력: `dist/client/seed/blog.json`, `dist/client/seed/guides.json`
 * 읽는 쪽: `src/worker/utils/seed-assets.ts` (경로 SSOT 는 그 파일의 SEED_ASSET_PATHS)
 *
 * ⚠️ **디렉터리 이름에 밑줄을 쓰지 않는다.** Cloudflare Pages 는 `_worker.js`·`_routes.json`·`_headers`
 *    처럼 밑줄로 시작하는 것을 **설정 파일로 특수 취급**한다. `_seed/` 로 두면 자산으로 안 올라갈 수
 *    있고, 그러면 워커가 영영 못 읽는다 — 게다가 fail-soft 라 **조용히** 시드가 멈춘다.
 *
 * ⚠️ **빈 결과면 실패로 끝낸다.** 빈 JSON 을 배포하면 워커가 그걸 '시드 없음'으로 읽고 지나가는데,
 *    호출부가 버전을 올려 버리면 라이브 문서가 조용히 낡는다. 여기서 막는 게 가장 싸다.
 */
import { build } from 'esbuild'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, 'dist/client/seed')
const TMP = path.join(ROOT, 'node_modules/.cache/seed-assets')

/** 시드 모듈을 번들→import 해서 순수 데이터로 뽑는다(TS 를 그대로 못 import 하므로 한 번 굽는다). */
async function extract(entry, pick) {
  const outfile = path.join(TMP, path.basename(entry).replace(/\.ts$/, '.mjs'))
  await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    outfile,
    alias: { '@': path.join(ROOT, 'src') },
    logLevel: 'silent',
  })
  const mod = await import(`file://${outfile}`)
  return pick(mod)
}

async function main() {
  await mkdir(TMP, { recursive: true })
  await mkdir(OUT_DIR, { recursive: true })

  const blog = await extract(
    path.join(ROOT, 'src/features/blog/api/blog-seed.ts'),
    (m) => m.blogSeedPosts(),
  )
  const guides = await extract(
    path.join(ROOT, 'src/features/guides/api/guide-seed.ts'),
    (m) => m.GUIDE_SEEDS,
  )

  if (!Array.isArray(blog) || blog.length === 0) {
    console.error('❌ blog 시드가 비었다 — 배포하면 라이브 블로그가 조용히 낡는다.')
    process.exit(1)
  }
  const guideRoles = Object.keys(guides || {})
  if (guideRoles.length === 0 || !guideRoles.some((r) => (guides[r] || []).length > 0)) {
    console.error('❌ guide 시드가 비었다 — 배포하면 라이브 가이드가 조용히 낡는다.')
    process.exit(1)
  }

  await writeFile(path.join(OUT_DIR, 'blog.json'), JSON.stringify(blog), 'utf8')
  await writeFile(path.join(OUT_DIR, 'guides.json'), JSON.stringify(guides), 'utf8')
  await rm(TMP, { recursive: true, force: true })

  const kb = (o) => Math.round(Buffer.byteLength(JSON.stringify(o)) / 1024)
  console.log(`✅ 시드 자산 생성 — blog ${blog.length}편(${kb(blog)}KB) · guides ${guideRoles.length}역할(${kb(guides)}KB)`)
}

if (!existsSync(path.join(ROOT, 'dist/client'))) {
  // 클라이언트 빌드보다 먼저 돌면 산출물이 갈 곳이 없다 — 조용히 만들어 두고 진행(순서 바뀌어도 안전).
  await mkdir(path.join(ROOT, 'dist/client'), { recursive: true })
}
main().catch((e) => { console.error('❌ 시드 자산 생성 실패:', e?.message || e); process.exit(1) })
