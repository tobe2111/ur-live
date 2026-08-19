import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { isBlogSeed, isGuideSeed, loadSeedAsset, SEED_ASSET_PATHS } from '@/worker/utils/seed-assets'

const read = (p: string) => readFileSync(p, 'utf8')
/** 주석을 걷어낸 코드만 본다 — "주석에만 남아도 통과"하는 헛도는 가드를 막는다. */
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/**
 * 🌱 시드 산문 외부화 (2026-08-19 — 대표 확정 "지금 배포만 먼저 + 시드 외부화").
 *
 * 배경: 가이드·블로그 한국어 산문 428KB 가 워커 번들에 상주해 Cloudflare 무료 플랜의
 * **압축 1MB** 한도를 밀어 올렸고, 2026-08-19 배포가 82바이트 차이로 실제로 막혔다.
 *
 * ⚠️ 이 테스트가 못 막는 것: 배포된 Pages 에서 `env.ASSETS` 가 실제로 `seed/*.json` 을
 *    돌려주는지. 그건 라이브에서만 확인된다(배포 후 가이드/블로그 화면이 뜨는지가 판정).
 */
describe('시드 산문은 워커 번들에 없다', () => {
  const SEED_MODULES = [
    'src/features/guides/api/guide-seed.ts',
    'src/features/blog/api/blog-seed.ts',
  ]
  // 시드를 **정적 import 든 동적 import 든** 끌어오면 워커 단일 번들에 통째로 들어간다.
  // (옛 주석은 "dynamic import 라 번들에서 제외"라고 적혀 있었지만 사실이 아니었다 —
  //  faq-bot.routes 가 그 오해로 313KB 를 끌고 있었다.)
  const CONSUMERS = [
    'src/features/guides/api/guide.routes.ts',
    'src/features/guides/api/faq-bot.routes.ts',
    'src/features/blog/api/blog.routes.ts',
  ]

  for (const f of CONSUMERS) {
    it(`${f.split('/').pop()} 는 시드 모듈을 import 하지 않는다`, () => {
      const src = code(f)
      expect(src).not.toMatch(/import\(['"]\.\/guide-seed['"]\)/)
      expect(src).not.toMatch(/import\(['"]\.\/blog-seed['"]\)/)
      expect(src).not.toMatch(/from ['"]\.\/guide-seed['"]/)
      expect(src).not.toMatch(/from ['"]\.\/blog-seed['"]/)
    })
  }

  it('시드 모듈 자체는 남아 있다 (빌드 스크립트가 읽는다)', () => {
    for (const f of SEED_MODULES) expect(read(f).length).toBeGreaterThan(1000)
  })

  it('빌드 체인이 시드 자산을 생성한다', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> }
    expect(pkg.scripts['build:worker']).toContain('build-seed-assets')
  })

  it('빌드 스크립트는 빈 시드를 배포하지 않는다', () => {
    // 빈 JSON 이 나가면 워커가 '시드 없음'으로 읽고, 호출부가 버전을 올리면 재시드가 영영 안 돈다.
    const s = code('scripts/build-seed-assets.mjs')
    expect(s).toMatch(/length === 0[\s\S]{0,200}process\.exit\(1\)/)
  })
})

describe('시드를 못 읽으면 버전을 올리지 않는다 (무음 누락 차단)', () => {
  it('블로그: syncBlogSeed 가 false 면 버전 UPDATE 를 건너뛴다', () => {
    const s = code('src/features/blog/api/blog.routes.ts')
    expect(s).toMatch(/const synced = await syncBlogSeed\([\s\S]{0,80}?\)\s*\n\s*if \(!synced\) return/)
  })

  it('가이드: syncGuideSeed 가 false 면 버전 UPDATE 를 건너뛴다', () => {
    const s = code('src/features/guides/api/guide.routes.ts')
    expect(s).toMatch(/const synced = await syncGuideSeed\([\s\S]{0,80}?\)\s*\n\s*if \(!synced\) return/)
  })

  it('가이드 강제 리셋도 시드를 못 읽으면 실패를 알린다(조용히 성공 금지)', () => {
    const s = code('src/features/guides/api/guide.routes.ts')
    expect(s).toMatch(/if \(!GUIDE_SEEDS\) \{[\s\S]{0,200}?503/)
  })
})

describe('로더는 ASSETS 의 함정을 막는다', () => {
  const mkEnv = (body: string, ctype: string, ok = true) => ({
    ASSETS: {
      fetch: async () =>
        new Response(ok ? body : null, {
          status: ok ? 200 : 404,
          headers: { 'content-type': ctype },
        }),
    },
  })

  it('없는 파일에 SPA index.html(200)을 받으면 null — 빈 시드로 오인하지 않는다', async () => {
    // env.ASSETS 는 미존재 파일에 SPA HTML 을 200 으로 준다(워커 /assets/* 핸들러가 겪은 실제 버그).
    const env = mkEnv('<!doctype html><html>…</html>', 'text/html; charset=utf-8')
    expect(await loadSeedAsset(env, SEED_ASSET_PATHS.guides, isGuideSeed)).toBeNull()
  })

  it('content-type 이 JSON 이 아니면 본문이 파싱되더라도 거부한다', async () => {
    // ⚠️ 되돌려-검증 교훈(2026-08-19): 위 HTML 케이스만으로는 **content-type 검사를 지워도 통과**한다
    //   (HTML 본문은 어차피 JSON 파싱에서 실패하므로). 그래서 "파싱은 되는데 타입이 틀린" 응답으로
    //   그 검사만 정면으로 겨눈다 — 이게 없으면 가드가 헛돈다.
    const posts = [{ slug: 'a', title: 't', summary: 's', tags: '', content: 'c' }]
    const env = mkEnv(JSON.stringify(posts), 'text/html; charset=utf-8')
    expect(await loadSeedAsset(env, SEED_ASSET_PATHS.blog, isBlogSeed)).toBeNull()
  })

  it('404 면 null', async () => {
    expect(await loadSeedAsset(mkEnv('', 'application/json', false), SEED_ASSET_PATHS.blog, isBlogSeed)).toBeNull()
  })

  it('ASSETS 바인딩이 없으면 null (throw 하지 않는다)', async () => {
    expect(await loadSeedAsset(undefined, SEED_ASSET_PATHS.blog, isBlogSeed)).toBeNull()
  })

  // 참고: 빈 배열은 `length > 0` 과 `v[0].slug` 검사 **두 경로**로 막힌다 — 한쪽을 지워도 동작은 같다.
  //   그래서 이 항목은 구현이 아니라 **동작**(빈 배열 → null)을 고정한다.
  it('모양이 안 맞으면 null — 빈 배열도 시드로 인정하지 않는다', async () => {
    const env = mkEnv('[]', 'application/json')
    expect(await loadSeedAsset(env, SEED_ASSET_PATHS.blog, isBlogSeed)).toBeNull()
  })

  it('정상 JSON 이면 값을 준다', async () => {
    const posts = [{ slug: 'a', title: 't', summary: 's', tags: '', content: 'c' }]
    const env = mkEnv(JSON.stringify(posts), 'application/json')
    expect(await loadSeedAsset(env, SEED_ASSET_PATHS.blog, isBlogSeed)).toEqual(posts)
  })

  it('모양 검사가 실제 시드 형태를 통과시킨다', () => {
    expect(isBlogSeed([{ slug: 'a', title: 't', summary: 's', tags: '', content: 'c' }])).toBe(true)
    expect(isBlogSeed([])).toBe(false)
    expect(isGuideSeed({ admin: [{ key: 'k', icon: 'i', title: 't', order: 1, content: 'c' }] })).toBe(true)
    expect(isGuideSeed({})).toBe(false)
    expect(isGuideSeed({ admin: [] })).toBe(false)
  })
})
